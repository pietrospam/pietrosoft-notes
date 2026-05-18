'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Clock, Save, AlertCircle, Calendar } from 'lucide-react';
import type { TaskNote, Project } from '@/lib/types';

// DD/MM/YYYY <-> YYYY-MM-DD conversions
function toDisplayDate(isoDate: string): string {
  // isoDate: "2026-03-06" -> "06/03/2026"
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function toIsoDate(displayDate: string): string | null {
  // displayDate: "06/03/2026" -> "2026-03-06"
  const parts = displayDate.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  if (!d || !m || !y || d.length !== 2 || m.length !== 2 || y.length !== 4) return null;
  return `${y}-${m}-${d}`;
}

interface FetchedTimeSheet {
  id: string;
  taskId: string;
  workDate: string;
  hoursWorked: number;
  description?: string;
  state: string;
}

interface SearchTask extends TaskNote {
  clientName: string;
  projectName: string;
}

interface TimeSheetModalProps {
  task?: TaskNote;
  initialDate?: string; // Optional: for editing from TimeSheetView grid
  onClose: () => void;
  onSaved: () => void;
}

function getLocalIsoDate(): string {
  const now = new Date();
  return [
    now.getFullYear().toString().padStart(4, '0'),
    (now.getMonth() + 1).toString().padStart(2, '0'),
    now.getDate().toString().padStart(2, '0'),
  ].join('-');
}

export function TimeSheetModal({ task, initialDate, onClose, onSaved }: TimeSheetModalProps) {
  const initialIsoDate = initialDate || getLocalIsoDate();
  const [date, setDate] = useState(() => initialIsoDate);
  const [displayDate, setDisplayDate] = useState(() => toDisplayDate(initialIsoDate));
  const [hours, setHours] = useState<string>('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTask, setSelectedTask] = useState<TaskNote | null>(task || null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [taskSearchResults, setTaskSearchResults] = useState<SearchTask[]>([]);
  const [allTasksWithContext, setAllTasksWithContext] = useState<SearchTask[]>([]);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hiddenDateRef = useRef<HTMLInputElement>(null);
  const hoursRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  
  // Existing timesheet for edit mode
  const [existingTimeSheet, setExistingTimeSheet] = useState<FetchedTimeSheet | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Refs for focus management
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    setSelectedTask(task || null);
  }, [task]);

  const loadTasksForSearch = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const tasksRes = await fetch('/api/notes?type=task');
      const [projectsRes, clientsRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/clients'),
      ]);
      if (!tasksRes.ok || !projectsRes.ok || !clientsRes.ok) {
        throw new Error('Failed to load tasks');
      }

      const tasks: TaskNote[] = await tasksRes.json();
      const projects: Project[] = await projectsRes.json();
      const clients: Array<{ id: string; name: string }> = await clientsRes.json();
      const projectMap = new Map(projects.map((p) => [p.id, p]));
      const clientMap = new Map(clients.map((c) => [c.id, c.name]));

      const tasksWithContext: SearchTask[] = tasks.map((taskItem) => {
        const project = projectMap.get(taskItem.projectId);
        const clientName = project?.clientId ? clientMap.get(project?.clientId) || 'Sin Cliente' : 'Sin Cliente';
        const projectName = project?.name || 'Sin Proyecto';
        return { ...taskItem, clientName, projectName };
      });

      setAllTasksWithContext(tasksWithContext);
      setTaskSearchResults(tasksWithContext.slice(0, 10));
      setTaskSearchQuery('');
      setSelectedSearchIndex(0);
    } catch (err) {
      console.error('Error loading task search data:', err);
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    if (!task) {
      loadTasksForSearch();
      setLoading(false);
    }
  }, [task, loadTasksForSearch]);

  // Check for existing timesheet when date changes
  const checkExistingTimeSheet = useCallback(async (selectedDate: string) => {
    if (!selectedTask) return;
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(`/api/timesheets?taskId=${selectedTask.id}&workDate=${selectedDate}`);
      if (res.ok) {
        const timesheets: FetchedTimeSheet[] = await res.json();
        const existing = timesheets.find(
          ts => ts.taskId === selectedTask.id && ts.workDate === selectedDate
        );
        if (existing) {
          setExistingTimeSheet(existing);
          setIsEditMode(true);
          setHours(existing.hoursWorked.toString());
          setDescription(existing.description || '');
        } else {
          setExistingTimeSheet(null);
          setIsEditMode(false);
          setHours('');
          setDescription('');
        }
      }
    } catch (err) {
      console.error('Error checking existing timesheet:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTask]);

  // Check on initial load and when date changes
  useEffect(() => {
    if (selectedTask) {
      checkExistingTimeSheet(date);
    }
  }, [date, checkExistingTimeSheet, selectedTask]);

  // Auto-focus hours field when loading completes
  useEffect(() => {
    if (!loading && hoursRef.current) {
      hoursRef.current.focus();
      hoursRef.current.select();
    }
  }, [loading]);

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    setDisplayDate(toDisplayDate(newDate));
  };

  const handleTaskSearch = (query: string) => {
    setTaskSearchQuery(query);
    setSelectedSearchIndex(0);

    if (!query.trim()) {
      setTaskSearchResults(allTasksWithContext.slice(0, 10));
      return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = allTasksWithContext.filter(taskItem =>
      taskItem.title.toLowerCase().includes(lowerQuery) ||
      taskItem.ticketPhaseCode?.toLowerCase().includes(lowerQuery) ||
      taskItem.clientName.toLowerCase().includes(lowerQuery) ||
      taskItem.projectName.toLowerCase().includes(lowerQuery) ||
      taskItem.shortDescription?.toLowerCase().includes(lowerQuery)
    );

    setTaskSearchResults(filtered.slice(0, 10));
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSearchIndex(prev => Math.min(prev + 1, taskSearchResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSearchIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && taskSearchResults.length > 0) {
      e.preventDefault();
      setSelectedTask(taskSearchResults[selectedSearchIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const selectTask = (taskItem: SearchTask) => {
    setSelectedTask(taskItem);
    setTaskSearchQuery('');
    setTaskSearchResults([]);
  };

  const handleDisplayDateChange = (value: string) => {
    setDisplayDate(value);
    const iso = toIsoDate(value);
    if (iso) {
      setDate(iso);
    }
  };

  const openNativeDatePicker = () => {
    hiddenDateRef.current?.showPicker?.();
  };

  const handleSave = async () => {
    if (!selectedTask) return;

    // Validation
    if (!hours || parseFloat(hours) <= 0) {
      setError('Por favor ingresa las horas trabajadas');
      return;
    }
    
    setSaving(true);
    setError('');

    try {
      if (isEditMode && existingTimeSheet) {
        // Update existing timesheet
        const res = await fetch(`/api/timesheets/${existingTimeSheet.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hoursWorked: parseFloat(hours),
            description,
          }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          throw new Error(errBody?.error || 'Failed to update');
        }
      } else {
        // Create new timesheet
        const res = await fetch('/api/timesheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: selectedTask.id,
            workDate: date,
            hoursWorked: parseFloat(hours),
            description,
            state: 'DRAFT',
          }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          throw new Error(errBody?.error || 'Failed to create');
        }
      }
      
      onSaved();
      onClose();
    } catch (err) {
      setError('Error al guardar. Intenta de nuevo.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const taskDisplayName = selectedTask
    ? selectedTask.ticketPhaseCode
      ? `${selectedTask.ticketPhaseCode} - ${selectedTask.shortDescription || selectedTask.title || 'Sin título'}`
      : selectedTask.shortDescription || selectedTask.title || 'Sin título'
    : '';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Clock size={20} className="text-green-500" />
            <h2 className="text-lg font-semibold text-white">
              {selectedTask ? (isEditMode ? 'Editar Registro de Horas' : 'Registrar Horas') : 'Buscar Tarea para Registrar Horas'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Edit mode indicator */}
          {!selectedTask && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Buscar tarea</label>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={taskSearchQuery}
                  onChange={(e) => handleTaskSearch(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Buscar por cliente, proyecto, ticket o tarea..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  autoFocus
                />
                <p className="mt-1 text-xs text-gray-500">
                  Usa ↑↓ para navegar, Enter para seleccionar, Esc para cerrar
                </p>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2">
                {loadingTasks ? (
                  <p className="text-sm text-gray-400 text-center py-6">Cargando tareas...</p>
                ) : taskSearchResults.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6 italic">No se encontraron tareas</p>
                ) : (
                  taskSearchResults.map((taskItem, idx) => (
                    <button
                      key={taskItem.id}
                      onClick={() => selectTask(taskItem)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        idx === selectedSearchIndex
                          ? 'bg-orange-600/20 border-orange-500'
                          : 'bg-gray-800 border-gray-700 hover:bg-gray-750 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {taskItem.ticketPhaseCode && (
                          <span className="shrink-0 px-2 py-0.5 bg-blue-600/30 text-blue-400 text-xs font-mono rounded">
                            {taskItem.ticketPhaseCode}
                          </span>
                        )}
                        <span className="text-white font-medium text-sm line-clamp-2">
                          {taskItem.title}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {taskItem.clientName} → {taskItem.projectName}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {selectedTask && (
            <>
              {isEditMode && (
                <div className="flex items-center gap-2 px-3 py-2 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
                  <AlertCircle size={16} className="text-yellow-500" />
                  <span className="text-sm text-yellow-400">
                    Editando registro existente para esta fecha
                  </span>
                </div>
              )}

              {/* Task info (readonly) */}
              <div className="p-3 bg-gray-800/50 rounded-lg">
                <span className="text-gray-500 text-sm">Tarea:</span>
                <p className="text-white font-medium truncate">
                  {taskDisplayName}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Date picker DD/MM/YYYY */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Fecha</label>
                  <div className="relative">
                    <input
                      ref={dateInputRef}
                      type="text"
                      value={displayDate}
                      onChange={(e) => handleDisplayDateChange(e.target.value)}
                      placeholder="DD/MM/YYYY"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={openNativeDatePicker}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    >
                      <Calendar size={18} />
                    </button>
                    {/* Hidden native date picker */}
                    <input
                      ref={hiddenDateRef}
                      type="date"
                      value={date}
                      onChange={(e) => handleDateChange(e.target.value)}
                      className="sr-only"
                      tabIndex={-1}
                    />
                  </div>
                </div>

                {/* Hours */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Horas trabajadas * <span className="text-gray-600 text-xs">(Enter=descripcion)</span></label>
                  <input
                    ref={hoursRef}
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        descriptionRef.current?.focus();
                      }
                    }}
                    placeholder="8.0"
                    disabled={loading}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Descripción <span className="text-gray-600 text-xs">(Enter=guardar, Ctrl+Enter=salto de línea)</span></label>
                <textarea
                  ref={descriptionRef}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.ctrlKey) {
                      e.preventDefault();
                      handleSave();
                    }
                    // Ctrl+Enter allows default behavior (newline)
                  }}
                  placeholder="Descripción del trabajo realizado..."
                  rows={4}
                  disabled={loading}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none disabled:opacity-50"
                />
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Save size={16} />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
