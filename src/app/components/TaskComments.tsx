'use client';

import { useState, useEffect } from 'react';
import { TipTapEditor } from './TipTapEditor';
import { Pencil, Trash2 } from 'lucide-react';
import type { TaskComment } from '@/lib/types';

interface TaskCommentsProps {
  taskId: string;
  currentUser: string;
  onAttachmentsChange?: () => void; // Called when images are added via paste
  onCommentsLoaded?: (count: number) => void; // Reports comments count to parent
  onSaveTask?: () => void; // Called on Ctrl+S to also save the parent task
}

export function TaskComments({ taskId, currentUser, onAttachmentsChange, onCommentsLoaded, onSaveTask }: TaskCommentsProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newContent, setNewContent] = useState<object>({ type: 'doc', content: [] });
  const [editing, setEditing] = useState<{ id: string; content: object } | null>(null);

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

  const handleAdd = async () => {
    // Check if there's actual content (not just empty doc)
    const hasContent = newContent && 
      (newContent as { content?: unknown[] }).content && 
      (newContent as { content: unknown[] }).content.length > 0;
    if (!hasContent) return;
    
    const res = await fetch(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: currentUser, content: newContent }),
    });
    if (res.ok) {
      setNewContent({ type: 'doc', content: [] }); // Reset to empty doc
      load();
      onAttachmentsChange?.(); // Refresh attachments in case images were pasted
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    const res = await fetch(`/api/tasks/${taskId}/comments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editing.id, content: editing.content }),
    });
    if (res.ok) {
      setEditing(null);
      load();
      onAttachmentsChange?.(); // Refresh attachments in case images were pasted
    }
  };

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
          <div key={c.id} className="py-0.5">
            <div className="flex justify-between text-[10px] text-gray-400">
              <span className="truncate max-w-[120px]">{c.author}</span>
              <span>{new Date(c.createdAt).toLocaleString()}</span>
            </div>
            {editing?.id === c.id ? (
              <div
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    handleUpdate();
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
                  compact
                />
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={handleUpdate}
                    className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                  >guardar</button>
                  <button
                    onClick={() => setEditing(null)}
                    className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                  >cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <TipTapEditor
                  content={c.content as object}
                  onChange={() => {}}
                  readOnly={true}
                />
                {c.author === currentUser && (
                  <div className="flex gap-2 mt-1 text-gray-400">
                    <button
                      onClick={() => setEditing({ id: c.id, content: c.content as object })}
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

      {/* New comment input - always visible */}
      <div 
        className="mt-3 border border-gray-600 rounded-lg p-2 bg-gray-800/50"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            handleAdd();
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
    </div>
  );
}
