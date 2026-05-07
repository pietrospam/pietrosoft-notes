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
  color?: string; // REQ-008.3: Client color (hex code)
  parentClientId?: string; // REQ-010: Reference to parent client
  disabled?: boolean;
  createdAt: string;
  updatedAt: string;
  subClients?: Client[]; // REQ-010: Sub-clients (populated by API)
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

export type NoteType = 'general' | 'task' | 'connection'; // timesheet moved to separate entity

// Task-specific enums
export type TaskStatus = 'NONE' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// TimeSheet-specific enum
export type TimeSheetState = 'NONE' | 'DRAFT' | 'FINAL';

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
// Timesheet entity (now separate from Note)
// ============================================================================

export interface TimeSheet {
  id: UUID;
  workDate: string;
  hoursWorked: number;
  description?: string;
  taskId?: UUID;
  projectId?: UUID;
  clientId?: UUID;
  rate?: number;
  state: TimeSheetState;
  createdAt: string;
  updatedAt: string;
}

export type CreateTimeSheetInput = Omit<TimeSheet, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateTimeSheetInput = Partial<CreateTimeSheetInput>;

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
  isFavorite: boolean; // REQ-006: Favorites
  favoriteOrder?: number; // REQ-008.2: Position in favorites
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
// TimeSheet Note (deprecated, timesheets moved to separate entity)
// ============================================================================

// NOTE: previously timesheets were stored as notes of type 'timesheet'.
// The new `TimeSheet` interface above now represents standalone entries and
// the Note union no longer includes timesheet cases. The legacy types remain
// only for historical reference and will not be used anywhere in the app.

// ============================================================================
// Union Type
// ============================================================================

export type Note = GeneralNote | TaskNote | ConnectionNote;

export interface TaskComment {
  id: UUID;
  taskId: UUID;
  author: string;
  content: unknown; // TipTap JSON
  createdAt: string; // ISO timestamp
}

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

// ============================================================================
// REQ-010: Task Activity Log Types
// ============================================================================

export type TaskActivityEventType =
  | 'CREATED'
  | 'TITLE_CHANGED'
  | 'STATUS_CHANGED'
  | 'PRIORITY_CHANGED'
  | 'PROJECT_CHANGED'
  | 'CLIENT_CHANGED'
  | 'DUE_DATE_CHANGED'
  | 'CONTENT_UPDATED'
  | 'TIMESHEET_ADDED'
  | 'TIMESHEET_MODIFIED'
  | 'TIMESHEET_DELETED'
  | 'ATTACHMENT_ADDED'
  | 'ATTACHMENT_DELETED'
  | 'ARCHIVED'
  | 'UNARCHIVED'
  | 'FAVORITED'
  | 'UNFAVORITED';

export interface TaskActivityLog {
  id: UUID;
  taskId: UUID;
  eventType: TaskActivityEventType;
  description?: string;
  createdAt: string;
}

// ============================================================================
// REQ-021: Task TODO Types
// ============================================================================

export type TodoStatus = 'pending' | 'completed' | 'deleted';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval?: number; // Every N days/weeks/months (default 1)
  endDate?: string; // ISO 8601 date when recurrence stops
}

export interface TaskTodo {
  id: UUID;
  taskId?: UUID;
  clientId?: UUID;
  author: string;
  content: unknown; // TipTap JSON
  deadline?: string; // ISO 8601 datetime (null for checklist-style TODO)
  status: TodoStatus;
  completedAt?: string;
  deletedAt?: string;
  snoozedUntil?: string; // ISO 8601 datetime
  recurrenceRule?: RecurrenceRule | null;
  recurrenceParentId?: string;
  createdAt: string;
}

export type CreateTodoInput = {
  taskId?: UUID;
  clientId?: UUID;
  author: string;
  content: unknown;
  deadline?: string;
  recurrenceRule?: RecurrenceRule;
};

export type UpdateTodoInput = Partial<{
  content: unknown;
  deadline: string | null;
  status: TodoStatus;
  snoozedUntil: string | null;
  recurrenceRule: RecurrenceRule | null;
}>;

// Todo with related task info for sidebar display
export interface TodoWithTask extends TaskTodo {
  task?: {
    id: UUID;
    title: string;
    ticketPhaseCode?: string;
    projectId?: UUID;
  };
  client?: {
    id: UUID;
    name: string;
  };
}

// ============================================================================
// REQ-021: Telegram TODO Notification Config
// ============================================================================

export interface TodoNotificationConfig {
  enabled: boolean;
  dailySummaryTime?: string; // HH:mm format, e.g., "08:00"
  reminderMinutes?: number[]; // Minutes before deadline to send reminders, e.g., [60, 15]
}

export type TodoNotificationType = 'daily_summary' | 'reminder' | 'overdue';

// ============================================================================
// REQ-026: Billing Types
// ============================================================================

export type BillingAuthType = 'none' | 'bearer' | 'basic' | 'apiKeyHeader' | 'apiKeyQuery';

export interface BillingAuthConfig {
  token?: string;        // For bearer
  username?: string;     // For basic
  password?: string;     // For basic
  headerName?: string;   // For apiKeyHeader
  headerValue?: string;  // For apiKeyHeader
  queryParam?: string;   // For apiKeyQuery
  queryValue?: string;   // For apiKeyQuery
}

export interface BillingMethod {
  id: UUID;
  name: string;
  endpointUrl: string;
  authType: BillingAuthType;
  authConfig?: BillingAuthConfig;
  payloadTemplate?: Record<string, unknown>; // Template JSON for invoice payload
  nextInvoiceNumber: number; // Per-method invoice counter
  invoicePrefix?: string; // Optional prefix e.g. "FAC-"
  clientParentId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  clientName?: string;
}

export type CreateBillingMethodInput = Omit<BillingMethod, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateBillingMethodInput = Partial<CreateBillingMethodInput>;

export type BillingRunStatus = 'pending' | 'success' | 'failed';

export interface BillingRun {
  id: UUID;
  clientParentId: UUID;
  year: number;
  month: number;
  methodId: UUID;
  invoiceNumber?: string;
  totalHours: number;
  totalAmount?: number;
  currency?: string;
  requestJson: Record<string, unknown>;
  responseStatus?: number;
  responseBody?: string;
  pdfFilename?: string;
  status: BillingRunStatus;
  validated: boolean;
  sentToClient: boolean;
  errorText?: string;
  noteId?: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  updatedAt: string;
  // Enriched (optional, from joins)
  clientName?: string;
  methodName?: string;
}

export interface BillingPreview {
  clientParentId: UUID;
  clientName: string;
  year: number;
  month: number;
  periodStart: string;
  periodEnd: string;
  totalHours: number;
  entryCount: number;
  entries: Array<{
    taskCode: string;
    taskTitle: string;
    projectName: string;
    hours: number;
  }>;
  dailyEntries: Array<{
    date: string; // YYYY-MM-DD
    totalHours: number;
    entries: Array<{
      taskCode: string;
      taskTitle: string;
      projectName: string;
      description: string;
      hours: number;
    }>;
  }>;
}

export interface CreateBillingRunInput {
  clientParentId: UUID;
  year: number;
  month: number;
  methodId: UUID;
  periodStart: string;
  periodEnd: string;
  requestJsonOverride?: Record<string, unknown>; // Optional override of generated payload
}