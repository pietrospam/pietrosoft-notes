'use client';

import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { TipTapEditor } from './TipTapEditor';
import { TaskFields } from './TaskFields';
import { ConnectionFields } from './ConnectionFields';
import { TimeSheetFields } from './TimeSheetFields';
import { AttachmentsPanel } from './AttachmentsPanel';
import { Trash2, Save, Archive, ArchiveRestore, RotateCcw } from 'lucide-react';
import type { Note, TaskNote, ConnectionNote, TimeSheetNote, AttachmentMeta } from '@/lib/types';

function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function EditorPanel() {
  const { selectedNote, updateNote, deleteNote } = useApp();
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const selectedNoteId = selectedNote?.id;

  // Update local state when selected note changes
  useEffect(() => {
    if (selectedNote) {
      setTitle(selectedNote.title);
      setLastSaved(new Date(selectedNote.updatedAt));
    }
  }, [selectedNoteId, selectedNote]);

  // Debounced save function
  const debouncedSave = useMemo(
    () => debounce(async (noteId: string, data: Partial<Note>) => {
      setIsSaving(true);
      await updateNote(noteId, data);
      setIsSaving(false);
      setLastSaved(new Date());
    }, 1000),
    [updateNote]
  );

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (selectedNote) {
      debouncedSave(selectedNote.id, { title: newTitle });
    }
  };

  const handleContentChange = (contentJson: object) => {
    if (selectedNote) {
      debouncedSave(selectedNote.id, { contentJson });
    }
  };

  const handleDelete = async () => {
    if (selectedNote && confirm('Are you sure you want to delete this note?')) {
      await deleteNote(selectedNote.id);
    }
  };

  const handleArchive = async () => {
    if (selectedNote) {
      await updateNote(selectedNote.id, { 
        archivedAt: selectedNote.archivedAt ? undefined : new Date().toISOString() 
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
          {isSaving && (
            <span className="text-xs text-blue-400 flex items-center gap-1">
              <Save size={12} className="animate-pulse" />
              Saving...
            </span>
          )}
          {!isSaving && lastSaved && (
            <span className="text-xs text-gray-600">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
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
              onChange={(data) => debouncedSave(selectedNote.id, data)}
            />
          </div>
        )}

        {selectedNote.type === 'connection' && (
          <div className="mt-6 pt-6 border-t border-gray-800">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Connection Details</h3>
            <ConnectionFields
              note={selectedNote as ConnectionNote}
              onChange={(data) => debouncedSave(selectedNote.id, data)}
            />
          </div>
        )}

        {selectedNote.type === 'timesheet' && (
          <div className="mt-6 pt-6 border-t border-gray-800">
            <h3 className="text-sm font-medium text-gray-400 mb-3">TimeSheet Details</h3>
            <TimeSheetFields
              note={selectedNote as TimeSheetNote}
              onChange={(data) => debouncedSave(selectedNote.id, data)}
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
        />
      </div>
    </div>
  );
}
