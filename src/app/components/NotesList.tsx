'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useApp } from '../context/AppContext';
import { FileText, CheckSquare, Link, Clock, Plus, X, Star, Paperclip, GripVertical, ChevronRight, ChevronLeft } from 'lucide-react';
import { TimeSheetModal } from './TimeSheetModal';
import { TaskEditorModal } from './TaskEditorModal';
import { NoteEditorModal } from './NoteEditorModal';
import { ConnectionEditorModal } from './ConnectionEditorModal';
import { Toast } from './Toast';
import { getContrastTextColor } from '@/lib/colorPalette';
import type { NoteType, TaskNote } from '@/lib/types';

// Note: timesheet is excluded from NotesList filters as per REQ-002
// TimeSheets are now viewed in a dedicated view
type FilterableNoteType = Exclude<NoteType, 'timesheet'>;

const typeIcons: Record<FilterableNoteType, React.ElementType> = {
  general: FileText,
  task: CheckSquare,
  connection: Link,
};

const typeColors: Record<NoteType, string> = {
  general: 'text-gray-400',
  task: 'text-blue-400',
  connection: 'text-green-400',
  timesheet: 'text-orange-400',
};

const typeBgColors: Record<FilterableNoteType, { active: string; inactive: string }> = {
  general: { active: 'bg-gray-600', inactive: 'bg-gray-800' },
  task: { active: 'bg-blue-600', inactive: 'bg-gray-800' },
  connection: { active: 'bg-green-600', inactive: 'bg-gray-800' },
};

const typeLabels: Record<FilterableNoteType, string> = {
  general: 'General',
  task: 'Task',
  connection: 'Conexión',
};

export function NotesList() {
  const { 
    filteredNotes, 
    selectedNoteId, 
    setSelectedNoteId,
    isLoading, 
    currentView,
    activeTypeFilters,
    clearTypeFilters,
    toggleTypeFilter,
    selectedClientId,
    setSelectedClientId,
    clients,
    refreshNotes,
    editorModal,
    openEditorModal,
    closeEditorModal,
    confirmNavigation,
    reorderFavorites,
    toggleFavorite,
    getClientForNote,
    isNotesListCollapsed,
    setNotesListCollapsed,
  } = useApp();
  
  const listRef = useRef<HTMLDivElement>(null);
  const noteRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  
  // Resizable width state
  const [panelWidth, setPanelWidth] = useState(288); // 288px = w-72
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  
  // Create note dropdown and client selector state
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [pendingNoteType, setPendingNoteType] = useState<NoteType | null>(null);
  const createDropdownRef = useRef<HTMLDivElement>(null);
  
  // TimeSheet modal state for quick access from task cards
  const [timeSheetTask, setTimeSheetTask] = useState<TaskNote | null>(null);
  const [toast, setToast] = useState<{ message: string } | null>(null);

  // REQ-008.2: Drag & drop state for reordering favorites
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Track previous collapsed state to detect expansion
  const wasCollapsedRef = useRef(isNotesListCollapsed);

  // Focus selected note when expanding from collapsed state
  useEffect(() => {
    if (wasCollapsedRef.current && !isNotesListCollapsed && selectedNoteId) {
      // Transitioned from collapsed to expanded - focus selected note
      const noteEl = noteRefs.current.get(selectedNoteId);
      if (noteEl) {
        noteEl.focus();
      }
    }
    wasCollapsedRef.current = isNotesListCollapsed;
  }, [isNotesListCollapsed, selectedNoteId]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = panelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [panelWidth]);

  useEffect(() => {
    const handleResizeMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = e.clientX - startX.current;
      const newWidth = Math.max(200, Math.min(600, startWidth.current + delta));
      setPanelWidth(newWidth);
    };

    const handleResizeEnd = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (createDropdownRef.current && !createDropdownRef.current.contains(e.target as Node)) {
        setShowCreateDropdown(false);
      }
    };
    
    if (showCreateDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCreateDropdown]);

  // Handle creating a note - opens popup modal
  const handleCreateNote = useCallback(async (type: NoteType, clientId?: string) => {
    // If a specific client was provided (from selector), select it first
    if (clientId) {
      setSelectedClientId(clientId);
    }
    
    // Open modal in create mode (popup)
    openEditorModal(type);
    
    setShowCreateDropdown(false);
    setShowClientSelector(false);
    setPendingNoteType(null);
  }, [openEditorModal, setSelectedClientId]);

  // Handle type selection from dropdown
  const handleTypeSelect = useCallback((type: NoteType) => {
    // Check if a specific client is selected
    if (selectedClientId && selectedClientId !== 'none') {
      // Client already selected, create note directly
      handleCreateNote(type);
    } else {
      // No specific client, show client selector
      setPendingNoteType(type);
      setShowClientSelector(true);
      setShowCreateDropdown(false);
    }
  }, [selectedClientId, handleCreateNote]);

  // Handle client selection
  const handleClientSelect = useCallback((clientId: string) => {
    if (pendingNoteType) {
      handleCreateNote(pendingNoteType, clientId);
    }
  }, [pendingNoteType, handleCreateNote]);

  // Handle note selection - check for unsaved changes first
  // Selection does NOT collapse - only ENTER does
  const handleSelectNote = useCallback((noteId: string) => {
    // Don't do anything if selecting the same note
    if (noteId === selectedNoteId) return;
    
    confirmNavigation(() => {
      setSelectedNoteId(noteId);
      // Do NOT collapse on selection - user navigates with arrows
    });
  }, [setSelectedNoteId, selectedNoteId, confirmNavigation]);

  // Handle ENTER to collapse and focus editor
  const handleEnterOnNote = useCallback(() => {
    if (!selectedNoteId) return;
    setNotesListCollapsed(true);
    // The editor will receive focus via the page.tsx effect
  }, [selectedNoteId, setNotesListCollapsed]);

  // REQ-008.2: Drag & drop handlers for favorites
  const handleDragStart = useCallback((e: React.DragEvent, noteId: string) => {
    if (currentView !== 'favorites') return;
    setDraggedId(noteId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', noteId);
  }, [currentView]);

  const handleDragOver = useCallback((e: React.DragEvent, noteId: string) => {
    if (currentView !== 'favorites' || !draggedId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (noteId !== draggedId) {
      setDragOverId(noteId);
    }
  }, [currentView, draggedId]);

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (currentView !== 'favorites' || !draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    // Calculate new order
    const currentOrder = filteredNotes.map(n => n.id);
    const draggedIndex = currentOrder.indexOf(draggedId);
    const targetIndex = currentOrder.indexOf(targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    // Remove dragged item and insert at new position
    const newOrder = [...currentOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedId);

    // Reset drag state
    setDraggedId(null);
    setDragOverId(null);

    // Update order
    await reorderFavorites(newOrder);
  }, [currentView, draggedId, filteredNotes, reorderFavorites]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (currentView === 'config') return;
    if (editorModal.isOpen) return; // Don't navigate when modal is open
    
    // Only handle if not typing in an input/textarea
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    // ENTER to collapse and focus editor
    if (e.key === 'Enter' && selectedNoteId && !isNotesListCollapsed) {
      e.preventDefault();
      handleEnterOnNote();
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      
      const currentIndex = filteredNotes.findIndex(n => n.id === selectedNoteId);
      let newIndex: number;
      
      if (e.key === 'ArrowDown') {
        newIndex = currentIndex < filteredNotes.length - 1 ? currentIndex + 1 : currentIndex;
      } else {
        newIndex = currentIndex > 0 ? currentIndex - 1 : (currentIndex === -1 ? 0 : 0);
      }
      
      if (newIndex >= 0 && newIndex < filteredNotes.length) {
        const newNote = filteredNotes[newIndex];
        handleSelectNote(newNote.id);
        
        // Scroll into view
        const noteEl = noteRefs.current.get(newNote.id);
        if (noteEl) {
          noteEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    }
  }, [filteredNotes, selectedNoteId, handleSelectNote, currentView, editorModal.isOpen, isNotesListCollapsed, handleEnterOnNote]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (currentView === 'config') {
    return (
      <div style={{ width: panelWidth }} className="bg-gray-900 border-r border-gray-800 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Panel de configuración</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ width: panelWidth }} className="bg-gray-900 border-r border-gray-800 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Cargando...</p>
      </div>
    );
  }

  // Filterable types (timesheet excluded per REQ-002)
  const allTypes: FilterableNoteType[] = ['task', 'connection', 'general'];

  // Collapsed state: minimal view with just expand button
  if (isNotesListCollapsed && selectedNoteId) {
    return (
      <div className="w-10 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-2">
        <button
          onClick={() => setNotesListCollapsed(false)}
          className="p-2 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          title="Expandir lista (ESC)"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: panelWidth }} className="bg-gray-900 border-r border-gray-800 overflow-hidden flex flex-col relative">
      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors z-20"
      />
      {/* Type filters + Create button + Collapse button */}
      <div className="px-3 py-2 border-b border-gray-800 flex items-center gap-1">
        {/* Collapse button - only when note selected */}
        {selectedNoteId && (
          <button
            onClick={() => setNotesListCollapsed(true)}
            className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors mr-1 flex-shrink-0"
            title="Colapsar lista (Enter)"
          >
            <ChevronLeft size={14} />
          </button>
        )}
        
        {/* Type filter icons */}
        <div className="flex gap-1">
          {allTypes.map(type => {
            const isActive = activeTypeFilters.includes(type);
            const Icon = typeIcons[type];
            const colors = typeBgColors[type];
            
            return (
              <button
                key={type}
                onClick={() => toggleTypeFilter(type)}
                className={`
                  p-1.5 rounded transition-colors
                  ${isActive ? colors.active + ' text-white' : 'bg-gray-800 text-gray-500 hover:text-gray-300'}
                `}
                title={typeLabels[type]}
              >
                <Icon size={14} />
              </button>
            );
          })}
        </div>
        
        {/* Clear filters button - only show when filters active */}
        {activeTypeFilters.length > 0 && (
          <button
            onClick={clearTypeFilters}
            className="p-1.5 rounded bg-gray-800 text-gray-400 hover:text-red-400 transition-colors"
            title="Quitar filtros"
          >
            <X size={14} />
          </button>
        )}
        
        <div className="flex-1" />
        
        {/* Create note button */}
        <div className="relative" ref={createDropdownRef}>
          <button
            onClick={() => setShowCreateDropdown(!showCreateDropdown)}
            className="p-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-md"
            title="Crear nota"
          >
            <Plus size={16} strokeWidth={2.5} />
          </button>
          
          {/* Type dropdown */}
          {showCreateDropdown && (
            <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 py-1 min-w-[140px]">
              {allTypes.map(type => {
                const Icon = typeIcons[type];
                return (
                  <button
                    key={type}
                    onClick={() => handleTypeSelect(type)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                  >
                    <Icon size={14} className={typeColors[type]} />
                    {typeLabels[type]}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Client selector modal */}
      {showClientSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Seleccionar Cliente</h3>
              <button
                onClick={() => {
                  setShowClientSelector(false);
                  setPendingNoteType(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {clients.filter(c => !c.disabled).map(client => (
                <button
                  key={client.id}
                  onClick={() => handleClientSelect(client.id)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 rounded transition-colors"
                >
                  {client.name}
                </button>
              ))}
              {clients.filter(c => !c.disabled).length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">No hay clientes disponibles</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notes list */}
      {filteredNotes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500 text-sm">No hay notas</p>
        </div>
      ) : (
        <div ref={listRef} className="divide-y divide-gray-800 flex-1 overflow-y-auto notes-list-scrollbar">
          {filteredNotes.map((note, index) => {
            // Note: timesheets are filtered out by AppContext, but handle type safety
            const Icon = note.type !== 'timesheet' ? typeIcons[note.type] : Clock;
            const isSelected = note.id === selectedNoteId;
            const isTask = note.type === 'task';
            const isSavedTask = isTask && !note.id.startsWith('temp-');
            const isFavoritesView = currentView === 'favorites';
            const isDragging = draggedId === note.id;
            const isDragOver = dragOverId === note.id;
            
            // REQ-001.13.3: Get client for color indicator (always)
            const noteClient = getClientForNote(note);
            // REQ-008.3: Only show badge in "all" or "favorites" view
            const showClientBadge = (currentView === 'all' && !selectedClientId) || currentView === 'favorites';
            
            return (
              <div
                key={note.id}
                ref={(el) => {
                  if (el) noteRefs.current.set(note.id, el as unknown as HTMLButtonElement);
                  else noteRefs.current.delete(note.id);
                }}
                tabIndex={0}
                onClick={() => handleSelectNote(note.id)}
                onDoubleClick={() => handleEnterOnNote()}
                draggable={isFavoritesView}
                onDragStart={(e) => handleDragStart(e, note.id)}
                onDragOver={(e) => handleDragOver(e, note.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, note.id)}
                onDragEnd={handleDragEnd}
                className={`
                  w-full text-left pt-0 pb-3 px-3 transition-colors cursor-pointer relative outline-none
                  focus:ring-1 focus:ring-blue-500 focus:ring-inset
                  ${isSelected 
                    ? 'bg-gray-800' 
                    : 'hover:bg-gray-800/50'}
                  ${isDragging ? 'opacity-50' : ''}
                  ${isDragOver ? 'border-t-2 border-blue-500' : ''}
                `}
              >
                {/* REQ-001.13.3: Client color indicator - left and top borders */}
                {noteClient?.color && (
                  <>
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1"
                      style={{ backgroundColor: noteClient.color }}
                    />
                    <div
                      className="absolute left-0 right-0 top-0 h-px"
                      style={{ backgroundColor: noteClient.color }}
                    />
                  </>
                )}
                
                {/* Top row: Drag handle, Client badge, Type icon, Position badge */}
                <div className="flex items-center gap-1 mb-1 -ml-3">
                  {/* Client badge */}
                  {showClientBadge && noteClient && (
                    <span
                      className="px-1.5 py-0.5 text-[10px] rounded-sm flex-shrink-0"
                      style={{
                        backgroundColor: noteClient.color || '#6B7280',
                        color: noteClient.color ? getContrastTextColor(noteClient.color) : 'white',
                      }}
                      title={noteClient.name}
                    >
                      {noteClient.name}
                    </span>
                  )}
                  {/* Drag handle for favorites */}
                  {isFavoritesView && (
                    <GripVertical size={14} className="text-gray-600 cursor-grab flex-shrink-0" />
                  )}
                  {/* Spacer */}
                  <div className="flex-1" />
                  {/* Position badge for favorites - aligned right */}
                  {isFavoritesView && (
                    <span className="text-xs font-mono text-yellow-500 flex-shrink-0">#{index + 1}</span>
                  )}
                  {/* Favorite star in favorites view */}
                  {isFavoritesView && (
                    <button
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(note.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="text-yellow-400 flex-shrink-0 transition-colors hover:text-yellow-300"
                      title="Quitar de favoritos (doble clic)"
                    >
                      <Star size={14} className="fill-current" />
                    </button>
                  )}
                </div>
                
                {/* Content row: Title and actions */}
                <div className="flex items-start gap-2 pl-1">
                  <div className="flex-1 min-w-0">
                    {/* REQ-001.13.1: Word wrap title */}
                    <div className="flex items-start gap-2">
                      <h3 className="text-sm font-medium text-white flex-1 break-words">
                        {note.type === 'task' && (note as TaskNote).ticketPhaseCode ? (
                          <>
                            <span className="text-blue-400 font-semibold">#{(note as TaskNote).ticketPhaseCode}</span>
                            {' '}{(note as TaskNote).shortDescription || note.title || 'Sin título'}
                          </>
                        ) : (
                          note.title || 'Sin título'
                        )}
                      </h3>
                      {/* REQ-006: Favorite star - always visible, double-click to toggle */}
                      {!isFavoritesView && (
                        <button
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(note.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={`flex-shrink-0 mt-0.5 transition-colors ${
                            note.isFavorite 
                              ? 'text-yellow-400' 
                              : 'text-gray-600 hover:text-gray-400'
                          }`}
                          title={note.isFavorite ? 'Quitar de favoritos (doble clic)' : 'Agregar a favoritos (doble clic)'}
                        >
                          <Star size={14} className={note.isFavorite ? 'fill-current' : ''} />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Right column: Type icon, Clock, Attachments */}
                  <div className="flex flex-col items-center justify-center gap-1 flex-shrink-0">
                    {/* Type icon */}
                    <Icon size={14} className={`flex-shrink-0 ${typeColors[note.type]}`} />
                    {/* Quick TimeSheet button for tasks */}
                    {isSavedTask && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTimeSheetTask(note as TaskNote);
                        }}
                        className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-green-400 transition-colors"
                        title="Registrar horas"
                      >
                        <Clock size={14} />
                      </button>
                    )}
                    {/* Attachments */}
                    {note.attachments && note.attachments.length > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-gray-500" title="Adjuntos">
                        <Paperclip size={12} />
                        {note.attachments.length}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor Modals - Only for CREATE mode (popups) */}
      {editorModal.isOpen && editorModal.mode === 'create' && editorModal.noteType === 'task' && (
        <TaskEditorModal
          taskId={undefined}
          onClose={closeEditorModal}
          onSaved={() => refreshNotes()}
          defaultClientId={selectedClientId && selectedClientId !== 'none' ? selectedClientId : undefined}
        />
      )}
      {editorModal.isOpen && editorModal.mode === 'create' && editorModal.noteType === 'general' && (
        <NoteEditorModal
          noteId={undefined}
          onClose={closeEditorModal}
          onSaved={() => refreshNotes()}
          defaultClientId={selectedClientId && selectedClientId !== 'none' ? selectedClientId : undefined}
        />
      )}
      {editorModal.isOpen && editorModal.mode === 'create' && editorModal.noteType === 'connection' && (
        <ConnectionEditorModal
          noteId={undefined}
          onClose={closeEditorModal}
          onSaved={() => refreshNotes()}
          defaultClientId={selectedClientId && selectedClientId !== 'none' ? selectedClientId : undefined}
        />
      )}

      {/* TimeSheet Modal for quick access */}
      {timeSheetTask && (
        <TimeSheetModal
          task={timeSheetTask}
          onClose={() => setTimeSheetTask(null)}
          onSaved={() => {
            setToast({ message: 'Horas registradas exitosamente' });
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
