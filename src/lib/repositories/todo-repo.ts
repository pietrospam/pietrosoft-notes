import { randomUUID } from 'crypto';
import prisma from '../db';
import { Prisma } from '@prisma/client';
import type { 
  TaskTodo, CreateTodoInput, UpdateTodoInput, 
  TodoWithTask, TodoStatus, RecurrenceRule 
} from '../types';

let hasClientIdColumnCache: boolean | null = null;
let isTaskIdNullableCache: boolean | null = null;

async function hasClientIdColumn(): Promise<boolean> {
  if (hasClientIdColumnCache !== null) return hasClientIdColumnCache;

  try {
    const result = await prisma.$queryRaw<
      Array<{ exists: boolean }>
    >`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'task_todos'
          AND column_name = 'client_id'
      ) as "exists"
    `;
    hasClientIdColumnCache = !!result?.[0]?.exists;
  } catch {
    hasClientIdColumnCache = false;
  }

  return hasClientIdColumnCache;
}

async function isTaskIdNullable(): Promise<boolean> {
  if (isTaskIdNullableCache !== null) return isTaskIdNullableCache;

  try {
    const result = await prisma.$queryRaw<
      Array<{ is_nullable: string }>
    >`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'task_todos'
        AND column_name = 'task_id'
    `;

    isTaskIdNullableCache = result?.[0]?.is_nullable === 'YES';
  } catch {
    // Assume not nullable if we can't determine
    isTaskIdNullableCache = false;
  }

  return isTaskIdNullableCache;
}

interface PrismaKnownError {
  code?: string;
  meta?: {
    column?: string;
  };
}

function isMissingColumnError(err: unknown, column: string): boolean {
  const maybe = err as PrismaKnownError;
  return maybe?.code === 'P2022' && maybe?.meta?.column === column;
}

function mapRawTodoRow(row: Record<string, unknown>): PrismaTodo {
  return {
    id: String(row.id),
    taskId: row.task_id ? String(row.task_id) : null,
    clientId: row.client_id ? String(row.client_id) : null,
    author: String(row.author),
    content: row.content as Prisma.JsonValue,
    deadline: row.deadline ? new Date(row.deadline as string) : null,
    status: String(row.status) as TodoStatus,
    completedAt: row.completed_at ? new Date(String(row.completed_at)) : null,
    deletedAt: row.deleted_at ? new Date(String(row.deleted_at)) : null,
    snoozedUntil: row.snoozed_until ? new Date(String(row.snoozed_until)) : null,
    recurrenceRule: row.recurrence_rule ? String(row.recurrence_rule) : null,
    recurrenceParentId: row.recurrence_parent_id ? String(row.recurrence_parent_id) : null,
    createdAt: new Date(String(row.created_at)),
  };
}

function toTodoWithTaskFallback(p: PrismaTodo): TodoWithTask {
  return {
    ...toTodo(p),
    task: undefined,
    client: undefined,
  };
}

// ============================================================================
// Types
// ============================================================================

type PrismaTodo = Prisma.TaskTodoGetPayload<{ include?: { task?: boolean } }>;

type PrismaTodoWithTask = Prisma.TaskTodoGetPayload<{
  include: {
    task: {
      select: {
        id: true;
        title: true;
        taskTicketPhaseCode: true;
        projectId: true;
      };
    };
    client: {
      select: {
        id: true;
        name: true;
      };
    };
  };
}>;

// ============================================================================
// Converters
// ============================================================================

function toTodo(p: PrismaTodo): TaskTodo {
  return {
    id: p.id,
    taskId: p.taskId ?? undefined,
    clientId: p.clientId ?? undefined,
    author: p.author,
    content: p.content,
    deadline: p.deadline?.toISOString(),
    status: p.status as TodoStatus,
    completedAt: p.completedAt?.toISOString(),
    deletedAt: p.deletedAt?.toISOString(),
    snoozedUntil: p.snoozedUntil?.toISOString(),
    recurrenceRule: p.recurrenceRule ? JSON.parse(p.recurrenceRule) : undefined,
    recurrenceParentId: p.recurrenceParentId ?? undefined,
    createdAt: p.createdAt.toISOString(),
  };
}

function toTodoWithTask(p: PrismaTodoWithTask): TodoWithTask {
  const base = toTodo(p);
  return {
    ...base,
    task: p.task
      ? {
          id: p.task.id,
          title: p.task.title,
          ticketPhaseCode: p.task.taskTicketPhaseCode ?? undefined,
          projectId: p.task.projectId ?? undefined,
        }
      : undefined,
    client: p.client
      ? {
          id: p.client.id,
          name: p.client.name,
        }
      : undefined,
  };
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new TODO for a task
 */
export async function createTodo(data: CreateTodoInput): Promise<TaskTodo> {
  const hasClientColumn = await hasClientIdColumn();
  const taskIdNullable = await isTaskIdNullable();

  if (!taskIdNullable && !data.taskId) {
    throw new Error(
      'Database schema requires a task association for TODOs. Please select a task or run migrations to allow standalone TODOs.'
    );
  }

  let todoRecord: PrismaTodo;

  if (hasClientColumn) {
    const record = await prisma.taskTodo.create({
      data: {
        id: randomUUID(),
        taskId: data.taskId ?? null,
        clientId: data.clientId ?? null,
        author: data.author,
        content: data.content as Prisma.InputJsonValue,
        deadline: data.deadline ? new Date(data.deadline) : null,
        recurrenceRule: data.recurrenceRule ? JSON.stringify(data.recurrenceRule) : null,
        status: 'pending',
      },
    });
    todoRecord = record;
  } else {
    const record = await prisma.$queryRaw<Record<string, unknown>>`
      INSERT INTO task_todos
        (id, task_id, author, content, deadline, status, recurrence_rule, created_at)
      VALUES
        (${randomUUID()}, ${data.taskId ?? null}, ${data.author}, ${data.content as Prisma.InputJsonValue}, ${data.deadline ? new Date(data.deadline) : null}, 'pending', ${data.recurrenceRule ? JSON.stringify(data.recurrenceRule) : null}, now())
      RETURNING *
    `;
    todoRecord = mapRawTodoRow(record);
  }

  // Log activity (only if tied to a task)
  if (data.taskId) {
    await prisma.taskActivityLog.create({
      data: {
        id: randomUUID(),
        taskId: data.taskId,
        eventType: 'TODO_CREATED',
        description: data.author,
      },
    });
  }

  return toTodo(todoRecord);
}


/**
 * Get a TODO by ID
 */
export async function getTodoById(id: string): Promise<TaskTodo | null> {
  const record = await prisma.taskTodo.findUnique({ where: { id } });
  return record ? toTodo(record) : null;
}

/**
 * Get a TODO with task info by ID
 */
export async function getTodoWithTaskById(id: string): Promise<TodoWithTask | null> {
  const record = await prisma.taskTodo.findUnique({
    where: { id },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          taskTicketPhaseCode: true,
          projectId: true,
        },
      },
      client: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
  return record ? toTodoWithTask(record) : null;
}

/**
 * List all TODOs for a task
 */
export async function listTodosByTask(taskId: string): Promise<TaskTodo[]> {
  const records = await prisma.taskTodo.findMany({
    where: { taskId, status: { not: 'deleted' } },
    orderBy: [
      { deadline: { sort: 'asc', nulls: 'last' } },
      { createdAt: 'asc' },
    ],
  });
  return records.map(toTodo);
}

export async function listTodosByClient(clientId: string): Promise<TaskTodo[]> {
  try {
    const records = await prisma.taskTodo.findMany({
      where: { clientId, status: { not: 'deleted' } },
      orderBy: [
        { deadline: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' },
      ],
    });
    return records.map(toTodo);
  } catch (err) {
    if (isMissingColumnError(err, 'task_todos.client_id')) {
      // Schema missing client_id, so just return all todos (no filtering)
      const all = await listAllTodos();
      return all.map((t) => {
        const { task: _task, client: _client, ...base } = t;
        void _task;
        void _client;
        return base;
      });
    }
    throw err;
  }
}

/**
 * List all pending/snoozed TODOs across all tasks (for sidebar)
 * Includes task information for display
 */
export async function listAllPendingTodos(): Promise<TodoWithTask[]> {
  const now = new Date();
  try {
    const records = await prisma.taskTodo.findMany({
      where: {
        status: 'pending',
        OR: [
          { snoozedUntil: null },
          { snoozedUntil: { lte: now } },
        ],
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            taskTicketPhaseCode: true,
            projectId: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { deadline: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' },
      ],
    });
    return records.map(toTodoWithTask);
  } catch (err) {
    if (isMissingColumnError(err, 'task_todos.client_id')) {
      const rawRecords = await prisma.$queryRaw<Array<Record<string, unknown>>>
        `
        SELECT id, task_id, author, content, deadline, status, completed_at, deleted_at,
               snoozed_until, recurrence_rule, recurrence_parent_id, created_at
        FROM task_todos
        WHERE status = 'pending' AND (snoozed_until IS NULL OR snoozed_until <= NOW())
        ORDER BY deadline ASC NULLS LAST
      `;
    return rawRecords.map(r => toTodoWithTaskFallback(mapRawTodoRow(r)));
    }
    throw err;
  }
}

/**
 * List ALL TODOs (pending + completed) across all tasks
 * For calendar view that shows all todos
 * Excludes deleted TODOs
 */
export async function listAllTodos(): Promise<TodoWithTask[]> {
  try {
    const records = await prisma.taskTodo.findMany({
      where: {
        status: { not: 'deleted' },
        deletedAt: null,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            taskTicketPhaseCode: true,
            projectId: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { deadline: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' },
      ],
    });
    return records.map(toTodoWithTask);
  } catch (err) {
    if (isMissingColumnError(err, 'task_todos.client_id')) {
      const rawRecords = await prisma.$queryRaw<Array<Record<string, unknown>>>
        `
        SELECT id, task_id, author, content, deadline, status, completed_at, deleted_at,
               snoozed_until, recurrence_rule, recurrence_parent_id, created_at
        FROM task_todos
        WHERE status <> 'deleted' AND deleted_at IS NULL
        ORDER BY deadline ASC NULLS LAST, created_at ASC
      `;
    return rawRecords.map(r => toTodoWithTaskFallback(mapRawTodoRow(r)));
    }
    throw err;
  }
}

/**
 * List TODOs with upcoming deadlines (for notifications)
 */
export async function listTodosWithUpcomingDeadlines(withinMinutes: number): Promise<TodoWithTask[]> {
  const now = new Date();
  const future = new Date(now.getTime() + withinMinutes * 60 * 1000);

  try {
    const records = await prisma.taskTodo.findMany({
      where: {
        status: 'pending',
        deadline: {
          gte: now,
          lte: future,
        },
        OR: [
          { snoozedUntil: null },
          { snoozedUntil: { lte: now } },
        ],
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            taskTicketPhaseCode: true,
            projectId: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { deadline: 'asc' },
    });
    return records.map(toTodoWithTask);
  } catch (err) {
    if (isMissingColumnError(err, 'task_todos.client_id')) {
      const rawRecords = await prisma.$queryRaw<Array<Record<string, unknown>>>
        `
        SELECT id, task_id, author, content, deadline, status, completed_at, deleted_at,
               snoozed_until, recurrence_rule, recurrence_parent_id, created_at
        FROM task_todos
        WHERE status = 'pending' AND deadline >= $1 AND deadline <= $2
          AND (snoozed_until IS NULL OR snoozed_until <= $3)
        ORDER BY deadline ASC
      `;
      return rawRecords.map(r => toTodoWithTaskFallback(mapRawTodoRow(r)));
    }
    throw err;
  }
}

/**
 * List overdue TODOs
 */
export async function listOverdueTodos(): Promise<TodoWithTask[]> {
  const now = new Date();
  
  try {
    const records = await prisma.taskTodo.findMany({
      where: {
        status: 'pending',
        deadline: { lt: now },
        OR: [
          { snoozedUntil: null },
          { snoozedUntil: { lte: now } },
        ],
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            taskTicketPhaseCode: true,
            projectId: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { deadline: 'asc' },
    });
    return records.map(toTodoWithTask);
  } catch (err) {
    if (isMissingColumnError(err, 'task_todos.client_id')) {
      const rawRecords = await prisma.$queryRaw<Array<Record<string, unknown>>>
        `
        SELECT id, task_id, author, content, deadline, status, completed_at, deleted_at,
               snoozed_until, recurrence_rule, recurrence_parent_id, created_at
        FROM task_todos
        WHERE status = 'pending' AND deadline < NOW() AND (snoozed_until IS NULL OR snoozed_until <= NOW())
        ORDER BY deadline ASC
      `;
    return rawRecords.map(r => toTodoWithTaskFallback(mapRawTodoRow(r)));
    }
    throw err;
  }
}

/**
 * Update a TODO
 */
export async function updateTodo(id: string, data: UpdateTodoInput): Promise<TaskTodo> {
  const updateData: Prisma.TaskTodoUpdateInput = {};
  
  if (data.content !== undefined) {
    updateData.content = data.content as Prisma.InputJsonValue;
  }
  if (data.deadline !== undefined) {
    updateData.deadline = data.deadline ? new Date(data.deadline) : null;
  }
  if (data.snoozedUntil !== undefined) {
    updateData.snoozedUntil = data.snoozedUntil ? new Date(data.snoozedUntil) : null;
  }
  if (data.recurrenceRule !== undefined) {
    updateData.recurrenceRule = data.recurrenceRule ? JSON.stringify(data.recurrenceRule) : null;
  }
  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === 'completed') {
      updateData.completedAt = new Date();
    } else if (data.status === 'deleted') {
      updateData.deletedAt = new Date();
    }
  }

  const record = await prisma.taskTodo.update({
    where: { id },
    data: updateData,
  });

  return toTodo(record);
}

/**
 * Mark a TODO as completed
 */
export async function completeTodo(id: string): Promise<TaskTodo> {
  const existing = await prisma.taskTodo.findUnique({ where: { id } });
  if (!existing) throw new Error('TODO not found');

  const record = await prisma.taskTodo.update({
    where: { id },
    data: {
      status: 'completed',
      completedAt: new Date(),
    },
  });

  // Log activity (only if TODO is tied to a task)
  if (record.taskId) {
    await prisma.taskActivityLog.create({
      data: {
        id: randomUUID(),
        taskId: record.taskId,
        eventType: 'TODO_COMPLETED',
        description: id,
      },
    });
  }

  // If recurring, create next occurrence
  if (existing.recurrenceRule) {
    await createNextRecurrence(existing);
  }

  return toTodo(record);
}

/**
 * Mark a TODO as deleted (soft delete)
 */
export async function deleteTodo(id: string): Promise<void> {
  const record = await prisma.taskTodo.findUnique({ where: { id } });
  if (!record) return;

  await prisma.taskTodo.update({
    where: { id },
    data: {
      status: 'deleted',
      deletedAt: new Date(),
    },
  });

  // Log activity (only if TODO is tied to a task)
  if (record.taskId) {
    await prisma.taskActivityLog.create({
      data: {
        id: randomUUID(),
        taskId: record.taskId,
        eventType: 'TODO_DELETED',
        description: id,
      },
    });
  }
}

/**
 * Snooze a TODO until a specific time
 */
export async function snoozeTodo(id: string, until: string): Promise<TaskTodo> {
  const record = await prisma.taskTodo.update({
    where: { id },
    data: { snoozedUntil: new Date(until) },
  });

  // Log activity (only if TODO is tied to a task)
  if (record.taskId) {
    await prisma.taskActivityLog.create({
      data: {
        id: randomUUID(),
        taskId: record.taskId,
        eventType: 'TODO_SNOOZED',
        description: until,
      },
    });
  }

  return toTodo(record);
}

/**
 * Clear snooze from a TODO
 */
export async function clearSnooze(id: string): Promise<TaskTodo> {
  const record = await prisma.taskTodo.update({
    where: { id },
    data: { snoozedUntil: null },
  });
  return toTodo(record);
}

// ============================================================================
// Recurrence Logic
// ============================================================================

/**
 * Create the next occurrence of a recurring TODO
 */
async function createNextRecurrence(parentTodo: PrismaTodo): Promise<TaskTodo | null> {
  if (!parentTodo.recurrenceRule || !parentTodo.deadline) return null;

  const rule: RecurrenceRule = JSON.parse(parentTodo.recurrenceRule);
  const interval = rule.interval || 1;
  const currentDeadline = new Date(parentTodo.deadline);
  let nextDeadline: Date;

  switch (rule.frequency) {
    case 'daily':
      nextDeadline = new Date(currentDeadline);
      nextDeadline.setDate(nextDeadline.getDate() + interval);
      break;
    case 'weekly':
      nextDeadline = new Date(currentDeadline);
      nextDeadline.setDate(nextDeadline.getDate() + 7 * interval);
      break;
    case 'monthly':
      nextDeadline = new Date(currentDeadline);
      nextDeadline.setMonth(nextDeadline.getMonth() + interval);
      break;
    default:
      return null;
  }

  // Check if past end date
  if (rule.endDate && nextDeadline > new Date(rule.endDate)) {
    return null;
  }

  const record = await prisma.taskTodo.create({
    data: {
      id: randomUUID(),
      taskId: parentTodo.taskId,
      author: parentTodo.author,
      content: parentTodo.content as Prisma.InputJsonValue,
      deadline: nextDeadline,
      recurrenceRule: parentTodo.recurrenceRule,
      recurrenceParentId: parentTodo.recurrenceParentId || parentTodo.id,
      status: 'pending',
    },
  });

  return toTodo(record);
}

// ============================================================================
// Notification Tracking
// ============================================================================

/**
 * Check if a notification has already been sent
 */
export async function hasNotificationBeenSent(
  todoId: string,
  notificationType: string,
  reminderMinutes?: number
): Promise<boolean> {
  const where: Prisma.TodoNotificationSentWhereInput = {
    todoId,
    notificationType,
  };
  if (reminderMinutes !== undefined) {
    where.reminderMinutes = reminderMinutes;
  }

  const count = await prisma.todoNotificationSent.count({ where });
  return count > 0;
}

/**
 * Record that a notification was sent
 */
export async function recordNotificationSent(
  todoId: string,
  notificationType: string,
  reminderMinutes?: number
): Promise<void> {
  await prisma.todoNotificationSent.create({
    data: {
      id: randomUUID(),
      todoId,
      notificationType,
      reminderMinutes,
    },
  });
}

/**
 * Get count of pending TODOs for a task (for badge display)
 */
export async function countPendingTodosByTask(taskId: string): Promise<number> {
  const now = new Date();
  return prisma.taskTodo.count({
    where: {
      taskId,
      status: 'pending',
      OR: [
        { snoozedUntil: null },
        { snoozedUntil: { lte: now } },
      ],
    },
  });
}

/**
 * Get count of all pending TODOs (for sidebar badge)
 */
export async function countAllPendingTodos(): Promise<number> {
  const now = new Date();
  return prisma.taskTodo.count({
    where: {
      status: 'pending',
      OR: [
        { snoozedUntil: null },
        { snoozedUntil: { lte: now } },
      ],
    },
  });
}

/**
 * Get count of overdue TODOs
 */
export async function countOverdueTodos(): Promise<number> {
  const now = new Date();
  return prisma.taskTodo.count({
    where: {
      status: 'pending',
      deadline: { lt: now },
      OR: [
        { snoozedUntil: null },
        { snoozedUntil: { lte: now } },
      ],
    },
  });
}
