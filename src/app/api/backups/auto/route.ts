import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const BACKUP_DIR = process.env.BACKUP_DIR || './backups';

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

  const now = new Date();
  const [targetHour, targetMinute] = settings.autoBackupTime.split(':').map(Number);
  
  // Check if we're within the backup window (target time ± 30 minutes)
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const targetMinutes = targetHour * 60 + targetMinute;
  const diff = Math.abs(currentMinutes - targetMinutes);
  
  if (diff > 30 && diff < (24 * 60 - 30)) {
    // Not in the backup window
    return false;
  }

  if (!settings.lastAutoBackup) {
    return true;
  }

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
      return NextResponse.json({ 
        skipped: true, 
        reason: 'Auto backup not due yet',
        lastAutoBackup: settings.lastAutoBackup,
        frequency: settings.autoBackupFrequency,
      });
    }

    // Create the backup by calling the main backup endpoint logic
    const { prisma } = await import('@/lib/db');
    const archiver = (await import('archiver')).default;

    // Ensure backup directory exists
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
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
    const [clients, projects, notes, attachments, activityLogs, timesheets, taskComments] = await Promise.all([
      prisma.client.findMany(),
      prisma.project.findMany(),
      prisma.note.findMany(),
      prisma.attachment.findMany(),
      prisma.taskActivityLog.findMany(),
      prisma.timesheet.findMany(),
      prisma.taskComment.findMany(),
    ]);

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
      },
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

    // Encode attachment data to base64
    const attachmentsWithData = attachments.map(a => ({
      ...a,
      data: a.data.toString('base64'),
    }));
    archive.append(JSON.stringify(attachmentsWithData, null, 2), { name: 'db/attachments.json' });

    await archive.finalize();
    const zipBuffer = await finishPromise;

    // Write to file
    await fs.writeFile(filePath, zipBuffer);

    // Update last auto backup time
    settings.lastAutoBackup = new Date().toISOString();
    await writeSettings(settings);

    // Apply retention policy
    await applyRetentionPolicy(settings.retentionCount);

    return NextResponse.json({
      success: true,
      filename,
      sizeBytes: zipBuffer.length,
      stats: manifest.stats,
      type: 'auto',
    });
  } catch (error) {
    console.error('Error creating auto backup:', error);
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
