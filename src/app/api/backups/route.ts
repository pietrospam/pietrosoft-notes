import { NextRequest, NextResponse } from 'next/server';
import { promises as fs, createWriteStream } from 'fs';
import os from 'os';
import path from 'path';
import JSZip from 'jszip';
import archiver from 'archiver';
import Busboy from 'busboy';
import { Readable } from 'stream';
import { notifyBackupSuccess, notifyBackupError } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const ARGENTINA_TIMEZONE = 'America/Buenos_Aires';
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;

/**
 * Generate timestamp string in Argentina timezone for filenames
 */
function getArgentinaTimestamp(): string {
  const now = new Date();
  const argentinaDate = new Date(now.toLocaleString('en-US', { timeZone: ARGENTINA_TIMEZONE }));
  return `${argentinaDate.getFullYear()}-${String(argentinaDate.getMonth() + 1).padStart(2, '0')}-${String(argentinaDate.getDate()).padStart(2, '0')}T${String(argentinaDate.getHours()).padStart(2, '0')}-${String(argentinaDate.getMinutes()).padStart(2, '0')}-${String(argentinaDate.getSeconds()).padStart(2, '0')}`;
}

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
    taskTodos?: number;
    todoNotificationsSent?: number;
    billingMethods?: number;
    billingRuns?: number;
    billingRunItems?: number;
  };
  taskTodosError?: string;
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

interface BackupSettingsSummary {
  retentionCount: number;
  maxAgeDays: number;
}

interface UploadedBackupPayload {
  tempPath: string;
  originalFilename: string;
  requestedFilename?: string;
  description?: string;
  protected: boolean;
}

function sanitizeBackupFilename(input: string): string {
  const withoutExtension = input.replace(/\.zip$/i, '');
  const normalized = withoutExtension
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');

  return `${normalized || `backup-${getArgentinaTimestamp()}`}.zip`;
}

async function ensureUniqueFilename(filename: string): Promise<string> {
  let candidate = filename;
  let counter = 1;

  while (true) {
    try {
      await fs.access(path.join(BACKUP_DIR, candidate));
      const base = filename.replace(/\.zip$/i, '');
      candidate = `${base}-${counter}.zip`;
      counter += 1;
    } catch {
      return candidate;
    }
  }
}

async function moveFileSafely(sourcePath: string, targetPath: string): Promise<void> {
  try {
    await fs.rename(sourcePath, targetPath);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== 'EXDEV') {
      throw err;
    }
    await fs.copyFile(sourcePath, targetPath);
    await fs.unlink(sourcePath);
  }
}

async function writeMultipartUploadToTempFile(request: NextRequest): Promise<UploadedBackupPayload> {
  const tempPath = path.join(os.tmpdir(), `backup-upload-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`);
  const contentType = request.headers.get('content-type');
  if (!contentType) throw new Error('Missing multipart content type');

  let originalFilename = '';
  let requestedFilename = '';
  let description = '';
  let isProtected = false;

  await new Promise<void>((resolve, reject) => {
    const parser = Busboy({
      headers: { 'content-type': contentType },
      limits: { fileSize: MAX_UPLOAD_BYTES },
    });

    let foundFile = false;
    let output: ReturnType<typeof createWriteStream> | null = null;
    let parserFinished = false;
    let outputFinished = false;

    const complete = () => {
      if (parserFinished && outputFinished) resolve();
    };

    parser.on('field', (fieldname, value) => {
      if (typeof value !== 'string') {
        return;
      }

      if (fieldname === 'filename') requestedFilename = value;
      if (fieldname === 'description') description = value;
      if (fieldname === 'protected') isProtected = value === 'true';
    });

    parser.on('file', (fieldname, stream, info) => {
      if (fieldname !== 'file' || foundFile) {
        stream.resume();
        return;
      }

      foundFile = true;
      originalFilename = info.filename || '';
      output = createWriteStream(tempPath);

      stream.on('limit', () => reject(new Error(`Backup file is too large (maximum ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB)`)));
      stream.on('error', reject);
      output.on('error', reject);
      output.on('close', () => {
        outputFinished = true;
        complete();
      });
      stream.pipe(output);
    });

    parser.on('error', reject);
    parser.on('finish', () => {
      if (!foundFile) {
        reject(new Error('No backup file provided'));
      } else {
        parserFinished = true;
        complete();
      }
    });

    const body = request.body;
    if (!body) {
      reject(new Error('Empty request body'));
      return;
    }

    Readable.fromWeb(body as unknown as import('stream/web').ReadableStream).pipe(parser);
  }).catch(async error => {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  });

  return {
    tempPath,
    originalFilename,
    requestedFilename: requestedFilename || undefined,
    description: description || undefined,
    protected: isProtected,
  };
}

async function handleUploadedBackup(request: NextRequest) {
  const upload = await writeMultipartUploadToTempFile(request);

  try {
    const uploadedFileName = upload.originalFilename || '';
    if (!uploadedFileName.toLowerCase().endsWith('.zip')) {
      return NextResponse.json({ error: 'Backup file must be a .zip' }, { status: 400 });
    }

    const incomingName = upload.requestedFilename || uploadedFileName;

    await fs.mkdir(BACKUP_DIR, { recursive: true });

    const desiredFilename = sanitizeBackupFilename(incomingName);
    const finalFilename = await ensureUniqueFilename(desiredFilename);
    const finalPath = path.join(BACKUP_DIR, finalFilename);

    // Move the uploaded ZIP directly to backups. Re-compressing large files here
    // can take a very long time and makes the UI look stuck at 100%.
    await moveFileSafely(upload.tempPath, finalPath);
    const stat = await fs.stat(finalPath);

    await applyRetentionPolicy();

    return NextResponse.json({
      success: true,
      uploaded: true,
      filename: finalFilename,
      createdAt: stat.mtime.toISOString(),
      sizeBytes: stat.size,
      description: upload.description,
      protected: false,
    });
  } finally {
    await fs.rm(upload.tempPath, { force: true }).catch(() => undefined);
  }
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
async function readBackupSettings(): Promise<BackupSettingsSummary> {
  const settingsPath = path.join(BACKUP_DIR, 'backup-settings.json');
  try {
    const content = await fs.readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(content);
    return {
      retentionCount: settings.retentionCount || 0,
      maxAgeDays: settings.maxAgeDays || 0,
    };
  } catch {
    return { retentionCount: 0, maxAgeDays: 0 }; // 0 = unlimited
  }
}

// Helper: Apply retention policy - delete old non-protected backups
async function applyRetentionPolicy(): Promise<void> {
  try {
    const settings = await readBackupSettings();
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

    const now = Date.now();
    const maxAgeMs = settings.maxAgeDays > 0 ? settings.maxAgeDays * 24 * 60 * 60 * 1000 : 0;
    const deletedFilenames = new Set<string>();

    // Delete backups that are older than the configured age limit first.
    if (maxAgeMs > 0) {
      for (const backup of backupsWithInfo) {
        if (backup.protected) {
          continue;
        }

        const backupAgeMs = now - new Date(backup.date).getTime();
        if (backupAgeMs > maxAgeMs) {
          const filePath = path.join(BACKUP_DIR, backup.filename);
          try {
            await fs.unlink(filePath);
            deletedFilenames.add(backup.filename);
            console.log(`Retention policy: Deleted aged backup ${backup.filename}`);
          } catch (err) {
            console.warn(`Failed to delete aged backup ${backup.filename}:`, err);
          }
        }
      }
    }

    if (settings.retentionCount <= 0) {
      return; // Unlimited count retention, age cleanup already applied
    }

    // Keep track of non-protected backups
    let nonProtectedCount = 0;

    for (const backup of backupsWithInfo) {
      if (deletedFilenames.has(backup.filename)) {
        continue;
      }
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
    const contentType = request.headers.get('content-type') || '';
    if (contentType.startsWith('multipart/form-data')) {
      return await handleUploadedBackup(request);
    }

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
    
    // Generate filename with timestamp in Argentina timezone
    const timestamp = getArgentinaTimestamp();
    const filename = `backup-${timestamp}.zip`;
    const filePath = path.join(BACKUP_DIR, filename);
    
    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    // Export database tables
    const { prisma } = await import('@/lib/db');

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

    // Task todos may not exist in older schemas (missing client_id column), so fallback gracefully.
    let taskTodos: unknown[] = [];
    let taskTodosError: string | undefined;

    try {
      taskTodos = await prisma.taskTodo.findMany();
    } catch (err) {
      console.warn('Failed to fetch taskTodos with Prisma (schema mismatch), falling back to raw SQL:', err);
      taskTodosError = String(err);
      try {
        // Raw query should work even if schema differs; it selects existing columns only
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        taskTodos = await prisma.$queryRawUnsafe('SELECT * FROM task_todos');
      } catch (rawErr) {
        console.error('Fallback raw query for task_todos failed:', rawErr);
      }
    }
    
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
    
    // Encode attachment data to base64
    const attachmentsWithData = attachments.map(a => ({
      ...a,
      data: a.data.toString('base64'),
    }));
    archive.append(JSON.stringify(attachmentsWithData, null, 2), { name: 'db/attachments.json' });
    
    // Billing methods (no binary data)
    archive.append(JSON.stringify(billingMethods, null, 2), { name: 'db/billingMethods.json' });
    
    // Billing runs - encode pdfData (Bytes?) to base64
    const billingRunsWithData = billingRuns.map(r => ({
      ...r,
      pdfData: r.pdfData ? r.pdfData.toString('base64') : null,
    }));
    archive.append(JSON.stringify(billingRunsWithData, null, 2), { name: 'db/billingRuns.json' });
    archive.append(JSON.stringify(billingRunItems, null, 2), { name: 'db/billingRunItems.json' });
    
    // Add data directory if exists
    const dataDir = process.env.WORKSPACE_PATH || process.env.DATA_DIR || './data';
    const telegramConfigPath = path.join(dataDir, 'telegram-config.json');
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

    // Add Telegram configuration if exists
    try {
      const telegramConfigContent = await fs.readFile(telegramConfigPath);
      archive.append(telegramConfigContent, { name: 'config/telegram-config.json' });
    } catch {
      // Telegram config file doesn't exist - that's fine
    }

    // Add backup settings if exists
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

    // Apply retention policy
    await applyRetentionPolicy();

    // Send Telegram notification (async, don't block response)
    notifyBackupSuccess({
      filename,
      sizeBytes,
      type: 'manual',
      filePath,
    }).catch(err => console.error('Telegram notification failed:', err));

    return NextResponse.json({
      success: true,
      filename,
      sizeBytes,
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
