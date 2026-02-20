// Domain type definitions for Pietrosoft Notes

// ============================================================================
// Common Types
// ============================================================================

export type UUID = string;

export interface Timestamps {
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  deletedAt?: string; // Soft delete timestamp
  archivedAt?: string;
  lastOpenedAt?: string;
}

// ============================================================================
// Client
// ============================================================================

export interface Client {
  id: UUID;
  name: string;
  description?: string;
  icon: string; // Icon key/name
  disabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateClientInput = Omit<Client, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateClientInput = Partial<Omit<Client, 'id' | 'createdAt' | 'updatedAt'>>;

// ============================================================================
// Project
// ============================================================================

export interface Project {
  id: UUID;
  clientId: UUID; // Required - must belong to a client
  name: string;
  code?: string;
  description?: string;
  disabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateProjectInput = Omit<Project, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateProjectInput = Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>;

// ============================================================================
// Note Types
// ============================================================================

export type NoteType = 'general' | 'task' | 'connection' | 'timesheet';

// Task-specific enums
export type TaskStatus = 'NONE' | 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | 'CANCELED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

// TimeSheet-specific enum
export type TimeSheetState = 'NONE' | 'PENDING' | 'IMPUTED';

// ============================================================================
// Attachment
// ============================================================================

export interface AttachmentMeta {
  id: UUID;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number; // bytes
  createdAt: string;
}

// ============================================================================
// Note Base
// ============================================================================

export interface NoteBase extends Timestamps {
  id: UUID;
  type: NoteType;
  title: string;
  contentJson: object | null; // TipTap JSON
  contentText: string; // Derived plain text for search
  attachments: AttachmentMeta[];
}

// ============================================================================
// General Note
// ============================================================================

export interface GeneralNote extends NoteBase {
  type: 'general';
  clientId?: UUID;
  projectId?: UUID;
}

// ============================================================================
// Task Note
// ============================================================================

export interface TaskFields {
  projectId: UUID; // Required
  ticketPhaseCode: string; // Required, alphanumeric
  shortDescription: string; // Required
  budgetHours?: number | null; // Nullable, decimals allowed
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string; // ISO 8601
}

export interface TaskNote extends NoteBase, TaskFields {
  type: 'task';
}

// ============================================================================
// Connection Note
// ============================================================================

export interface ConnectionFields {
  clientId?: UUID;
  url?: string;
  username?: string;
  password?: string; // Stored plainly in prototype
}

export interface ConnectionNote extends NoteBase, ConnectionFields {
  type: 'connection';
}

// ============================================================================
// TimeSheet Note
// ============================================================================

export interface TimeSheetFields {
  taskId: UUID; // Required
  workDate: string; // Required, ISO 8601 date
  hoursWorked: number; // Required, decimals allowed
  description: string; // Required
  state: TimeSheetState;
}

export interface TimeSheetNote extends NoteBase, TimeSheetFields {
  type: 'timesheet';
}

// ============================================================================
// Union Type
// ============================================================================

export type Note = GeneralNote | TaskNote | ConnectionNote | TimeSheetNote;

// ============================================================================
// Workspace Meta
// ============================================================================

export interface WorkspaceMeta {
  schemaVersion: number;
  createdAt: string;
  lastModifiedAt: string;
}

// ============================================================================
// Input Types for Create/Update
// ============================================================================

export type CreateNoteInput<T extends Note> = Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'contentText' | 'attachments'> & {
  attachments?: AttachmentMeta[];
};

export type UpdateNoteInput<T extends Note> = Partial<Omit<T, 'id' | 'type' | 'createdAt' | 'updatedAt'>>;
