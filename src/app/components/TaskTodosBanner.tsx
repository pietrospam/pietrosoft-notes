'use client';

import { useState, useEffect, useCallback } from 'react';
import { Flag, Clock, AlertTriangle } from 'lucide-react';
import type { TaskTodo } from '@/lib/types';

interface TaskTodosBannerProps {
  taskId: string;
  onClick: () => void;
  onPendingCountChange?: (count: number) => void;
}

export function TaskTodosBanner({ taskId, onClick, onPendingCountChange }: TaskTodosBannerProps) {
  const [todos, setTodos] = useState<TaskTodo[]>([]);

  const load = useCallback(async () => {
    if (!taskId) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}/todos`);
      if (res.ok) {
        const data = await res.json();
        setTodos(data);
      }
    } catch {
      // Silently handle errors
    }
  }, [taskId]);

  useEffect(() => {
    if (taskId) load();
  }, [taskId, load]);

  const pendingTodos = todos.filter(t => t.status === 'pending');

  // Report count to parent
  useEffect(() => {
    onPendingCountChange?.(pendingTodos.length);
  }, [pendingTodos.length, onPendingCountChange]);
  
  if (pendingTodos.length === 0) return null;

  // Get the most urgent TODO (earliest deadline or any overdue)
  const now = new Date();
  const sortedTodos = [...pendingTodos].sort((a, b) => {
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });
  
  const urgentTodo = sortedTodos[0];
  const hasOverdue = pendingTodos.some(t => t.deadline && new Date(t.deadline) < now);
  const hasRecurring = pendingTodos.some(t => t.recurrenceRule);

  // Get time display for urgent todo
  const getTimeText = () => {
    if (!urgentTodo?.deadline) return null;
    
    const deadline = new Date(urgentTodo.deadline);
    const diff = deadline.getTime() - now.getTime();
    const isOverdue = diff < 0;
    
    const absDiff = Math.abs(diff);
    const minutes = Math.floor(absDiff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    let text: string;
    if (days > 0) {
      text = `${days}d`;
    } else if (hours > 0) {
      text = `${hours}h`;
    } else {
      text = `${minutes}m`;
    }
    
    return isOverdue ? `vencido hace ${text}` : `vence en ${text}`;
  };

  // Extract plain text from TipTap content
  const getPreviewText = (content: object): string => {
    const extractText = (node: { type?: string; text?: string; content?: object[] }): string => {
      if (node.text) return node.text;
      if (node.content) {
        return node.content.map(extractText).join(' ');
      }
      return '';
    };
    return extractText(content as { content?: object[] }).trim().slice(0, 60);
  };

  const timeText = getTimeText();
  const previewText = urgentTodo ? getPreviewText(urgentTodo.content as object) : '';

  return (
    <button
      onClick={onClick}
      className={`w-full p-2 rounded-lg mb-3 flex items-center gap-2 transition-all hover:opacity-90 ${
        hasOverdue 
          ? 'bg-red-900/80 border border-red-700 text-red-100' 
          : 'bg-orange-900/80 border border-orange-700 text-orange-100'
      }`}
    >
      {hasOverdue ? (
        <AlertTriangle size={18} className="text-red-400 flex-shrink-0 animate-pulse" />
      ) : (
        <Flag size={18} className="text-orange-400 flex-shrink-0" />
      )}
      
      <div className="flex-1 text-left min-w-0">
        <span className="font-semibold">
          {pendingTodos.length} TODO{pendingTodos.length !== 1 ? 's' : ''} pendiente{pendingTodos.length !== 1 ? 's' : ''}
        </span>
        {previewText && (
          <span className="mx-2 opacity-70">•</span>
        )}
        {previewText && (
          <span className="opacity-80 truncate">
            {previewText}{previewText.length >= 60 ? '...' : ''}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs flex-shrink-0">
        {hasRecurring && (
          <span className="px-1.5 py-0.5 bg-purple-800/50 rounded text-purple-300">
            recurrente
          </span>
        )}
        {timeText && (
          <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${
            hasOverdue ? 'bg-red-800/50 text-red-300' : 'bg-orange-800/50 text-orange-300'
          }`}>
            <Clock size={12} />
            {timeText}
          </span>
        )}
      </div>
    </button>
  );
}
