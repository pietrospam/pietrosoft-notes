import prisma from '../db';
import { NoteType as PrismaNoteType, TaskStatus as PrismaTaskStatus, TaskPriority as PrismaTaskPriority, TimesheetState as PrismaTimesheetState, Prisma } from '@prisma/client';
import type { 
  Note, NoteType, CreateNoteInput, UpdateNoteInput,
  GeneralNote, TaskNote, ConnectionNote, TimeSheetNote,
  AttachmentMeta, TaskStatus, TaskPriority, TimeSheetState
} from '../types';

// ============================================================================
// Type Mappers
// ============================================================================

const noteTypeToDb: Record<NoteType, PrismaNoteType> = {
  general: PrismaNoteType.GENERAL,
  task: PrismaNoteType.TASK,
  connection: PrismaNoteType.CONNECTION,
  timesheet: PrismaNoteType.TIMESHEET,
};

const noteTypeFromDb: Record<PrismaNoteType, NoteType> = {
  [PrismaNoteType.GENERAL]: 'general',
  [PrismaNoteType.TASK]: 'task',
  [PrismaNoteType.CONNECTION]: 'connection',
  [PrismaNoteType.TIMESHEET]: 'timesheet',
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

const timesheetStateToDb = (state: TimeSheetState): PrismaTimesheetState | null => {
  if (state === 'NONE') return null;
  const map: Record<Exclude<TimeSheetState, 'NONE'>, PrismaTimesheetState> = {
    DRAFT: PrismaTimesheetState.DRAFT,
    FINAL: PrismaTimesheetState.FINAL,
  };
  return map[state];
};

const timesheetStateFromDb = (state: PrismaTimesheetState | null): TimeSheetState => {
  if (!state) return 'NONE';
  const map: Record<PrismaTimesheetState, TimeSheetState> = {
    [PrismaTimesheetState.DRAFT]: 'DRAFT',
    [PrismaTimesheetState.FINAL]: 'FINAL',
  };
  return map[state];
};

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
        username: undefined,
        password: p.connectionCredentials ?? undefined,
      } as ConnectionNote;

    case 'timesheet':
      return {
        ...base,
        type: 'timesheet',
        taskId: p.timesheetTaskId || '',
        workDate: p.timesheetDate?.toISOString().split('T')[0] || '',
        hoursWorked: p.timesheetHours || 0,
        description: p.content || '',
        state: timesheetStateFromDb(p.timesheetState),
      } as TimeSheetNote;

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
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (taskStatus && taskStatus !== 'NONE') {
    where.taskStatus = taskStatusToDb(taskStatus);
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
    data.connectionCredentials = (connInput.password as string) || null;
  }

  // Timesheet-specific fields
  if (input.type === 'timesheet') {
    const tsInput = anyInput;
    data.timesheetTaskId = (tsInput.taskId as string) || null;
    data.timesheetDate = tsInput.workDate ? new Date(tsInput.workDate as string) : null;
    data.timesheetHours = (tsInput.hoursWorked as number) || null;
    data.timesheetState = timesheetStateToDb((tsInput.state as TimeSheetState) || 'DRAFT');
    // TimeSheet description is stored in the content field
    if (tsInput.description) {
      data.content = tsInput.description as string;
    }
  }

  const created = await prisma.note.create({ 
    data,
    include: { attachmentFiles: true }, // REQ-007
  });
  return toNote(created) as T;
}

// ============================================================================
// Update Note
// ============================================================================

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
  if ('password' in input) {
    data.connectionCredentials = (anyInput.password as string) || null;
  }

  // Timesheet-specific fields
  if ('taskId' in input) {
    data.timesheetTaskId = (anyInput.taskId as string) || null;
  }
  if ('workDate' in input) {
    data.timesheetDate = anyInput.workDate 
      ? new Date(anyInput.workDate as string) 
      : null;
  }
  if ('hoursWorked' in input) {
    data.timesheetHours = (anyInput.hoursWorked as number) || null;
  }
  if ('state' in input) {
    data.timesheetState = timesheetStateToDb(anyInput.state as TimeSheetState);
  }
  // TimeSheet description field
  if ('description' in input) {
    data.content = (anyInput.description as string) || '';
  }

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
// Timesheets Export
// ============================================================================

export interface TimesheetExportOptions {
  clientId?: string;
  projectId?: string;
  from?: string;
  to?: string;
}

export async function exportTimesheets(options: TimesheetExportOptions = {}): Promise<TimeSheetNote[]> {
  const { clientId, projectId, from, to } = options;

  const where: Prisma.NoteWhereInput = {
    type: PrismaNoteType.TIMESHEET,
  };

  if (clientId) {
    where.clientId = clientId;
  }
  if (projectId) {
    where.projectId = projectId;
  }
  if (from || to) {
    where.timesheetDate = {};
    if (from) {
      where.timesheetDate.gte = new Date(from);
    }
    if (to) {
      where.timesheetDate.lte = new Date(to);
    }
  }

  const notes = await prisma.note.findMany({
    where,
    orderBy: { timesheetDate: 'desc' },
    include: { attachmentFiles: true }, // REQ-007
  });

  return notes.map(toNote) as TimeSheetNote[];
}
