import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import { PATHS, generateId, ensureWorkspaceDirectories } from '@/lib/storage/file-storage';
import { getNote, updateNote } from '@/lib/repositories/notes-repo';
import type { AttachmentMeta } from '@/lib/types';

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 100);
}

export async function POST(request: NextRequest) {
  try {
    await ensureWorkspaceDirectories();
    
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const noteId = formData.get('noteId') as string | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    if (!noteId) {
      return NextResponse.json({ error: 'No noteId provided' }, { status: 400 });
    }
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }
    
    // Verify note exists
    const note = await getNote(noteId);
    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }
    
    // Generate attachment metadata
    const id = generateId();
    const sanitizedName = sanitizeFilename(file.name);
    const filename = `${id}-${sanitizedName}`;
    
    const attachment: AttachmentMeta = {
      id,
      filename,
      originalName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      createdAt: new Date().toISOString(),
    };
    
    // Save file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = PATHS.attachment(filename);
    await fs.writeFile(filePath, buffer);
    
    // Update note's attachments array
    const updatedAttachments = [...note.attachments, attachment];
    await updateNote(noteId, { attachments: updatedAttachments });
    
    return NextResponse.json({
      ...attachment,
      url: `/api/attachments/${id}`,
    }, { status: 201 });
    
  } catch (error) {
    console.error('Error uploading attachment:', error);
    return NextResponse.json({ error: 'Failed to upload attachment' }, { status: 500 });
  }
}

export async function GET() {
  // List all attachments is not implemented - use note.attachments
  return NextResponse.json({ error: 'Use note.attachments to list attachments' }, { status: 501 });
}
