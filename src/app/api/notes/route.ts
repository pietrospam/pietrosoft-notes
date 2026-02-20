import { NextResponse } from 'next/server';
import { listNotes, createNote } from '@/lib/repositories/notes-repo';
import { ensureWorkspaceDirectories } from '@/lib/storage/file-storage';
import type { Note, NoteType, CreateNoteInput } from '@/lib/types';

// GET /api/notes - List all notes
export async function GET(request: Request) {
  try {
    await ensureWorkspaceDirectories();
    
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as NoteType | null;
    const includeDeleted = searchParams.get('includeDeleted') === 'true';
    const includeArchived = searchParams.get('includeArchived') === 'true';
    
    const notes = await listNotes({
      type: type || undefined,
      includeDeleted,
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
    await ensureWorkspaceDirectories();
    
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
      const taskBody = body as CreateNoteInput<Note> & { projectId?: string; ticketPhaseCode?: string; shortDescription?: string };
      if (!taskBody.projectId) {
        return NextResponse.json(
          { error: 'projectId is required for task notes' },
          { status: 400 }
        );
      }
      if (!taskBody.ticketPhaseCode) {
        return NextResponse.json(
          { error: 'ticketPhaseCode is required for task notes' },
          { status: 400 }
        );
      }
      if (!taskBody.shortDescription) {
        return NextResponse.json(
          { error: 'shortDescription is required for task notes' },
          { status: 400 }
        );
      }
    }
    
    if (body.type === 'timesheet') {
      const tsBody = body as CreateNoteInput<Note> & { taskId?: string; workDate?: string; hoursWorked?: number; description?: string };
      if (!tsBody.taskId) {
        return NextResponse.json(
          { error: 'taskId is required for timesheet notes' },
          { status: 400 }
        );
      }
      if (!tsBody.workDate) {
        return NextResponse.json(
          { error: 'workDate is required for timesheet notes' },
          { status: 400 }
        );
      }
      if (typeof tsBody.hoursWorked !== 'number') {
        return NextResponse.json(
          { error: 'hoursWorked is required for timesheet notes' },
          { status: 400 }
        );
      }
      if (!tsBody.description) {
        return NextResponse.json(
          { error: 'description is required for timesheet notes' },
          { status: 400 }
        );
      }
    }
    
    const note = await createNote(body);
    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error('Error creating note:', error);
    return NextResponse.json(
      { error: 'Failed to create note' },
      { status: 500 }
    );
  }
}
