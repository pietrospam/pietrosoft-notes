import { randomUUID } from 'crypto';
import prisma from '../db';
import { NoteType as PrismaNoteType, TaskStatus as PrismaTaskStatus, TaskPriority as PrismaTaskPriority, Prisma } from '@prisma/client';
import type { 
  Note, NoteType, CreateNoteInput, UpdateNoteInput,
  GeneralNote, TaskNote, ConnectionNote,
  AttachmentMeta, TaskStatus, TaskPriority
} from '../types';

// ============================================================================
// Type Mappers
// ============================================================================

const noteTypeToDb: Record<NoteType, PrismaNoteType> = {
  general: PrismaNoteType.GENERAL,
  task: PrismaNoteType.TASK,
  connection: PrismaNoteType.CONNECTION,
};

const noteTypeFromDb: Record<PrismaNoteType, NoteType> = {
  [PrismaNoteType.GENERAL]: 'general',
  [PrismaNoteType.TASK]: 'task',
  [PrismaNoteType.CONNECTION]: 'connection',
  // if a legacy TIMESHEET record is ever encountered, treat it as general
  [PrismaNoteType.TIMESHEET]: 'general',
};

const taskStatusToDb = (status: TaskStatus): PrismaTaskStatus | null => {
  if (status === 'NONE') return null;
  const map: Record<Exclude<TaskStatus, 'NONE'>, PrismaTaskStatus> = {
    PENDING: PrismaTaskStatus.PENDING,
    IN_PROGRESS: PrismaTaskStatus.IN_PROGRESS,
    COMPLETED: PrismaTaskStatus.COMPLETED,
    CANCELLED: PrismaTaskStatus.CANCELLED,
  };
  return map[status];
};

const taskStatusFromDb = (status: PrismaTaskStatus | null): TaskStatus => {
  if (!status) return 'NONE';
  const map: Record<PrismaTaskStatus, TaskStatus> = {
    [PrismaTaskStatus.PENDING]: 'PENDING',
    [PrismaTaskStatus.IN_PROGRESS]: 'IN_PROGRESS',
    [PrismaTaskStatus.COMPLETED]: 'COMPLETED',
    [PrismaTaskStatus.CANCELLED]: 'CANCELLED',
  };
  return map[status];
};

const taskPriorityToDb = (priority: TaskPriority): PrismaTaskPriority => {
  const map: Record<TaskPriority, PrismaTaskPriority> = {
    LOW: PrismaTaskPriority.LOW,
    MEDIUM: PrismaTaskPriority.MEDIUM,
    HIGH: PrismaTaskPriority.HIGH,
    CRITICAL: PrismaTaskPriority.CRITICAL,
  };
  return map[priority];
};

const taskPriorityFromDb = (priority: PrismaTaskPriority | null): TaskPriority => {
  if (!priority) return 'MEDIUM';
  const map: Record<PrismaTaskPriority, TaskPriority> = {
    [PrismaTaskPriority.LOW]: 'LOW',
    [PrismaTaskPriority.MEDIUM]: 'MEDIUM',
    [PrismaTaskPriority.HIGH]: 'HIGH',
    [PrismaTaskPriority.CRITICAL]: 'CRITICAL',
  };
  return map[priority];
};

// timesheet state mapping removed since timesheets are now separate entities

// ============================================================================
// Prisma to Domain Converter
// ============================================================================

type PrismaNote = Prisma.NoteGetPayload<{ include: { attachmentFiles: true } }>;

function toNote(p: PrismaNote): Note {
  // REQ-007: Prefer attachments from DB, fall back to JSON field for migration
  const dbAttachments: AttachmentMeta[] = (p.attachmentFiles || []).map(a => ({
    id: a.id,
    filename: a.filename,
    originalName: a.originalName,
    mimeType: a.mimeType,
    size: a.size,
    createdAt: a.createdAt.toISOString(),
  }));
  
  const jsonAttachments = (p.attachments as unknown as AttachmentMeta[]) || [];
  const attachments = dbAttachments.length > 0 ? dbAttachments : jsonAttachments;
  
  const base = {
    id: p.id,
    title: p.title,
    contentJson: p.contentJson as object | null,
    contentText: p.content || '',
    attachments,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    archivedAt: p.archived ? p.updatedAt.toISOString() : undefined,
    isFavorite: p.isFavorite ?? false,
    favoriteOrder: p.favoriteOrder ?? undefined,
  };

  const type = noteTypeFromDb[p.type];

  switch (type) {
    case 'general':
      return {
        ...base,
        type: 'general',
        clientId: p.clientId ?? undefined,
        projectId: p.projectId ?? undefined,
      } as GeneralNote;

    case 'task':
      return {
        ...base,
        type: 'task',
        projectId: p.projectId || '',
        clientId: p.clientId ?? undefined,
        ticketPhaseCode: p.taskTicketPhaseCode || '',
        shortDescription: p.taskShortDescription || '',
        budgetHours: p.taskBudgetHours ?? undefined,
        status: taskStatusFromDb(p.taskStatus),
        priority: taskPriorityFromDb(p.taskPriority),
        dueDate: p.taskDueDate?.toISOString(),
      } as TaskNote;

    case 'connection':
      return {
        ...base,
        type: 'connection',
        clientId: p.clientId ?? undefined,
        projectId: p.projectId ?? undefined,
        url: p.connectionUrl ?? undefined,
        username: p.connectionUsername ?? undefined,
        password: p.connectionCredentials ?? undefined,
      } as ConnectionNote;

    // timesheet notes no longer exist in this table (migrated to separate Timesheet model)
    // fall through to default, treating as general note

    default:
      return {
        ...base,
        type: 'general',
      } as GeneralNote;
  }
}

// ============================================================================
// List Notes
// ============================================================================

export interface ListNotesOptions {
  type?: NoteType;
  clientId?: string;
  projectId?: string;
  includeArchived?: boolean;
  search?: string;
  taskStatus?: TaskStatus;
  updatedAfter?: Date; // Filter notes updated strictly after this timestamp (used for polling)
}

export async function listNotes(options: ListNotesOptions = {}): Promise<Note[]> {
  const { type, clientId, projectId, includeArchived = false, search, taskStatus } = options;

  const where: Prisma.NoteWhereInput = {};

  if (type) {
    where.type = noteTypeToDb[type];
  }
  if (clientId) {
    where.clientId = clientId;
  }
  if (projectId) {
    where.projectId = projectId;
  }
  if (!includeArchived) {
    where.archived = false;
  }
  if (search) {
    // search across title, raw content (HTML), and task-specific fields
    // contentText is derived client-side so we keep searching the HTML blob as a proxy
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
      { taskTicketPhaseCode: { contains: search, mode: 'insensitive' } },
      { taskShortDescription: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (taskStatus && taskStatus !== 'NONE') {
    where.taskStatus = taskStatusToDb(taskStatus);
  }

  if (options.updatedAfter) {
    where.updatedAt = { gt: options.updatedAfter };
  }

  const notes = await prisma.note.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: { attachmentFiles: true }, // REQ-007
  });

  return notes.map(toNote);
}

// ============================================================================
// Get Note by ID
// ============================================================================

export async function getNote(id: string): Promise<Note | null> {
  const note = await prisma.note.findUnique({ 
    where: { id },
    include: { attachmentFiles: true }, // REQ-007
  });
  return note ? toNote(note) : null;
}

// ============================================================================
// Create Note
// ============================================================================

function generateId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export async function createNote<T extends Note>(input: CreateNoteInput<T>): Promise<T> {
  const id = generateId();
  const type = noteTypeToDb[input.type];
  const anyInput = input as unknown as Record<string, unknown>;

  const data: Prisma.NoteUncheckedCreateInput = {
    id,
    type,
    title: input.title || '',
    content: (anyInput.contentText as string) || '',
    contentJson: anyInput.contentJson ?? Prisma.JsonNull,
    clientId: (anyInput.clientId as string) || null,
    projectId: (anyInput.projectId as string) || null,
    archived: false,
    attachments: [],
  };

  // Task-specific fields
  if (input.type === 'task') {
    const taskInput = anyInput;
    data.taskStatus = taskStatusToDb((taskInput.status as TaskStatus) || 'PENDING');
    data.taskPriority = taskPriorityToDb((taskInput.priority as TaskPriority) || 'MEDIUM');
    data.taskDueDate = taskInput.dueDate ? new Date(taskInput.dueDate as string) : null;
    data.taskTicketPhaseCode = (taskInput.ticketPhaseCode as string) || null;
    data.taskShortDescription = (taskInput.shortDescription as string) || null;
    data.taskBudgetHours = (taskInput.budgetHours as number) || null;
  }

  // Connection-specific fields
  if (input.type === 'connection') {
    const connInput = anyInput;
    data.connectionUrl = (connInput.url as string) || null;
    data.connectionUsername = (connInput.username as string) || null;
    data.connectionCredentials = (connInput.password as string) || null;
  }

  // timesheet notes are no longer stored here; any timesheet creation/update
  // should use the dedicated timesheet APIs. The code path remains for legacy
  // compatibility but will simply ignore timesheet-specific fields.

  const created = await prisma.note.create({ 
    data,
    include: { attachmentFiles: true }, // REQ-007
  });
  return toNote(created) as T;
}

// ============================================================================
// Update Note
// ============================================================================

export async function findTasksByTicket(ticketPhaseCode: string): Promise<Note[]> {
  const normalizedTicket = ticketPhaseCode.trim();
  if (!normalizedTicket) return [];

  const existing = await prisma.note.findMany({
    where: {
      type: PrismaNoteType.TASK,
      taskTicketPhaseCode: normalizedTicket,
    },
    include: { attachmentFiles: true },
  });

  return existing.map(toNote);
}

export async function findTasksByTicketAndProject(ticketPhaseCode: string, projectId?: string | null): Promise<Note[]> {
  const normalizedTicket = ticketPhaseCode.trim();
  if (!normalizedTicket) return [];

  const existing = await prisma.note.findMany({
    where: {
      type: PrismaNoteType.TASK,
      taskTicketPhaseCode: normalizedTicket,
      projectId: projectId?.trim() || null,
    },
    include: { attachmentFiles: true },
  });

  return existing.map(toNote);
}

// General tasks use a global ticket/fase namespace. Other projects have their
// own namespace, so the project participates in duplicate detection.
export async function findTaskDuplicates(ticketPhaseCode: string, projectId?: string | null): Promise<Note[]> {
  const normalizedProjectId = projectId?.trim() || null;

  if (normalizedProjectId) {
    const project = await prisma.project.findUnique({
      where: { id: normalizedProjectId },
      select: { name: true },
    });

    if (project?.name.trim().toLowerCase() === 'general') {
      return findTasksByTicket(ticketPhaseCode);
    }
  }

  return findTasksByTicketAndProject(ticketPhaseCode, normalizedProjectId);
}

export async function hideNoteFromRecents(id: string): Promise<Note | null> {
  const existing = await prisma.note.findUnique({ where: { id } });
  if (!existing) return null;

  // For recents view, recency is determined by updatedAt; set updatedAt to a far past date.
  // Prisma's @updatedAt auto value may override updates via prisma.note.update, so use raw SQL.
  const hiddenDate = new Date(0);
  await prisma.$executeRaw`
    UPDATE notes
    SET updated_at = ${hiddenDate}
    WHERE id = ${id}
  `;

  const updated = await prisma.note.findUnique({
    where: { id },
    include: { attachmentFiles: true },
  });

  return updated ? toNote(updated) : null;
}

export async function updateNote<T extends Note>(
  id: string,
  input: UpdateNoteInput<T>
): Promise<T | null> {
  const existing = await prisma.note.findUnique({ where: { id } });
  if (!existing) return null;

  const anyInput = input as unknown as Record<string, unknown>;
  const data: Prisma.NoteUncheckedUpdateInput = {};

  if ('title' in input) {
    data.title = anyInput.title as string;
  }
  if ('contentText' in input) {
    data.content = anyInput.contentText as string;
  }
  if ('contentJson' in input) {
    data.contentJson = anyInput.contentJson ?? Prisma.JsonNull;
  }
  if ('clientId' in input) {
    data.clientId = (anyInput.clientId as string) || null;
  }
  if ('projectId' in input) {
    data.projectId = (anyInput.projectId as string) || null;
  }

  // Task-specific fields
  if ('status' in input) {
    data.taskStatus = taskStatusToDb(anyInput.status as TaskStatus);
  }
  if ('priority' in input) {
    data.taskPriority = taskPriorityToDb(anyInput.priority as TaskPriority);
  }
  if ('dueDate' in input) {
    data.taskDueDate = anyInput.dueDate 
      ? new Date(anyInput.dueDate as string) 
      : null;
  }
  if ('ticketPhaseCode' in input) {
    data.taskTicketPhaseCode = (anyInput.ticketPhaseCode as string) || null;
  }
  if ('shortDescription' in input) {
    data.taskShortDescription = (anyInput.shortDescription as string) || null;
  }
  if ('budgetHours' in input) {
    data.taskBudgetHours = (anyInput.budgetHours as number) || null;
  }

  // Connection-specific fields
  if ('url' in input) {
    data.connectionUrl = (anyInput.url as string) || null;
  }
  if ('username' in input) {
    data.connectionUsername = (anyInput.username as string) || null;
  }
  if ('password' in input) {
    data.connectionCredentials = (anyInput.password as string) || null;
  }

  // ignore any leftover timesheet-specific fields; these are handled via the
  // dedicated timesheet infrastructure now.

  // Archive field - convert archivedAt (string|undefined) to archived (boolean)
  if ('archivedAt' in input) {
    data.archived = anyInput.archivedAt ? true : false;
  }

  // Attachments field
  if ('attachments' in input) {
    data.attachments = anyInput.attachments as Prisma.InputJsonValue;
  }

  // REQ-006: Favorites field
  if ('isFavorite' in input) {
    data.isFavorite = anyInput.isFavorite as boolean;

    // When *unfavoriting*, avoid bumping updatedAt so it doesn't count as "recent".
    // This allows users to remove from favorites without moving it to the top of recent items.
    if (existing.isFavorite && data.isFavorite === false) {
      data.updatedAt = existing.updatedAt;
    }
  }

  // REQ-008.2: Favorite order field
  if ('favoriteOrder' in input) {
    data.favoriteOrder = anyInput.favoriteOrder as number | null;
  }

  const updated = await prisma.note.update({ 
    where: { id }, 
    data,
    include: { attachmentFiles: true }, // REQ-007
  });
  return toNote(updated) as T;
}

// ============================================================================
// Delete Note
// ============================================================================

export async function deleteNote(id: string): Promise<boolean> {
  try {
    await prisma.note.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Archive / Restore
// ============================================================================

export async function archiveNote(id: string): Promise<Note | null> {
  try {
    const updated = await prisma.note.update({
      where: { id },
      data: { archived: true },
      include: { attachmentFiles: true }, // REQ-007
    });
    return toNote(updated);
  } catch {
    return null;
  }
}

export async function restoreNote(id: string): Promise<Note | null> {
  try {
    const updated = await prisma.note.update({
      where: { id },
      data: { archived: false },
      include: { attachmentFiles: true }, // REQ-007
    });
    return toNote(updated);
  } catch {
    return null;
  }
}

// ============================================================================
// Attachments (DEPRECATED - REQ-007 uses attachments table directly)
// These functions work on the JSON field for backward compatibility
// ============================================================================

export async function addAttachment(noteId: string, attachment: AttachmentMeta): Promise<Note | null> {
  const note = await prisma.note.findUnique({ where: { id: noteId } });
  if (!note) return null;

  const attachments = (note.attachments as unknown as AttachmentMeta[]) || [];
  attachments.push(attachment);

  const updated = await prisma.note.update({
    where: { id: noteId },
    data: { attachments: attachments as unknown as Prisma.InputJsonValue },
    include: { attachmentFiles: true }, // REQ-007
  });
  return toNote(updated);
}

export async function removeAttachment(noteId: string, attachmentId: string): Promise<Note | null> {
  const note = await prisma.note.findUnique({ where: { id: noteId } });
  if (!note) return null;

  const attachments = (note.attachments as unknown as AttachmentMeta[]) || [];
  const filtered = attachments.filter(a => a.id !== attachmentId);

  const updated = await prisma.note.update({
    where: { id: noteId },
    data: { attachments: filtered as unknown as Prisma.InputJsonValue },
    include: { attachmentFiles: true }, // REQ-007
  });
  return toNote(updated);
}

// ============================================================================
// Task comment helpers (REQ-016)
// ============================================================================

export interface TaskCommentRecord {
  id: string;
  taskId: string;
  author: string;
  content: unknown;
  createdAt: Date;
}

export async function listTaskComments(taskId: string): Promise<TaskCommentRecord[]> {
  return prisma.taskComment.findMany({
    where: { taskId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createTaskComment(data: {
  taskId: string;
  author: string;
  content: Prisma.InputJsonValue;
}): Promise<TaskCommentRecord> {
  const rec = await prisma.taskComment.create({ 
    data: {
      id: randomUUID(),
      ...data,
    } 
  });
  // update task last-modified timestamp so it appears in "Recientes"
  await prisma.note.update({
    where: { id: data.taskId },
    data: { updatedAt: new Date() },
  });
  // record in activity log
  await prisma.taskActivityLog.create({
    data: {
      id: randomUUID(),
      taskId: data.taskId,
      eventType: 'COMMENT_CREATED',
      description: data.author,
    }
  });
  return rec;
}

export async function updateTaskComment(id: string, content: Prisma.InputJsonValue): Promise<TaskCommentRecord> {
  const rec = await prisma.taskComment.update({ where: { id }, data: { content } });
  // update task last-modified timestamp so it appears in "Recientes"
  await prisma.note.update({
    where: { id: rec.taskId },
    data: { updatedAt: new Date() },
  });
  // log update (author not tracked here)
  await prisma.taskActivityLog.create({
    data: {
      id: randomUUID(),
      taskId: rec.taskId,
      eventType: 'COMMENT_UPDATED',
      description: id,
    }
  });
  return rec;
}

export async function deleteTaskComment(id: string): Promise<void> {
  const rec = await prisma.taskComment.findUnique({ where: { id } });
  if (rec) {
    // update task last-modified timestamp so it appears in "Recientes"
    await prisma.note.update({
      where: { id: rec.taskId },
      data: { updatedAt: new Date() },
    });
    await prisma.taskActivityLog.create({
      data: {
        id: randomUUID(),
        taskId: rec.taskId,
        eventType: 'COMMENT_DELETED',
        description: id,
      }
    });
  }
  await prisma.taskComment.delete({ where: { id } });
}

// ============================================================================
// Timesheets Export
