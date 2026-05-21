import { NextResponse } from 'next/server';
import { promises as fs, createWriteStream } from 'fs';
import path from 'path';
import { notifyBackupSuccess, notifyBackupError } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const ARGENTINA_TIMEZONE = 'America/Buenos_Aires';

/**
 * Get current time in Argentina timezone
 */
function getArgentinaTime(): { hours: number; minutes: number } {
  const now = new Date();
  const argentinaTime = new Date(now.toLocaleString('en-US', { timeZone: ARGENTINA_TIMEZONE }));
  return {
    hours: argentinaTime.getHours(),
    minutes: argentinaTime.getMinutes(),
  };
}

interface BackupSettings {
  retentionCount: number;
  autoBackupEnabled: boolean;
  autoBackupFrequency: 'daily' | 'weekly' | 'monthly';
  autoBackupTime: string;
  lastAutoBackup?: string;
}

async function readSettings(): Promise<BackupSettings | null> {
  const settingsPath = path.join(BACKUP_DIR, 'backup-settings.json');
  try {
    const content = await fs.readFile(settingsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function writeSettings(settings: BackupSettings): Promise<void> {
  const settingsPath = path.join(BACKUP_DIR, 'backup-settings.json');
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
}

function shouldRunAutoBackup(settings: BackupSettings): boolean {
  if (!settings.autoBackupEnabled) {
    return false;
  }

  // Use Argentina timezone for time comparison
  const argentinaTime = getArgentinaTime();
  const [targetHour, targetMinute] = settings.autoBackupTime.split(':').map(Number);
  
  // Check if we're within the backup window (from target time to 5 minutes after)
  // Never run before the scheduled time
  const currentMinutes = argentinaTime.hours * 60 + argentinaTime.minutes;
  const targetMinutes = targetHour * 60 + targetMinute;
  
  // Calculate minutes since target time (handling midnight wraparound)
  let minutesSinceTarget = currentMinutes - targetMinutes;
  if (minutesSinceTarget < -60) {
    // We're before midnight and target is after (e.g., current 23:30, target 00:00)
    minutesSinceTarget += 24 * 60;
  } else if (minutesSinceTarget > 23 * 60) {
    // We're after midnight and target was before (e.g., current 00:02, target 23:58)
    minutesSinceTarget -= 24 * 60;
  }
  
  // Only run if we're at or after the target time, within 5-minute window
  if (minutesSinceTarget < 0 || minutesSinceTarget > 5) {
    return false;
  }

  if (!settings.lastAutoBackup) {
    return true;
  }

  const now = new Date();
  const lastBackup = new Date(settings.lastAutoBackup);
  const hoursSinceLastBackup = (now.getTime() - lastBackup.getTime()) / (1000 * 60 * 60);

  switch (settings.autoBackupFrequency) {
    case 'daily':
      return hoursSinceLastBackup >= 23; // At least 23 hours since last backup
    case 'weekly':
      return hoursSinceLastBackup >= 167; // At least ~7 days
    case 'monthly':
      return hoursSinceLastBackup >= 719; // At least ~30 days
    default:
      return false;
  }
}

// POST /api/backups/auto - Create automatic backup (called by cron or internal check)
export async function POST() {
  try {
    const settings = await readSettings();
    
    if (!settings) {
      return NextResponse.json({ 
        skipped: true, 
        reason: 'No backup settings found' 
      });
    }

    if (!shouldRunAutoBackup(settings)) {
      const argentinaTime = getArgentinaTime();
      return NextResponse.json({ 
        skipped: true, 
        reason: 'Auto backup not due yet',
        currentArgentinaTime: `${String(argentinaTime.hours).padStart(2, '0')}:${String(argentinaTime.minutes).padStart(2, '0')}`,
        targetTime: settings.autoBackupTime,
        lastAutoBackup: settings.lastAutoBackup,
        frequency: settings.autoBackupFrequency,
      });
    }

    // Create the backup by calling the main backup endpoint logic
    const { prisma } = await import('@/lib/db');
    const archiver = (await import('archiver')).default;

    // Ensure backup directory exists
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    // Generate filename with timestamp in Argentina timezone
    const now = new Date();
    const argentinaDate = new Date(now.toLocaleString('en-US', { timeZone: ARGENTINA_TIMEZONE }));
    const timestamp = `${argentinaDate.getFullYear()}-${String(argentinaDate.getMonth() + 1).padStart(2, '0')}-${String(argentinaDate.getDate()).padStart(2, '0')}T${String(argentinaDate.getHours()).padStart(2, '0')}-${String(argentinaDate.getMinutes()).padStart(2, '0')}-${String(argentinaDate.getSeconds()).padStart(2, '0')}`;
    const filename = `backup-auto-${timestamp}.zip`;
    const filePath = path.join(BACKUP_DIR, filename);

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk) => chunks.push(chunk));

    const finishPromise = new Promise<Buffer>((resolve, reject) => {
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);
    });

    // Export database tables
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

    // Task todos may not exist in older DB schemas (missing client_id column), so fall back safely
    let taskTodos = [] as unknown[];
    let taskTodosError: string | null = null;

    try {
      taskTodos = await prisma.taskTodo.findMany();
    } catch (err) {
      console.warn('Failed to fetch taskTodos with Prisma (schema mismatch), falling back to raw SQL:', err);
      taskTodosError = String(err);
      try {
        // Raw query should work even if schema differs; it selects whatever columns exist
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        taskTodos = await prisma.$queryRawUnsafe('SELECT * FROM task_todos');
      } catch (rawErr) {
        console.error('Fallback raw query for task_todos failed:', rawErr);
      }
    }

    // Create manifest
    const manifest = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      type: 'auto' as const,
      description: `Automatic ${settings.autoBackupFrequency} backup`,
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

    // Add manifest first
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    // Add database tables
    archive.append(JSON.stringify(clients, null, 2), { name: 'db/clients.json' });
    archive.append(JSON.stringify(projects, null, 2), { name: 'db/projects.json' });
    archive.append(JSON.stringify(notes, null, 2), { name: 'db/notes.json' });
    archive.append(JSON.stringify(timesheets, null, 2), { name: 'db/timesheets.json' });
    archive.append(JSON.stringify(activityLogs, null, 2), { name: 'db/activityLogs.json' });
    archive.append(JSON.stringify(taskComments, null, 2), { name: 'db/taskComments.json' });
    archive.append(JSON.stringify(taskTodos, null, 2), { name: 'db/taskTodos.json' });
    archive.append(JSON.stringify(todoNotificationsSent, null, 2), { name: 'db/todoNotificationsSent.json' });
    archive.append(JSON.stringify(billingMethods, null, 2), { name: 'db/billingMethods.json' });

    const billingRunsWithData = billingRuns.map(r => ({
      ...r,
      pdfData: r.pdfData ? r.pdfData.toString('base64') : null,
    }));
    archive.append(JSON.stringify(billingRunsWithData, null, 2), { name: 'db/billingRuns.json' });
    archive.append(JSON.stringify(billingRunItems, null, 2), { name: 'db/billingRunItems.json' });

    // Encode attachment data to base64
    const attachmentsWithData = attachments.map(a => ({
      ...a,
      data: a.data.toString('base64'),
    }));
    archive.append(JSON.stringify(attachmentsWithData, null, 2), { name: 'db/attachments.json' });

    // Add data directory if exists (telegram config, etc)
    const dataDir = process.env.WORKSPACE_PATH || process.env.DATA_DIR || './data';
    const telegramConfigPath = path.join(dataDir, 'telegram-config.json');
    try {
      const addDirectory = async (dirPath: string, archivePath: string): Promise<void> => {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          const archiveEntryPath = path.join(archivePath, entry.name);
          
          if (entry.isDirectory()) {
            await addDirectory(fullPath, archiveEntryPath);
          } else {
            const content = await fs.readFile(fullPath);
            archive.append(content, { name: archiveEntryPath });
          }
        }
      };
      
      await addDirectory(dataDir, 'data');
    } catch {
      // Data directory doesn't exist - that's fine
    }

    // Add Telegram configuration if exists
    try {
      const telegramConfigContent = await fs.readFile(telegramConfigPath);
      archive.append(telegramConfigContent, { name: 'config/telegram-config.json' });
    } catch {
      // Telegram config file doesn't exist - that's fine
    }

    // Add backup settings
    const backupSettingsPath = path.join(BACKUP_DIR, 'backup-settings.json');
    try {
      const settingsContent = await fs.readFile(backupSettingsPath);
      archive.append(settingsContent, { name: 'config/backup-settings.json' });
    } catch {
      // Settings file doesn't exist - that's fine
    }

    const output = createWriteStream(filePath);
    archive.pipe(output);

    const finishPromise = new Promise<void>((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
      archive.on('error', reject);
    });

    await archive.finalize();
    await finishPromise;

    const fileStat = await fs.stat(filePath);
    const sizeBytes = fileStat.size;

    // Update last auto backup time
    settings.lastAutoBackup = new Date().toISOString();
    await writeSettings(settings);

    // Apply retention policy
    await applyRetentionPolicy(settings.retentionCount);

    // Send Telegram notification (async, don't block response)
    notifyBackupSuccess({
      filename,
      sizeBytes,
      type: 'auto',
      filePath,
    }).catch(err => console.error('Telegram notification failed:', err));

    return NextResponse.json({
      success: true,
      filename,
      sizeBytes,
      stats: manifest.stats,
      type: 'auto',
    });
  } catch (error) {
    console.error('Error creating auto backup:', error);
    
    // Send error notification (async)
    notifyBackupError({
      type: 'auto',
      error: error instanceof Error ? error.message : 'Unknown error',
    }).catch(err => console.error('Telegram error notification failed:', err));
    
    return NextResponse.json({ error: 'Failed to create auto backup' }, { status: 500 });
  }
}

// GET /api/backups/auto - Check if auto backup is due (can be called periodically)
export async function GET() {
  try {
    const settings = await readSettings();
    
    if (!settings) {
      return NextResponse.json({ 
        enabled: false,
        reason: 'No settings configured',
      });
    }

    const isDue = shouldRunAutoBackup(settings);

    return NextResponse.json({
      enabled: settings.autoBackupEnabled,
      frequency: settings.autoBackupFrequency,
      scheduledTime: settings.autoBackupTime,
      lastAutoBackup: settings.lastAutoBackup,
      isDue,
    });
  } catch (error) {
    console.error('Error checking auto backup status:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}

// Helper: Apply retention policy
async function applyRetentionPolicy(retentionCount: number): Promise<void> {
  if (retentionCount <= 0) return;

  try {
    const JSZip = (await import('jszip')).default;
    const files = await fs.readdir(BACKUP_DIR);
    const zipFiles = files.filter(f => f.endsWith('.zip'));

    const backupsWithInfo: Array<{ filename: string; date: string; protected: boolean }> = [];

    for (const filename of zipFiles) {
      const filePath = path.join(BACKUP_DIR, filename);
      try {
        const zipBuffer = await fs.readFile(filePath);
        const zip = await JSZip.loadAsync(zipBuffer);
        const manifestFile = zip.file('manifest.json');
        
        if (manifestFile) {
          const content = await manifestFile.async('text');
          const manifest = JSON.parse(content);
          backupsWithInfo.push({
            filename,
            date: manifest.createdAt || new Date().toISOString(),
            protected: manifest.protected || false,
          });
        } else {
          backupsWithInfo.push({
            filename,
            date: new Date().toISOString(),
            protected: false,
          });
        }
      } catch {
        backupsWithInfo.push({
          filename,
          date: new Date().toISOString(),
          protected: false,
        });
      }
    }

    // Sort by date descending
    backupsWithInfo.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    let nonProtectedCount = 0;
    for (const backup of backupsWithInfo) {
      if (backup.protected) continue;
      nonProtectedCount++;

      if (nonProtectedCount > retentionCount) {
        const filePath = path.join(BACKUP_DIR, backup.filename);
        try {
          await fs.unlink(filePath);
          console.log(`Retention: Deleted ${backup.filename}`);
        } catch (err) {
          console.warn(`Failed to delete ${backup.filename}:`, err);
        }
      }
    }
  } catch (err) {
    console.warn('Retention policy error:', err);
  }
}
