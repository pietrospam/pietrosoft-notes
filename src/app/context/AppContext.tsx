'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import type { Note, NoteType, Client, Project } from '@/lib/types';

// ============================================================================
// Types
// ============================================================================

export type ViewType = 'all' | 'general' | 'task' | 'connection' | 'timesheets' | 'archived' | 'config' | 'favorites'; // REQ-006: Added favorites

export type ActiveTab = 'bitacora' | 'timesheets'; // REQ-010: Main navigation tabs

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
  selectedClientId: string | null; // null = all, 'none' = without client
  activeTypeFilters: NoteType[]; // Active type toggles
  notes: Note[];
  clients: Client[];
  projects: Project[];
  searchQuery: string;
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean; // Has unsaved changes
  isNewNote: boolean; // Is the selected note new (not yet saved to DB)
  autoSaveEnabled: boolean; // Auto-save preference
  showUnsavedModal: boolean; // Show unsaved changes modal
  pendingAction: (() => void) | null; // Action to execute after save/discard
  lastSaved: Date | null;
  taskFilters: TaskFilters;
  timeSheetFilters: TimeSheetFilters;
  isNotesListCollapsed: boolean; // REQ-001.13.2: NotesList collapsed state
  // REQ-010: Tab navigation
  activeTab: ActiveTab;
  selectedTimesheetClientId: string | null; // null = all, string = specific client
  expandedClientIds: string[]; // Which client hierarchies are expanded
  // Editor modal state
  editorModal: {
    isOpen: boolean;
    mode: 'create' | 'edit';
    noteType: NoteType | null;
    noteId: string | null;
  };
}

interface AppContextValue extends AppState {
  setCurrentView: (view: ViewType) => void;
  setSelectedNoteId: (id: string | null) => void;
  setSelectedClientId: (id: string | null) => void;
  toggleTypeFilter: (type: NoteType) => void;
  clearTypeFilters: () => void;
  setSearchQuery: (query: string) => void;
  setTaskFilters: (filters: TaskFilters) => void;
  setTimeSheetFilters: (filters: TimeSheetFilters) => void;
  setIsSaving: (saving: boolean) => void;
  setLastSaved: (date: Date | null) => void;
  setIsDirty: (dirty: boolean) => void;
  setIsNewNote: (isNew: boolean) => void;
  setPendingChanges: (changes: Partial<Note>) => void; // Sync pending changes from inline editors
  toggleAutoSave: () => void;
  confirmNavigation: (action: () => void) => boolean; // Returns true if can proceed immediately
  saveCurrentNote: () => Promise<void>;
  persistNewNote: (noteData: Partial<Note>) => Promise<Note | null>; // Save new note to DB for first time
  discardAndExecute: () => void;
  cancelPendingAction: () => void;
  saveAndExecute: () => Promise<void>;
  refreshNotes: () => Promise<void>;
  refreshClients: () => Promise<void>;
  createNote: (type: NoteType) => Promise<Note | null>;
  updateNote: (id: string, data: Partial<Note>) => Promise<Note | null>;
  deleteNote: (id: string) => Promise<boolean>;
  toggleFavorite: (id: string) => Promise<boolean>; // REQ-006: Toggle favorite status
  reorderFavorites: (orderedIds: string[]) => Promise<boolean>; // REQ-008.2: Reorder favorites
  selectedNote: Note | null;
  filteredNotes: Note[];
  favoritesCount: number; // REQ-006: Count of favorites
  getClientForNote: (note: Note) => Client | null;
  // Editor modal actions
  openEditorModal: (type: NoteType, noteId?: string) => void;
  closeEditorModal: () => void;
  // REQ-001.13.2: NotesList collapse control
  isNotesListCollapsed: boolean;
  setNotesListCollapsed: (collapsed: boolean) => void;
  toggleNotesListCollapsed: () => void;
  // REQ-010: Tab navigation
  setActiveTab: (tab: ActiveTab) => void;
  setSelectedTimesheetClientId: (clientId: string | null) => void;
  toggleClientExpanded: (clientId: string) => void;
  getParentClients: () => Client[]; // Get clients without parent (top-level or independent)
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
    selectedClientId: null,
    activeTypeFilters: [], // Empty = no filter, show all types
    notes: [],
    clients: [],
    projects: [],
    searchQuery: '',
    isLoading: true,
    isSaving: false,
    isDirty: false,
    isNewNote: false, // Is current note new (not yet in DB)
    autoSaveEnabled: true, // Default to enabled
    showUnsavedModal: false,
    pendingAction: null,
    lastSaved: null,
    taskFilters: { status: '', clientId: '', projectId: '' },
    timeSheetFilters: { startDate: '', endDate: '', clientId: '' },
    isNotesListCollapsed: false, // REQ-001.13.2: NotesList collapsed state
    // REQ-010: Tab navigation
    activeTab: 'bitacora',
    selectedTimesheetClientId: null,
    expandedClientIds: [],
    editorModal: {
      isOpen: false,
      mode: 'create',
      noteType: null,
      noteId: null,
    },
  });

  // Load auto-save preference from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('bitacora-autosave');
    if (saved !== null) {
      setState(s => ({ ...s, autoSaveEnabled: saved === 'true' }));
    }
    
    // REQ-010: Load tab preferences from localStorage
    const savedTab = localStorage.getItem('bitacora-active-tab') as ActiveTab | null;
    if (savedTab && (savedTab === 'bitacora' || savedTab === 'timesheets')) {
      setState(s => ({ 
        ...s, 
        activeTab: savedTab,
        currentView: savedTab === 'timesheets' ? 'timesheets' : s.currentView
      }));
    }
    
    const savedTimesheetClient = localStorage.getItem('bitacora-timesheet-client');
    if (savedTimesheetClient) {
      const clientId = savedTimesheetClient === 'all' ? null : savedTimesheetClient;
      setState(s => ({ ...s, selectedTimesheetClientId: clientId }));
    }
    
    // Load expanded clients from localStorage
    const savedExpanded = localStorage.getItem('bitacora-expanded-clients');
    if (savedExpanded) {
      try {
        const expanded = JSON.parse(savedExpanded);
        if (Array.isArray(expanded)) {
          setState(s => ({ ...s, expandedClientIds: expanded }));
        }
      } catch {
        // Ignore invalid JSON
      }
    }
  }, []);

  // Ref to track current notes for optimistic updates (avoids stale closure)
  const notesRef = useRef<Note[]>([]);
  notesRef.current = state.notes;
  
  // Ref to track pending changes for save
  const pendingChangesRef = useRef<Partial<Note>>({});

  // Fetch clients from API
  const refreshClients = useCallback(async () => {
    try {
      const [clientsRes, projectsRes] = await Promise.all([
        fetch('/api/clients'),
        fetch('/api/projects'),
      ]);
      if (clientsRes.ok && projectsRes.ok) {
        const clients = await clientsRes.json();
        const projects = await projectsRes.json();
        setState(s => ({ ...s, clients, projects }));
      }
    } catch (error) {
      console.error('Failed to fetch clients/projects:', error);
    }
  }, []);

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

  // Create new note (local only - not saved to DB yet)
  const createNote = useCallback(async (type: NoteType): Promise<Note | null> => {
    try {
      // Find "General" project for selected client (for tasks)
      let defaultProjectId = '';
      if (type === 'task' && state.selectedClientId && state.selectedClientId !== 'none') {
        const generalProject = state.projects.find(
          p => p.clientId === state.selectedClientId && p.name === 'General'
        );
        if (generalProject) {
          defaultProjectId = generalProject.id;
        }
      }

      // Get clientId for notes that support it (general, connection)
      const clientId = (state.selectedClientId && state.selectedClientId !== 'none') 
        ? state.selectedClientId 
        : undefined;

      // Create a temporary ID for the new note
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date().toISOString();

      const defaultData: Record<NoteType, Note> = {
        general: { 
          id: tempId,
          type: 'general', 
          title: 'Nueva Nota', 
          contentText: '',
          contentJson: null,
          attachments: [],
          clientId,
          isFavorite: false, // REQ-006
          createdAt: now,
          updatedAt: now,
        } as Note,
        task: { 
          id: tempId,
          type: 'task', 
          title: 'Nueva Tarea', 
          contentText: '',
          contentJson: null,
          attachments: [],
          projectId: defaultProjectId,
          ticketPhaseCode: 'NEW',
          shortDescription: 'Nueva tarea',
          status: 'PENDING',
          priority: 'MEDIUM',
          isFavorite: false, // REQ-006
          createdAt: now,
          updatedAt: now,
        } as Note,
        connection: { 
          id: tempId,
          type: 'connection', 
          title: 'Nueva Conexión', 
          contentText: '',
          contentJson: null,
          attachments: [],
          clientId,
          isFavorite: false, // REQ-006
          createdAt: now,
          updatedAt: now,
        } as Note,
        timesheet: { 
          id: tempId,
          type: 'timesheet', 
          title: 'Nuevo TimeSheet', 
          contentText: '',
          contentJson: null,
          attachments: [],
          taskId: '',
          workDate: new Date().toISOString().split('T')[0],
          hoursWorked: 0,
          description: '',
          state: 'DRAFT',
          isFavorite: false, // REQ-006
          createdAt: now,
          updatedAt: now,
        } as Note,
      };

      const newNote = defaultData[type];
      
      // Add to local state without calling API
      setState(s => ({ 
        ...s, 
        notes: [newNote, ...s.notes], 
        selectedNoteId: newNote.id,
        isNewNote: true, // Mark as new (not yet saved)
        isDirty: true, // Mark as dirty since it needs to be saved
      }));
      
      return newNote;
    } catch (error) {
      console.error('Failed to create note:', error);
    }
    return null;
  }, [state.selectedClientId, state.projects]);

  // Persist new note to database (first save)
  const persistNewNote = useCallback(async (noteData: Partial<Note>): Promise<Note | null> => {
    const tempNote = notesRef.current.find(n => n.id === state.selectedNoteId);
    if (!tempNote || !state.selectedNoteId?.startsWith('temp-')) return null;

    setState(s => ({ ...s, isSaving: true }));

    try {
      // Merge temp note with any pending changes
      const dataToSend = { ...tempNote, ...noteData };
      // Remove the temp id - the server will generate a real one
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _tempId, ...noteWithoutId } = dataToSend;

      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteWithoutId),
      });

      if (response.ok) {
        const savedNote = await response.json();
        
        // Replace the temp note with the real one
        setState(s => ({
          ...s,
          notes: s.notes.map(n => n.id === state.selectedNoteId ? savedNote : n),
          selectedNoteId: savedNote.id,
          isNewNote: false,
          isDirty: false,
          isSaving: false,
          lastSaved: new Date(),
        }));
        
        return savedNote;
      } else {
        setState(s => ({ ...s, isSaving: false }));
      }
    } catch (error) {
      console.error('Failed to persist new note:', error);
      setState(s => ({ ...s, isSaving: false }));
    }
    return null;
  }, [state.selectedNoteId]);

  // Update note (optimistic)
  const updateNote = useCallback(async (id: string, data: Partial<Note>): Promise<Note | null> => {
    // Get current note for rollback if needed (use ref to avoid stale closure)
    const currentNote = notesRef.current.find(n => n.id === id);
    if (!currentNote) return null;

    // Optimistically update local state immediately
    const optimisticNote = { ...currentNote, ...data, updatedAt: new Date().toISOString() } as Note;
    setState(s => ({
      ...s,
      notes: s.notes.map(n => n.id === id ? optimisticNote : n),
    }));

    try {
      const response = await fetch(`/api/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const updatedNote = await response.json();
        // Sync with server response (in case of computed fields)
        setState(s => ({
          ...s,
          notes: s.notes.map(n => n.id === id ? updatedNote : n),
        }));
        return updatedNote;
      } else {
        // Rollback on error
        setState(s => ({
          ...s,
          notes: s.notes.map(n => n.id === id ? currentNote : n),
        }));
      }
    } catch (error) {
      console.error('Failed to update note:', error);
      // Rollback on error
      setState(s => ({
        ...s,
        notes: s.notes.map(n => n.id === id ? currentNote : n),
      }));
    }
    return null;
  }, []); // No dependencies - uses notesRef

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

  // REQ-006: Toggle favorite status with optimistic update
  // REQ-008.2: Handle favoriteOrder when toggling
  const toggleFavorite = useCallback(async (id: string): Promise<boolean> => {
    const note = notesRef.current.find(n => n.id === id);
    if (!note) return false;

    const newValue = !note.isFavorite;
    
    // Calculate new favoriteOrder
    let newFavoriteOrder: number | null = null;
    if (newValue) {
      // Find max order and add 1
      const maxOrder = notesRef.current
        .filter(n => n.isFavorite && n.favoriteOrder)
        .reduce((max, n) => Math.max(max, n.favoriteOrder || 0), 0);
      newFavoriteOrder = maxOrder + 1;
    }
    
    // Optimistic update
    setState(s => ({
      ...s,
      notes: s.notes.map(n => n.id === id ? { ...n, isFavorite: newValue, favoriteOrder: newFavoriteOrder ?? undefined } : n),
    }));

    try {
      const response = await fetch(`/api/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: newValue, favoriteOrder: newFavoriteOrder }),
      });
      
      if (response.ok) {
        // Refresh notes to get consistent state
        const notesRes = await fetch('/api/notes');
        if (notesRes.ok) {
          const notes = await notesRes.json();
          setState(s => ({ ...s, notes }));
        }
        return true;
      } else {
        // Revert on failure
        setState(s => ({
          ...s,
          notes: s.notes.map(n => n.id === id ? { ...n, isFavorite: !newValue } : n),
        }));
        return false;
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      // Revert on error
      setState(s => ({
        ...s,
        notes: s.notes.map(n => n.id === id ? { ...n, isFavorite: !newValue } : n),
      }));
      return false;
    }
  }, []);

  // REQ-008.2: Reorder favorites
  const reorderFavorites = useCallback(async (orderedIds: string[]): Promise<boolean> => {
    // Optimistic update
    setState(s => ({
      ...s,
      notes: s.notes.map(n => {
        const index = orderedIds.indexOf(n.id);
        if (index !== -1) {
          return { ...n, favoriteOrder: index + 1 };
        }
        return n;
      }),
    }));

    try {
      const response = await fetch('/api/notes/reorder-favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds }),
      });
      
      if (response.ok) {
        return true;
      } else {
        // Revert by refreshing notes
        const notesRes = await fetch('/api/notes');
        if (notesRes.ok) {
          const notes = await notesRes.json();
          setState(s => ({ ...s, notes }));
        }
        return false;
      }
    } catch (error) {
      console.error('Failed to reorder favorites:', error);
      // Revert by refreshing notes
      const notesRes = await fetch('/api/notes');
      if (notesRes.ok) {
        const notes = await notesRes.json();
        setState(s => ({ ...s, notes }));
      }
      return false;
    }
  }, []);

  // Save current note (flush pending changes)
  const saveCurrentNote = useCallback(async (): Promise<void> => {
    if (!state.selectedNoteId || !state.isDirty) return;
    
    const changes = pendingChangesRef.current;
    
    // For new notes, use persistNewNote
    if (state.isNewNote && state.selectedNoteId.startsWith('temp-')) {
      await persistNewNote(changes);
      pendingChangesRef.current = {};
      return;
    }
    
    if (Object.keys(changes).length === 0) return;
    
    setState(s => ({ ...s, isSaving: true }));
    
    try {
      const response = await fetch(`/api/notes/${state.selectedNoteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      
      if (response.ok) {
        const updatedNote = await response.json();
        setState(s => ({
          ...s,
          notes: s.notes.map(n => n.id === state.selectedNoteId ? updatedNote : n),
          isDirty: false,
          isSaving: false,
          lastSaved: new Date(),
        }));
        pendingChangesRef.current = {};
      } else {
        setState(s => ({ ...s, isSaving: false }));
      }
    } catch (error) {
      console.error('Failed to save note:', error);
      setState(s => ({ ...s, isSaving: false }));
    }
  }, [state.selectedNoteId, state.isDirty, state.isNewNote, persistNewNote]);

  // Check if we can navigate (returns true if no unsaved changes)
  const confirmNavigation = useCallback((action: () => void): boolean => {
    if (!state.isDirty) {
      action();
      return true;
    }
    // Show modal and store pending action
    setState(s => ({ ...s, showUnsavedModal: true, pendingAction: action }));
    return false;
  }, [state.isDirty]);

  // Discard changes and execute pending action
  const discardAndExecute = useCallback(() => {
    const action = state.pendingAction;
    pendingChangesRef.current = {};
    setState(s => ({ 
      ...s, 
      isDirty: false, 
      showUnsavedModal: false, 
      pendingAction: null 
    }));
    if (action) action();
  }, [state.pendingAction]);

  // Cancel pending action (close modal)
  const cancelPendingAction = useCallback(() => {
    setState(s => ({ ...s, showUnsavedModal: false, pendingAction: null }));
  }, []);

  // Save and execute pending action
  const saveAndExecute = useCallback(async () => {
    await saveCurrentNote();
    const action = state.pendingAction;
    setState(s => ({ ...s, showUnsavedModal: false, pendingAction: null }));
    if (action) action();
  }, [saveCurrentNote, state.pendingAction]);

  // Toggle auto-save preference
  const toggleAutoSave = useCallback(() => {
    setState(s => {
      const newValue = !s.autoSaveEnabled;
      localStorage.setItem('bitacora-autosave', String(newValue));
      return { ...s, autoSaveEnabled: newValue };
    });
  }, []);

  // Initial load
  useEffect(() => {
    refreshNotes();
    refreshClients();
  }, [refreshNotes, refreshClients]);

  // Helper to get client for a note
  const getClientForNote = useCallback((note: Note): Client | null => {
    // Direct clientId (GeneralNote, ConnectionNote)
    const anyNote = note as Note & { clientId?: string; projectId?: string; taskId?: string };
    
    if (anyNote.clientId) {
      return state.clients.find(c => c.id === anyNote.clientId) || null;
    }
    
    // TaskNote: get client via project
    if (note.type === 'task' && anyNote.projectId) {
      const project = state.projects.find(p => p.id === anyNote.projectId);
      if (project) {
        return state.clients.find(c => c.id === project.clientId) || null;
      }
    }
    
    // TimeSheetNote: get client via task -> project
    if (note.type === 'timesheet' && anyNote.taskId) {
      const task = state.notes.find(n => n.id === anyNote.taskId) as Note & { projectId?: string } | undefined;
      if (task?.projectId) {
        const project = state.projects.find(p => p.id === task.projectId);
        if (project) {
          return state.clients.find(c => c.id === project.clientId) || null;
        }
      }
    }
    
    return null;
  }, [state.clients, state.projects, state.notes]);

  // Helper to extract text from TipTap JSON content
  const extractTextFromJson = useCallback((json: object | null): string => {
    if (!json) return '';
    
    const extractText = (node: unknown): string => {
      if (!node || typeof node !== 'object') return '';
      const n = node as { type?: string; text?: string; content?: unknown[] };
      
      if (n.type === 'text' && n.text) {
        return n.text;
      }
      
      if (Array.isArray(n.content)) {
        return n.content.map(extractText).join(' ');
      }
      
      return '';
    };
    
    return extractText(json);
  }, []);

  // Computed values
  const selectedNote = state.notes.find(n => n.id === state.selectedNoteId) || null;
  
  const filteredNotes = state.notes.filter(note => {
    // Always exclude timesheets from the notes list (REQ-002)
    // TimeSheets are viewed in dedicated TimeSheetView
    if (note.type === 'timesheet') return false;
    
    // When searching, ignore all filters except archived (search across everything)
    if (state.searchQuery) {
      // Still exclude archived unless in archived view
      if (note.archivedAt && state.currentView !== 'archived') return false;
      
      const query = state.searchQuery.toLowerCase();
      const titleMatch = note.title.toLowerCase().includes(query);
      const contentTextMatch = note.contentText.toLowerCase().includes(query);
      const contentJsonText = extractTextFromJson(note.contentJson).toLowerCase();
      const jsonMatch = contentJsonText.includes(query);
      
      return titleMatch || contentTextMatch || jsonMatch;
    }
    
    // Archived view shows only archived notes
    if (state.currentView === 'archived') {
      return !!note.archivedAt;
    }
    
    // REQ-006: Favorites view shows only favorites (non-archived)
    if (state.currentView === 'favorites') {
      return !!note.isFavorite && !note.archivedAt;
    }
    
    // Other views exclude archived notes by default
    if (note.archivedAt) return false;
    
    // Filter by active type filters (empty = no filter, show all)
    if (state.activeTypeFilters.length > 0 && !state.activeTypeFilters.includes(note.type)) {
      return false;
    }
    
    // Filter by selected client (REQ-010: includes sub-clients when parent is selected)
    if (state.selectedClientId !== null) {
      const noteClient = getClientForNote(note);
      if (state.selectedClientId === 'none') {
        // "Sin Cliente" - notes without a client
        if (noteClient !== null) return false;
      } else {
        // Specific client - also include sub-clients if this is a parent
        const selectedClient = state.clients.find(c => c.id === state.selectedClientId);
        const isParentClient = selectedClient && state.clients.some(c => c.parentClientId === state.selectedClientId);
        
        if (isParentClient) {
          // Include notes from parent and all sub-clients
          const validClientIds = [state.selectedClientId, ...state.clients.filter(c => c.parentClientId === state.selectedClientId).map(c => c.id)];
          if (!noteClient || !validClientIds.includes(noteClient.id)) return false;
        } else {
          // Regular client - match exactly
          if (noteClient?.id !== state.selectedClientId) return false;
        }
      }
    }
    
    return true;
  });

  // REQ-008.2: Sort favorites by favoriteOrder
  const sortedFilteredNotes = state.currentView === 'favorites'
    ? filteredNotes.sort((a, b) => (a.favoriteOrder || 999) - (b.favoriteOrder || 999))
    : filteredNotes;

  // REQ-006: Count favorites (non-archived non-timesheets)
  const favoritesCount = state.notes.filter(n => 
    n.isFavorite && !n.archivedAt && n.type !== 'timesheet'
  ).length;

  const value: AppContextValue = {
    ...state,
    setCurrentView: (view) => setState(s => ({ ...s, currentView: view, selectedNoteId: null, isNewNote: false })),
    setSelectedNoteId: (id) => setState(s => ({ ...s, selectedNoteId: id, isNewNote: id?.startsWith('temp-') ?? false })),
    setSelectedClientId: (id) => setState(s => ({ ...s, selectedClientId: id, selectedNoteId: null, isNewNote: false })),
    toggleTypeFilter: (type) => setState(s => {
      const current = s.activeTypeFilters;
      const isActive = current.includes(type);
      // Single selection: if already active, deactivate (show all). Otherwise, set as only filter.
      return {
        ...s,
        activeTypeFilters: isActive ? [] : [type],
      };
    }),
    clearTypeFilters: () => setState(s => ({ ...s, activeTypeFilters: [] })),
    setSearchQuery: (query) => setState(s => ({ ...s, searchQuery: query })),
    setTaskFilters: (filters) => setState(s => ({ ...s, taskFilters: filters })),
    setTimeSheetFilters: (filters) => setState(s => ({ ...s, timeSheetFilters: filters })),
    setIsSaving: (saving) => setState(s => ({ ...s, isSaving: saving })),
    setLastSaved: (date) => setState(s => ({ ...s, lastSaved: date })),
    setIsDirty: (dirty) => setState(s => ({ ...s, isDirty: dirty })),
    setPendingChanges: (changes) => { pendingChangesRef.current = changes; },
    setIsNewNote: (isNew) => setState(s => ({ ...s, isNewNote: isNew })),
    toggleAutoSave,
    confirmNavigation,
    saveCurrentNote,
    discardAndExecute,
    cancelPendingAction,
    saveAndExecute,
    refreshNotes,
    refreshClients,
    createNote,
    updateNote,
    deleteNote,
    toggleFavorite, // REQ-006
    reorderFavorites, // REQ-008.2
    persistNewNote,
    selectedNote,
    filteredNotes: sortedFilteredNotes,
    favoritesCount, // REQ-006
    getClientForNote,
    // Editor modal actions
    openEditorModal: (type, noteId) => setState(s => ({
      ...s,
      editorModal: {
        isOpen: true,
        mode: noteId ? 'edit' : 'create',
        noteType: type,
        noteId: noteId || null,
      },
    })),
    closeEditorModal: () => setState(s => ({
      ...s,
      editorModal: {
        isOpen: false,
        mode: 'create',
        noteType: null,
        noteId: null,
      },
    })),
    // REQ-001.13.2: NotesList collapse control
    setNotesListCollapsed: (collapsed) => setState(s => ({ ...s, isNotesListCollapsed: collapsed })),
    toggleNotesListCollapsed: () => setState(s => ({ ...s, isNotesListCollapsed: !s.isNotesListCollapsed })),
    // REQ-010: Tab navigation
    setActiveTab: (tab) => {
      localStorage.setItem('bitacora-active-tab', tab);
      setState(s => ({ 
        ...s, 
        activeTab: tab,
        currentView: tab === 'timesheets' ? 'timesheets' : (s.currentView === 'timesheets' ? 'all' : s.currentView)
      }));
    },
    setSelectedTimesheetClientId: (clientId) => {
      localStorage.setItem('bitacora-timesheet-client', clientId || 'all');
      setState(s => ({ ...s, selectedTimesheetClientId: clientId }));
    },
    toggleClientExpanded: (clientId) => {
      setState(s => {
        const expanded = s.expandedClientIds.includes(clientId)
          ? s.expandedClientIds.filter(id => id !== clientId)
          : [...s.expandedClientIds, clientId];
        localStorage.setItem('bitacora-expanded-clients', JSON.stringify(expanded));
        return { ...s, expandedClientIds: expanded };
      });
    },
    getParentClients: () => {
      // Return clients without a parent (top-level clients)
      return state.clients.filter(c => !c.parentClientId && !c.disabled);
    },
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
