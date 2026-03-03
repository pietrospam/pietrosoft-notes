'use client';

import { useState, useEffect } from 'react';
import { TipTapEditor } from './TipTapEditor';
import type { TaskComment } from '@/lib/types';

interface TaskCommentsProps {
  taskId: string;
  currentUser: string;
}

export function TaskComments({ taskId, currentUser }: TaskCommentsProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newContent, setNewContent] = useState<object | null>(null);
  const [editing, setEditing] = useState<{ id: string; content: object } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`);
      if (res.ok) {
        setComments(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) load();
  }, [taskId]);

  const handleAdd = async () => {
    if (!newContent) return;
    const res = await fetch(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: currentUser, content: newContent }),
    });
    if (res.ok) {
      setNewContent(null);
      load();
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
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/tasks/${taskId}/comments?id=${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-2">Comentarios</h3>
      {loading && <p>cargando...</p>}
      {comments.length === 0 && !loading && <p className="text-gray-500">Sin comentarios</p>}
      <div className="space-y-4">
        {comments.map(c => (
          <div key={c.id} className="bg-gray-800 p-3 rounded">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{c.author}</span>
              <span>{new Date(c.createdAt).toLocaleString()}</span>
            </div>
            <TipTapEditor
              content={c.content as object}
              onChange={() => {}}
              readOnly={true}
            />
            {c.author === currentUser && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setEditing({ id: c.id, content: c.content as object })}
                  className="text-blue-400 text-sm"
                >editar</button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="text-red-400 text-sm"
                >eliminar</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* New / edit form */}
      {(editing || newContent !== null) && (
        <div className="mt-4 bg-gray-800 p-3 rounded">
          <h4 className="text-sm font-medium mb-1">
            {editing ? 'Editar comentario' : 'Nuevo comentario'}
          </h4>
          <TipTapEditor
            content={(editing ? editing.content : newContent) as object | null}
            onChange={json => {
              if (editing) setEditing(prev => prev ? { ...prev, content: json } : null);
              else setNewContent(json);
            }}
            placeholder="Escribe tu comentario..."
            readOnly={false}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={editing ? handleUpdate : handleAdd}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
            >guardar</button>
            <button
              onClick={() => {
                setEditing(null);
                setNewContent(null);
              }}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >cancelar</button>
          </div>
        </div>
      )}

      {!editing && newContent === null && (
        <button
          onClick={() => setNewContent({ type: 'doc', content: [] })}
          className="mt-4 text-blue-400 text-sm"
        >Agregar comentario</button>
      )}
    </div>
  );
}
