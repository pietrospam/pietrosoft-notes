import { NextResponse } from 'next/server';
import { listTaskComments, createTaskComment, updateTaskComment, deleteTaskComment } from '@/lib/repositories/notes-repo';
import prisma from '@/lib/db';
import { SYSTEM_AUTHOR } from '@/lib/system-comments';

// GET /api/tasks/[id]/comments
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const taskId = params.id;
  const comments = await listTaskComments(taskId);
  return NextResponse.json(comments);
}

// POST create new comment
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const taskId = params.id;
  const body = await request.json();
  const { author, content } = body;
  if (!author || content === undefined) {
    return NextResponse.json({ error: 'author and content required' }, { status: 400 });
  }
  try {
    const comment = await createTaskComment({ taskId, author, content });
    return NextResponse.json(comment);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: `Failed to create comment: ${message}` }, { status: 500 });
  }
}

// PUT to update comment (system comments cannot be updated)
export async function PUT(request: Request) {
  const body = await request.json();
  const { id, content } = body;
  if (!id || content === undefined) {
    return NextResponse.json({ error: 'id and content required' }, { status: 400 });
  }
  
  // Check if it's a system comment
  const comment = await prisma.taskComment.findUnique({
    where: { id },
    select: { author: true },
  });
  
  if (!comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
  }
  
  if (comment.author === SYSTEM_AUTHOR) {
    return NextResponse.json({ error: 'System comments cannot be edited' }, { status: 403 });
  }
  
  const updated = await updateTaskComment(id, content);
  return NextResponse.json(updated);
}

// DELETE comment (system comments cannot be deleted)
export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }
  
  // Check if it's a system comment
  const comment = await prisma.taskComment.findUnique({
    where: { id },
    select: { author: true },
  });
  
  if (!comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
  }
  
  if (comment.author === SYSTEM_AUTHOR) {
    return NextResponse.json({ error: 'System comments cannot be deleted' }, { status: 403 });
  }
  
  await deleteTaskComment(id);
  return NextResponse.json({ success: true });
}
