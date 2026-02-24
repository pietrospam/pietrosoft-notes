import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import type { AttachmentMeta } from '@/lib/types';

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 100);
}

// REQ-007: Store attachments in database as BLOB
export async function POST(request: NextRequest) {
  try {
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
    const note = await prisma.note.findUnique({ where: { id: noteId } });
    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }
    
    // Generate filename
    const sanitizedName = sanitizeFilename(file.name);
    
    // Read file data
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Save to database
    const attachment = await prisma.attachment.create({
      data: {
        noteId,
        filename: sanitizedName,
        originalName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        data: buffer,
      },
    });
    
    const response: AttachmentMeta = {
      id: attachment.id,
      filename: attachment.filename,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      createdAt: attachment.createdAt.toISOString(),
    };
    
    return NextResponse.json({
      ...response,
      url: `/api/attachments/${attachment.id}`,
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
