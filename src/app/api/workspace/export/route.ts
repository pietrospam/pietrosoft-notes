import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import archiver from 'archiver';

export const dynamic = 'force-dynamic';

const DATA_DIR = process.env.DATA_DIR || './data';

export async function GET() {
  try {
    // Create a zip archive in memory
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk) => chunks.push(chunk));
    
    const finishPromise = new Promise<Buffer>((resolve, reject) => {
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);
    });

    // Add all files from data directory recursively
    const dataPath = path.resolve(DATA_DIR);
    
    // Check if data directory exists
    let hasDataDir = true;
    try {
      await fs.access(dataPath);
    } catch {
      hasDataDir = false;
    }

    // Helper to recursively add files
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

    if (hasDataDir) {
      await addDirectory(dataPath, 'data');
    }

    // Additionally export database tables to JSON
    try {
      const { prisma } = await import('@/lib/db');
      const clients = await prisma.client.findMany();
      const projects = await prisma.project.findMany();
      const notes = await prisma.note.findMany();
      const attachments = await prisma.attachment.findMany();
      const activityLogs = await prisma.taskActivityLog.findMany();

      archive.append(JSON.stringify(clients), { name: 'db/clients.json' });
      archive.append(JSON.stringify(projects), { name: 'db/projects.json' });
      archive.append(JSON.stringify(notes), { name: 'db/notes.json' });

      // encode attachment data to base64 to make JSON-safe
      const attachmentsWithData = attachments.map(a => ({
        ...a,
        data: a.data.toString('base64'),
      }));
      archive.append(JSON.stringify(attachmentsWithData), { name: 'db/attachments.json' });
      archive.append(JSON.stringify(activityLogs), { name: 'db/activityLogs.json' });
    } catch (err) {
      console.warn('Failed to include database export:', err);
    }
    await archive.finalize();
    
    const zipBuffer = await finishPromise;

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `pietrosoft-notes-backup-${timestamp}.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
