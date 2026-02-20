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
    try {
      await fs.access(dataPath);
    } catch {
      return NextResponse.json({ error: 'Data directory not found' }, { status: 404 });
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

    await addDirectory(dataPath, '');
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
