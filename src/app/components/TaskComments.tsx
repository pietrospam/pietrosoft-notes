'use client';

import { useState, useEffect, useImperativeHandle, forwardRef, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { TipTapEditor, TipTapEditorHandle } from './TipTapEditor';
import { Pencil, Trash2, Copy, Loader2 } from 'lucide-react';
import { Toast } from './Toast';
import { copyHtmlWithEmbeddedImages } from '@/lib/clipboard';
import type { TaskComment } from '@/lib/types';

function hasMeaningfulCommentContent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasMeaningfulCommentContent);

  const node = value as Record<string, unknown>;

  if (typeof node.text === 'string' && node.text.trim().length > 0) return true;

  const nodeType = typeof node.type === 'string' ? node.type : '';
  if (nodeType === 'image' || nodeType === 'hardBreak') return true;

  return hasMeaningfulCommentContent(node.content);
}

function getCommentPlainText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return '';
  if (Array.isArray(value)) return value.map(getCommentPlainText).join(' ');

  const node = value as Record<string, unknown>;
  if (typeof node.text === 'string') return node.text;

  return getCommentPlainText(node.content);
}

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
  const { copyWithImagesOnCopy } = useApp();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newContent, setNewContent] = useState<object>({ type: 'doc', content: [] });
  const [editing, setEditing] = useState<{ id: string; content: object } | null>(null);
  const [originalContent, setOriginalContent] = useState<object | null>(null); // Original content when editing started
  const [pendingEdit, setPendingEdit] = useState<{ id: string; content: object } | null>(null); // Comment waiting to be edited
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [copyingCommentId, setCopyingCommentId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string } | null>(null);
  const commentEditorRefs = useRef<Record<string, TipTapEditorHandle | null>>({});
  const onCommentsLoadedRef = useRef(onCommentsLoaded);
  onCommentsLoadedRef.current = onCommentsLoaded;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`);
      if (res.ok) {
        const data = await res.json();
        const visibleComments = data.filter((comment: TaskComment) => hasMeaningfulCommentContent(comment.content));
        setComments(visibleComments);
        onCommentsLoadedRef.current?.(visibleComments.length);
      }
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (taskId) load();
  }, [taskId, load]);

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
    if (savingComment) return false;
    // Check if there's actual content (not just empty doc)
    if (!hasContentText(newContent)) return false;

    setSavingComment(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: currentUser, content: newContent }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments(prev => {
          const updated = [...prev, newComment];
          onCommentsLoaded?.(updated.length);
          return updated;
        });
        setNewContent({ type: 'doc', content: [] }); // Reset to empty doc
        onAttachmentsChange?.(); // Refresh attachments in case images were pasted
        return true;
      }
      return false;
    } finally {
      setSavingComment(false);
    }
  };

  const handleUpdate = async (): Promise<boolean> => {
    if (!editing || savingComment) return false;
    setSavingComment(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, content: editing.content }),
      });
      if (res.ok) {
        const updatedComment = await res.json();
        setComments(prev => prev.map(c => c.id === updatedComment.id ? updatedComment : c));
        stopEditing();
        onAttachmentsChange?.(); // Refresh attachments in case images were pasted
        return true;
      }
      return false;
    } finally {
      setSavingComment(false);
    }
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

  const handleCopyComment = async (comment: TaskComment) => {
    const editorHandle = commentEditorRefs.current[comment.id];
    const fallbackText = getCommentPlainText(comment.content as object).trim();
    const copiedWithImages = !!editorHandle;

    setCopyingCommentId(comment.id);
    try {
      if (editorHandle) {
        await copyHtmlWithEmbeddedImages(editorHandle.getHTML(), editorHandle.getText());
      } else {
        await navigator.clipboard.writeText(fallbackText);
      }
      setToast({ message: copiedWithImages ? 'Comentario copiado con imágenes' : 'Comentario copiado' });
    } catch (err) {
      console.error('Error copiando comentario:', err);
      setToast({ message: 'Error al copiar comentario' });
    } finally {
      setCopyingCommentId(null);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/tasks/${taskId}/comments?id=${id}`, { method: 'DELETE' });
    setComments(prev => {
      const updated = prev.filter(c => c.id !== id);
      onCommentsLoaded?.(updated.length);
      return updated;
    });
    onSaveTask?.(); // Refresh notes list (updatedAt changed)
  };

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-300">Comentarios</h3>
        {comments.length > 0 && (
          <span className="text-[10px] text-gray-500">{comments.length}</span>
        )}
      </div>
      {loading && <p className="text-[11px] text-gray-500">cargando...</p>}
      {comments.length === 0 && !loading && <p className="text-[11px] text-gray-500 italic">Sin comentarios</p>}
      <div className="space-y-1.5 text-sm">
        {comments.map(c => {
          const isSystemComment = c.author === '🤖 Sistema';
          const commentText = getCommentPlainText(c.content as object).trim();
          const commentMeta = `${c.author} • ${c.createdAt ? new Date(c.createdAt).toLocaleString('es-AR', { hour12: false }) : 'Sin fecha'}`;

          return (
            <div
              key={c.id}
              className={`rounded-md border ${isSystemComment ? 'px-1.5 py-1' : 'px-2 py-1.5'} ${editing?.id === c.id ? 'border-gray-600 bg-gray-800/50' : 'border-gray-800 bg-gray-900/30'}`}
              onDoubleClick={(event) => {
                event.stopPropagation();
                // Only allow editing own comments and avoid resetting the current edit session
                if (c.author !== currentUser) return;
                if (editing?.id === c.id) return;
                startEditing(c.id, c.content as object);
              }}
            >
              {isSystemComment ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="min-w-0 flex-1 truncate text-sm leading-snug italic text-gray-300 opacity-90">
                    {commentText || 'Sin contenido'}
                  </span>
                  <div className="flex items-center gap-1 shrink-0 text-[11px] leading-none text-gray-400">
                    <span>{commentMeta}</span>
                    <button
                      onClick={() => handleCopyComment(c)}
                      className="p-0.5 hover:text-white"
                      title="Copiar comentario con imágenes"
                    >
                      {copyingCommentId === c.id ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Copy size={11} />
                      )}
                    </button>
                  </div>
                </div>
              ) : editing?.id === c.id ? (
                <div
                  className="mt-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      stopEditing();
                    } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                      e.preventDefault();
                      // Only save if content has actually changed
                      if (hasContentChanged()) {
                        handleUpdate();
                      }
                    }
                  }}
                >
                  <TipTapEditor
                    copyWithImagesOnCopy={copyWithImagesOnCopy}
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
                      className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 rounded text-[11px]"
                    >guardar</button>
                    <button
                      onClick={() => stopEditing()}
                      className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-[11px]"
                    >cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex items-center gap-1 text-[11px] leading-none text-gray-400">
                      <span className={`truncate max-w-[120px] ${isSystemComment ? 'text-gray-300' : ''}`}>{c.author}</span>
                      <span className="text-gray-600">•</span>
                      <span>{c.createdAt ? new Date(c.createdAt).toLocaleString('es-AR', { hour12: false }) : 'Sin fecha'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-400 shrink-0">
                      <button
                        onClick={() => handleCopyComment(c)}
                        className="p-0.5 hover:text-white"
                        title="Copiar comentario con imágenes"
                      >
                        {copyingCommentId === c.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                      {c.author === currentUser && (
                        <>
                          <button
                            onClick={() => startEditing(c.id, c.content as object)}
                            className="p-0.5 hover:text-white"
                            title="Editar"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="p-0.5 hover:text-white"
                            title="Eliminar"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className={isSystemComment ? 'mt-0.5 text-[11px] leading-snug text-gray-400 opacity-70 [&_p]:!mb-0.5 [&_p]:!leading-snug [&_p:last-child]:!mb-0' : 'mt-1'}>
                  <TipTapEditor
                    ref={(instance) => {
                      if (instance) commentEditorRefs.current[c.id] = instance;
                    }}
                    copyWithImagesOnCopy={copyWithImagesOnCopy}
                    content={c.content as object}
                    onChange={() => {}}
                    readOnly={true}
                    compact
                    bare
                  />
                </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* New comment input - hidden when editing an existing comment */}
      {!editing && (
        <div 
          className="mt-2 border border-gray-700 rounded-md px-2 py-1.5 bg-gray-900/35"
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
          <div className="flex gap-2 mt-1 justify-end">
            <button
              onClick={handleAdd}
              disabled={savingComment}
              className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 rounded text-[11px] disabled:opacity-50"
            >guardar</button>
            <button
              onClick={() => setNewContent({ type: 'doc', content: [] })}
              className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-[11px]"
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

      {toast && (
        <Toast message={toast.message} onClose={() => setToast(null)} />
      )}
    </div>
  );
});
