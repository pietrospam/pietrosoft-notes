import { NextResponse } from 'next/server';
import { listNotes, createNote } from '@/lib/repositories/notes-repo';
import { 
  createActivityLog, 
  createPlaceholderTimesheet,
  getPlaceholderTimesheetDescription,
  shouldCreatePlaceholderTimesheet 
} from '@/lib/repositories/activity-log-repo';
import type { Note, NoteType, CreateNoteInput } from '@/lib/types';

// GET /api/notes - List all notes
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as NoteType | null;
    const includeArchived = searchParams.get('includeArchived') === 'true';
    
    const notes = await listNotes({
      type: type || undefined,
      includeArchived,
    });
    
    return NextResponse.json(notes);
  } catch (error) {
    console.error('Error listing notes:', error);
    return NextResponse.json(
      { error: 'Failed to list notes' },
      { status: 500 }
    );
  }
}

// POST /api/notes - Create a new note
export async function POST(request: Request) {
  try {
    const body = await request.json() as CreateNoteInput<Note>;
    
    // Validate required fields
    if (!body.type || !['general', 'task', 'connection', 'timesheet'].includes(body.type)) {
      return NextResponse.json(
        { error: 'Valid type is required (general, task, connection, timesheet)' },
        { status: 400 }
      );
    }
    
    if (!body.title || typeof body.title !== 'string') {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }
    
    // Type-specific validations
    if (body.type === 'task') {
      // projectId is optional at creation - can be assigned later
      // ticketPhaseCode and shortDescription have defaults
    }
    
    if (body.type === 'timesheet') {
      // All timesheet fields are optional at creation - can be assigned later
      // taskId, workDate, hoursWorked, description
    }
    
    const note = await createNote(body);
    
    // REQ-010: Log activity for task creation
    if (note.type === 'task') {
      try {
        await createActivityLog(note.id, 'CREATED', 'Tarea creada');
        // Create placeholder timesheet
        if (shouldCreatePlaceholderTimesheet('CREATED')) {
          const description = getPlaceholderTimesheetDescription('CREATED');
          await createPlaceholderTimesheet(note.id, description);
        }
      } catch (error) {
        console.error('Failed to log task creation activity:', error);
        // Don't fail the request if logging fails
      }
    }
    
    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error('Error creating note:', error);
    return NextResponse.json(
      { error: 'Failed to create note' },
      { status: 500 }
    );
  }
}
