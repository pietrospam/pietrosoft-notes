import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';

const BACKUP_DIR = process.env.BACKUP_DIR || './backups';

interface RouteParams {
  params: Promise<{ filename: string }>;
}

// POST /api/backups/[filename]/restore - Restore from a backup
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { filename } = await params;
    
    // Validate filename (prevent path traversal)
    if (filename.includes('..') || filename.includes('/') || !filename.endsWith('.zip')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }
    
    const filePath = path.join(BACKUP_DIR, filename);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }
    
    // Read ZIP file
    const zipBuffer = await fs.readFile(filePath);
    const zip = await JSZip.loadAsync(zipBuffer);
    
    // Helper to read JSON from ZIP
    const readJson = async (name: string): Promise<unknown[] | null> => {
      const file = zip.file(name);
      if (!file) return null;
      
      try {
        const content = await file.async('text');
        return JSON.parse(content);
      } catch (err) {
        console.warn(`Failed to parse ${name}:`, err);
        return null;
      }
    };
    
    // Import to database
    const { prisma } = await import('@/lib/db');
    
    const counts: Record<string, number> = {
      clients: 0,
      projects: 0,
      notes: 0,
      timesheets: 0,
      attachments: 0,
      activityLogs: 0,
      taskComments: 0,
      billingMethods: 0,
      billingRuns: 0,
      billingRunItems: 0,
      todoNotificationsSent: 0,
    };
    
    // Delete existing data in correct order (respecting FK constraints)
    await prisma.$transaction([
      prisma.todoNotificationSent.deleteMany(),
      prisma.billingRun.deleteMany(),
      prisma.billingMethod.deleteMany(),
      prisma.taskComment.deleteMany(),
      prisma.taskActivityLog.deleteMany(),
      prisma.attachment.deleteMany(),
      prisma.timesheet.deleteMany(),
      prisma.note.deleteMany(),
      prisma.project.deleteMany(),
      prisma.client.deleteMany(),
    ]);
    
    // Import in correct order (parents before children)
    const clients = await readJson('db/clients.json');
    if (clients && Array.isArray(clients)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.client.createMany({ data: clients as any });
      counts.clients = clients.length;
    }
    
    const projects = await readJson('db/projects.json');
    if (projects && Array.isArray(projects)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.project.createMany({ data: projects as any });
      counts.projects = projects.length;
    }
    
    const notes = await readJson('db/notes.json');
    if (notes && Array.isArray(notes)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.note.createMany({ data: notes as any });
      counts.notes = notes.length;
    }
    
    const timesheets = await readJson('db/timesheets.json');
    if (timesheets && Array.isArray(timesheets)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.timesheet.createMany({ data: timesheets as any });
      counts.timesheets = timesheets.length;
    }
    
    const attachments = await readJson('db/attachments.json');
    if (attachments && Array.isArray(attachments)) {
      // Decode base64 data back to Buffer
      interface AttachmentJson { [key: string]: unknown; data: string; }
      const withBinary = (attachments as AttachmentJson[]).map(a => ({
        ...a,
        data: Buffer.from(a.data, 'base64'),
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.attachment.createMany({ data: withBinary as any });
      counts.attachments = attachments.length;
    }
    
    const activityLogs = await readJson('db/activityLogs.json');
    if (activityLogs && Array.isArray(activityLogs)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.taskActivityLog.createMany({ data: activityLogs as any });
      counts.activityLogs = activityLogs.length;
    }
    
    const taskComments = await readJson('db/taskComments.json');
    if (taskComments && Array.isArray(taskComments)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.taskComment.createMany({ data: taskComments as any });
      counts.taskComments = taskComments.length;
    }

    const todoNotificationsSent = await readJson('db/todoNotificationsSent.json');
    if (todoNotificationsSent && Array.isArray(todoNotificationsSent)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.todoNotificationSent.createMany({ data: todoNotificationsSent as any });
      counts.todoNotificationsSent = todoNotificationsSent.length;
    }
    
    // Restore billing methods
    const billingMethods = await readJson('db/billingMethods.json');
    if (billingMethods && Array.isArray(billingMethods)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.billingMethod.createMany({ data: billingMethods as any });
      counts.billingMethods = billingMethods.length;
    }
    
    // Restore billing runs - decode pdfData from base64
    const billingRuns = await readJson('db/billingRuns.json');
    if (billingRuns && Array.isArray(billingRuns)) {
      interface BillingRunJson { [key: string]: unknown; pdfData: string | null; }
      const withBinary = (billingRuns as BillingRunJson[]).map(r => ({
        ...r,
        pdfData: r.pdfData ? Buffer.from(r.pdfData, 'base64') : null,
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.billingRun.createMany({ data: withBinary as any });
      counts.billingRuns = billingRuns.length;
    }

    const billingRunItems = await readJson('db/billingRunItems.json');
    if (billingRunItems && Array.isArray(billingRunItems)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.billingRunItem.createMany({ data: billingRunItems as any });
      counts.billingRunItems = billingRunItems.length;
    }
    
    // Optionally restore data directory files
    const dataDir = process.env.WORKSPACE_PATH || './data';
    const dataFolders = ['notes', 'clients', 'projects', 'attachments'];
    
    // Restore config files, if present
    const telegramConfigFile = zip.file('config/telegram-config.json');
    if (telegramConfigFile) {
      const telegramConfigBuffer = await telegramConfigFile.async('nodebuffer');
      const telegramConfigPath = process.env.WORKSPACE_PATH
        ? path.join(process.env.WORKSPACE_PATH, 'telegram-config.json')
        : path.join(process.env.DATA_DIR || './data', 'telegram-config.json');
      await fs.mkdir(path.dirname(telegramConfigPath), { recursive: true });
      await fs.writeFile(telegramConfigPath, telegramConfigBuffer);
    }

    const backupSettingsFile = zip.file('config/backup-settings.json');
    if (backupSettingsFile) {
      const backupSettingsBuffer = await backupSettingsFile.async('nodebuffer');
      const backupSettingsPath = path.join(BACKUP_DIR, 'backup-settings.json');
      await fs.writeFile(backupSettingsPath, backupSettingsBuffer);
    }

    let filesRestored = 0;
    for (const folder of dataFolders) {
      const prefix = `data/${folder}/`;
      const files = Object.keys(zip.files).filter(name => 
        name.startsWith(prefix) && !name.endsWith('/')
      );
      
      for (const fileName of files) {
        const file = zip.file(fileName);
        if (!file) continue;
        
        const content = await file.async('nodebuffer');
        const targetPath = path.join(dataDir, fileName.replace('data/', ''));
        
        // Ensure directory exists
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, content);
        filesRestored++;
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Backup restored successfully',
      restored: counts,
      filesRestored,
    });
  } catch (error) {
    console.error('Error restoring backup:', error);
    return NextResponse.json({ 
      error: 'Failed to restore backup',
      details: String(error),
    }, { status: 500 });
  }
}
