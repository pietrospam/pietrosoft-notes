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
        clients: 0,
        projects: 0,
        attachments: 0,
        activityLogs: 0,
      };

      const dbDir = entries.some(e => e.entryName.startsWith('db/')) ? path.join(dataPath, 'db') : null;
      if (dbDir) {
        try {
          const { prisma } = await import('@/lib/db');
          // wipe tables
          await prisma.$transaction([
            prisma.taskActivityLog.deleteMany(),
            prisma.attachment.deleteMany(),
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

          const clients = await readJson('clients.json');
          if (clients) {
            await prisma.client.createMany({ data: clients });
            counts.clients = clients.length;
          }
          const projects = await readJson('projects.json');
          if (projects) {
            await prisma.project.createMany({ data: projects });
            counts.projects = projects.length;
          }
          const notes = await readJson('notes.json');
          if (notes) {
            await prisma.note.createMany({ data: notes });
            counts.notes = notes.length;
          }
          const attachments = await readJson('attachments.json');
          if (attachments) {
            // decode base64
            interface AttachmentJson { [key: string]: unknown; data: string; }
            const withBinary = (attachments as AttachmentJson[]).map(a => ({
              ...a,
              data: Buffer.from(a.data, 'base64'),
            }));
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore: input derived from exported JSON and should match schema
            await prisma.attachment.createMany({ data: withBinary });
            counts.attachments = attachments.length;
          }
          const logs = await readJson('activityLogs.json');
          if (logs) {
            await prisma.taskActivityLog.createMany({ data: logs });
            counts.activityLogs = logs.length;
          }
        } catch (err) {
          console.error('DB import error:', err);
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
