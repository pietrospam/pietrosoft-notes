const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const { PrismaClient } = require('@prisma/client');

const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const DATA_DIR = process.env.WORKSPACE_PATH || process.env.DATA_DIR || './data';
const ARGENTINA_TIMEZONE = 'America/Buenos_Aires';

function getArgentinaTimestamp() {
  const now = new Date();
  const argentinaDate = new Date(now.toLocaleString('en-US', { timeZone: ARGENTINA_TIMEZONE }));
  return `${argentinaDate.getFullYear()}-${String(argentinaDate.getMonth() + 1).padStart(2, '0')}-${String(argentinaDate.getDate()).padStart(2, '0')}T${String(argentinaDate.getHours()).padStart(2, '0')}-${String(argentinaDate.getMinutes()).padStart(2, '0')}-${String(argentinaDate.getSeconds()).padStart(2, '0')}`;
}

async function readBackupSettings() {
  const settingsPath = path.join(BACKUP_DIR, 'backup-settings.json');
  try {
    const content = await fsPromises.readFile(settingsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function addDirectoryToArchive(archive, dirPath, archivePath) {
  const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const entryPath = path.join(archivePath, entry.name);
    if (entry.isDirectory()) {
      await addDirectoryToArchive(archive, fullPath, entryPath);
    } else {
      archive.file(fullPath, { name: entryPath });
    }
  }
}

async function main() {
  try {
    await fsPromises.mkdir(BACKUP_DIR, { recursive: true });

    const prisma = new PrismaClient();
    const [clients, projects, notes, attachments, activityLogs, timesheets, taskComments, billingMethods, billingRuns, billingRunItems, todoNotificationsSent] = await Promise.all([
      prisma.client.findMany(),
      prisma.project.findMany(),
      prisma.note.findMany(),
      prisma.attachment.findMany(),
      prisma.taskActivityLog.findMany(),
      prisma.timesheet.findMany(),
      prisma.taskComment.findMany(),
      prisma.billingMethod.findMany(),
      prisma.billingRun.findMany(),
      prisma.billingRunItem.findMany(),
      prisma.todoNotificationSent.findMany(),
    ]);

    let taskTodos = [];
    let taskTodosError = null;
    try {
      taskTodos = await prisma.taskTodo.findMany();
    } catch (err) {
      taskTodosError = String(err);
      try {
        taskTodos = await prisma.$queryRawUnsafe('SELECT * FROM task_todos');
      } catch (rawErr) {
        taskTodosError = `${taskTodosError}; fallback failed: ${rawErr}`;
      }
    }

    const manifest = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      type: 'manual',
      description: 'Manual backup',
      protected: false,
      stats: {
        notes: notes.length,
        clients: clients.length,
        projects: projects.length,
        attachments: attachments.length,
        timesheets: timesheets.length,
        activityLogs: activityLogs.length,
        taskComments: taskComments.length,
        taskTodos: taskTodos.length,
        todoNotificationsSent: todoNotificationsSent.length,
        billingMethods: billingMethods.length,
        billingRuns: billingRuns.length,
        billingRunItems: billingRunItems.length,
      },
      taskTodosError,
      appVersion: '1.0.0',
    };

    const timestamp = getArgentinaTimestamp();
    const filename = `backup-${timestamp}.zip`;
    const filePath = path.join(BACKUP_DIR, filename);

    const output = fs.createWriteStream(filePath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(output);

    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
    archive.append(JSON.stringify(clients, null, 2), { name: 'db/clients.json' });
    archive.append(JSON.stringify(projects, null, 2), { name: 'db/projects.json' });
    archive.append(JSON.stringify(notes, null, 2), { name: 'db/notes.json' });
    archive.append(JSON.stringify(timesheets, null, 2), { name: 'db/timesheets.json' });
    archive.append(JSON.stringify(activityLogs, null, 2), { name: 'db/activityLogs.json' });
    archive.append(JSON.stringify(taskComments, null, 2), { name: 'db/taskComments.json' });
    archive.append(JSON.stringify(taskTodos, null, 2), { name: 'db/taskTodos.json' });
    archive.append(JSON.stringify(todoNotificationsSent, null, 2), { name: 'db/todoNotificationsSent.json' });
    archive.append(JSON.stringify(billingMethods, null, 2), { name: 'db/billingMethods.json' });
    archive.append(JSON.stringify(billingRunItems, null, 2), { name: 'db/billingRunItems.json' });

    const billingRunsWithData = billingRuns.map((r) => ({
      ...r,
      pdfData: r.pdfData ? Buffer.from(r.pdfData).toString('base64') : null,
    }));
    archive.append(JSON.stringify(billingRunsWithData, null, 2), { name: 'db/billingRuns.json' });

    const attachmentsWithData = attachments.map((a) => ({
      ...a,
      data: a.data ? Buffer.from(a.data).toString('base64') : null,
    }));
    archive.append(JSON.stringify(attachmentsWithData, null, 2), { name: 'db/attachments.json' });

    try {
      await addDirectoryToArchive(archive, DATA_DIR, 'data');
    } catch (_) {
      // ignore if data dir missing
    }

    try {
      const telegramConfigContent = await fsPromises.readFile(path.join(DATA_DIR, 'telegram-config.json'));
      archive.append(telegramConfigContent, { name: 'config/telegram-config.json' });
    } catch (_) {
      // ignore if missing
    }

    try {
      const backupSettingsContent = await fsPromises.readFile(path.join(BACKUP_DIR, 'backup-settings.json'));
      archive.append(backupSettingsContent, { name: 'config/backup-settings.json' });
    } catch (_) {
      // ignore if missing
    }

    await archive.finalize();

    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
      archive.on('error', reject);
    });

    const { size } = await fsPromises.stat(filePath);
    console.log(JSON.stringify({ success: true, filename, sizeBytes: size }));
    process.exit(0);
  } catch (err) {
    console.error('Backup creation failed:', err.stack || err.message || err);
    process.exit(1);
  }
}

main();
