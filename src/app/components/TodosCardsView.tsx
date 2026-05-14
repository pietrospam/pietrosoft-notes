'use client';

/**
 * TodosCardsView Component
 * REQ-021: Vista de TODOs en panel lateral (reemplaza NotesList)
 * 
 * Muestra TODOs en un panel lateral con calendario mensual.
 * Click en un TODO muestra la task relacionada en el editor.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Flag, Check, Clock, ChevronLeft, ChevronRight, Pencil, Plus } from 'lucide-react';
import type { TodoWithTask, TaskTodo } from '@/lib/types';
import { TodoEditModal } from './TodoEditModal';
import { TodoCreateModal } from './TodoCreateModal';

interface TodosCardsViewProps {
  filterTaskId?: string | null;  // null = all TODOs, string = specific task
  onNavigateToTask: (taskId: string) => void;
  onClose?: () => void;  // Optional close handler when showing for specific task
}

export function TodosCardsView({ filterTaskId, onNavigateToTask, onClose }: TodosCardsViewProps) {
  const [allTodos, setAllTodos] = useState<TodoWithTask[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Edit modal state
  const [editingTodo, setEditingTodo] = useState<TodoWithTask | null>(null);
  const [creatingTodo, setCreatingTodo] = useState(false);

  const fetchTodos = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterTaskId 
        ? `/api/tasks/${filterTaskId}/todos`
        : '/api/todos?includeCompleted=true';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const todosList = Array.isArray(data) ? data : data.todos || [];
        setAllTodos(todosList);
      }
    } catch (error) {
      console.error('Error fetching TODOs:', error);
    } finally {
      setLoading(false);
    }
  }, [filterTaskId]);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  // Get days in month that have TODOs
  const daysWithTodos = useMemo(() => {
    const days = new Set<string>();
    allTodos.forEach(todo => {
      if (todo.deadline) {
        const d = new Date(todo.deadline);
        days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
      }
    });
    return days;
  }, [allTodos]);

  // Filter and sort todos based on selected date
  const filteredTodos = useMemo(() => {
    let filtered = allTodos;
    
    // Filter by selected date if any
    if (selectedDate) {
      filtered = allTodos.filter(todo => {
        if (!todo.deadline) return false;
        const d = new Date(todo.deadline);
        return d.getFullYear() === selectedDate.getFullYear() &&
               d.getMonth() === selectedDate.getMonth() &&
               d.getDate() === selectedDate.getDate();
      });
    }
    
    // Sort: overdue first, then pending by deadline, then completed
    const now = new Date();
    return filtered.sort((a, b) => {
      // Completed goes last
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (b.status === 'completed' && a.status !== 'completed') return -1;
      
      // For pending items, sort by deadline
      if (a.status === 'pending' && b.status === 'pending') {
        const aOverdue = a.deadline && new Date(a.deadline) < now;
        const bOverdue = b.deadline && new Date(b.deadline) < now;
        
        // Overdue first
        if (aOverdue && !bOverdue) return -1;
        if (bOverdue && !aOverdue) return 1;
        
        // Then by deadline
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      
      return 0;
    });
  }, [allTodos, selectedDate]);

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay(); // 0 = Sunday
    
    return { daysInMonth, startingDay, year, month };
  };

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const navigateMonth = (direction: number) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  const isToday = (year: number, month: number, day: number) => {
    const today = new Date();
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
  };

  const isSelected = (year: number, month: number, day: number) => {
    if (!selectedDate) return false;
    return selectedDate.getFullYear() === year && 
           selectedDate.getMonth() === month && 
           selectedDate.getDate() === day;
  };

  const hasTodo = (year: number, month: number, day: number) => {
    return daysWithTodos.has(`${year}-${month}-${day}`);
  };

  const handleDayClick = (year: number, month: number, day: number) => {
    const clickedDate = new Date(year, month, day);
    // Toggle selection - if already selected, deselect
    if (isSelected(year, month, day)) {
      setSelectedDate(null);
    } else {
      setSelectedDate(clickedDate);
    }
  };

  const handleComplete = async (todoId: string) => {
    try {
      await fetch(`/api/todos/${todoId}?action=complete`, { method: 'PATCH' });
      fetchTodos();
    } catch (error) {
      console.error('Error completing TODO:', error);
    }
  };

  const handleSnooze = async (todoId: string, minutes: number) => {
    const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    try {
      await fetch(`/api/todos/${todoId}?action=snooze`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ until })
      });
      fetchTodos();
    } catch (error) {
      console.error('Error snoozing TODO:', error);
    }
  };

  const getTimeDisplay = (deadline: string | null) => {
    if (!deadline) return { text: 'Sin fecha', isOverdue: false, color: 'text-gray-400' };
    
    const d = new Date(deadline);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const isOverdue = diff < 0;
    
    const absDiff = Math.abs(diff);
    const minutes = Math.floor(absDiff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    let text: string;
    if (days > 0) {
      text = isOverdue ? `Vencido hace ${days}d` : `Vence en ${days}d`;
    } else if (hours > 0) {
      text = isOverdue ? `Vencido hace ${hours}h` : `Vence en ${hours}h`;
    } else {
      text = isOverdue ? `Vencido hace ${minutes}m` : `Vence en ${minutes}m`;
    }
    
    const color = isOverdue 
      ? 'text-red-400 bg-red-500/20' 
      : hours < 1 
        ? 'text-orange-400 bg-orange-500/20' 
        : 'text-gray-400 bg-gray-700';
    
    return { text, isOverdue, color };
  };

  const getContentPreview = (content: unknown): string => {
    if (!content) return '';
    const doc = content as { type: string; content?: Array<{ type: string; content?: Array<{ text?: string }> }> };
    if (doc.type === 'doc' && doc.content) {
      const texts: string[] = [];
      doc.content.forEach(block => {
        if (block.content) {
          block.content.forEach(inline => {
            if (inline.text) texts.push(inline.text);
          });
        }
      });
      return texts.join(' ').slice(0, 200);
    }
    return '';
  };

  if (loading) {
    return (
      <div style={{ width: 320 }} className="bg-gray-900 border-r border-gray-800 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Cargando TODOs...</div>
      </div>
    );
  }

  return (
    <>
      <TodoCreateModal
        isOpen={creatingTodo}
        onClose={() => setCreatingTodo(false)}
        onCreated={() => {
          setCreatingTodo(false);
          fetchTodos();
        }}
      />
      <div style={{ width: 320 }} className="bg-gray-900 border-r border-gray-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Flag className="text-orange-500" size={16} />
            {filterTaskId ? 'TODOs de tarea' : 'TODOs'}
          </h2>
          <button
            onClick={() => setCreatingTodo(true)}
            className="text-xs text-blue-400 hover:text-white flex items-center gap-1"
          >
            <Plus size={14} /> Nuevo
          </button>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {/* Calendar - REQ-021.8 (compact) */}
      {!filterTaskId && (
        <div className="px-2 py-2 border-b border-gray-800">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-0.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-white font-medium">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </span>
            <button
              onClick={() => navigateMonth(1)}
              className="p-0.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {dayNames.map(day => (
              <div key={day} className="text-center text-[10px] text-gray-500 font-medium">
                {day.charAt(0)}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {(() => {
              const { daysInMonth, startingDay, year, month } = getDaysInMonth(currentMonth);
              const cells = [];
              
              for (let i = 0; i < startingDay; i++) {
                cells.push(<div key={`empty-${i}`} className="h-6" />);
              }
              
              for (let day = 1; day <= daysInMonth; day++) {
                const today = isToday(year, month, day);
                const selected = isSelected(year, month, day);
                const hasTodoOnDay = hasTodo(year, month, day);
                
                cells.push(
                  <button
                    key={day}
                    onClick={() => handleDayClick(year, month, day)}
                    className={`h-6 w-full rounded text-xs relative transition-colors ${
                      selected 
                        ? 'bg-orange-600 text-white' 
                        : today 
                          ? 'bg-blue-600 text-white'
                          : hasTodoOnDay
                            ? 'bg-gray-700 text-white'
                            : 'hover:bg-gray-800 text-gray-400'
                    }`}
                  >
                    {day}
                    {hasTodoOnDay && !selected && !today && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-orange-500" />
                    )}
                  </button>
                );
              }
              
              return cells;
            })()}
          </div>

          {/* Filter indicator */}
          {selectedDate && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {selectedDate.getDate()} {monthNames[selectedDate.getMonth()]}
              </span>
              <button
                onClick={() => setSelectedDate(null)}
                className="text-xs text-orange-400 hover:text-orange-300"
              >
                Quitar
              </button>
            </div>
          )}
        </div>
      )}

      {/* TODO List */}
      <div className="flex-1 overflow-y-auto">
        {filteredTodos.length === 0 ? (
          <div className="text-center py-8 px-3">
            <Flag size={24} className="mx-auto mb-2 text-gray-600" />
            <p className="text-xs text-gray-500">
              {selectedDate 
                ? `Sin TODOs el ${selectedDate.getDate()}/${selectedDate.getMonth()+1}`
                : 'Sin TODOs'
              }
            </p>
          </div>
        ) : (
          <div className="py-1">
            {filteredTodos.map((todo) => {
              const timeDisplay = getTimeDisplay(todo.deadline ?? null);
              const preview = getContentPreview(todo.content);
              const isCompleted = todo.status === 'completed';
              
              return (
                <div
                  key={todo.id}
                  onClick={() => {
                    if (todo.taskId) onNavigateToTask(todo.taskId);
                  }}
                  className={`px-3 py-2 border-b border-gray-800 cursor-pointer transition-colors ${
                    isCompleted
                      ? 'opacity-50 hover:opacity-70'
                      : timeDisplay.isOverdue 
                        ? 'bg-red-900/10 hover:bg-red-900/20' 
                        : 'hover:bg-gray-800'
                  }`}
                >
                  {/* Task name + time */}
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium truncate flex-1 ${
                      isCompleted ? 'text-gray-500' : 'text-blue-400'
                    }`}>
                      {todo.task?.title || 'Tarea'}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ml-2 ${
                      isCompleted 
                        ? 'text-green-400 bg-green-500/20' 
                        : timeDisplay.color
                    }`}>
                      {isCompleted ? '✓' : timeDisplay.text}
                    </span>
                  </div>

                  {/* Content preview */}
                  <div className={`text-xs ${isCompleted ? 'text-gray-600 line-through' : 'text-gray-400'} line-clamp-2`}>
                    {preview || 'Sin contenido'}
                  </div>

                  {/* Quick actions for pending todos */}
                  {!isCompleted && (
                    <div className="flex items-center gap-1 mt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleComplete(todo.id);
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 bg-green-600 hover:bg-green-700 rounded text-[10px] text-white"
                      >
                        <Check size={10} />
                        Listo
                      </button>
                      
                      {/* Snooze dropdown */}
                      <div className="relative group">
                        <button 
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-[10px] text-gray-300"
                        >
                          <Clock size={10} />
                        </button>
                        <div className="absolute left-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded shadow-lg py-1 z-10 hidden group-hover:block min-w-20">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSnooze(todo.id, 15); }}
                            className="w-full px-2 py-1 text-left text-[10px] text-gray-300 hover:bg-gray-700"
                          >
                            15 min
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSnooze(todo.id, 60); }}
                            className="w-full px-2 py-1 text-left text-[10px] text-gray-300 hover:bg-gray-700"
                          >
                            1 hora
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSnooze(todo.id, 1440); }}
                            className="w-full px-2 py-1 text-left text-[10px] text-gray-300 hover:bg-gray-700"
                          >
                            Mañana
                          </button>
                        </div>
                      </div>
                      
                      {/* Edit button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTodo(todo);
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-[10px] text-gray-300"
                        title="Editar TODO"
                      >
                        <Pencil size={10} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingTodo && (
        <TodoEditModal
          todo={editingTodo as TaskTodo}
          taskTitle={editingTodo.task?.title}
          isOpen={!!editingTodo}
          onClose={() => setEditingTodo(null)}
          onSave={() => {
            fetchTodos();
            setEditingTodo(null);
          }}
          onDelete={() => {
            fetchTodos();
            setEditingTodo(null);
          }}
        />
      )}
    </div>
    </>
  );
}
