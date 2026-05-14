'use client';

import { useEffect, useState } from 'react';
import { TipTapEditor } from './TipTapEditor';
import { X, Save, Plus, Calendar } from 'lucide-react';
import type { Client } from '@/lib/types';

interface TodoCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface TaskOption {
  id: string;
  title: string;
}

export function TodoCreateModal({ isOpen, onClose, onCreated }: TodoCreateModalProps) {
  const [content, setContent] = useState<object>({ type: 'doc', content: [] });
  const [deadline, setDeadline] = useState<string>('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatDatetimeLocal = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const getDefaultDeadline = () => {
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    return formatDatetimeLocal(nextHour);
  };

  useEffect(() => {
    if (!isOpen) return;

    const fetchClients = async () => {
      try {
        const res = await fetch('/api/clients');
        if (res.ok) {
          const data = await res.json();
          setClients(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Error fetching clients for TODO modal', err);
      }
    };

    fetchClients();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    setContent({ type: 'doc', content: [] });
    setDeadline(getDefaultDeadline());
    setTaskId(null);
    setClientId(null);
    setError(null);
    setTasks([]);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (!clientId) {
      setTasks([]);
      setTaskId(null);
      return;
    }

    const fetchTasksByClient = async () => {
      try {
        const res = await fetch(`/api/notes?type=task&clientId=${clientId}`);
        if (res.ok) {
          const data = await res.json();
          const taskOpts = Array.isArray(data)
            ? data.map((t: { id: string; title: string }) => ({ id: t.id, title: t.title }))
            : [];
          setTasks(taskOpts);
        }
      } catch (err) {
        console.error('Error fetching tasks for TODO modal', err);
      }
    };

    fetchTasksByClient();
  }, [clientId, isOpen]);

  const isContentEmpty = (value: unknown) => {
    if (!value || typeof value !== 'object') return true;
    const doc = value as { type?: string; content?: unknown[] };
    if (doc.type === 'doc' && Array.isArray(doc.content)) {
      return doc.content.length === 0 || doc.content.every((block) => {
        if (!block || typeof block !== 'object') return true;
        return !Object.values(block).some((v) =>
          typeof v === 'string' ? v.trim().length > 0 : v != null
        );
      });
    }
    return false;
  };

  const handleSave = async () => {
    if (saving) return;

    if (isContentEmpty(content)) {
      setError('Escribe algo en el TODO antes de guardar.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const body = {
        author: 'usuario',
        content: content && typeof content === 'object' ? content : { type: 'doc', content: [] },
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        taskId: taskId || undefined,
        clientId: clientId || undefined,
      };
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const payload = await res.text().catch(() => null);
        setError(
          typeof payload === 'string' && payload.trim()
            ? `No se pudo guardar el TODO: ${payload}`
            : 'No se pudo guardar el TODO.'
        );
        return;
      }

      onCreated();
      onClose();
    } catch (err) {
      console.error('Error creating TODO:', err);
      setError('Error al guardar el TODO. Revisa la consola para más detalles.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg flex flex-col border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Plus size={20} className="text-blue-400" />
            <div>
              <h2 className="text-lg font-semibold">Nuevo TODO</h2>
              <p className="text-xs text-gray-400">Puedes asociarlo opcionalmente a una tarea o cliente</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="border border-gray-700 rounded-lg p-3 bg-gray-800/50">
            <label className="text-xs text-gray-400 mb-2 block">Contenido</label>
            <TipTapEditor
              content={content}
              onChange={json => setContent(json)}
              placeholder="Describe el TODO..."
              readOnly={false}
              noteId={taskId || undefined}
              compact
            />
          </div>

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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Asignar cliente</label>
              <select
                value={clientId ?? ''}
                onChange={(e) => setClientId(e.target.value || null)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">(ninguno)</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-2 block">Asignar tarea</label>
              <select
                value={taskId ?? ''}
                onChange={(e) => setTaskId(e.target.value || null)}
                disabled={!clientId}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
              >
                {!clientId ? (
                  <option value="">Selecciona un cliente primero</option>
                ) : (
                  <>
                    <option value="">(ninguna)</option>
                    {tasks.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>
          {error && (
            <div className="text-sm text-red-400 mt-2">
              {error}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-700 bg-gray-800/50 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm disabled:opacity-50"
          >
            {saving ? 'Guardando...' : (
              <span className="flex items-center gap-1">
                <Save size={14} /> Guardar
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
