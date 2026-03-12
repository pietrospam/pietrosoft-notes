import { NextResponse } from 'next/server';
import { 
  listAllPendingTodos,
  listAllTodos,
  countAllPendingTodos, 
  countOverdueTodos,
  listOverdueTodos 
} from '@/lib/repositories/todo-repo';

// GET /api/todos - List all TODOs (for sidebar and calendar view)
// Query params:
//   - overdue=true: list only overdue todos
//   - count=true: return only counts (not full list)
//   - includeCompleted=true: include completed todos (for calendar view)
export async function GET(request: Request) {
  const url = new URL(request.url);
  const overdueOnly = url.searchParams.get('overdue') === 'true';
  const countOnly = url.searchParams.get('count') === 'true';
  const includeCompleted = url.searchParams.get('includeCompleted') === 'true';
  
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
  
  if (includeCompleted) {
    const todos = await listAllTodos();
    return NextResponse.json(todos);
  }
  
  const todos = await listAllPendingTodos();
  return NextResponse.json(todos);
}
