import { NextResponse } from 'next/server';
import { listTodosByTask, createTodo } from '@/lib/repositories/todo-repo';

// GET /api/tasks/[id]/todos - List all TODOs for a task
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const taskId = params.id;
  const todos = await listTodosByTask(taskId);
  return NextResponse.json(todos);
}

// POST /api/tasks/[id]/todos - Create new TODO for a task
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const taskId = params.id;
  const body = await request.json();
  const { author, content, deadline, recurrenceRule } = body;
  
  if (!author || content === undefined) {
    return NextResponse.json({ error: 'author and content required' }, { status: 400 });
  }
  
  const todo = await createTodo({ 
    taskId, 
    author, 
    content, 
    deadline, 
    recurrenceRule 
  });
  
  return NextResponse.json(todo);
}
