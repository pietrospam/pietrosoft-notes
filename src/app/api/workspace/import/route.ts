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

    if (entries.length === 0) {
      return NextResponse.json({ error: 'ZIP file is empty' }, { status: 400 });
    }

    // Validate structure - should contain expected folders
    const expectedFolders = ['notes', 'clients', 'projects'];
    const foundFolders = new Set<string>();
    
    for (const entry of entries) {
      const topFolder = entry.entryName.split('/')[0];
      if (expectedFolders.includes(topFolder)) {
        foundFolders.add(topFolder);
      }
    }

    if (foundFolders.size === 0) {
      return NextResponse.json({ 
        error: 'Invalid backup file. Expected folders: notes, clients, projects' 
      }, { status: 400 });
    }

    const dataPath = path.resolve(DATA_DIR);

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

      // Count imported items
      const counts = {
        notes: 0,
        clients: 0,
        projects: 0,
        attachments: 0,
      };

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
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
