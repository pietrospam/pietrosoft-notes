import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { PATHS } from '@/lib/storage/file-storage';
import { listNotes, updateNote } from '@/lib/repositories/notes-repo';
import type { AttachmentMeta } from '@/lib/types';

interface Params {
  params: { id: string };
}

// Find attachment metadata across all notes
async function findAttachment(attachmentId: string): Promise<{ 
  noteId: string; 
  attachment: AttachmentMeta 
} | null> {
  const notes = await listNotes({ includeDeleted: true, includeArchived: true });
  
  for (const note of notes) {
    const attachment = note.attachments.find(a => a.id === attachmentId);
    if (attachment) {
      return { noteId: note.id, attachment };
    }
  }
  
  return null;
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = params;
    
    // Find attachment metadata
    const result = await findAttachment(id);
    if (!result) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }
    
    const { attachment } = result;
    const filePath = PATHS.attachment(attachment.filename);
    
    // Check file exists
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Attachment file missing' }, { status: 404 });
    }
    
    // Read file
    const fileBuffer = await fs.readFile(filePath);
    
    // Check if download is requested
    const download = request.nextUrl.searchParams.get('download') === 'true';
    
    const headers: HeadersInit = {
      'Content-Type': attachment.mimeType,
      'Content-Length': attachment.size.toString(),
    };
    
    if (download) {
      headers['Content-Disposition'] = `attachment; filename="${attachment.originalName}"`;
    } else {
      headers['Content-Disposition'] = `inline; filename="${attachment.originalName}"`;
    }
    
    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });
    
  } catch (error) {
    console.error('Error serving attachment:', error);
    return NextResponse.json({ error: 'Failed to serve attachment' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = params;
    
    // Find attachment metadata
    const result = await findAttachment(id);
    if (!result) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }
    
    const { noteId, attachment } = result;
    const filePath = PATHS.attachment(attachment.filename);
    
    // Delete file if exists
    if (existsSync(filePath)) {
      await fs.unlink(filePath);
    }
    
    // Get note and update attachments array
    const notes = await listNotes({ includeDeleted: true, includeArchived: true });
    const note = notes.find(n => n.id === noteId);
    
    if (note) {
      const updatedAttachments = note.attachments.filter(a => a.id !== id);
      await updateNote(noteId, { attachments: updatedAttachments });
    }
    
    return new NextResponse(null, { status: 204 });
    
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 });
  }
}
