'use client';

import { useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { X, Save, Loader2, Maximize2, Minimize2, Pencil, Check, ExternalLink, Star } from 'lucide-react';
import { TipTapEditor, TipTapEditorHandle } from './TipTapEditor';
import { AttachmentsPanel } from './AttachmentsPanel';
import { Toast } from './Toast';
import { UnsavedChangesModal } from './UnsavedChangesModal';
import { useApp } from '../context/AppContext';
import type { Note, AttachmentMeta } from '@/lib/types';

interface BaseEditorModalProps {
  noteId?: string;      // undefined = create mode
  defaultNote: Note;    // Default values for new note
  onClose: () => void;
  onSaved?: () => void;
  onExpandToPopup?: () => void; // For inline mode: expand to popup
  fieldsComponent?: ReactNode;  // Custom fields for the note type
  onFieldsChange?: (data: Partial<Note>) => void;
  headerActions?: ReactNode;    // Additional header actions (e.g., clock icon for tasks)
  inline?: boolean;             // Render as inline panel (not modal)
}

export function BaseEditorModal({ 
  noteId,
  defaultNote,
  onClose, 
  onSaved,
  onExpandToPopup,
  fieldsComponent,
  onFieldsChange,
  headerActions,
  inline = false,
}: BaseEditorModalProps) {
  const { updateNote, refreshNotes, toggleFavorite, autoSaveEnabled, setIsDirty: setGlobalIsDirty, setPendingChanges: setGlobalPendingChanges } = useApp();
  
  const [note, setNote] = useState<Note>(defaultNote);
  const [loading, setLoading] = useState(!!noteId);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [title, setTitle] = useState(defaultNote.title);
  const [isDirty, setIsDirtyLocal] = useState(!noteId); // New notes start dirty
  const [isMaximized, setIsMaximized] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(!noteId); // Auto-edit title for new notes
  const [toast, setToast] = useState<{ message: string } | null>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  
  // Sync local isDirty with global context (for inline mode navigation protection)
  const setIsDirty = useCallback((dirty: boolean) => {
    setIsDirtyLocal(dirty);
    if (inline) {
      setGlobalIsDirty(dirty);
      if (!dirty) {
        setGlobalPendingChanges({});
      }
    }
  }, [inline, setGlobalIsDirty, setGlobalPendingChanges]);
  
  const editorRef = useRef<TipTapEditorHandle>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const pendingChangesRef = useRef<Partial<Note>>({});
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCreatedRef = useRef(false); // Track if note was created

  // REQ-006: Handle favorite toggle
  const handleToggleFavorite = async () => {
    const targetId = noteId || note.id;
    if (!targetId || targetId.startsWith('temp-')) return; // Can't favorite unsaved notes
    
    // Optimistic update
    setNote(prev => ({ ...prev, isFavorite: !prev.isFavorite }));
    
    await toggleFavorite(targetId);
  };

  // Load existing note data
  useEffect(() => {
    if (noteId) {
      const loadNote = async () => {
        try {
          const res = await fetch(`/api/notes/${noteId}`);
          if (res.ok) {
            const data = await res.json();
            setNote(data);
            setTitle(data.title);
            setIsDirty(false);
          }
        } catch (err) {
          console.error('Error loading note:', err);
          setToast({ message: 'Error al cargar' });
        } finally {
          setLoading(false);
        }
      };
      loadNote();
    } else {
      // New note - focus title after mount
      setTimeout(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      }, 100);
    }
  }, [noteId]);

  // Handle Escape key (only in popup mode)
  useEffect(() => {
    if (inline) return; // Don't handle Escape in inline mode
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [inline]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Schedule auto-save (only for existing notes, and only if enabled)
  const scheduleAutoSave = useCallback(() => {
    if (!autoSaveEnabled) return; // Respect user's auto-save preference
    if (!noteId && !isCreatedRef.current) return; // Don't auto-save new unsaved notes
    
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    autoSaveTimerRef.current = setTimeout(async () => {
      if (Object.keys(pendingChangesRef.current).length > 0) {
        const targetId = noteId || note.id;
        if (targetId && !targetId.startsWith('temp-')) {
          await updateNote(targetId, pendingChangesRef.current);
          pendingChangesRef.current = {};
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }
      }
    }, 2000);
  }, [noteId, note.id, updateNote, autoSaveEnabled]);

  // Track changes
  const trackChange = useCallback((data: Partial<Note>) => {
    pendingChangesRef.current = { ...pendingChangesRef.current, ...data };
    setNote(prev => ({ ...prev, ...data } as Note));
    setIsDirty(true);
    onFieldsChange?.(data);
    // Sync pending changes to global context for inline mode
    if (inline) {
      setGlobalPendingChanges(pendingChangesRef.current);
    }
    scheduleAutoSave();
  }, [onFieldsChange, scheduleAutoSave, setIsDirty, inline, setGlobalPendingChanges]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    trackChange({ title: newTitle });
  };

  const handleContentChange = (contentJson: object) => {
    trackChange({ contentJson });
  };

  // Manual save (or create for new notes)
  const handleSave = async () => {
    if (Object.keys(pendingChangesRef.current).length === 0 && noteId) return;
    
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    setSaving(true);
    
    try {
      if (!noteId && !isCreatedRef.current) {
        // Create new note
        const dataToSend = { ...note, ...pendingChangesRef.current };
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _tempId, ...noteWithoutId } = dataToSend;
        
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(noteWithoutId),
        });
        
        if (res.ok) {
          const savedNote = await res.json();
          setNote(savedNote);
          pendingChangesRef.current = {};
          isCreatedRef.current = true;
          setIsDirty(false);
          setToast({ message: 'Creado exitosamente' });
          await refreshNotes();
          onSaved?.();
        } else {
          setToast({ message: 'Error al crear' });
        }
      } else {
        // Update existing note
        const targetId = noteId || note.id;
        const res = await fetch(`/api/notes/${targetId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pendingChangesRef.current),
        });
        
        if (res.ok) {
          const updatedNote = await res.json();
          setNote(updatedNote);
          pendingChangesRef.current = {};
          setIsDirty(false);
          setToast({ message: 'Guardado exitosamente' });
          await refreshNotes();
          onSaved?.();
        } else {
          setToast({ message: 'Error al guardar' });
        }
      }
    } catch (err) {
      console.error('Error saving:', err);
      setToast({ message: 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    // If dirty, show confirmation modal
    if (isDirty && Object.keys(pendingChangesRef.current).length > 0) {
      setShowUnsavedModal(true);
      return;
    }
    onClose();
  };

  const handleDiscardAndClose = () => {
    setShowUnsavedModal(false);
    pendingChangesRef.current = {};
    setIsDirty(false);
    onClose();
  };

  const handleSaveAndClose = async () => {
    setShowUnsavedModal(false);
    await handleSave();
    onClose();
  };

  if (loading) {
    if (inline) {
      return (
        <div className="flex-1 flex items-center justify-center bg-gray-900">
          <Loader2 className="animate-spin text-blue-400" size={32} />
        </div>
      );
    }
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-8">
          <Loader2 className="animate-spin text-blue-400" size={32} />
        </div>
      </div>
    );
  }

  // Inline mode: render as panel
  if (inline) {
    return (
      <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2 flex-1 min-w-0 mr-4">
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIsEditingTitle(false);
                    editorRef.current?.focus();
                  }
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
                className="flex-1 text-lg font-semibold bg-gray-800 border border-blue-500 rounded px-2 py-1 text-white outline-none"
                autoFocus
                placeholder="Título..."
              />
            ) : (
              <>
                <h2 className="text-lg font-semibold text-white truncate">{title || 'Sin título'}</h2>
                <button
                  onClick={() => {
                    setIsEditingTitle(true);
                    setTimeout(() => titleInputRef.current?.select(), 0);
                  }}
                  className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                  title="Editar título"
                >
                  <Pencil size={16} />
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* REQ-006: Favorite toggle - only for saved notes */}
            {(noteId || isCreatedRef.current) && !note.id.startsWith('temp-') && (
              <button
                onClick={handleToggleFavorite}
                className={`p-2 rounded transition-colors ${
                  note.isFavorite 
                    ? 'text-yellow-400 hover:text-yellow-300 hover:bg-gray-800' 
                    : 'text-gray-400 hover:text-yellow-400 hover:bg-gray-800'
                }`}
                title={note.isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
              >
                <Star size={20} className={note.isFavorite ? 'fill-current' : ''} />
              </button>
            )}
            
            {/* Custom header actions */}
            {headerActions}
            
            {/* Save status indicator */}
            {saved && (
              <span className="flex items-center gap-1 text-green-400 text-sm">
                <Check size={14} />
                Guardado
              </span>
            )}
            
            {/* Save button */}
            {isDirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Guardar
              </button>
            )}
            
            {/* Expand to popup button */}
            {onExpandToPopup && (
              <button
                onClick={onExpandToPopup}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                title="Abrir en popup"
              >
                <ExternalLink size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Custom fields for the note type */}
          {fieldsComponent && (
            <div className="mb-6">
              {fieldsComponent}
            </div>
          )}

          {/* Editor */}
          <div className={fieldsComponent ? "mb-6 border-t border-gray-800 pt-6" : "mb-6"}>
            {fieldsComponent && <h3 className="text-sm font-medium text-gray-400 mb-3">Contenido</h3>}
            <TipTapEditor
              ref={editorRef}
              key={note.id}
              content={note.contentJson}
              onChange={handleContentChange}
              noteId={note.id}
              placeholder="Escribe aquí..."
            />
          </div>

          {/* Attachments */}
          <div className="border-t border-gray-800 pt-6">
            <AttachmentsPanel
              noteId={note.id}
              attachments={note.attachments || []}
              onAttachmentAdded={(attachment: AttachmentMeta) => {
                const updatedAttachments = [...(note.attachments || []), attachment];
                setNote(prev => ({ ...prev, attachments: updatedAttachments }));
                trackChange({ attachments: updatedAttachments });
              }}
              onAttachmentDeleted={(attachmentId: string) => {
                const updatedAttachments = (note.attachments || []).filter(a => a.id !== attachmentId);
                setNote(prev => ({ ...prev, attachments: updatedAttachments }));
                trackChange({ attachments: updatedAttachments });
              }}
              onAttachmentRenamed={(attachmentId: string, newName: string) => {
                const updatedAttachments = (note.attachments || []).map(
                  a => a.id === attachmentId ? { ...a, originalName: newName } : a
                );
                setNote(prev => ({ ...prev, attachments: updatedAttachments }));
                trackChange({ attachments: updatedAttachments });
              }}
            />
          </div>
        </div>

        {/* Footer - simplified for inline */}
        <div className="px-6 py-3 border-t border-gray-700 flex items-center justify-between text-xs text-gray-500">
          <div>
            {isDirty ? (
              <span className="text-yellow-500">● Cambios sin guardar</span>
            ) : (
              <span>Último guardado: {new Date(note.updatedAt).toLocaleString()}</span>
            )}
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <Toast
            message={toast.message}
            onClose={() => setToast(null)}
          />
        )}

        {/* Unsaved Changes Modal */}
        <UnsavedChangesModal
          isOpen={showUnsavedModal}
          onDiscard={handleDiscardAndClose}
          onCancel={() => setShowUnsavedModal(false)}
          onSave={handleSaveAndClose}
        />
      </div>
    );
  }

  // Popup mode (original)
  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className={`bg-gray-900 rounded-lg border border-gray-700 flex flex-col shadow-2xl transition-all duration-200 ${
        isMaximized 
          ? 'w-full h-full max-w-none max-h-none m-0 rounded-none' 
          : 'w-full max-w-4xl max-h-[90vh]'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2 flex-1 min-w-0 mr-4">
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIsEditingTitle(false);
                    editorRef.current?.focus();
                  }
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
                className="flex-1 text-lg font-semibold bg-gray-800 border border-blue-500 rounded px-2 py-1 text-white outline-none"
                autoFocus
                placeholder="Título..."
              />
            ) : (
              <>
                <h2 className="text-lg font-semibold text-white truncate">{title || 'Sin título'}</h2>
                <button
                  onClick={() => {
                    setIsEditingTitle(true);
                    setTimeout(() => titleInputRef.current?.select(), 0);
                  }}
                  className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                  title="Editar título"
                >
                  <Pencil size={16} />
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* REQ-006: Favorite toggle - only for saved notes */}
            {(noteId || isCreatedRef.current) && !note.id.startsWith('temp-') && (
              <button
                onClick={handleToggleFavorite}
                className={`p-2 rounded transition-colors ${
                  note.isFavorite 
                    ? 'text-yellow-400 hover:text-yellow-300 hover:bg-gray-800' 
                    : 'text-gray-400 hover:text-yellow-400 hover:bg-gray-800'
                }`}
                title={note.isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
              >
                <Star size={20} className={note.isFavorite ? 'fill-current' : ''} />
              </button>
            )}
            
            {/* Custom header actions */}
            {headerActions}
            
            {/* Save status indicator */}
            {saved && (
              <span className="flex items-center gap-1 text-green-400 text-sm">
                <Check size={14} />
                Guardado
              </span>
            )}
            
            {/* Save button */}
            {isDirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Guardar
              </button>
            )}
            
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
              title={isMaximized ? "Restaurar tamaño" : "Maximizar"}
            >
              {isMaximized ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
              title="Cerrar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Custom fields for the note type */}
          {fieldsComponent && (
            <div className="mb-6">
              {fieldsComponent}
            </div>
          )}

          {/* Editor */}
          <div className={fieldsComponent ? "mb-6 border-t border-gray-800 pt-6" : "mb-6"}>
            {fieldsComponent && <h3 className="text-sm font-medium text-gray-400 mb-3">Contenido</h3>}
            <TipTapEditor
              ref={editorRef}
              key={note.id}
              content={note.contentJson}
              onChange={handleContentChange}
              noteId={note.id}
              placeholder="Escribe aquí..."
            />
          </div>

          {/* Attachments */}
          <div className="border-t border-gray-800 pt-6">
            <AttachmentsPanel
              noteId={note.id}
              attachments={note.attachments || []}
              onAttachmentAdded={(attachment: AttachmentMeta) => {
                const updatedAttachments = [...(note.attachments || []), attachment];
                setNote(prev => ({ ...prev, attachments: updatedAttachments }));
                trackChange({ attachments: updatedAttachments });
              }}
              onAttachmentDeleted={(attachmentId: string) => {
                const updatedAttachments = (note.attachments || []).filter(a => a.id !== attachmentId);
                setNote(prev => ({ ...prev, attachments: updatedAttachments }));
                trackChange({ attachments: updatedAttachments });
              }}
              onAttachmentRenamed={(attachmentId: string, newName: string) => {
                const updatedAttachments = (note.attachments || []).map(
                  a => a.id === attachmentId ? { ...a, originalName: newName } : a
                );
                setNote(prev => ({ ...prev, attachments: updatedAttachments }));
                trackChange({ attachments: updatedAttachments });
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-700 flex items-center justify-between text-xs text-gray-500">
          <div>
            {isDirty ? (
              <span className="text-yellow-500">● Cambios sin guardar</span>
            ) : (
              <span>Último guardado: {new Date(note.updatedAt).toLocaleString()}</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleClose}
              className="px-3 py-1.5 text-gray-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={async () => {
                await handleSave();
                onClose();
              }}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar y Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Unsaved Changes Modal */}
      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        onDiscard={handleDiscardAndClose}
        onCancel={() => setShowUnsavedModal(false)}
        onSave={handleSaveAndClose}
      />
    </div>
  );
}
