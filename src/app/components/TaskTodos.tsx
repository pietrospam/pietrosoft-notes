'use client';

import { useState, useEffect, useCallback } from 'react';
import { TipTapEditor } from './TipTapEditor';
import { 
  Flag, Clock, Repeat, Bell, BellOff, Check, Trash2, 
  Calendar, ChevronDown, ChevronUp 
} from 'lucide-react';
import type { TaskTodo, RecurrenceRule } from '@/lib/types';

interface TaskTodosProps {
  taskId: string;
  currentUser: string;
  onTodoCountChange?: (count: number) => void;
}

type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

export function TaskTodos({ taskId, currentUser, onTodoCountChange }: TaskTodosProps) {
  const [todos, setTodos] = useState<TaskTodo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // New TODO form state
  const [newContent, setNewContent] = useState<object>({ type: 'doc', content: [] });
  const [newDeadline, setNewDeadline] = useState<string>('');
  const [newRecurrence, setNewRecurrence] = useState<RecurrenceFrequency | ''>('');
  
  // Snooze menu state
  const [snoozeMenuId, setSnoozeMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/todos`);
      if (res.ok) {
        const data = await res.json();
        setTodos(data);
        const pendingCount = data.filter((t: TaskTodo) => t.status === 'pending').length;
        onTodoCountChange?.(pendingCount);
      }
    } finally {
      setLoading(false);
    }
  }, [taskId, onTodoCountChange]);

  useEffect(() => {
    if (taskId) load();
  }, [taskId, load]);

  // Check for scroll-to-todo from sidebar click
  useEffect(() => {
    const scrollToId = sessionStorage.getItem('scrollToTodoId');
    if (scrollToId) {
      sessionStorage.removeItem('scrollToTodoId');
      setTimeout(() => {
        const el = document.getElementById(`todo-${scrollToId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-blue-500');
          setTimeout(() => el.classList.remove('ring-2', 'ring-blue-500'), 2000);
        }
      }, 100);
    }
  }, [todos]);

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

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Flag size={16} className={pendingTodos.some(t => {
            const d = t.deadline ? new Date(t.deadline) : null;
            return d && d < new Date();
          }) ? 'text-red-500' : 'text-gray-400'} />
          TODOs
          {pendingTodos.length > 0 && (
            <span className="bg-gray-700 text-xs px-1.5 py-0.5 rounded-full">
              {pendingTodos.length}
            </span>
          )}
        </h3>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          {showCreateForm ? 'Cancelar' : '+ Nuevo TODO'}
        </button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="mb-3 border border-gray-600 rounded-lg p-3 bg-gray-800/50">
          <TipTapEditor
            content={newContent}
            onChange={json => setNewContent(json)}
            placeholder="Describe el TODO..."
            readOnly={false}
            noteId={taskId}
            compact
          />
          
          <div className="flex flex-wrap gap-3 mt-2">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-400" />
              <input
                type="datetime-local"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Repeat size={14} className="text-gray-400" />
              <select
                value={newRecurrence}
                onChange={(e) => setNewRecurrence(e.target.value as RecurrenceFrequency | '')}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs"
              >
                <option value="">Sin recurrencia</option>
                <option value="daily">Diario</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensual</option>
              </select>
            </div>
          </div>
          
          <div className="flex gap-2 mt-2 justify-end">
            <button
              onClick={handleCreate}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
            >
              Crear TODO
            </button>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setNewContent({ type: 'doc', content: [] });
                setNewDeadline('');
                setNewRecurrence('');
              }}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading && <p className="text-xs text-gray-500">Cargando TODOs...</p>}
      
      {/* Pending TODOs */}
      {pendingTodos.length === 0 && !loading && !showCreateForm && (
        <p className="text-gray-500 text-xs">Sin TODOs pendientes</p>
      )}
      
      <div className="space-y-2">
        {pendingTodos.map(todo => {
          const timeDisplay = getTimeDisplay(todo);
          const snoozed = isSnoozed(todo);
          
          return (
            <div
              key={todo.id}
              id={`todo-${todo.id}`}
              className={`border border-gray-700 rounded-lg p-2 transition-all ${
                snoozed ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start gap-2">
                {/* Checkbox */}
                <button
                  onClick={() => handleComplete(todo.id)}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${getStatusColor(todo)} border-transparent hover:border-white`}
                >
                  <Check size={12} className="text-white opacity-0 hover:opacity-100" />
                </button>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs">
                    <TipTapEditor
                      content={todo.content as object}
                      onChange={() => {}}
                      readOnly={true}
                    />
                  </div>
                  
                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {timeDisplay && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        timeDisplay.isOverdue 
                          ? 'bg-red-900/50 text-red-400' 
                          : 'bg-gray-700 text-gray-300'
                      }`}>
                        <Clock size={10} className="inline mr-1" />
                        {timeDisplay.text}
                      </span>
                    )}
                    
                    {todo.recurrenceRule && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-400">
                        <Repeat size={10} className="inline mr-1" />
                        {typeof todo.recurrenceRule === 'string' 
                          ? (JSON.parse(todo.recurrenceRule) as RecurrenceRule).frequency 
                          : (todo.recurrenceRule as RecurrenceRule).frequency}
                      </span>
                    )}
                    
                    {snoozed && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">
                        <BellOff size={10} className="inline mr-1" />
                        Pospuesto
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-1 relative">
                  {/* Snooze button */}
                  <button
                    onClick={() => setSnoozeMenuId(snoozeMenuId === todo.id ? null : todo.id)}
                    className="p-1 text-gray-400 hover:text-white"
                    title="Posponer"
                  >
                    <Bell size={14} />
                  </button>
                  
                  {/* Snooze menu */}
                  {snoozeMenuId === todo.id && (
                    <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 py-1 min-w-[120px]">
                      <button
                        onClick={() => handleSnooze(todo.id, 15)}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-700"
                      >
                        15 minutos
                      </button>
                      <button
                        onClick={() => handleSnooze(todo.id, 60)}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-700"
                      >
                        1 hora
                      </button>
                      <button
                        onClick={() => handleSnooze(todo.id, 180)}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-700"
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
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-700"
                      >
                        Mañana 9:00
                      </button>
                    </div>
                  )}
                  
                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(todo.id)}
                    className="p-1 text-gray-400 hover:text-red-400"
                    title="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Completed TODOs toggle */}
      {completedTodos.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
          >
            {showCompleted ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {completedTodos.length} completado{completedTodos.length !== 1 ? 's' : ''}
          </button>
          
          {showCompleted && (
            <div className="mt-2 space-y-2 opacity-60">
              {completedTodos.map(todo => (
                <div
                  key={todo.id}
                  className="border border-gray-800 rounded-lg p-2"
                >
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                      <Check size={12} className="text-white" />
                    </div>
                    <div className="flex-1 line-through text-gray-500 text-xs">
                      <TipTapEditor
                        content={todo.content as object}
                        onChange={() => {}}
                        readOnly={true}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500">
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
  );
}
