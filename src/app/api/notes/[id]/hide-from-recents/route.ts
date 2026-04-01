import { NextResponse } from 'next/server';
import { hideNoteFromRecents } from '@/lib/repositories/notes-repo';

interface RouteParams {
  params: { id: string };
}

export async function POST(request: Request, { params }: RouteParams) {
  console.log('[API] hide-from-recents called for id:', params.id);
  try {
    const note = await hideNoteFromRecents(params.id);
    if (!note) {
      console.warn('[API] hide-from-recents note not found:', params.id);
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }
    console.log('[API] hide-from-recents updated note:', note.id, note.updatedAt);
    return NextResponse.json(note);
  } catch (error) {
    console.error('Error hiding note from recents:', error);
    return NextResponse.json({ error: 'Failed to hide note from recents' }, { status: 500 });
  }
}
