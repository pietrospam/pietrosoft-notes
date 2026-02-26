import { NextResponse } from 'next/server';
import { getNote, updateNote, deleteNote } from '@/lib/repositories/notes-repo';
import { 
  createActivityLogs, 
  createPlaceholderTimesheet,
  getPlaceholderTimesheetDescription,
  shouldCreatePlaceholderTimesheet,
  getStatusChangeDescription,
  getPriorityChangeDescription,
  getTitleChangeDescription,
  getProjectChangeDescription,
  getDueDateChangeDescription,
} from '@/lib/repositories/activity-log-repo';
import type { Note, UpdateNoteInput, TaskActivityEventType, TaskNote } from '@/lib/types';

interface RouteParams {
  params: { id: string };
}

// GET /api/notes/:id - Get a single note
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const note = await getNote(params.id);
    if (!note) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(note);
  } catch (error) {
    console.error('Error getting note:', error);
    return NextResponse.json(
      { error: 'Failed to get note' },
      { status: 500 }
    );
  }
}

// PUT /api/notes/:id - Update a note
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const body = await request.json() as UpdateNoteInput<Note>;
    
    // REQ-010: Get old note for comparison (for task activity logging)
    const oldNote = await getNote(params.id);
    
    const note = await updateNote(params.id, body);
    if (!note) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }
    
    // REQ-010: Log activity for task updates
    if (note.type === 'task' && oldNote) {
      try {
        const events = detectTaskChanges(oldNote as TaskNote, note as TaskNote, body);
        if (events.length > 0) {
          await createActivityLogs(note.id, events);
          
          // Create placeholder timesheet for first non-timesheet event
          const firstLoggableEvent = events.find(e => shouldCreatePlaceholderTimesheet(e.eventType));
          if (firstLoggableEvent) {
            const description = getPlaceholderTimesheetDescription(firstLoggableEvent.eventType);
            await createPlaceholderTimesheet(note.id, description);
          }
        }
      } catch (error) {
        console.error('Failed to log task update activity:', error);
        // Don't fail the request if logging fails
      }
    }
    
    return NextResponse.json(note);
  } catch (error) {
    console.error('Error updating note:', error);
    return NextResponse.json(
      { error: 'Failed to update note' },
      { status: 500 }
    );
  }
}

// DELETE /api/notes/:id - Delete a note
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const success = await deleteNote(params.id);
    if (!success) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting note:', error);
    return NextResponse.json(
      { error: 'Failed to delete note' },
      { status: 500 }
    );
  }
}

// ============================================================================
// REQ-010: Helper to detect changes between old and new task
// ============================================================================

function detectTaskChanges(
  oldTask: TaskNote, 
  newTask: TaskNote,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any
): Array<{ eventType: TaskActivityEventType; description?: string }> {
  const events: Array<{ eventType: TaskActivityEventType; description?: string }> = [];
  
  // Title changed
  if ('title' in input && oldTask.title !== newTask.title) {
    events.push({
      eventType: 'TITLE_CHANGED',
      description: getTitleChangeDescription(oldTask.title, newTask.title),
    });
  }
  
  // Status changed
  if ('status' in input && oldTask.status !== newTask.status) {
    events.push({
      eventType: 'STATUS_CHANGED',
      description: getStatusChangeDescription(oldTask.status, newTask.status),
    });
  }
  
  // Priority changed
  if ('priority' in input && oldTask.priority !== newTask.priority) {
    events.push({
      eventType: 'PRIORITY_CHANGED',
      description: getPriorityChangeDescription(oldTask.priority, newTask.priority),
    });
  }
  
  // Project changed
  if ('projectId' in input && oldTask.projectId !== newTask.projectId) {
    events.push({
      eventType: 'PROJECT_CHANGED',
      description: getProjectChangeDescription(newTask.projectId || 'Ninguno'),
    });
  }
  
  // Due date changed
  if ('dueDate' in input && oldTask.dueDate !== newTask.dueDate) {
    events.push({
      eventType: 'DUE_DATE_CHANGED',
      description: getDueDateChangeDescription(newTask.dueDate || null),
    });
  }
  
  // Content updated
  if (('contentText' in input || 'contentJson' in input) && 
      (oldTask.contentText !== newTask.contentText)) {
    events.push({
      eventType: 'CONTENT_UPDATED',
      description: 'Contenido actualizado',
    });
  }
  
  // Archived/Unarchived
  if ('archivedAt' in input) {
    if (!oldTask.archivedAt && newTask.archivedAt) {
      events.push({
        eventType: 'ARCHIVED',
        description: 'Tarea archivada',
      });
    } else if (oldTask.archivedAt && !newTask.archivedAt) {
      events.push({
        eventType: 'UNARCHIVED',
        description: 'Tarea desarchivada',
      });
    }
  }
  
  // Favorited/Unfavorited
  if ('isFavorite' in input) {
    if (!oldTask.isFavorite && newTask.isFavorite) {
      events.push({
        eventType: 'FAVORITED',
        description: 'Marcada como favorita',
      });
    } else if (oldTask.isFavorite && !newTask.isFavorite) {
      events.push({
        eventType: 'UNFAVORITED',
        description: 'Desmarcada de favoritos',
      });
    }
  }
  
  return events;
}
