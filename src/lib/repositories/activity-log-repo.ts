import prisma from '../db';
import type { TaskActivityLog, TaskActivityEventType } from '../types';

// ============================================================================
// REQ-010: Task Activity Log Repository
// ============================================================================

// Helper to convert Prisma model to domain type
function toActivityLog(prismaLog: {
  id: string;
  taskId: string;
  eventType: string;
  description: string | null;
  createdAt: Date;
}): TaskActivityLog {
  return {
    id: prismaLog.id,
    taskId: prismaLog.taskId,
    eventType: prismaLog.eventType as TaskActivityEventType,
    description: prismaLog.description ?? undefined,
    createdAt: prismaLog.createdAt.toISOString(),
  };
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get activity logs for a task, ordered by creation date (newest first)
 */
export async function getActivityLogsForTask(taskId: string): Promise<TaskActivityLog[]> {
  const logs = await prisma.taskActivityLog.findMany({
    where: { taskId },
    orderBy: { createdAt: 'desc' },
  });
  return logs.map(toActivityLog);
}

/**
 * Create a new activity log entry
 */
export async function createActivityLog(
  taskId: string,
  eventType: TaskActivityEventType,
  description?: string
): Promise<TaskActivityLog> {
  const log = await prisma.taskActivityLog.create({
    data: {
      taskId,
      eventType,
      description,
    },
  });
  return toActivityLog(log);
}

/**
 * Log multiple events at once (for batch updates)
 */
export async function createActivityLogs(
  taskId: string,
  events: Array<{ eventType: TaskActivityEventType; description?: string }>
): Promise<TaskActivityLog[]> {
  // Use createMany for bulk insert
  await prisma.taskActivityLog.createMany({
    data: events.map(e => ({
      taskId,
      eventType: e.eventType,
      description: e.description,
    })),
  });
  
  // Return newly created logs
  const logs = await prisma.taskActivityLog.findMany({
    where: { taskId },
    orderBy: { createdAt: 'desc' },
    take: events.length,
  });
  
  return logs.map(toActivityLog);
}

/**
 * Delete all activity logs for a task (called when task is deleted)
 * Note: This is handled by CASCADE in the database, but kept for explicit cleanup if needed
 */
export async function deleteActivityLogsForTask(taskId: string): Promise<void> {
  await prisma.taskActivityLog.deleteMany({
    where: { taskId },
  });
}

// ============================================================================
// REQ-010.3.6: Auto-create TimeSheet Placeholder
// ============================================================================

/**
 * Check if a timesheet exists for the task on a specific date
 */
export async function hasTimesheetForDate(taskId: string, date: Date): Promise<boolean> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const count = await prisma.note.count({
    where: {
      type: 'TIMESHEET',
      timesheetTaskId: taskId,
      timesheetDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });
  
  return count > 0;
}

/**
 * Create a placeholder timesheet with 0 hours
 */
export async function createPlaceholderTimesheet(
  taskId: string,
  description: string
): Promise<void> {
  const today = new Date();
  
  // Check if timesheet already exists for today
  if (await hasTimesheetForDate(taskId, today)) {
    return;
  }
  
  // Get task details to fill in project info
  const task = await prisma.note.findUnique({
    where: { id: taskId },
    select: { projectId: true, title: true },
  });
  
  if (!task) return;
  
  // Create placeholder timesheet
  const timesheetId = `ts-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  await prisma.note.create({
    data: {
      id: timesheetId,
      type: 'TIMESHEET',
      title: `TimeSheet - ${task.title}`,
      timesheetTaskId: taskId,
      timesheetDate: today,
      timesheetHours: 0,
      timesheetState: 'DRAFT',
      content: description,
    },
  });
}

// ============================================================================
// Activity Description Generators
// ============================================================================

export function getStatusChangeDescription(oldStatus: string, newStatus: string): string {
  return `Estado cambiado de ${oldStatus} a ${newStatus}`;
}

export function getPriorityChangeDescription(oldPriority: string, newPriority: string): string {
  return `Prioridad cambiada de ${oldPriority} a ${newPriority}`;
}

export function getTitleChangeDescription(oldTitle: string, newTitle: string): string {
  return `Título cambiado de '${oldTitle}' a '${newTitle}'`;
}

export function getProjectChangeDescription(projectName: string): string {
  return `Proyecto cambiado a '${projectName}'`;
}

export function getClientChangeDescription(clientName: string): string {
  return `Cliente cambiado a '${clientName}'`;
}

export function getDueDateChangeDescription(dueDate: string | null): string {
  if (!dueDate) return 'Fecha de vencimiento eliminada';
  return `Fecha de vencimiento cambiada a ${dueDate}`;
}

export function getTimesheetAddedDescription(hours: number, description?: string): string {
  const desc = description ? ` - ${description}` : '';
  return `TimeSheet agregado: ${hours}h${desc}`;
}

export function getTimesheetModifiedDescription(): string {
  return 'TimeSheet modificado';
}

export function getTimesheetDeletedDescription(): string {
  return 'TimeSheet eliminado';
}

export function getAttachmentAddedDescription(filename: string): string {
  return `Adjunto agregado: ${filename}`;
}

export function getAttachmentDeletedDescription(filename: string): string {
  return `Adjunto eliminado: ${filename}`;
}

// ============================================================================
// Placeholder TimeSheet Description by Event Type
// ============================================================================

export function getPlaceholderTimesheetDescription(eventType: TaskActivityEventType): string {
  const descriptions: Record<TaskActivityEventType, string> = {
    CREATED: 'Tarea creada',
    TITLE_CHANGED: 'Actualización de título',
    STATUS_CHANGED: 'Cambio de estado',
    PRIORITY_CHANGED: 'Cambio de prioridad',
    PROJECT_CHANGED: 'Cambio de proyecto',
    CLIENT_CHANGED: 'Cambio de cliente',
    DUE_DATE_CHANGED: 'Cambio de fecha',
    CONTENT_UPDATED: 'Actualización de contenido',
    TIMESHEET_ADDED: '', // Should not create placeholder
    TIMESHEET_MODIFIED: '', // Should not create placeholder
    TIMESHEET_DELETED: '', // Should not create placeholder
    ATTACHMENT_ADDED: 'Agregado adjunto',
    ATTACHMENT_DELETED: 'Eliminado adjunto',
    ARCHIVED: 'Tarea archivada',
    UNARCHIVED: 'Tarea desarchivada',
    FAVORITED: 'Marcada como favorita',
    UNFAVORITED: 'Desmarcada de favoritos',
  };
  
  return descriptions[eventType] || 'Trabajé en esta tarea';
}

// Events that should NOT create a placeholder timesheet
const TIMESHEET_EVENTS: TaskActivityEventType[] = [
  'TIMESHEET_ADDED',
  'TIMESHEET_MODIFIED',
  'TIMESHEET_DELETED',
];

export function shouldCreatePlaceholderTimesheet(eventType: TaskActivityEventType): boolean {
  return !TIMESHEET_EVENTS.includes(eventType);
}
