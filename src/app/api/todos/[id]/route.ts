import { NextResponse } from 'next/server';
import { 
  getTodoWithTaskById, 
  updateTodo, 
  deleteTodo, 
  completeTodo, 
  snoozeTodo, 
  clearSnooze 
} from '@/lib/repositories/todo-repo';

// GET /api/todos/[id] - Get a specific TODO
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const todo = await getTodoWithTaskById(params.id);
  if (!todo) {
    return NextResponse.json({ error: 'TODO not found' }, { status: 404 });
  }
  return NextResponse.json(todo);
}

// PATCH /api/todos/[id] - Update a TODO
// Body can include: content, deadline, snoozedUntil, recurrenceRule
// Special actions via query params:
//   - action=complete: Mark as completed
//   - action=delete: Soft delete
//   - action=snooze: Snooze until time in body.until
//   - action=clearSnooze: Clear snooze
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const body = await request.json().catch(() => ({}));
  
  try {
    let todo;
    
    switch (action) {
      case 'complete':
        todo = await completeTodo(params.id);
        break;
      
      case 'delete':
        await deleteTodo(params.id);
        return NextResponse.json({ success: true });
      
      case 'snooze':
        if (!body.until) {
          return NextResponse.json({ error: 'until required for snooze' }, { status: 400 });
        }
        todo = await snoozeTodo(params.id, body.until);
        break;
      
      case 'clearSnooze':
        todo = await clearSnooze(params.id);
        break;
      
      default:
        // Regular update
        todo = await updateTodo(params.id, body);
    }
    
    return NextResponse.json(todo);
  } catch (error) {
    console.error('Error updating TODO:', error);
    return NextResponse.json({ error: 'Failed to update TODO' }, { status: 500 });
  }
}

// DELETE /api/todos/[id] - Soft delete a TODO
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await deleteTodo(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting TODO:', error);
    return NextResponse.json({ error: 'Failed to delete TODO' }, { status: 500 });
  }
}
