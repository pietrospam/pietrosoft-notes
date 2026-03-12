import { randomUUID } from 'crypto';
import prisma from '../db';
import { Prisma } from '@prisma/client';
import type { 
  TaskTodo, CreateTodoInput, UpdateTodoInput, 
  TodoWithTask, TodoStatus, RecurrenceRule 
} from '../types';

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
  };
}>;

// ============================================================================
// Converters
// ============================================================================

function toTodo(p: PrismaTodo): TaskTodo {
  return {
    id: p.id,
    taskId: p.taskId,
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
  return {
    ...toTodo(p),
    task: {
      id: p.task.id,
      title: p.task.title,
      ticketPhaseCode: p.task.taskTicketPhaseCode ?? undefined,
      projectId: p.task.projectId ?? undefined,
    },
  };
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new TODO for a task
 */
export async function createTodo(data: CreateTodoInput): Promise<TaskTodo> {
  const record = await prisma.taskTodo.create({
    data: {
      id: randomUUID(),
      taskId: data.taskId,
      author: data.author,
      content: data.content as Prisma.InputJsonValue,
      deadline: data.deadline ? new Date(data.deadline) : null,
      recurrenceRule: data.recurrenceRule ? JSON.stringify(data.recurrenceRule) : null,
      status: 'pending',
    },
  });

  // Log activity
  await prisma.taskActivityLog.create({
    data: {
      id: randomUUID(),
      taskId: data.taskId,
      eventType: 'TODO_CREATED',
      description: data.author,
    },
  });

  return toTodo(record);
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

/**
 * List all pending/snoozed TODOs across all tasks (for sidebar)
 * Includes task information for display
 */
export async function listAllPendingTodos(): Promise<TodoWithTask[]> {
  const now = new Date();
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
    },
    orderBy: [
      { deadline: { sort: 'asc', nulls: 'last' } },
      { createdAt: 'asc' },
    ],
  });
  return records.map(toTodoWithTask);
}

/**
 * List ALL TODOs (pending + completed) across all tasks
 * For calendar view that shows all todos
 * Excludes deleted TODOs
 */
export async function listAllTodos(): Promise<TodoWithTask[]> {
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
    },
    orderBy: [
      { deadline: { sort: 'asc', nulls: 'last' } },
      { createdAt: 'asc' },
    ],
  });
  return records.map(toTodoWithTask);
}

/**
 * List TODOs with upcoming deadlines (for notifications)
 */
export async function listTodosWithUpcomingDeadlines(withinMinutes: number): Promise<TodoWithTask[]> {
  const now = new Date();
  const future = new Date(now.getTime() + withinMinutes * 60 * 1000);
  
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
    },
    orderBy: { deadline: 'asc' },
  });
  return records.map(toTodoWithTask);
}

/**
 * List overdue TODOs
 */
export async function listOverdueTodos(): Promise<TodoWithTask[]> {
  const now = new Date();
  
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
    },
    orderBy: { deadline: 'asc' },
  });
  return records.map(toTodoWithTask);
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

  // Log activity
  await prisma.taskActivityLog.create({
    data: {
      id: randomUUID(),
      taskId: record.taskId,
      eventType: 'TODO_COMPLETED',
      description: id,
    },
  });

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

  // Log activity
  await prisma.taskActivityLog.create({
    data: {
      id: randomUUID(),
      taskId: record.taskId,
      eventType: 'TODO_DELETED',
      description: id,
    },
  });
}

/**
 * Snooze a TODO until a specific time
 */
export async function snoozeTodo(id: string, until: string): Promise<TaskTodo> {
  const record = await prisma.taskTodo.update({
    where: { id },
    data: { snoozedUntil: new Date(until) },
  });

  // Log activity
  await prisma.taskActivityLog.create({
    data: {
      id: randomUUID(),
      taskId: record.taskId,
      eventType: 'TODO_SNOOZED',
      description: until,
    },
  });

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
