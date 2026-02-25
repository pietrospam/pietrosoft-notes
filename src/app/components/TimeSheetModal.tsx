'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Clock, Save, AlertCircle } from 'lucide-react';
import type { TaskNote, TimeSheetNote, Client, Project } from '@/lib/types';

interface TimeSheetModalProps {
  task: TaskNote;
  initialDate?: string; // Optional: for editing from TimeSheetView grid
  onClose: () => void;
  onSaved: () => void;
}

export function TimeSheetModal({ task, initialDate, onClose, onSaved }: TimeSheetModalProps) {
  const [date, setDate] = useState(() => initialDate || new Date().toISOString().split('T')[0]);
  const [hours, setHours] = useState<string>('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Existing timesheet for edit mode
  const [existingTimeSheet, setExistingTimeSheet] = useState<TimeSheetNote | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Task context info
  const [client, setClient] = useState<Client | null>(null);
  const [project, setProject] = useState<Project | null>(null);

  // Refs for focus management
  const hoursRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

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

  // Load client and project info
  useEffect(() => {
    const loadContext = async () => {
      try {
        // Get project
        if (task.projectId) {
          const projectRes = await fetch(`/api/projects/${task.projectId}`);
          if (projectRes.ok) {
            const projectData = await projectRes.json();
            setProject(projectData);
            
            // Get client from project
            if (projectData.clientId) {
              const clientRes = await fetch(`/api/clients/${projectData.clientId}`);
              if (clientRes.ok) {
                setClient(await clientRes.json());
              }
            }
          }
        }
      } catch (err) {
        console.error('Error loading context:', err);
      }
    };
    
    loadContext();
  }, [task.projectId]);

  // Check for existing timesheet when date changes
  const checkExistingTimeSheet = useCallback(async (selectedDate: string) => {
    setLoading(true);
    setError('');
    
    try {
      // Fetch all timesheets and filter by taskId and date
      const res = await fetch('/api/notes?type=timesheet');
      if (res.ok) {
        const timesheets: TimeSheetNote[] = await res.json();
        const existing = timesheets.find(
          ts => ts.taskId === task.id && ts.workDate === selectedDate
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
  }, [task.id]);

  // Check on initial load and when date changes
  useEffect(() => {
    checkExistingTimeSheet(date);
  }, [date, checkExistingTimeSheet]);

  // Auto-focus hours field when loading completes
  useEffect(() => {
    if (!loading && hoursRef.current) {
      hoursRef.current.focus();
      hoursRef.current.select();
    }
  }, [loading]);

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
  };

  const handleSave = async () => {
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
        const res = await fetch(`/api/notes/${existingTimeSheet.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hoursWorked: parseFloat(hours),
            description,
          }),
        });
        
        if (!res.ok) throw new Error('Failed to update');
      } else {
        // Create new timesheet
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'timesheet',
            title: `Time: ${task.title || task.shortDescription || 'Task'}`,
            contentJson: null,
            taskId: task.id,
            workDate: date,
            hoursWorked: parseFloat(hours),
            description,
            state: 'DRAFT',
          }),
        });
        
        if (!res.ok) throw new Error('Failed to create');
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Clock size={20} className="text-green-500" />
            <h2 className="text-lg font-semibold text-white">
              {isEditMode ? 'Editar Registro de Horas' : 'Registrar Horas'}
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
          {isEditMode && (
            <div className="flex items-center gap-2 px-3 py-2 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
              <AlertCircle size={16} className="text-yellow-500" />
              <span className="text-sm text-yellow-400">
                Editando registro existente para esta fecha
              </span>
            </div>
          )}

          {/* Task info (readonly) */}
          <div className="space-y-2 p-3 bg-gray-800/50 rounded-lg">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Tarea:</span>
                <p className="text-white font-medium truncate">
                  {task.title || task.shortDescription || 'Sin título'}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Cliente:</span>
                <p className="text-white font-medium truncate">
                  {client?.name || '—'}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Proyecto:</span>
                <p className="text-white font-medium truncate">
                  {project?.name || '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Date picker */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Hours */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Horas trabajadas * <span className="text-gray-600 text-xs">(Enter=descripción)</span></label>
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
