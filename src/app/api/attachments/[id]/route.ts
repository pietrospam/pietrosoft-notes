import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import type { AttachmentMeta } from '@/lib/types';

interface Params {
  params: { id: string };
}

// REQ-007: Serve attachments from database
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = params;
    
    // Find attachment in database
    const attachment = await prisma.attachment.findUnique({
      where: { id },
    });
    
    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }
    
    // Check if download is requested
    const download = request.nextUrl.searchParams.get('download') === 'true';
    
    const headers: HeadersInit = {
      'Content-Type': attachment.mimeType,
      'Content-Length': attachment.size.toString(),
      'Cache-Control': 'public, max-age=31536000, immutable',
    };
    
    if (download) {
      headers['Content-Disposition'] = `attachment; filename="${attachment.originalName}"`;
    } else {
      headers['Content-Disposition'] = `inline; filename="${attachment.originalName}"`;
    }
    
    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(attachment.data);
    
    return new NextResponse(uint8Array, {
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
    
    // Delete from database (cascade will handle if note is deleted)
    const attachment = await prisma.attachment.delete({
      where: { id },
    }).catch(() => null);
    
    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }
    
    return new NextResponse(null, { status: 204 });
    
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = params;
    const body = await request.json();
    
    if (!body.originalName) {
      return NextResponse.json({ error: 'originalName is required' }, { status: 400 });
    }
    
    // Update attachment name in database
    const attachment = await prisma.attachment.update({
      where: { id },
      data: { originalName: body.originalName },
    }).catch(() => null);
    
    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }
    
    const response: AttachmentMeta = {
      id: attachment.id,
      filename: attachment.filename,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      createdAt: attachment.createdAt.toISOString(),
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error updating attachment:', error);
    return NextResponse.json({ error: 'Failed to update attachment' }, { status: 500 });
  }
}
