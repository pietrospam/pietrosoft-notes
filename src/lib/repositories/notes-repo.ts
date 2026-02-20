import * as fs from 'fs/promises';
import { PATHS, readJson, atomicWriteJson, generateId, nowISO, listJsonFiles } from '../storage/file-storage';
import type { Note, NoteType, CreateNoteInput, UpdateNoteInput } from '../types';

// ============================================================================
// Notes Repository (file-per-note approach)
// ============================================================================

// ============================================================================
// Helper: Extract plain text from TipTap JSON
// ============================================================================

function extractTextFromTipTap(json: object | null): string {
  if (!json) return '';
  
  function walk(node: Record<string, unknown>): string {
    let text = '';
    
    if (node.text && typeof node.text === 'string') {
      text += node.text;
    }
    
    if (node.content && Array.isArray(node.content)) {
      for (const child of node.content) {
        text += walk(child as Record<string, unknown>) + ' ';
      }
    }
    
    return text;
  }
  
  return walk(json as Record<string, unknown>).trim().replace(/\s+/g, ' ');
}

// ============================================================================
// CRUD Operations
// ============================================================================

export async function listNotes(options?: {
  type?: NoteType;
  includeDeleted?: boolean;
  includeArchived?: boolean;
}): Promise<Note[]> {
  const files = await listJsonFiles(PATHS.notesDir());
  const notes: Note[] = [];
  
  for (const file of files) {
    const notePath = PATHS.note(file.replace('.json', ''));
    const note = await readJson<Note | null>(notePath, null);
    if (note) {
      // Filter by type if specified
      if (options?.type && note.type !== options.type) continue;
      
      // Filter deleted
      if (!options?.includeDeleted && note.deletedAt) continue;
      
      // Filter archived
      if (!options?.includeArchived && note.archivedAt) continue;
      
      notes.push(note);
    }
  }
  
  // Sort by updatedAt DESC
  return notes.sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getNote(id: string): Promise<Note | null> {
  return readJson<Note | null>(PATHS.note(id), null);
}

export async function createNote<T extends Note>(input: CreateNoteInput<T>): Promise<T> {
  const now = nowISO();
  const id = generateId();
  
  const note = {
    ...input,
    id,
    contentText: extractTextFromTipTap(input.contentJson),
    attachments: input.attachments || [],
    createdAt: now,
    updatedAt: now,
  } as T;
  
  await atomicWriteJson(PATHS.note(id), note);
  
  return note;
}

export async function updateNote<T extends Note>(id: string, input: UpdateNoteInput<T>): Promise<T | null> {
  const existing = await getNote(id);
  if (!existing) return null;
  
  const contentText = input.contentJson 
    ? extractTextFromTipTap(input.contentJson) 
    : existing.contentText;
  
  const updated = {
    ...existing,
    ...input,
    id: existing.id,
    type: existing.type,
    createdAt: existing.createdAt,
    contentText,
    updatedAt: nowISO(),
  } as T;
  
  await atomicWriteJson(PATHS.note(id), updated);
  
  return updated;
}

export async function softDeleteNote(id: string): Promise<Note | null> {
  const existing = await getNote(id);
  if (!existing) return null;
  
  const updated = {
    ...existing,
    deletedAt: nowISO(),
    updatedAt: nowISO(),
  };
  
  await atomicWriteJson(PATHS.note(id), updated);
  
  return updated;
}

export async function restoreNote(id: string): Promise<Note | null> {
  const existing = await getNote(id);
  if (!existing) return null;
  
  const updated = {
    ...existing,
    deletedAt: undefined,
    updatedAt: nowISO(),
  };
  
  await atomicWriteJson(PATHS.note(id), updated);
  
  return updated;
}

export async function archiveNote(id: string): Promise<Note | null> {
  const existing = await getNote(id);
  if (!existing) return null;
  
  const updated = {
    ...existing,
    archivedAt: nowISO(),
    updatedAt: nowISO(),
  };
  
  await atomicWriteJson(PATHS.note(id), updated);
  
  return updated;
}

export async function unarchiveNote(id: string): Promise<Note | null> {
  const existing = await getNote(id);
  if (!existing) return null;
  
  const updated = {
    ...existing,
    archivedAt: undefined,
    updatedAt: nowISO(),
  };
  
  await atomicWriteJson(PATHS.note(id), updated);
  
  return updated;
}

export async function hardDeleteNote(id: string): Promise<boolean> {
  try {
    await fs.unlink(PATHS.note(id));
    return true;
  } catch {
    return false;
  }
}

export async function recordNoteOpened(id: string): Promise<Note | null> {
  const existing = await getNote(id);
  if (!existing) return null;
  
  const updated = {
    ...existing,
    lastOpenedAt: nowISO(),
  };
  
  await atomicWriteJson(PATHS.note(id), updated);
  
  return updated;
}
