'use client';

import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { TipTapEditor } from './TipTapEditor';
import { Pencil, Trash2 } from 'lucide-react';
import type { TaskComment } from '@/lib/types';

export interface TaskCommentsRef {
  savePendingComment: () => Promise<boolean>; // Returns true if a comment was saved
  reloadComments: () => void; // Reload comments from server
}

interface TaskCommentsProps {
  taskId: string;
  currentUser: string;
  onAttachmentsChange?: () => void; // Called when images are added via paste
  onCommentsLoaded?: (count: number) => void; // Reports comments count to parent
  onSaveTask?: () => void; // Called on Ctrl+S to also save the parent task
  onEditingChange?: (isEditing: boolean) => void; // Called when editing state changes (to mark task as dirty)
}

export const TaskComments = forwardRef<TaskCommentsRef, TaskCommentsProps>(function TaskComments({ taskId, currentUser, onAttachmentsChange, onCommentsLoaded, onSaveTask, onEditingChange }, ref) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newContent, setNewContent] = useState<object>({ type: 'doc', content: [] });
  const [editing, setEditing] = useState<{ id: string; content: object } | null>(null);
  const [originalContent, setOriginalContent] = useState<object | null>(null); // Original content when editing started
  const [pendingEdit, setPendingEdit] = useState<{ id: string; content: object } | null>(null); // Comment waiting to be edited
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
        onCommentsLoaded?.(data.length);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) load();
  }, [taskId]);

  // Helper to check if content has changed
  const hasContentChanged = () => {
    if (!editing || !originalContent) return false;
    return JSON.stringify(editing.content) !== JSON.stringify(originalContent);
  };

  // Helper to start editing a comment
  const startEditing = (id: string, content: object) => {
    // If already editing another comment with changes, show confirmation
    if (editing && editing.id !== id) {
      if (hasContentChanged()) {
        setPendingEdit({ id, content });
        setShowUnsavedModal(true);
        return;
      }
      // No changes, just switch to new comment
    }
    setEditing({ id, content: JSON.parse(JSON.stringify(content)) }); // Deep copy to avoid reference issues
    setOriginalContent(JSON.parse(JSON.stringify(content))); // Deep copy original content
    onEditingChange?.(true); // Notify parent that editing started (mark as dirty)
  };

  // Helper to stop editing
  const stopEditing = () => {
    setEditing(null);
    setOriginalContent(null);
    onEditingChange?.(false);
  };

  // Handle unsaved modal actions
  const handleUnsavedSave = async () => {
    await handleUpdate();
    setShowUnsavedModal(false);
    if (pendingEdit) {
      setEditing({ id: pendingEdit.id, content: JSON.parse(JSON.stringify(pendingEdit.content)) });
      setOriginalContent(JSON.parse(JSON.stringify(pendingEdit.content)));
      onEditingChange?.(true);
      setPendingEdit(null);
    }
  };

  const handleUnsavedDiscard = () => {
    setShowUnsavedModal(false);
    if (pendingEdit) {
      setEditing({ id: pendingEdit.id, content: JSON.parse(JSON.stringify(pendingEdit.content)) });
      setOriginalContent(JSON.parse(JSON.stringify(pendingEdit.content)));
      onEditingChange?.(true);
      setPendingEdit(null);
    }
  };

  const handleUnsavedCancel = () => {
    setShowUnsavedModal(false);
    setPendingEdit(null);
  };

  // Helper to check if content has actual text
  const hasContentText = (content: object) => {
    return content && 
      (content as { content?: unknown[] }).content && 
      (content as { content: unknown[] }).content.length > 0;
  };

  const handleAdd = async (): Promise<boolean> => {
    // Check if there's actual content (not just empty doc)
    if (!hasContentText(newContent)) return false;
    
    const res = await fetch(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: currentUser, content: newContent }),
    });
    if (res.ok) {
      setNewContent({ type: 'doc', content: [] }); // Reset to empty doc
      load();
      onAttachmentsChange?.(); // Refresh attachments in case images were pasted
      return true;
    }
    return false;
  };

  const handleUpdate = async (): Promise<boolean> => {
    if (!editing) return false;
    const res = await fetch(`/api/tasks/${taskId}/comments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editing.id, content: editing.content }),
    });
    if (res.ok) {
      stopEditing();
      load();
      onAttachmentsChange?.(); // Refresh attachments in case images were pasted
      return true;
    }
    return false;
  };

  // Expose functions to parent via ref
  useImperativeHandle(ref, () => ({
    savePendingComment: async () => {
      // If editing an existing comment, save that
      if (editing) {
        return handleUpdate();
      }
      // Otherwise save new comment if there's content
      return handleAdd();
    },
    reloadComments: () => {
      load();
    }
  }));

  const handleDelete = async (id: string) => {
    await fetch(`/api/tasks/${taskId}/comments?id=${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="mt-4">
      <h3 className="text-base font-semibold mb-1">Comentarios</h3>
      {loading && <p>cargando...</p>}
      {comments.length === 0 && !loading && <p className="text-gray-500">Sin comentarios</p>}
      <div className="divide-y divide-gray-700 text-xs">
        {comments.map(c => (
          <div 
            key={c.id} 
            className={`py-0.5 ${editing?.id === c.id ? 'border border-gray-600 rounded-lg p-2 bg-gray-800/50 my-1' : ''}`}
            onDoubleClick={() => {
              // Only allow editing own comments
              if (c.author === currentUser) {
                startEditing(c.id, c.content as object);
              }
            }}
          >
            <div className="flex justify-end items-center gap-2 text-[10px] text-gray-400 mb-1">
              <span>{c.createdAt ? new Date(c.createdAt).toLocaleString() : 'Sin fecha'}</span>
              <span className="truncate max-w-[120px]">{c.author}</span>
            </div>
            {editing?.id === c.id ? (
              <div
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    stopEditing();
                  } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    // Just call onSaveTask - it will save the comment via savePendingComment
                    onSaveTask?.();
                  }
                }}
              >
                <TipTapEditor
                  content={editing.content}
                  onChange={json => setEditing(prev => prev ? { ...prev, content: json } : null)}
                  placeholder="Escribe tu comentario..."
                  readOnly={false}
                  noteId={taskId}
                  onAttachmentAdded={() => load()}
                  compact
                />
                <div className="flex gap-2 mt-1 justify-end">
                  <button
                    onClick={handleUpdate}
                    className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                  >guardar</button>
                  <button
                    onClick={() => stopEditing()}
                    className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                  >cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <div className={c.author === currentUser ? 'cursor-pointer' : ''}>
                  <TipTapEditor
                    content={c.content as object}
                    onChange={() => {}}
                    readOnly={true}
                  />
                </div>
                {c.author === currentUser && (
                  <div className="flex gap-2 mt-1 text-gray-400 justify-end">
                    <button
                      onClick={() => startEditing(c.id, c.content as object)}
                      className="p-1 hover:text-white"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="p-1 hover:text-white"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* New comment input - hidden when editing an existing comment */}
      {!editing && (
        <div 
          className="mt-3 border border-gray-600 rounded-lg p-2 bg-gray-800/50"
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
              e.preventDefault();
              // Just call onSaveTask - it will save the comment via savePendingComment
              onSaveTask?.();
            }
          }}
        >
          <TipTapEditor
            content={newContent}
            onChange={json => setNewContent(json)}
            placeholder="Escribe un comentario... (Ctrl+S para guardar)"
            readOnly={false}
            noteId={taskId}
            onAttachmentAdded={() => load()}
            compact
          />
          <div className="flex gap-2 mt-1">
            <button
              onClick={handleAdd}
              className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 rounded text-xs"
            >guardar</button>
            <button
              onClick={() => setNewContent({ type: 'doc', content: [] })}
              className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-xs"
            >cancelar</button>
          </div>
        </div>
      )}

      {/* Unsaved changes confirmation modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-4 max-w-sm mx-4 border border-gray-600">
            <h3 className="text-sm font-semibold mb-2">Cambios sin guardar</h3>
            <p className="text-xs text-gray-400 mb-4">
              Tienes cambios sin guardar en el comentario actual. ¿Qué deseas hacer?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleUnsavedCancel}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
              >Cancelar</button>
              <button
                onClick={handleUnsavedDiscard}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
              >Descartar</button>
              <button
                onClick={handleUnsavedSave}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
              >Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
