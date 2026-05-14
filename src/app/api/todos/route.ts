import { NextResponse } from 'next/server';
import { 
  listAllPendingTodos,
  listAllTodos,
  countAllPendingTodos, 
  countOverdueTodos,
  listOverdueTodos,
  createTodo,
} from '@/lib/repositories/todo-repo';
import type { CreateTodoInput } from '@/lib/types';

// GET /api/todos - List all TODOs (for sidebar and calendar view)
// Query params:
//   - overdue=true: list only overdue todos
//   - count=true: return only counts (not full list)
//   - includeCompleted=true: include completed todos (for calendar view)
//   - taskId: filter by task
//   - clientId: filter by client
export async function GET(request: Request) {
  const url = new URL(request.url);
  const overdueOnly = url.searchParams.get('overdue') === 'true';
  const countOnly = url.searchParams.get('count') === 'true';
  const includeCompleted = url.searchParams.get('includeCompleted') === 'true';
  const taskId = url.searchParams.get('taskId');
  const clientId = url.searchParams.get('clientId');
  
  if (countOnly) {
    const [totalPending, totalOverdue] = await Promise.all([
      countAllPendingTodos(),
      countOverdueTodos(),
    ]);
    return NextResponse.json({ totalPending, totalOverdue });
  }
  
  if (overdueOnly) {
    const todos = await listOverdueTodos();
    return NextResponse.json(todos);
  }

  let todos = includeCompleted ? await listAllTodos() : await listAllPendingTodos();

  if (taskId) {
    todos = todos.filter((t) => t.taskId === taskId);
  }
  if (clientId) {
    todos = todos.filter((t) => t.clientId === clientId);
  }

  return NextResponse.json(todos);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { author, content, deadline, recurrenceRule, taskId, clientId } = body;

  if (!author || content === undefined) {
    return NextResponse.json({ error: 'author and content required' }, { status: 400 });
  }

  const input: CreateTodoInput = {
    author,
    content,
    taskId: taskId ?? undefined,
    clientId: clientId ?? undefined,
    deadline,
    recurrenceRule,
  };

  try {
    const todo = await createTodo(input);
    return NextResponse.json(todo);
  } catch (err) {
    console.error('Failed to create TODO:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to create TODO' },
      { status: 400 }
    );
  }
}
