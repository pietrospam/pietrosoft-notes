'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { Note, NoteType } from '@/lib/types';

// ============================================================================
// Types
// ============================================================================

export type ViewType = 'all' | 'general' | 'task' | 'connection' | 'timesheet' | 'archived' | 'config';

export interface TaskFilters {
  status: string;
  clientId: string;
  projectId: string;
}

export interface TimeSheetFilters {
  startDate: string;
  endDate: string;
  clientId: string;
}

interface AppState {
  currentView: ViewType;
  selectedNoteId: string | null;
  notes: Note[];
  searchQuery: string;
  isLoading: boolean;
  taskFilters: TaskFilters;
  timeSheetFilters: TimeSheetFilters;
}

interface AppContextValue extends AppState {
  setCurrentView: (view: ViewType) => void;
  setSelectedNoteId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setTaskFilters: (filters: TaskFilters) => void;
  setTimeSheetFilters: (filters: TimeSheetFilters) => void;
  refreshNotes: () => Promise<void>;
  createNote: (type: NoteType) => Promise<Note | null>;
  updateNote: (id: string, data: Partial<Note>) => Promise<Note | null>;
  deleteNote: (id: string) => Promise<boolean>;
  selectedNote: Note | null;
  filteredNotes: Note[];
}

// ============================================================================
// Context
// ============================================================================

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, setState] = useState<AppState>({
    currentView: 'all',
    selectedNoteId: null,
    notes: [],
    searchQuery: '',
    isLoading: true,
    taskFilters: { status: '', clientId: '', projectId: '' },
    timeSheetFilters: { startDate: '', endDate: '', clientId: '' },
  });

  // Fetch notes from API
  const refreshNotes = useCallback(async () => {
    try {
      setState(s => ({ ...s, isLoading: true }));
      const response = await fetch('/api/notes');
      if (response.ok) {
        const notes = await response.json();
        setState(s => ({ ...s, notes, isLoading: false }));
      }
    } catch (error) {
      console.error('Failed to fetch notes:', error);
      setState(s => ({ ...s, isLoading: false }));
    }
  }, []);

  // Create new note
  const createNote = useCallback(async (type: NoteType): Promise<Note | null> => {
    try {
      const defaultData: Record<NoteType, object> = {
        general: { type: 'general', title: 'New Note', contentJson: null },
        task: { 
          type: 'task', 
          title: 'New Task', 
          contentJson: null,
          projectId: '', // Will need to be set
          ticketPhaseCode: 'NEW',
          shortDescription: 'New task',
          status: 'PENDING',
          priority: 'MEDIUM',
        },
        connection: { type: 'connection', title: 'New Connection', contentJson: null },
        timesheet: { 
          type: 'timesheet', 
          title: 'New Timesheet', 
          contentJson: null,
          taskId: '',
          workDate: new Date().toISOString().split('T')[0],
          hoursWorked: 0,
          description: '',
          state: 'DRAFT',
        },
      };

      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaultData[type]),
      });

      if (response.ok) {
        const note = await response.json();
        setState(s => ({ ...s, notes: [note, ...s.notes], selectedNoteId: note.id }));
        return note;
      }
    } catch (error) {
      console.error('Failed to create note:', error);
    }
    return null;
  }, []);

  // Update note
  const updateNote = useCallback(async (id: string, data: Partial<Note>): Promise<Note | null> => {
    try {
      const response = await fetch(`/api/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const updatedNote = await response.json();
        setState(s => ({
          ...s,
          notes: s.notes.map(n => n.id === id ? updatedNote : n),
        }));
        return updatedNote;
      }
    } catch (error) {
      console.error('Failed to update note:', error);
    }
    return null;
  }, []);

  // Delete note
  const deleteNote = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setState(s => ({
          ...s,
          notes: s.notes.filter(n => n.id !== id),
          selectedNoteId: s.selectedNoteId === id ? null : s.selectedNoteId,
        }));
        return true;
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
    return false;
  }, []);

  // Initial load
  useEffect(() => {
    refreshNotes();
  }, [refreshNotes]);

  // Computed values
  const selectedNote = state.notes.find(n => n.id === state.selectedNoteId) || null;
  
  const filteredNotes = state.notes.filter(note => {
    // Archived view shows only archived notes
    if (state.currentView === 'archived') {
      return !!note.archivedAt;
    }
    
    // Other views exclude archived notes by default
    if (note.archivedAt) return false;
    
    // Filter by view type
    if (state.currentView !== 'all' && state.currentView !== 'config') {
      if (note.type !== state.currentView) return false;
    }
    
    // Apply task filters (Note: clientId filtering requires project lookup, so we skip it here)
    if (note.type === 'task' && state.currentView === 'task') {
      const tf = state.taskFilters;
      const taskNote = note as Note & { status?: string; projectId?: string };
      if (tf.status && taskNote.status !== tf.status) return false;
      if (tf.projectId && taskNote.projectId !== tf.projectId) return false;
    }
    
    // Apply timesheet filters (Note: clientId filtering requires task lookup, so we skip it here)
    if (note.type === 'timesheet' && state.currentView === 'timesheet') {
      const tsf = state.timeSheetFilters;
      const tsNote = note as Note & { workDate?: string };
      if (tsNote.workDate) {
        if (tsf.startDate && tsNote.workDate < tsf.startDate) return false;
        if (tsf.endDate && tsNote.workDate > tsf.endDate) return false;
      }
    }
    
    // Filter by search query
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      return (
        note.title.toLowerCase().includes(query) ||
        note.contentText.toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  const value: AppContextValue = {
    ...state,
    setCurrentView: (view) => setState(s => ({ ...s, currentView: view, selectedNoteId: null })),
    setSelectedNoteId: (id) => setState(s => ({ ...s, selectedNoteId: id })),
    setSearchQuery: (query) => setState(s => ({ ...s, searchQuery: query })),
    setTaskFilters: (filters) => setState(s => ({ ...s, taskFilters: filters })),
    setTimeSheetFilters: (filters) => setState(s => ({ ...s, timeSheetFilters: filters })),
    refreshNotes,
    createNote,
    updateNote,
    deleteNote,
    selectedNote,
    filteredNotes,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
