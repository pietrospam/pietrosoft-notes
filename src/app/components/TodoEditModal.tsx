'use client';

/**
 * TodoEditModal Component
 * REQ-021: Modal for editing or deleting a TODO
 */

import { useState, useEffect } from 'react';
import { TipTapEditor } from './TipTapEditor';
import { 
  Flag, Calendar, Repeat, Trash2, X, Save 
} from 'lucide-react';
import type { TaskTodo, RecurrenceRule } from '@/lib/types';

interface TodoEditModalProps {
  todo: TaskTodo;
  taskTitle?: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
}

type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

export function TodoEditModal({ 
  todo, 
  taskTitle,
  isOpen, 
  onClose, 
  onSave,
  onDelete 
}: TodoEditModalProps) {
  const [content, setContent] = useState<object>({ type: 'doc', content: [] });
  const [deadline, setDeadline] = useState<string>('');
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency | ''>('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Initialize form from todo prop
  useEffect(() => {
    if (isOpen && todo) {
      setContent(todo.content as object || { type: 'doc', content: [] });
      
      // Convert ISO datetime to local datetime-local format
      if (todo.deadline) {
        const d = new Date(todo.deadline);
        const localDatetime = d.getFullYear() + '-' +
          String(d.getMonth() + 1).padStart(2, '0') + '-' +
          String(d.getDate()).padStart(2, '0') + 'T' +
          String(d.getHours()).padStart(2, '0') + ':' +
          String(d.getMinutes()).padStart(2, '0');
        setDeadline(localDatetime);
      } else {
        setDeadline('');
      }
      
      // Parse recurrence
      if (todo.recurrenceRule) {
        const rule = typeof todo.recurrenceRule === 'string' 
          ? JSON.parse(todo.recurrenceRule) as RecurrenceRule
          : todo.recurrenceRule as RecurrenceRule;
        setRecurrence(rule.frequency as RecurrenceFrequency);
      } else {
        setRecurrence('');
      }
      
      setShowDeleteConfirm(false);
    }
  }, [isOpen, todo]);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose, showDeleteConfirm]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: {
        content: object;
        deadline?: string | null;
        recurrenceRule?: RecurrenceRule | null;
      } = {
        content,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        recurrenceRule: recurrence ? { frequency: recurrence } : null,
      };
      
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (res.ok) {
        onSave();
        onClose();
      }
    } catch (error) {
      console.error('Error updating TODO:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/todos/${todo.id}`, { method: 'DELETE' });
      if (res.ok) {
        onDelete();
        onClose();
      }
    } catch (error) {
      console.error('Error deleting TODO:', error);
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-md flex flex-col border border-gray-700"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Flag size={20} className="text-orange-500" />
            <div>
              <h2 className="text-lg font-semibold">Editar TODO</h2>
              {taskTitle && (
                <p className="text-xs text-gray-400 truncate max-w-[280px]">{taskTitle}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* TipTap Editor */}
          <div className="border border-gray-700 rounded-lg p-3 bg-gray-800/50">
            <label className="text-xs text-gray-400 mb-2 block">Contenido</label>
            <TipTapEditor
              content={content}
              onChange={json => setContent(json)}
              placeholder="Describe el TODO..."
              readOnly={false}
              noteId={todo.taskId}
              compact
            />
          </div>

          {/* Deadline */}
          <div>
            <label className="text-xs text-gray-400 flex items-center gap-1 mb-2">
              <Calendar size={14} />
              Fecha límite
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            {deadline && (
              <button
                onClick={() => setDeadline('')}
                className="text-xs text-gray-400 hover:text-red-400 mt-1"
              >
                Quitar fecha
              </button>
            )}
          </div>

          {/* Recurrence */}
          <div>
            <label className="text-xs text-gray-400 flex items-center gap-1 mb-2">
              <Repeat size={14} />
              Recurrencia
            </label>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as RecurrenceFrequency | '')}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">Sin recurrencia</option>
              <option value="daily">Diario</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensual</option>
            </select>
          </div>

          {/* Delete section */}
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full mt-2 p-2 border border-red-700/50 rounded-lg text-red-400 hover:bg-red-900/30 transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Trash2 size={16} />
              Eliminar TODO
            </button>
          ) : (
            <div className="mt-2 p-3 border border-red-700 rounded-lg bg-red-900/20">
              <p className="text-sm text-red-300 mb-3">
                ¿Estás seguro de eliminar este TODO?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                  disabled={deleting}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm flex items-center justify-center gap-1"
                >
                  {deleting ? 'Eliminando...' : (
                    <>
                      <Trash2 size={14} />
                      Eliminar
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-800/50 rounded-b-xl flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm flex items-center gap-2"
          >
            {saving ? 'Guardando...' : (
              <>
                <Save size={16} />
                Guardar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
