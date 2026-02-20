'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { TipTapEditor } from './TipTapEditor';
import { TaskFields } from './TaskFields';
import { ConnectionFields } from './ConnectionFields';
import { TimeSheetFields } from './TimeSheetFields';
import { AttachmentsPanel } from './AttachmentsPanel';
import { Toast } from './Toast';
import { UnsavedChangesModal } from './UnsavedChangesModal';
import { Trash2, Save, Archive, ArchiveRestore, RotateCcw, Circle } from 'lucide-react';
import type { Note, TaskNote, ConnectionNote, TimeSheetNote, AttachmentMeta } from '@/lib/types';

export function EditorPanel() {
  const { 
    selectedNote, 
    updateNote, 
    deleteNote, 
    isSaving, 
    setIsSaving, 
    lastSaved, 
    setLastSaved,
    isDirty,
    setIsDirty,
    autoSaveEnabled,
    showUnsavedModal,
    discardAndExecute,
    cancelPendingAction,
    saveAndExecute,
    isNewNote,
    persistNewNote,
  } = useApp();
  
  const [title, setTitle] = useState('');
  const [toast, setToast] = useState<{ message: string; action?: { label: string; onClick: () => void } } | null>(null);
  const selectedNoteId = selectedNote?.id;
  
  // Track pending changes
  const pendingChangesRef = useRef<Partial<Note>>({});
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update local state when selected note changes
  useEffect(() => {
    if (selectedNote) {
      setTitle(selectedNote.title);
      // For new notes (temp IDs), keep dirty state - they need to be saved
      const isTemp = selectedNote.id.startsWith('temp-');
      if (!isTemp) {
        setLastSaved(new Date(selectedNote.updatedAt));
        // Reset dirty state and pending changes when switching to existing notes
        pendingChangesRef.current = {};
        setIsDirty(false);
      }
      // For new notes, keep isDirty true so save button is enabled
    }
  }, [selectedNoteId, selectedNote, setLastSaved, setIsDirty]);

  // Cleanup auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Schedule auto-save if enabled (NOT for new notes - they require manual first save)
  const scheduleAutoSave = useCallback(() => {
    if (!autoSaveEnabled || !selectedNote || isNewNote) return;
    
    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // Schedule new save
    autoSaveTimerRef.current = setTimeout(async () => {
      if (Object.keys(pendingChangesRef.current).length > 0) {
        setIsSaving(true);
        await updateNote(selectedNote.id, pendingChangesRef.current);
        pendingChangesRef.current = {};
        setIsSaving(false);
        setLastSaved(new Date());
        setIsDirty(false);
      }
    }, 2000); // 2 second delay for auto-save
  }, [autoSaveEnabled, selectedNote, isNewNote, updateNote, setIsSaving, setLastSaved, setIsDirty]);

  // Track changes
  const trackChange = useCallback((data: Partial<Note>) => {
    pendingChangesRef.current = { ...pendingChangesRef.current, ...data };
    setIsDirty(true);
    scheduleAutoSave();
  }, [setIsDirty, scheduleAutoSave]);

  // Manual save
  const handleSave = async () => {
    if (!selectedNote) return;
    
    // Clear auto-save timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    setIsSaving(true);
    
    // For new notes, persist to database for the first time
    if (isNewNote) {
      const savedNote = await persistNewNote(pendingChangesRef.current);
      if (savedNote) {
        pendingChangesRef.current = {};
        const typeLabels: Record<string, string> = {
          general: 'Nota',
          task: 'Tarea', 
          connection: 'Conexión',
          timesheet: 'TimeSheet'
        };
        setToast({ message: `${typeLabels[savedNote.type] || 'Nota'} creada exitosamente` });
      } else {
        setIsSaving(false);
        setToast({ message: 'Error al crear la nota' });
        return;
      }
    } else {
      // For existing notes, just update
      if (Object.keys(pendingChangesRef.current).length > 0) {
        await updateNote(selectedNote.id, pendingChangesRef.current);
        pendingChangesRef.current = {};
        setIsSaving(false);
        setLastSaved(new Date());
        setIsDirty(false);
        setToast({ message: 'Guardado exitosamente' });
      }
    }
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (selectedNote) {
      trackChange({ title: newTitle });
    }
  };

  const handleContentChange = (contentJson: object) => {
    if (selectedNote) {
      trackChange({ contentJson });
    }
  };

  const handleDelete = async () => {
    if (selectedNote && confirm('Are you sure you want to delete this note?')) {
      await deleteNote(selectedNote.id);
    }
  };

  const handleArchive = async () => {
    if (selectedNote) {
      const wasArchived = !!selectedNote.archivedAt;
      const newArchivedAt = wasArchived ? undefined : new Date().toISOString();
      
      await updateNote(selectedNote.id, { archivedAt: newArchivedAt });
      
      // Show toast with undo option
      setToast({
        message: wasArchived ? 'Nota restaurada' : 'Nota archivada',
        action: {
          label: 'Deshacer',
          onClick: () => {
            updateNote(selectedNote.id, { 
              archivedAt: wasArchived ? new Date().toISOString() : undefined 
            });
          }
        }
      });
    }
  };

  const handleRestore = async () => {
    if (selectedNote && selectedNote.deletedAt) {
      await updateNote(selectedNote.id, { deletedAt: undefined });
    }
  };

  if (!selectedNote) {
    return (
      <div className="flex-1 bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Select a note or create a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 uppercase tracking-wider">
            {selectedNote.type}
          </span>
          {/* Dirty indicator */}
          {isDirty && (
            <span className="flex items-center gap-1 text-xs text-yellow-500">
              <Circle size={8} fill="currentColor" />
              Sin guardar
            </span>
          )}
          {isSaving && (
            <span className="text-xs text-blue-400 flex items-center gap-1">
              <Save size={12} className="animate-pulse" />
              Guardando...
            </span>
          )}
          {!isSaving && !isDirty && lastSaved && (
            <span className="text-xs text-gray-600">
              Guardado {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className={`p-2 rounded transition-colors ${
              isDirty 
                ? 'text-blue-500 hover:text-blue-400 hover:bg-gray-800' 
                : 'text-gray-600 cursor-not-allowed'
            }`}
            title={isDirty ? 'Guardar cambios' : 'Sin cambios pendientes'}
          >
            <Save size={18} />
          </button>
          {selectedNote.deletedAt && (
            <button
              onClick={handleRestore}
              className="p-2 text-green-500 hover:text-green-400 hover:bg-gray-800 rounded transition-colors"
              title="Restore note"
            >
              <RotateCcw size={18} />
            </button>
          )}
          <button
            onClick={handleArchive}
            className={`p-2 hover:bg-gray-800 rounded transition-colors ${
              selectedNote.archivedAt ? 'text-yellow-500 hover:text-yellow-400' : 'text-gray-500 hover:text-yellow-400'
            }`}
            title={selectedNote.archivedAt ? 'Unarchive note' : 'Archive note'}
          >
            {selectedNote.archivedAt ? <ArchiveRestore size={18} /> : <Archive size={18} />}
          </button>
          <button
            onClick={handleDelete}
            className="p-2 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
            title="Delete note"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Note title..."
          className="w-full text-2xl font-bold bg-transparent border-none outline-none text-white placeholder-gray-600 mb-4"
        />

        {/* Editor */}
        <TipTapEditor
          key={selectedNote.id}
          content={selectedNote.contentJson}
          onChange={handleContentChange}
          noteId={selectedNote.id}
        />

        {/* Type-specific fields */}
        {selectedNote.type === 'task' && (
          <div className="mt-6 pt-6 border-t border-gray-800">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Task Details</h3>
            <TaskFields
              note={selectedNote as TaskNote}
              onChange={(data) => trackChange(data)}
            />
          </div>
        )}

        {selectedNote.type === 'connection' && (
          <div className="mt-6 pt-6 border-t border-gray-800">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Connection Details</h3>
            <ConnectionFields
              note={selectedNote as ConnectionNote}
              onChange={(data) => trackChange(data)}
            />
          </div>
        )}

        {selectedNote.type === 'timesheet' && (
          <div className="mt-6 pt-6 border-t border-gray-800">
            <h3 className="text-sm font-medium text-gray-400 mb-3">TimeSheet Details</h3>
            <TimeSheetFields
              note={selectedNote as TimeSheetNote}
              onChange={(data) => trackChange(data)}
            />
          </div>
        )}

        {/* Attachments Panel */}
        <AttachmentsPanel
          noteId={selectedNote.id}
          attachments={selectedNote.attachments || []}
          onAttachmentAdded={(attachment: AttachmentMeta) => {
            const updatedAttachments = [...(selectedNote.attachments || []), attachment];
            updateNote(selectedNote.id, { attachments: updatedAttachments });
          }}
          onAttachmentDeleted={(attachmentId: string) => {
            const updatedAttachments = (selectedNote.attachments || []).filter(
              (a) => a.id !== attachmentId
            );
            updateNote(selectedNote.id, { attachments: updatedAttachments });
          }}
          onAttachmentRenamed={(attachmentId: string, newName: string) => {
            const updatedAttachments = (selectedNote.attachments || []).map(
              (a) => a.id === attachmentId ? { ...a, originalName: newName } : a
            );
            updateNote(selectedNote.id, { attachments: updatedAttachments });
          }}
        />
      </div>

      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          action={toast.action}
          onClose={() => setToast(null)}
        />
      )}

      {/* Unsaved changes modal */}
      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        onDiscard={discardAndExecute}
        onCancel={cancelPendingAction}
        onSave={saveAndExecute}
      />
    </div>
  );
}
