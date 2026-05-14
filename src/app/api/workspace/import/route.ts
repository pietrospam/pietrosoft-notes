import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

export const dynamic = 'force-dynamic';

const DATA_DIR = process.env.DATA_DIR || './data';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.endsWith('.zip')) {
      return NextResponse.json({ error: 'File must be a .zip archive' }, { status: 400 });
    }

    // Read zip file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    console.log('Import ZIP entries:', entries.map(e => e.entryName));

    if (entries.length === 0) {
      return NextResponse.json({ error: 'ZIP file is empty' }, { status: 400 });
    }

    // Validate structure - should contain expected folders somewhere in the tree
    const expectedFolders = ['notes', 'clients', 'projects'];
    const foundFolders = new Set<string>();
    
    for (const entry of entries) {
      // split on either forward or back slash to cover different zip creators
      const parts = entry.entryName.split(/[/\\]/).filter(Boolean);
      for (const part of parts) {
        if (expectedFolders.includes(part)) {
          foundFolders.add(part);
        }
      }
    }

    // if there are no legacy folders, accept file as long as it contains
    // any of the new `db/` JSON dumps
    const hasDbDump = entries.some(e => e.entryName.startsWith('db/'));
    if (foundFolders.size === 0 && !hasDbDump) {
      return NextResponse.json({ 
        error: 'Invalid backup file. Expected folders: notes, clients, projects or db/' 
      }, { status: 400 });
    }

    let dataPath = path.resolve(DATA_DIR);

    // try to create data directory if it doesn't exist, handle permission errors
    try {
      await fs.mkdir(dataPath, { recursive: true });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'EACCES' || code === 'EPERM') {
        // cannot write to configured directory, fallback to temp
        const os = await import('os');
        const fallback = path.join(os.tmpdir(), 'pietrosoft-data');
        console.warn(`Permission denied for DATA_DIR ${dataPath}, using fallback ${fallback}`);
        dataPath = fallback;
        try {
          await fs.mkdir(dataPath, { recursive: true });
        } catch (err2) {
          console.error('Fallback data directory creation failed', err2);
          return NextResponse.json({ error: 'Import failed', details: `cannot create data directory (${dataPath})` }, { status: 500 });
        }
      } else {
        // unexpected error
        console.error('Error ensuring data directory', err);
        return NextResponse.json({ error: 'Import failed', details: String(err) }, { status: 500 });
      }
    }

    // Backup existing data (optional - create .backup suffix)
    const backupPath = `${dataPath}.backup-${Date.now()}`;
    try {
      await fs.access(dataPath);
      await fs.rename(dataPath, backupPath);
    } catch {
      // Data directory doesn't exist, that's fine
    }

    // Extract to data directory
    try {
      await fs.mkdir(dataPath, { recursive: true });
      
      for (const entry of entries) {
        const entryPath = path.join(dataPath, entry.entryName);
        
        if (entry.isDirectory) {
          await fs.mkdir(entryPath, { recursive: true });
        } else {
          // Ensure parent directory exists
          await fs.mkdir(path.dirname(entryPath), { recursive: true });
          await fs.writeFile(entryPath, entry.getData());
        }
      }

      // Remove backup on success
      try {
        await fs.rm(backupPath, { recursive: true });
      } catch {
        // Backup might not exist
      }

      // after writing files to data directory, also import database dumps if present
      const counts: Record<string, number> = {
        notes: 0,
        timesheets: 0,
        clients: 0,
        projects: 0,
        attachments: 0,
        activityLogs: 0,
        taskComments: 0,
      };

      const dbDir = entries.some(e => e.entryName.startsWith('db/')) ? path.join(dataPath, 'db') : null;
      if (dbDir) {
        let dbError: unknown = null;
        try {
          const { prisma } = await import('@/lib/db');
          // wipe tables: timesheets must be cleared before notes in case they reference
          // taskId -> notes; otherwise note deletion will fail due to FK constraint.
          await prisma.$transaction([
            prisma.taskComment.deleteMany(),
            prisma.taskActivityLog.deleteMany(),
            prisma.attachment.deleteMany(),
            prisma.timesheet.deleteMany(),
            prisma.note.deleteMany(),
            prisma.project.deleteMany(),
            prisma.client.deleteMany(),
          ]);

          const readJson = async (name: string) => {
            const p = path.join(dataPath, 'db', name);
            try {
              const raw = await fs.readFile(p, 'utf-8');
              return JSON.parse(raw);
            } catch {
              return null;
            }
          };

          // Sanitize data functions - keep only fields that exist in current schema
          const sanitizeClient = (obj: unknown): Record<string, unknown> => {
            if (typeof obj !== 'object' || obj === null) return {};
            const data = obj as Record<string, unknown>;
            const result: Record<string, unknown> = {};
            const validFields = ['id', 'name', 'description', 'color', 'active', 'parentClientId', 'createdAt', 'updatedAt'];
            for (const field of validFields) {
              if (field in data) {
                result[field] = data[field];
              }
            }
            // Convert date strings
            if (typeof result.createdAt === 'string') result.createdAt = new Date(result.createdAt);
            if (typeof result.updatedAt === 'string') result.updatedAt = new Date(result.updatedAt);
            return result;
          };

          const sanitizeProject = (obj: unknown): Record<string, unknown> => {
            if (typeof obj !== 'object' || obj === null) return {};
            const data = obj as Record<string, unknown>;
            const result: Record<string, unknown> = {};
            const validFields = ['id', 'name', 'description', 'clientId', 'createdAt', 'updatedAt'];
            for (const field of validFields) {
              if (field in data) {
                result[field] = data[field];
              }
            }
            if (typeof result.createdAt === 'string') result.createdAt = new Date(result.createdAt);
            if (typeof result.updatedAt === 'string') result.updatedAt = new Date(result.updatedAt);
            return result;
          };

          const sanitizeNote = (obj: unknown): Record<string, unknown> => {
            if (typeof obj !== 'object' || obj === null) return {};
            const data = obj as Record<string, unknown>;
            const result: Record<string, unknown> = {};
            const validFields = ['id', 'type', 'title', 'content', 'projectId', 'clientId', 'archived', 'isFavorite', 'favoriteOrder', 'attachments', 'taskStatus', 'taskPriority', 'taskDueDate', 'connectionUrl', 'connectionUsername', 'connectionCredentials', 'createdAt', 'updatedAt', 'contentJson', 'taskTicketPhaseCode', 'taskShortDescription', 'taskBudgetHours'];
            for (const field of validFields) {
              if (field in data) {
                result[field] = data[field];
              }
            }
            if (typeof result.createdAt === 'string') result.createdAt = new Date(result.createdAt);
            if (typeof result.updatedAt === 'string') result.updatedAt = new Date(result.updatedAt);
            if (typeof result.taskDueDate === 'string') result.taskDueDate = new Date(result.taskDueDate);
            return result;
          };

          const sanitizeTimesheet = (obj: unknown): Record<string, unknown> => {
            if (typeof obj !== 'object' || obj === null) return {};
            const data = obj as Record<string, unknown>;
            const result: Record<string, unknown> = {};
            const validFields = ['id', 'workDate', 'hoursWorked', 'description', 'taskId', 'projectId', 'clientId', 'rate', 'state', 'createdAt', 'updatedAt'];
            for (const field of validFields) {
              if (field in data) {
                result[field] = data[field];
              }
            }
            if (typeof result.createdAt === 'string') result.createdAt = new Date(result.createdAt);
            if (typeof result.updatedAt === 'string') result.updatedAt = new Date(result.updatedAt);
            if (typeof result.workDate === 'string') result.workDate = new Date(result.workDate);
            return result;
          };

          const sanitizeAttachment = (obj: unknown): Record<string, unknown> => {
            if (typeof obj !== 'object' || obj === null) return {};
            const data = obj as Record<string, unknown>;
            const result: Record<string, unknown> = {};
            const validFields = ['id', 'noteId', 'filename', 'mimeType', 'size', 'data', 'createdAt', 'originalName'];
            for (const field of validFields) {
              if (field in data) {
                result[field] = data[field];
              }
            }
            if (typeof result.createdAt === 'string') result.createdAt = new Date(result.createdAt);
            return result;
          };

          const sanitizeActivityLog = (obj: unknown): Record<string, unknown> => {
            if (typeof obj !== 'object' || obj === null) return {};
            const data = obj as Record<string, unknown>;
            const result: Record<string, unknown> = {};
            const validFields = ['id', 'taskId', 'eventType', 'description', 'createdAt'];
            for (const field of validFields) {
              if (field in data) {
                result[field] = data[field];
              }
            }
            if (typeof result.createdAt === 'string') result.createdAt = new Date(result.createdAt);
            return result;
          };

          const sanitizeTaskComment = (obj: unknown): Record<string, unknown> => {
            if (typeof obj !== 'object' || obj === null) return {};
            const data = obj as Record<string, unknown>;
            const result: Record<string, unknown> = {};
            const validFields = ['id', 'taskId', 'author', 'content', 'createdAt'];
            for (const field of validFields) {
              if (field in data) {
                result[field] = data[field];
              }
            }
            if (typeof result.author !== 'string' || !result.author) result.author = 'Imported';
            if (typeof result.createdAt === 'string') result.createdAt = new Date(result.createdAt);
            return result;
          };

          const clients = await readJson('clients.json');
          if (clients) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore: input derived from exported JSON and should match schema
            await prisma.client.createMany({ data: clients.map(sanitizeClient) });
            counts.clients = clients.length;
          }
          const projects = await readJson('projects.json');
          if (projects) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore: input derived from exported JSON and should match schema
            await prisma.project.createMany({ data: projects.map(sanitizeProject) });
            counts.projects = projects.length;
          }
          const notes = await readJson('notes.json');
          if (notes) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore: input derived from exported JSON and should match schema
            await prisma.note.createMany({ data: notes.map(sanitizeNote) });
            counts.notes = notes.length;
          }
          const timesheets = await readJson('timesheets.json');
          if (timesheets) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore: input derived from exported JSON and should match schema
            await prisma.timesheet.createMany({ data: timesheets.map(sanitizeTimesheet) });
            counts.timesheets = timesheets.length;
          }
          const attachments = await readJson('attachments.json');
          if (attachments) {
            // decode base64
            interface AttachmentJson { [key: string]: unknown; data: string; }
            const withBinary = (attachments as AttachmentJson[]).map(a => {
              const sanitized = sanitizeAttachment(a);
              return {
                ...sanitized,
                data: Buffer.from(a.data, 'base64'),
              };
            });
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore: input derived from exported JSON and should match schema
            await prisma.attachment.createMany({ data: withBinary });
            counts.attachments = attachments.length;
          }
          const logs = await readJson('activityLogs.json');
          if (logs) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore: input derived from exported JSON and should match schema
            await prisma.taskActivityLog.createMany({ data: logs.map(sanitizeActivityLog) });
            counts.activityLogs = logs.length;
          }
          const taskComments = await readJson('taskComments.json');
          if (taskComments) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore: input derived from exported JSON and should match schema
            await prisma.taskComment.createMany({ data: taskComments.map(sanitizeTaskComment) });
            counts.taskComments = taskComments.length;
          }
        } catch (err) {
          console.error('DB import error:', err);
          dbError = err;
        }
        if (dbError) {
          // propagate failure to caller so they know import wasn't fully successful
          return NextResponse.json({
            success: false,
            error: 'Database import failed',
            details: String(dbError),
            imported: counts,
          }, { status: 500 });
        }
      }

      // also count existing exported files
      for (const entry of entries) {
        if (entry.isDirectory) continue;
        if (entry.entryName.startsWith('notes/')) counts.notes++;
        if (entry.entryName.startsWith('clients/')) counts.clients++;
        if (entry.entryName.startsWith('projects/')) counts.projects++;
        if (entry.entryName.startsWith('attachments/')) counts.attachments++;
      }

      return NextResponse.json({
        success: true,
        message: 'Workspace imported successfully',
        imported: counts,
      });

    } catch (error) {
      // Restore backup on failure
      try {
        await fs.rm(dataPath, { recursive: true });
        await fs.rename(backupPath, dataPath);
      } catch {
        // Best effort restore
      }
      throw error;
    }

  } catch (error) {
    console.error('Import error:', error);
    // also log entries for context
    try {
      const zip = await (async () => {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        if (file) {
          const buf = Buffer.from(await file.arrayBuffer());
          return new AdmZip(buf);
        }
        return null;
      })();
      if (zip) console.error('Entries at failure:', zip.getEntries().map(e => e.entryName));
    } catch {
      // ignore
    }
    // return error message for debugging
    return NextResponse.json({ error: 'Import failed', details: String(error) }, { status: 500 });
  }
}
