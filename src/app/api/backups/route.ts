import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import JSZip from 'jszip';
import archiver from 'archiver';
import { notifyBackupSuccess, notifyBackupError } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

const BACKUP_DIR = process.env.BACKUP_DIR || './backups';

interface BackupManifest {
  version: string;
  createdAt: string;
  type: 'auto' | 'manual';
  description?: string;
  protected: boolean;
  stats: {
    notes: number;
    clients: number;
    projects: number;
    attachments: number;
    timesheets: number;
    activityLogs: number;
    taskComments?: number;
  };
  appVersion: string;
}

interface BackupMetadata {
  filename: string;
  createdAt: string;
  sizeBytes: number;
  type: 'auto' | 'manual';
  description?: string;
  protected: boolean;
  stats?: BackupManifest['stats'];
}

// Helper: Read manifest from ZIP without extracting
async function readBackupManifest(zipPath: string): Promise<Partial<BackupManifest> | null> {
  try {
    const zipBuffer = await fs.readFile(zipPath);
    const zip = await JSZip.loadAsync(zipBuffer);
    
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
      return null;
    }
    
    const manifestContent = await manifestFile.async('text');
    return JSON.parse(manifestContent);
  } catch (err) {
    console.warn('Failed to read manifest from', zipPath, err);
    return null;
  }
}

// Helper: Extract date from filename (backup-YYYY-MM-DD-HH-mm-ss.zip)
function extractDateFromFilename(filename: string): string {
  const match = filename.match(/backup-(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})/);
  if (match) {
    const parts = match[1].split('-');
    // YYYY-MM-DD-HH-mm-ss -> ISO date
    return `${parts[0]}-${parts[1]}-${parts[2]}T${parts[3]}:${parts[4]}:${parts[5]}.000Z`;
  }
  return new Date().toISOString();
}

// Helper: Read backup settings
async function readBackupSettings(): Promise<{ retentionCount: number }> {
  const settingsPath = path.join(BACKUP_DIR, 'backup-settings.json');
  try {
    const content = await fs.readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(content);
    return { retentionCount: settings.retentionCount || 0 };
  } catch {
    return { retentionCount: 0 }; // 0 = unlimited
  }
}

// Helper: Apply retention policy - delete old non-protected backups
async function applyRetentionPolicy(): Promise<void> {
  try {
    const settings = await readBackupSettings();
    if (settings.retentionCount <= 0) {
      return; // Unlimited retention
    }
    
    const files = await fs.readdir(BACKUP_DIR);
    const zipFiles = files.filter(f => f.endsWith('.zip'));
    
    // Get backup info with protection status
    const backupsWithInfo: Array<{ filename: string; date: string; protected: boolean }> = [];
    
    for (const filename of zipFiles) {
      const filePath = path.join(BACKUP_DIR, filename);
      const manifest = await readBackupManifest(filePath);
      backupsWithInfo.push({
        filename,
        date: manifest?.createdAt || extractDateFromFilename(filename),
        protected: manifest?.protected || false,
      });
    }
    
    // Sort by date descending (newest first)
    backupsWithInfo.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    // Keep track of non-protected backups
    let nonProtectedCount = 0;
    
    for (const backup of backupsWithInfo) {
      if (backup.protected) {
        continue; // Never delete protected backups
      }
      
      nonProtectedCount++;
      
      if (nonProtectedCount > settings.retentionCount) {
        // Delete this backup
        const filePath = path.join(BACKUP_DIR, backup.filename);
        try {
          await fs.unlink(filePath);
          console.log(`Retention policy: Deleted old backup ${backup.filename}`);
        } catch (err) {
          console.warn(`Failed to delete old backup ${backup.filename}:`, err);
        }
      }
    }
  } catch (err) {
    console.warn('Failed to apply retention policy:', err);
  }
}

// GET /api/backups - List all backups
export async function GET() {
  try {
    // Ensure backup directory exists
    try {
      await fs.access(BACKUP_DIR);
    } catch {
      await fs.mkdir(BACKUP_DIR, { recursive: true });
      return NextResponse.json([]);
    }
    
    const files = await fs.readdir(BACKUP_DIR);
    const zipFiles = files.filter(f => f.endsWith('.zip'));
    
    const backups: BackupMetadata[] = [];
    
    for (const filename of zipFiles) {
      const filePath = path.join(BACKUP_DIR, filename);
      try {
        const stat = await fs.stat(filePath);
        const manifest = await readBackupManifest(filePath);
        
        backups.push({
          filename,
          createdAt: manifest?.createdAt || extractDateFromFilename(filename),
          sizeBytes: stat.size,
          type: manifest?.type || 'manual',
          description: manifest?.description,
          protected: manifest?.protected || false,
          stats: manifest?.stats,
        });
      } catch (err) {
        console.warn('Failed to read backup', filename, err);
        // Include with basic info from filesystem
        try {
          const stat = await fs.stat(filePath);
          backups.push({
            filename,
            createdAt: extractDateFromFilename(filename),
            sizeBytes: stat.size,
            type: 'manual',
            protected: false,
          });
        } catch {
          // Skip this file
        }
      }
    }
    
    // Sort by date descending (most recent first)
    backups.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    return NextResponse.json(backups);
  } catch (error) {
    console.error('Error listing backups:', error);
    return NextResponse.json({ error: 'Failed to list backups' }, { status: 500 });
  }
}

// POST /api/backups - Create a new backup
export async function POST(request: NextRequest) {
  try {
    // Parse request body for optional description
    let description: string | undefined;
    let isProtected = false;
    
    try {
      const body = await request.json();
      description = body.description;
      isProtected = body.protected || false;
    } catch {
      // No body or invalid JSON - that's fine
    }
    
    // Ensure backup directory exists
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `backup-${timestamp}.zip`;
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
    const { prisma } = await import('@/lib/db');
    
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
    const manifest: BackupManifest = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      type: 'manual',
      description,
      protected: isProtected,
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
    
    // Add data directory if exists
    const dataDir = process.env.DATA_DIR || './data';
    try {
      await fs.access(dataDir);
      
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
    
    await archive.finalize();
    const zipBuffer = await finishPromise;
    
    // Write to file
    await fs.writeFile(filePath, zipBuffer);
    
    // Apply retention policy
    await applyRetentionPolicy();

    // Send Telegram notification (async, don't block response)
    notifyBackupSuccess({
      filename,
      sizeBytes: zipBuffer.length,
      type: 'manual',
      filePath,
    }).catch(err => console.error('Telegram notification failed:', err));

    return NextResponse.json({
      success: true,
      filename,
      sizeBytes: zipBuffer.length,
      stats: manifest.stats,
    });
  } catch (error) {
    console.error('Error creating backup:', error);
    
    // Send error notification (async)
    notifyBackupError({
      type: 'manual',
      error: error instanceof Error ? error.message : 'Unknown error',
    }).catch(err => console.error('Telegram error notification failed:', err));
    
    return NextResponse.json({ error: 'Failed to create backup' }, { status: 500 });
  }
}
