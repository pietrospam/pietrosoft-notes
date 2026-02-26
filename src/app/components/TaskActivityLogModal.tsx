'use client';

import { useState, useEffect } from 'react';
import { X, Clock, Check, AlertCircle, Edit, File, Star, Archive, Loader2 } from 'lucide-react';
import type { TaskActivityLog, TaskActivityEventType } from '@/lib/types';

interface TaskActivityLogModalProps {
  taskId: string;
  taskTitle: string;
  onClose: () => void;
}

// Event type icons
const EVENT_ICONS: Record<TaskActivityEventType, React.ElementType> = {
  CREATED: Check,
  TITLE_CHANGED: Edit,
  STATUS_CHANGED: AlertCircle,
  PRIORITY_CHANGED: AlertCircle,
  PROJECT_CHANGED: AlertCircle,
  CLIENT_CHANGED: AlertCircle,
  DUE_DATE_CHANGED: Clock,
  CONTENT_UPDATED: Edit,
  TIMESHEET_ADDED: Clock,
  TIMESHEET_MODIFIED: Clock,
  TIMESHEET_DELETED: Clock,
  ATTACHMENT_ADDED: File,
  ATTACHMENT_DELETED: File,
  ARCHIVED: Archive,
  UNARCHIVED: Archive,
  FAVORITED: Star,
  UNFAVORITED: Star,
};

// Event type labels in Spanish
const EVENT_LABELS: Record<TaskActivityEventType, string> = {
  CREATED: 'Tarea creada',
  TITLE_CHANGED: 'Título modificado',
  STATUS_CHANGED: 'Estado cambiado',
  PRIORITY_CHANGED: 'Prioridad cambiada',
  PROJECT_CHANGED: 'Proyecto cambiado',
  CLIENT_CHANGED: 'Cliente cambiado',
  DUE_DATE_CHANGED: 'Fecha de vencimiento',
  CONTENT_UPDATED: 'Contenido actualizado',
  TIMESHEET_ADDED: 'TimeSheet agregado',
  TIMESHEET_MODIFIED: 'TimeSheet modificado',
  TIMESHEET_DELETED: 'TimeSheet eliminado',
  ATTACHMENT_ADDED: 'Adjunto agregado',
  ATTACHMENT_DELETED: 'Adjunto eliminado',
  ARCHIVED: 'Archivada',
  UNARCHIVED: 'Desarchivada',
  FAVORITED: 'Agregada a favoritos',
  UNFAVORITED: 'Eliminada de favoritos',
};

// Group logs by date
interface GroupedLogs {
  date: string;
  dateLabel: string;
  logs: TaskActivityLog[];
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const dateOnly = date.toISOString().split('T')[0];
  const todayOnly = today.toISOString().split('T')[0];
  const yesterdayOnly = yesterday.toISOString().split('T')[0];
  
  if (dateOnly === todayOnly) {
    return 'Hoy';
  }
  if (dateOnly === yesterdayOnly) {
    return 'Ayer';
  }
  
  return date.toLocaleDateString('es', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

function groupLogsByDate(logs: TaskActivityLog[]): GroupedLogs[] {
  const groups: Map<string, TaskActivityLog[]> = new Map();
  
  logs.forEach(log => {
    const dateKey = new Date(log.createdAt).toISOString().split('T')[0];
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(log);
  });
  
  return Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0])) // Sort by date descending
    .map(([date, logs]) => ({
      date,
      dateLabel: formatDateLabel(date),
      logs: logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    }));
}

export function TaskActivityLogModal({ taskId, taskTitle, onClose }: TaskActivityLogModalProps) {
  const [logs, setLogs] = useState<TaskActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/notes/${taskId}/activity`);
        if (response.ok) {
          const data = await response.json();
          setLogs(data.logs || []);
        } else {
          setError('Error al cargar el historial');
        }
      } catch (err) {
        console.error('Failed to fetch activity logs:', err);
        setError('Error al cargar el historial');
      } finally {
        setLoading(false);
      }
    };
    
    fetchLogs();
  }, [taskId]);
  
  const groupedLogs = groupLogsByDate(logs);
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Clock size={20} className="text-blue-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">Historial de Cambios</h2>
              <p className="text-sm text-gray-400 truncate max-w-xs">{taskTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors rounded"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={32} className="animate-spin text-blue-400" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-red-400">
              <AlertCircle size={32} className="mb-2" />
              <p>{error}</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <Clock size={32} className="mb-2 opacity-50" />
              <p>No hay historial de cambios</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedLogs.map(group => (
                <div key={group.date}>
                  {/* Date header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="text-sm font-semibold text-gray-300 capitalize">
                      {group.dateLabel}
                    </div>
                    <div className="flex-1 h-px bg-gray-700" />
                  </div>
                  
                  {/* Logs for this date */}
                  <div className="space-y-2">
                    {group.logs.map(log => {
                      const Icon = EVENT_ICONS[log.eventType] || Clock;
                      const label = EVENT_LABELS[log.eventType] || log.eventType;
                      
                      return (
                        <div
                          key={log.id}
                          className="flex items-start gap-3 p-2 rounded-lg bg-gray-750 hover:bg-gray-700 transition-colors"
                        >
                          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-700">
                            <Icon size={14} className="text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">
                                {label}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatTime(log.createdAt)}
                              </span>
                            </div>
                            {log.description && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {log.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
