'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import type { Note, NoteType, TaskNote, Client, Project } from '@/lib/types';
import type { ConfigTab } from '../components/ConfigPanel';

// ============================================================================
// Types
// ============================================================================

export type ViewType = 'all' | 'general' | 'task' | 'connection' | 'timesheets' | 'archived' | 'config' | 'favorites' | 'todos' | 'recents' | 'billing'; // REQ-006: Added favorites, REQ-011: Added recents, REQ-021: Added todos, REQ-026: Added billing

export type ActiveTab = 'bitacora' | 'conexiones' | 'timesheets'; // REQ-010: Main navigation tabs

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
  copyWithImagesOnCopy: boolean; // Intercept Ctrl+C and embed images (Outlook-friendly)
  showUnsavedModal: boolean; // Show unsaved changes modal
  pendingAction: (() => void) | null; // Action to execute after save/discard
  lastSaved: Date | null;
  taskFilters: TaskFilters;
  timeSheetFilters: TimeSheetFilters;
  isNotesListCollapsed: boolean; // REQ-001.13.2: NotesList collapsed state
  isAttachmentsSidebarOpen: boolean; // REQ-015: Collapsible attachments panel
  isSidebarVisible: boolean; // visibility of the left navigation sidebar
  recentHours: number; // REQ-011: Intervalo de "Recientes" en horas
  // REQ-010: Tab navigation
  activeTab: ActiveTab;
  selectedTimesheetClientId: string | null; // null = all, string = specific client
  expandedClientIds: string[]; // Which client hierarchies are expanded
  // REQ-012: floating action button helpers
  configRequest: { tab: ConfigTab; create: boolean } | null;
  globalTimeSheetRequest: boolean;
  // Cargar Horas modal
  showCargarHorasModal: boolean;
  // REQ-021: TODOs view filter
  todosFilterTaskId: string | null; // null = show all TODOs, string = show TODOs for specific task
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
  setTodosFilterTaskId: (taskId: string | null) => void; // REQ-021: Filter TODOs view by task
  setSelectedNoteId: (id: string | null) => void;
  setSelectedClientId: (id: string | null) => void;
  toggleTypeFilter: (type: NoteType) => void;
  clearTypeFilters: () => void;
  setSearchQuery: (query: string) => void;
  setRecentHours: (hours: number) => void; // REQ-011
  setTaskFilters: (filters: TaskFilters) => void;
  setTimeSheetFilters: (filters: TimeSheetFilters) => void;
  setIsSaving: (saving: boolean) => void;
  setLastSaved: (date: Date | null) => void;
  setIsDirty: (dirty: boolean) => void;
  setIsNewNote: (isNew: boolean) => void;
  setPendingChanges: (changes: Partial<Note>) => void; // Sync pending changes from inline editors
  toggleAutoSave: () => void;
  setCopyWithImagesOnCopy: (enabled: boolean) => void;
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
  // REQ-015: Attachments sidebar control
  isAttachmentsSidebarOpen: boolean;
  setAttachmentsSidebarOpen: (open: boolean) => void;
  toggleAttachmentsSidebar: () => void;
  // sidebar visibility control (needed when notes list collapses)
  isSidebarVisible: boolean;
  setSidebarVisible: (visible: boolean) => void;
  toggleSidebarVisible: () => void;
  // REQ-010: Tab navigation
  setActiveTab: (tab: ActiveTab) => void;
  setSelectedTimesheetClientId: (clientId: string | null) => void;
  toggleClientExpanded: (clientId: string) => void;
  getParentClients: () => Client[]; // Get clients without parent (top-level or independent)
  // REQ-012: helpers for floating action button triggers
  configRequest: { tab: ConfigTab; create: boolean } | null;
  openConfig: (tab: ConfigTab, create?: boolean) => void;
  clearConfigRequest: () => void;
  globalTimeSheetRequest: boolean;
  requestTimeSheet: () => void;
  clearTimeSheetRequest: () => void;
  // Cargar Horas modal
  showCargarHorasModal: boolean;
  openCargarHorasModal: () => void;
  closeCargarHorasModal: () => void;
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
    activeTypeFilters: ['task', 'general'], // Default for bitacora tab (excludes connections)
    notes: [],
    clients: [],
    projects: [],
    searchQuery: '',
    isLoading: true,
    isSaving: false,
    isDirty: false,
    isNewNote: false, // Is current note new (not yet in DB)
    autoSaveEnabled: true, // Default to enabled
    copyWithImagesOnCopy: false, // Ctrl+C should embed images by default off
    showUnsavedModal: false,
    pendingAction: null,
    lastSaved: null,
    taskFilters: { status: '', clientId: '', projectId: '' },
    timeSheetFilters: { startDate: '', endDate: '', clientId: '' },
    isNotesListCollapsed: false, // REQ-001.13.2: NotesList collapsed state
    isAttachmentsSidebarOpen: false, // REQ-015: sidebar collapsed by default
    isSidebarVisible: true, // track sidebar visibility for collapse behaviour
    recentHours: 8, // REQ-011: Recents view interval (hours)
    // REQ-010: Tab navigation
    activeTab: 'bitacora',
    configRequest: null,
    globalTimeSheetRequest: false,
    showCargarHorasModal: false,
    todosFilterTaskId: null, // REQ-021: TODOs view filter
    selectedTimesheetClientId: null,
    expandedClientIds: [],
    // REQ-012: FAB helpers have been initialized above
    editorModal: {
      isOpen: false,
      mode: 'create',
      noteType: null,
      noteId: null,
    },
  });

  // keep track of previous sidebar visibility so we can restore it
  const prevSidebarVisibleRef = useRef<boolean>(state.isSidebarVisible);

  // Load auto-save preference from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('bitacora-autosave');
    if (saved !== null) {
      setState(s => ({ ...s, autoSaveEnabled: saved === 'true' }));
    }

    const savedCopyImages = localStorage.getItem('bitacora-copy-images-on-copy');
    if (savedCopyImages !== null) {
      setState(s => ({ ...s, copyWithImagesOnCopy: savedCopyImages === 'true' }));
    }

    const savedRecentHours = localStorage.getItem('bitacora-recents-hours');
    if (savedRecentHours !== null) {
      const parsed = parseInt(savedRecentHours, 10);
      if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 168) {
        setState(s => ({ ...s, recentHours: parsed }));
      }
    }
    
    // REQ-010: Load tab preferences from localStorage
    const savedTab = localStorage.getItem('bitacora-active-tab') as ActiveTab | null;
    if (savedTab && (savedTab === 'bitacora' || savedTab === 'conexiones' || savedTab === 'timesheets')) {
      setState(s => ({ 
        ...s, 
        activeTab: savedTab,
        currentView: savedTab === 'timesheets' ? 'timesheets' : s.currentView,
        activeTypeFilters: savedTab === 'conexiones' ? ['connection'] : savedTab === 'bitacora' ? ['task', 'general'] : []
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

  // Ref to track last seen updatedAt (for polling new/updated notes)
  const lastUpdateRef = useRef<string | null>(null);

  // Ref to track pending changes for save
  const pendingChangesRef = useRef<Partial<Note>>({});

  // Audio notification for new/updated notes via mail ingest
  const playNotificationSound = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.1;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // ignore if audio not available
    }
  }, []);

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
        const notes: Note[] = await response.json();
        setState(s => ({ ...s, notes, isLoading: false }));
        // Track last updatedAt for polling
        const maxUpdated = notes.reduce((max, note) => {
          const t = new Date(note.updatedAt).toISOString();
          return t > max ? t : max;
        }, lastUpdateRef.current || new Date(0).toISOString());
        lastUpdateRef.current = maxUpdated;
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

  // REQ-012: support opening config panel and quick timesheet from FAB
  const openConfig = useCallback((tab: ConfigTab, create: boolean = false) => {
    setState(s => ({ ...s, currentView: 'config', configRequest: { tab, create } }));
  }, [setState]);

  const clearConfigRequest = useCallback(() => {
    setState(s => ({ ...s, configRequest: null }));
  }, [setState]);

  const requestTimeSheet = useCallback(() => {
    setState(s => ({ ...s, currentView: 'timesheets', globalTimeSheetRequest: true }));
  }, [setState]);

  const clearTimeSheetRequest = useCallback(() => {
    setState(s => ({ ...s, globalTimeSheetRequest: false }));
  }, [setState]);

  // Cargar Horas modal controls
  const openCargarHorasModal = useCallback(() => {
    setState(s => ({ ...s, showCargarHorasModal: true }));
  }, [setState]);

  const closeCargarHorasModal = useCallback(() => {
    setState(s => ({ ...s, showCargarHorasModal: false }));
  }, [setState]);

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

  // Enable/disable embedding images when copying (Ctrl+C)
  const setCopyWithImagesOnCopy = useCallback((enabled: boolean) => {
    setState(s => {
      localStorage.setItem('bitacora-copy-images-on-copy', String(enabled));
      return { ...s, copyWithImagesOnCopy: enabled };
    });
  }, []);

  // Initial load
  useEffect(() => {
    refreshNotes();
    refreshClients();
  }, [refreshNotes, refreshClients]);

  // Poll for new/updated notes (used for mail-ingest notifications)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const lastUpdate = lastUpdateRef.current;
        if (!lastUpdate) return;
        const res = await fetch(`/api/notes?since=${encodeURIComponent(lastUpdate)}`);
        if (!res.ok) return;
        const newNotes: Note[] = await res.json();
        if (newNotes.length > 0) {
          playNotificationSound();
          refreshNotes();
        }
      } catch {
        // ignore polling errors
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [refreshNotes, playNotificationSound]);

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

      // Support special raw HTML nodes produced by mail ingest
      if (n.type === 'html' && typeof (n as { html?: unknown }).html === 'string') {
        // Strip tags for search indexing
        return (n as { html: string }).html.replace(/<[^>]*>/g, ' ');
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
    
    // When searching, ignore all filters except archived (search across everything)
    if (state.searchQuery) {
      // Still exclude archived unless in archived or recents view
      if (note.archivedAt && state.currentView !== 'archived' && state.currentView !== 'recents') return false;

      // Apply recents time window even when searching
      if (state.currentView === 'recents') {
        const cutoff = Date.now() - state.recentHours * 3600 * 1000;
        if (new Date(note.updatedAt).getTime() < cutoff) return false;
      }

      const query = state.searchQuery.toLowerCase();
      const titleMatch = note.title.toLowerCase().includes(query);
      const contentTextMatch = note.contentText.toLowerCase().includes(query);
      const contentJsonText = extractTextFromJson(note.contentJson).toLowerCase();
      const jsonMatch = contentJsonText.includes(query);

      // REQ-009 & REQ-001: also search task-specific fields (ticket number and short description)
      let ticketMatch = false;
      let shortDescMatch = false;
      if ('ticketPhaseCode' in note) {
        // note must be a TaskNote when it has ticketPhaseCode
        const t = (note as TaskNote).ticketPhaseCode;
        ticketMatch = !!t && t.toLowerCase().includes(query);
      }
      if ('shortDescription' in note) {
        const s = (note as TaskNote).shortDescription;
        shortDescMatch = !!s && s.toLowerCase().includes(query);
      }

      return titleMatch || contentTextMatch || jsonMatch || ticketMatch || shortDescMatch;
    }
    
    // Recents view shows notes updated within the configured interval (ignore other filters)
    if (state.currentView === 'recents') {
      const cutoff = Date.now() - state.recentHours * 3600 * 1000;
      if (new Date(note.updatedAt).getTime() < cutoff) return false;
      return true;
    }

    // Archived view shows only archived notes (but still applies type filters)
    if (state.currentView === 'archived') {
      if (!note.archivedAt) return false;
      // Apply type filters in archived view too (for conexiones tab)
      if (state.activeTypeFilters.length > 0 && !state.activeTypeFilters.includes(note.type)) {
        return false;
      }
      return true;
    }
    
    // REQ-006: Favorites view shows only favorites (non-archived)
    if (state.currentView === 'favorites') {
      if (!note.isFavorite || note.archivedAt) return false;
      // Apply type filters in favorites view too (for conexiones tab)
      if (state.activeTypeFilters.length > 0 && !state.activeTypeFilters.includes(note.type)) {
        return false;
      }
      return true;
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

  // Sort notes list order
  // - Favorites: user-defined order (favoriteOrder)
  // - All other views: most recently updated first
  const sortedFilteredNotes = state.currentView === 'favorites'
    ? filteredNotes.sort((a, b) => (a.favoriteOrder || 999) - (b.favoriteOrder || 999))
    : [...filteredNotes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  // REQ-006: Count favorites (non-archived non-timesheets)
  const favoritesCount = state.notes.filter(n => 
    n.isFavorite && !n.archivedAt
  ).length;

  const value: AppContextValue = {
    ...state,
    setCurrentView: (view) => setState(s => ({ ...s, currentView: view, selectedNoteId: null, isNewNote: false })),
    setTodosFilterTaskId: (taskId) => setState(s => ({ ...s, todosFilterTaskId: taskId })), // REQ-021
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
    setRecentHours: (hours) => {
      const validHours = Math.min(168, Math.max(1, Math.round(hours)));
      localStorage.setItem('bitacora-recents-hours', String(validHours));
      setState(s => ({ ...s, recentHours: validHours }));
    },
    setTaskFilters: (filters) => setState(s => ({ ...s, taskFilters: filters })),
    setTimeSheetFilters: (filters) => setState(s => ({ ...s, timeSheetFilters: filters })),
    setIsSaving: (saving) => setState(s => ({ ...s, isSaving: saving })),
    setLastSaved: (date) => setState(s => ({ ...s, lastSaved: date })),
    setIsDirty: (dirty) => setState(s => ({ ...s, isDirty: dirty })),
    setPendingChanges: (changes) => { pendingChangesRef.current = changes; },
    setIsNewNote: (isNew) => setState(s => ({ ...s, isNewNote: isNew })),
    toggleAutoSave,
    setCopyWithImagesOnCopy,
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
    setNotesListCollapsed: (collapsed) => {
      setState(s => {
        if (collapsed) {
          // remember current sidebar visibility and hide it
          prevSidebarVisibleRef.current = s.isSidebarVisible;
          return { ...s, isNotesListCollapsed: true, isSidebarVisible: false };
        } else {
          // restore previous sidebar visibility
          return { ...s, isNotesListCollapsed: false, isSidebarVisible: prevSidebarVisibleRef.current };
        }
      });
    },
    toggleNotesListCollapsed: () => {
      setState(s => {
        const willCollapse = !s.isNotesListCollapsed;
        if (willCollapse) {
          prevSidebarVisibleRef.current = s.isSidebarVisible;
          return { ...s, isNotesListCollapsed: true, isSidebarVisible: false };
        } else {
          return { ...s, isNotesListCollapsed: false, isSidebarVisible: prevSidebarVisibleRef.current };
        }
      });
    },
    // REQ-015: Attachments sidebar control
    setAttachmentsSidebarOpen: (open) => {
      setState(s => ({ ...s, isAttachmentsSidebarOpen: open }));
    },
    toggleAttachmentsSidebar: () => {
      setState(s => ({ ...s, isAttachmentsSidebarOpen: !s.isAttachmentsSidebarOpen }));
    },
    // sidebar visibility helpers
    isSidebarVisible: state.isSidebarVisible,
    setSidebarVisible: (visible) => setState(s => ({ ...s, isSidebarVisible: visible })),
    toggleSidebarVisible: () => setState(s => ({ ...s, isSidebarVisible: !s.isSidebarVisible })),
    // REQ-010: Tab navigation
    setActiveTab: (tab) => {
      localStorage.setItem('bitacora-active-tab', tab);
      setState(s => ({ 
        ...s, 
        activeTab: tab,
        currentView: tab === 'timesheets' ? 'timesheets' : (s.currentView === 'timesheets' ? 'all' : s.currentView),
        activeTypeFilters: tab === 'conexiones' ? ['connection'] : tab === 'bitacora' ? ['task', 'general'] : []
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
    // REQ-012: config/tab request helpers
    configRequest: state.configRequest,
    openConfig,
    clearConfigRequest,
    // REQ-012: timesheet request helpers
    globalTimeSheetRequest: state.globalTimeSheetRequest,
    requestTimeSheet,
    clearTimeSheetRequest,
    // Cargar Horas modal
    showCargarHorasModal: state.showCargarHorasModal,
    openCargarHorasModal,
    closeCargarHorasModal,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
