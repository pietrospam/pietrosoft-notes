'use client';

import { useState, useEffect, useCallback } from 'react';
import { TipTapEditor } from './TipTapEditor';
import { 
  Flag, Clock, Repeat, Bell, BellOff, Check, Trash2, 
  Calendar, ChevronDown, ChevronUp, X, Plus, Pencil 
} from 'lucide-react';
import type { TaskTodo, RecurrenceRule } from '@/lib/types';
import { TodoEditModal } from './TodoEditModal';

interface TaskTodosModalProps {
  taskId: string;
  taskTitle: string;
  isOpen: boolean;
  currentUser: string;
  onClose: () => void;
  onTodosChange?: (pendingCount: number) => void;
}

type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

export function TaskTodosModal({ 
  taskId, 
  taskTitle,
  isOpen, 
  currentUser, 
  onClose, 
  onTodosChange 
}: TaskTodosModalProps) {
  const [todos, setTodos] = useState<TaskTodo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // New TODO form state
  const [newContent, setNewContent] = useState<object>({ type: 'doc', content: [] });
  const [newDeadline, setNewDeadline] = useState<string>('');
  const [newRecurrence, setNewRecurrence] = useState<RecurrenceFrequency | ''>('');
  
  // Snooze menu state
  const [snoozeMenuId, setSnoozeMenuId] = useState<string | null>(null);
  
  // Edit modal state
  const [editingTodo, setEditingTodo] = useState<TaskTodo | null>(null);

  const load = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/todos`);
      if (res.ok) {
        const data = await res.json();
        setTodos(data);
        const pendingCount = data.filter((t: TaskTodo) => t.status === 'pending').length;
        onTodosChange?.(pendingCount);
      }
    } finally {
      setLoading(false);
    }
  }, [taskId, onTodosChange]);

  useEffect(() => {
    if (isOpen && taskId) load();
  }, [isOpen, taskId, load]);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  const hasContentText = (content: object) => {
    return content && 
      (content as { content?: unknown[] }).content && 
      (content as { content: unknown[] }).content.length > 0;
  };

  const handleCreate = async () => {
    if (!hasContentText(newContent)) return;
    
    const body: {
      author: string;
      content: object;
      deadline?: string;
      recurrenceRule?: RecurrenceRule;
    } = {
      author: currentUser,
      content: newContent,
    };
    
    if (newDeadline) {
      body.deadline = new Date(newDeadline).toISOString();
    }
    
    if (newRecurrence) {
      body.recurrenceRule = { frequency: newRecurrence };
    }
    
    const res = await fetch(`/api/tasks/${taskId}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    if (res.ok) {
      setNewContent({ type: 'doc', content: [] });
      setNewDeadline('');
      setNewRecurrence('');
      setShowCreateForm(false);
      load();
    }
  };

  const handleComplete = async (id: string) => {
    await fetch(`/api/todos/${id}?action=complete`, { method: 'PATCH' });
    load();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/todos/${id}`, { method: 'DELETE' });
    load();
  };

  const handleSnooze = async (id: string, minutes: number) => {
    const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    await fetch(`/api/todos/${id}?action=snooze`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ until }),
    });
    setSnoozeMenuId(null);
    load();
  };

  const getTimeDisplay = (todo: TaskTodo) => {
    if (!todo.deadline) return null;
    
    const deadline = new Date(todo.deadline);
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    const isOverdue = diff < 0;
    
    const absDiff = Math.abs(diff);
    const minutes = Math.floor(absDiff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    let text: string;
    if (days > 0) {
      text = `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      text = `${hours}h ${minutes % 60}m`;
    } else {
      text = `${minutes}m`;
    }
    
    return { 
      text: isOverdue ? `Vencido hace ${text}` : `Vence en ${text}`, 
      isOverdue 
    };
  };

  const getStatusColor = (todo: TaskTodo) => {
    if (todo.status === 'completed') return 'bg-green-500';
    if (todo.snoozedUntil && new Date(todo.snoozedUntil) > new Date()) return 'bg-gray-500';
    if (!todo.deadline) return 'bg-blue-500';
    
    const deadline = new Date(todo.deadline);
    const now = new Date();
    const hoursRemaining = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursRemaining < 0) return 'bg-red-500 animate-pulse';
    if (hoursRemaining <= 1) return 'bg-orange-500';
    if (hoursRemaining <= 24) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const isSnoozed = (todo: TaskTodo) => {
    return todo.snoozedUntil && new Date(todo.snoozedUntil) > new Date();
  };

  const pendingTodos = todos.filter(t => t.status === 'pending');
  const completedTodos = todos.filter(t => t.status === 'completed');

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col border border-gray-700"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Flag size={20} className={pendingTodos.some(t => {
              const d = t.deadline ? new Date(t.deadline) : null;
              return d && d < new Date();
            }) ? 'text-red-500' : 'text-orange-500'} />
            <div>
              <h2 className="text-lg font-semibold">TODOs de la Tarea</h2>
              <p className="text-xs text-gray-400 truncate max-w-[300px]">{taskTitle}</p>
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
        <div className="flex-1 overflow-y-auto p-4">
          {/* Create button or form */}
          {!showCreateForm ? (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full mb-4 p-3 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-blue-500 hover:text-blue-400 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              Nuevo TODO
            </button>
          ) : (
            <div className="mb-4 border border-gray-600 rounded-lg p-3 bg-gray-800/50">
              <TipTapEditor
                content={newContent}
                onChange={json => setNewContent(json)}
                placeholder="Describe el TODO..."
                readOnly={false}
                noteId={taskId}
                compact
              />
              
              <div className="flex flex-wrap gap-3 mt-3">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-gray-400" />
                  <input
                    type="datetime-local"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <Repeat size={14} className="text-gray-400" />
                  <select
                    value={newRecurrence}
                    onChange={(e) => setNewRecurrence(e.target.value as RecurrenceFrequency | '')}
                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                  >
                    <option value="">Sin recurrencia</option>
                    <option value="daily">Diario</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensual</option>
                  </select>
                </div>
              </div>
              
              <div className="flex gap-2 mt-3 justify-end">
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewContent({ type: 'doc', content: [] });
                    setNewDeadline('');
                    setNewRecurrence('');
                  }}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreate}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                >
                  Crear TODO
                </button>
              </div>
            </div>
          )}

          {loading && <p className="text-sm text-gray-500 text-center py-4">Cargando TODOs...</p>}

          {/* Pending TODOs section */}
          {pendingTodos.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                <Clock size={14} />
                Pendientes ({pendingTodos.length})
              </h3>
              <div className="space-y-2">
                {pendingTodos.map(todo => {
                  const timeDisplay = getTimeDisplay(todo);
                  const snoozed = isSnoozed(todo);
                  
                  return (
                    <div
                      key={todo.id}
                      className={`border border-gray-700 rounded-lg p-3 transition-all ${
                        snoozed ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => handleComplete(todo.id)}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${getStatusColor(todo)} border-transparent hover:border-white`}
                        >
                          <Check size={14} className="text-white opacity-0 hover:opacity-100" />
                        </button>
                        
                        <div className="flex-1 min-w-0">
                          <div className="text-sm">
                            <TipTapEditor
                              content={todo.content as object}
                              onChange={() => {}}
                              readOnly={true}
                            />
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {timeDisplay && (
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                timeDisplay.isOverdue 
                                  ? 'bg-red-900/50 text-red-400' 
                                  : 'bg-gray-700 text-gray-300'
                              }`}>
                                <Clock size={12} className="inline mr-1" />
                                {timeDisplay.text}
                              </span>
                            )}
                            
                            {todo.recurrenceRule && (
                              <span className="text-xs px-2 py-0.5 rounded bg-purple-900/50 text-purple-400">
                                <Repeat size={12} className="inline mr-1" />
                                {typeof todo.recurrenceRule === 'string' 
                                  ? (JSON.parse(todo.recurrenceRule) as RecurrenceRule).frequency 
                                  : (todo.recurrenceRule as RecurrenceRule).frequency}
                              </span>
                            )}
                            
                            {snoozed && (
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-400">
                                <BellOff size={12} className="inline mr-1" />
                                Pospuesto
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 relative">
                          <button
                            onClick={() => setSnoozeMenuId(snoozeMenuId === todo.id ? null : todo.id)}
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                            title="Posponer"
                          >
                            <Bell size={16} />
                          </button>
                          
                          {snoozeMenuId === todo.id && (
                            <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 py-1 min-w-[140px]">
                              <button
                                onClick={() => handleSnooze(todo.id, 15)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                              >
                                15 minutos
                              </button>
                              <button
                                onClick={() => handleSnooze(todo.id, 60)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                              >
                                1 hora
                              </button>
                              <button
                                onClick={() => handleSnooze(todo.id, 180)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                              >
                                3 horas
                              </button>
                              <button
                                onClick={() => {
                                  const tomorrow = new Date();
                                  tomorrow.setDate(tomorrow.getDate() + 1);
                                  tomorrow.setHours(9, 0, 0, 0);
                                  handleSnooze(todo.id, Math.round((tomorrow.getTime() - Date.now()) / 60000));
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                              >
                                Mañana 9:00
                              </button>
                            </div>
                          )}
                          
                          <button
                            onClick={() => setEditingTodo(todo)}
                            className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded"
                            title="Editar"
                          >
                            <Pencil size={16} />
                          </button>
                          
                          <button
                            onClick={() => handleDelete(todo.id)}
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No pending todos */}
          {pendingTodos.length === 0 && !loading && !showCreateForm && (
            <p className="text-gray-500 text-center py-6">Sin TODOs pendientes</p>
          )}

          {/* Completed TODOs section */}
          {completedTodos.length > 0 && (
            <div className="mt-4 border-t border-gray-700 pt-4">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-2"
              >
                {showCompleted ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <Check size={14} className="text-green-500" />
                Completados ({completedTodos.length})
              </button>
              
              {showCompleted && (
                <div className="space-y-2 opacity-60">
                  {completedTodos.map(todo => (
                    <div
                      key={todo.id}
                      className="border border-gray-800 rounded-lg p-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                          <Check size={14} className="text-white" />
                        </div>
                        <div className="flex-1 line-through text-gray-500 text-sm">
                          <TipTapEditor
                            content={todo.content as object}
                            onChange={() => {}}
                            readOnly={true}
                          />
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {todo.completedAt && new Date(todo.completedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-700 bg-gray-800/50 rounded-b-xl">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{pendingTodos.length} pendiente{pendingTodos.length !== 1 ? 's' : ''} • {completedTodos.length} completado{completedTodos.length !== 1 ? 's' : ''}</span>
            <button
              onClick={onClose}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingTodo && (
        <TodoEditModal
          todo={editingTodo}
          taskTitle={taskTitle}
          isOpen={!!editingTodo}
          onClose={() => setEditingTodo(null)}
          onSave={() => {
            load();
            setEditingTodo(null);
          }}
          onDelete={() => {
            load();
            setEditingTodo(null);
          }}
        />
      )}
    </div>
  );
}
