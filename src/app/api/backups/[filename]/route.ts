import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';

const BACKUP_DIR = process.env.BACKUP_DIR || './backups';

// GET /api/backups/[filename] - Download a specific backup
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    
    // Validate filename (prevent path traversal)
    if (filename.includes('..') || filename.includes('/') || !filename.endsWith('.zip')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }
    
    const filePath = path.join(BACKUP_DIR, filename);
    
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }
    
    const fileBuffer = await fs.readFile(filePath);
    
    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error downloading backup:', error);
    return NextResponse.json({ error: 'Failed to download backup' }, { status: 500 });
  }
}

// DELETE /api/backups/[filename] - Delete a specific backup
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    
    // Validate filename (prevent path traversal)
    if (filename.includes('..') || filename.includes('/') || !filename.endsWith('.zip')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }
    
    const filePath = path.join(BACKUP_DIR, filename);
    
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }
    
    // Check if backup is protected
    try {
      const zipBuffer = await fs.readFile(filePath);
      const zip = await JSZip.loadAsync(zipBuffer);
      const manifestFile = zip.file('manifest.json');
      
      if (manifestFile) {
        const manifest = JSON.parse(await manifestFile.async('text'));
        if (manifest.protected) {
          return NextResponse.json({ error: 'Cannot delete protected backup' }, { status: 403 });
        }
      }
    } catch {
      // If we can't read manifest, allow deletion
    }
    
    await fs.unlink(filePath);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting backup:', error);
    return NextResponse.json({ error: 'Failed to delete backup' }, { status: 500 });
  }
}

// PATCH /api/backups/[filename] - Update backup metadata (e.g., protect/unprotect)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    
    // Validate filename
    if (filename.includes('..') || filename.includes('/') || !filename.endsWith('.zip')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }
    
    const filePath = path.join(BACKUP_DIR, filename);
    
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }
    
    const body = await request.json();
    
    // Read current ZIP
    const zipBuffer = await fs.readFile(filePath);
    const zip = await JSZip.loadAsync(zipBuffer);
    
    // Read and update manifest
    const manifestFile = zip.file('manifest.json');
    let manifest: Record<string, unknown> = {};
    
    if (manifestFile) {
      manifest = JSON.parse(await manifestFile.async('text'));
    }
    
    // Update allowed fields
    if (typeof body.protected === 'boolean') {
      manifest.protected = body.protected;
    }
    if (typeof body.description === 'string') {
      manifest.description = body.description;
    }
    
    // Update manifest in ZIP
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    
    // Write updated ZIP
    const updatedBuffer = await zip.generateAsync({ 
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    });
    
    await fs.writeFile(filePath, updatedBuffer);
    
    return NextResponse.json({ success: true, manifest });
  } catch (error) {
    console.error('Error updating backup:', error);
    return NextResponse.json({ error: 'Failed to update backup' }, { status: 500 });
  }
}
