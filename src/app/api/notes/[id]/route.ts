import { NextResponse } from 'next/server';
import { getNote, updateNote, softDeleteNote } from '@/lib/repositories/notes-repo';
import { ensureWorkspaceDirectories } from '@/lib/storage/file-storage';
import type { Note, UpdateNoteInput } from '@/lib/types';

interface RouteParams {
  params: { id: string };
}

// GET /api/notes/:id - Get a single note
export async function GET(request: Request, { params }: RouteParams) {
  try {
    await ensureWorkspaceDirectories();
    
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
    await ensureWorkspaceDirectories();
    
    const body = await request.json() as UpdateNoteInput<Note>;
    
    const note = await updateNote(params.id, body);
    if (!note) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
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

// DELETE /api/notes/:id - Soft delete a note
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    await ensureWorkspaceDirectories();
    
    const note = await softDeleteNote(params.id);
    if (!note) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(note);
  } catch (error) {
    console.error('Error deleting note:', error);
    return NextResponse.json(
      { error: 'Failed to delete note' },
      { status: 500 }
    );
  }
}
