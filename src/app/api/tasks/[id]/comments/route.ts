import { NextResponse } from 'next/server';
import { listTaskComments, createTaskComment, updateTaskComment, deleteTaskComment } from '@/lib/repositories/notes-repo';

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
  const comment = await createTaskComment({ taskId, author, content });
  return NextResponse.json(comment);
}

// PUT to update comment
export async function PUT(request: Request) {
  const body = await request.json();
  const { id, content } = body;
  if (!id || content === undefined) {
    return NextResponse.json({ error: 'id and content required' }, { status: 400 });
  }
  const updated = await updateTaskComment(id, content);
  return NextResponse.json(updated);
}

// DELETE comment
export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }
  await deleteTaskComment(id);
  return NextResponse.json({ success: true });
}
