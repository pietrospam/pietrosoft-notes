'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Save, Loader2, Maximize2, Minimize2, Pencil, Clock, ChevronDown, Plus, Check, ExternalLink, Star } from 'lucide-react';
import { TipTapEditor, TipTapEditorHandle } from './TipTapEditor';
import { AttachmentsPanel } from './AttachmentsPanel';
import { TimeSheetModal } from './TimeSheetModal';
import { QuickCreateModal } from './QuickCreateModal';
import { Toast } from './Toast';
import { UnsavedChangesModal } from './UnsavedChangesModal';
import { useApp } from '../context/AppContext';
import type { TaskNote, AttachmentMeta, Client, Project, TaskStatus, TaskPriority } from '@/lib/types';

const STATUSES: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'NONE', label: 'None', color: 'bg-gray-500' },
  { value: 'PENDING', label: 'Pending', color: 'bg-yellow-500' },
  { value: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-500' },
  { value: 'COMPLETED', label: 'Completed', color: 'bg-green-500' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'bg-gray-600' },
];

const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'LOW', label: 'Low', color: 'text-gray-400' },
  { value: 'MEDIUM', label: 'Medium', color: 'text-yellow-400' },
  { value: 'HIGH', label: 'High', color: 'text-orange-400' },
  { value: 'CRITICAL', label: 'Critical', color: 'text-red-400' },
];

interface TaskEditorModalProps {
  taskId?: string;  // undefined = create mode
  onClose: () => void;
  onSaved?: () => void;
  inline?: boolean;
  onExpandToPopup?: () => void;
}

export function TaskEditorModal({ taskId, onClose, onSaved, inline = false, onExpandToPopup }: TaskEditorModalProps) {
  const { refreshNotes, refreshClients, toggleFavorite, autoSaveEnabled, setIsDirty: setGlobalIsDirty, setPendingChanges: setGlobalPendingChanges } = useApp();
  
  // Create default task for new notes
  const now = new Date().toISOString();
  const defaultTask: TaskNote = {
    id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    type: 'task',
    title: 'Nueva Tarea',
    contentText: '',
    contentJson: null,
    attachments: [],
    projectId: '',
    ticketPhaseCode: '',
    shortDescription: '',
    status: 'PENDING' as TaskStatus,
    priority: 'MEDIUM' as TaskPriority,
    isFavorite: false, // REQ-006
    createdAt: now,
    updatedAt: now,
  };

  const [task, setTask] = useState<TaskNote>(defaultTask);
  const [loading, setLoading] = useState(!!taskId);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [title, setTitle] = useState(defaultTask.title);
  const [isDirty, setIsDirtyLocal] = useState(!taskId); // New notes start dirty
  const [isMaximized, setIsMaximized] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(!taskId); // Auto-edit title for new notes
  const [toast, setToast] = useState<{ message: string } | null>(null);
  const [showTimeSheetModal, setShowTimeSheetModal] = useState(false);
  
  // Task fields state
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  
  // Sync local isDirty with global context (for inline mode navigation protection)
  const setIsDirty = useCallback((dirty: boolean) => {
    setIsDirtyLocal(dirty);
    if (inline) {
      setGlobalIsDirty(dirty);
      if (!dirty) {
        setGlobalPendingChanges({});
      }
    }
  }, [inline, setGlobalIsDirty, setGlobalPendingChanges]);
  
  const editorRef = useRef<TipTapEditorHandle>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const pendingChangesRef = useRef<Partial<TaskNote>>({});
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCreatedRef = useRef(false);

  // REQ-006: Handle favorite toggle
  const handleToggleFavorite = async () => {
    const targetId = taskId || task.id;
    if (!targetId || targetId.startsWith('temp-')) return;
    
    // Optimistic update
    setTask(prev => ({ ...prev, isFavorite: !prev.isFavorite }));
    
    await toggleFavorite(targetId);
  };

  // Load clients
  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(setClients);
  }, []);

  // Load task data (edit mode)
  useEffect(() => {
    if (taskId) {
      const loadTask = async () => {
        try {
          const res = await fetch(`/api/notes/${taskId}`);
          if (res.ok) {
            const data = await res.json();
            setTask(data);
            setTitle(data.title);
            setIsDirty(false);
            
            // Find client for this project
            if (data.projectId) {
              const projectRes = await fetch('/api/projects');
              const allProjects = await projectRes.json();
              const project = allProjects.find((p: Project) => p.id === data.projectId);
              if (project) {
                setSelectedClientId(project.clientId);
                setProjects(allProjects.filter((p: Project) => p.clientId === project.clientId));
              }
            }
          }
        } catch (err) {
          console.error('Error loading task:', err);
          setToast({ message: 'Error al cargar la tarea' });
        } finally {
          setLoading(false);
        }
      };
      loadTask();
    } else {
      // New note - focus title after mount
      setTimeout(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      }, 100);
    }
  }, [taskId]);

  // Handle client change - load projects for client
  const handleClientChange = async (clientId: string) => {
    setSelectedClientId(clientId);
    if (clientId) {
      const res = await fetch(`/api/projects?clientId=${clientId}`);
      const projectsList = await res.json();
      setProjects(projectsList);
    } else {
      setProjects([]);
    }
    trackChange({ projectId: '' }); // Clear project when client changes
  };

  // Handle Escape key (only in popup mode)
  useEffect(() => {
    if (inline) return; // Don't handle Escape in inline mode
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [inline]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Schedule auto-save (only for existing notes, and only if enabled)
  const scheduleAutoSave = useCallback(() => {
    if (!autoSaveEnabled) return; // Respect user's auto-save preference
    if (!taskId && !isCreatedRef.current) return;
    
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    autoSaveTimerRef.current = setTimeout(async () => {
      if (Object.keys(pendingChangesRef.current).length > 0) {
        const targetId = taskId || task.id;
        if (targetId && !targetId.startsWith('temp-')) {
          const res = await fetch(`/api/notes/${targetId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pendingChangesRef.current),
          });
          if (res.ok) {
            pendingChangesRef.current = {};
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }
        }
      }
    }, 2000);
  }, [taskId, task.id, autoSaveEnabled]);

  // Track changes
  const trackChange = useCallback((data: Partial<TaskNote>) => {
    pendingChangesRef.current = { ...pendingChangesRef.current, ...data };
    setTask(prev => ({ ...prev, ...data }));
    setIsDirty(true);
    // Sync pending changes to global context for inline mode
    if (inline) {
      setGlobalPendingChanges(pendingChangesRef.current);
    }
    scheduleAutoSave();
  }, [scheduleAutoSave, setIsDirty, inline, setGlobalPendingChanges]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    trackChange({ title: newTitle });
  };

  const handleContentChange = (contentJson: object) => {
    trackChange({ contentJson });
  };

  const handleSave = async () => {
    if (Object.keys(pendingChangesRef.current).length === 0 && taskId) return;
    
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    setSaving(true);
    try {
      if (!taskId && !isCreatedRef.current) {
        // Create new task
        const dataToSend = { ...task, ...pendingChangesRef.current };
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _tempId, ...taskWithoutId } = dataToSend;
        
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskWithoutId),
        });
        
        if (res.ok) {
          const savedTask = await res.json();
          setTask(savedTask);
          pendingChangesRef.current = {};
          isCreatedRef.current = true;
          setIsDirty(false);
          setToast({ message: 'Tarea creada exitosamente' });
          await refreshNotes();
          onSaved?.();
        } else {
          setToast({ message: 'Error al crear la tarea' });
        }
      } else {
        // Update existing task
        const targetId = taskId || task.id;
        const res = await fetch(`/api/notes/${targetId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pendingChangesRef.current),
        });
        
        if (res.ok) {
          const updatedTask = await res.json();
          setTask(updatedTask);
          pendingChangesRef.current = {};
          setIsDirty(false);
          setToast({ message: 'Guardado exitosamente' });
          await refreshNotes();
          onSaved?.();
        } else {
          setToast({ message: 'Error al guardar' });
        }
      }
    } catch (err) {
      console.error('Error saving task:', err);
      setToast({ message: 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    // If dirty, show confirmation modal
    if (isDirty && Object.keys(pendingChangesRef.current).length > 0) {
      setShowUnsavedModal(true);
      return;
    }
    onClose();
  };

  const handleDiscardAndClose = () => {
    setShowUnsavedModal(false);
    pendingChangesRef.current = {};
    setIsDirty(false);
    onClose();
  };

  const handleSaveAndClose = async () => {
    setShowUnsavedModal(false);
    await handleSave();
    onClose();
  };

  if (loading) {
    if (inline) {
      return (
        <div className="flex-1 flex items-center justify-center bg-gray-900">
          <Loader2 className="animate-spin text-blue-400" size={32} />
        </div>
      );
    }
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-8">
          <Loader2 className="animate-spin text-blue-400" size={32} />
        </div>
      </div>
    );
  }

  // Inline mode content
  const renderContent = () => (
    <>
      {/* Task Fields */}
      <div className="mb-6 space-y-4">
        {/* Validation Summary */}
        {(!task.projectId || !task.ticketPhaseCode || !task.shortDescription) && (
          <div className="p-2 bg-yellow-900/30 border border-yellow-700/50 rounded-lg text-xs text-yellow-400">
            <span className="font-medium">Campos requeridos: </span>
            {[
              !task.projectId && 'Proyecto',
              !task.ticketPhaseCode && 'Ticket/Fase',
              !task.shortDescription && 'Descripción corta',
            ].filter(Boolean).join(', ')}
          </div>
        )}

        {/* Row 1: Ticket/Phase - Short Description - Due Date - Budget */}
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Ticket/Fase *</label>
            <input
              type="text"
              value={task.ticketPhaseCode || ''}
              onChange={(e) => trackChange({ ticketPhaseCode: e.target.value })}
              className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 ${
                !task.ticketPhaseCode ? 'border-yellow-600' : 'border-gray-700'
              }`}
              placeholder="TASK-001"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Descripción *</label>
            <input
              type="text"
              value={task.shortDescription || ''}
              onChange={(e) => trackChange({ shortDescription: e.target.value })}
              className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 ${
                !task.shortDescription ? 'border-yellow-600' : 'border-gray-700'
              }`}
              placeholder="Descripción breve"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fecha límite</label>
            <input
              type="date"
              value={task.dueDate?.split('T')[0] || ''}
              onChange={(e) => trackChange({ dueDate: e.target.value || undefined })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Horas presup.</label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={task.budgetHours ?? ''}
              onChange={(e) => trackChange({ budgetHours: e.target.value ? parseFloat(e.target.value) : undefined })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="0"
            />
          </div>
        </div>

        {/* Row 2: Client - Project - Status - Priority */}
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Cliente</label>
            <div className="flex gap-1">
              <div className="relative flex-1">
                <select
                  value={selectedClientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 appearance-none"
                >
                  <option value="">Seleccionar...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
              <button
                type="button"
                onClick={() => setShowCreateClient(true)}
                className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-blue-500 transition-colors"
                title="Nuevo cliente"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Proyecto *</label>
            <div className="flex gap-1">
              <div className="relative flex-1">
                <select
                  value={task.projectId || ''}
                  onChange={(e) => trackChange({ projectId: e.target.value })}
                  disabled={!selectedClientId}
                  className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 appearance-none disabled:opacity-50 ${
                    !task.projectId ? 'border-yellow-600' : 'border-gray-700'
                  }`}
                >
                  <option value="">Seleccionar...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
              <button
                type="button"
                onClick={() => setShowCreateProject(true)}
                disabled={!selectedClientId}
                className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-blue-500 transition-colors disabled:opacity-50"
                title="Nuevo proyecto"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Estado</label>
            <div className="flex flex-wrap gap-1">
              {STATUSES.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => trackChange({ status: s.value })}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    task.status === s.value
                      ? `${s.color} text-white`
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Prioridad</label>
            <div className="flex flex-wrap gap-1">
              {PRIORITIES.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => trackChange({ priority: p.value })}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    task.priority === p.value
                      ? `bg-gray-700 ${p.color}`
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="mb-6 border-t border-gray-800 pt-6">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Descripción</h3>
        <TipTapEditor
          ref={editorRef}
          key={task.id}
          content={task.contentJson}
          onChange={handleContentChange}
          noteId={task.id}
          placeholder="Descripción de la tarea..."
        />
      </div>

      {/* Attachments */}
      <div className="border-t border-gray-800 pt-6">
        <AttachmentsPanel
          noteId={task.id}
          attachments={task.attachments || []}
          onAttachmentAdded={(attachment: AttachmentMeta) => {
            const updatedAttachments = [...(task.attachments || []), attachment];
            setTask(prev => ({ ...prev, attachments: updatedAttachments }));
            trackChange({ attachments: updatedAttachments });
          }}
          onAttachmentDeleted={(attachmentId: string) => {
            const updatedAttachments = (task.attachments || []).filter(a => a.id !== attachmentId);
            setTask(prev => ({ ...prev, attachments: updatedAttachments }));
            trackChange({ attachments: updatedAttachments });
          }}
          onAttachmentRenamed={(attachmentId: string, newName: string) => {
            const updatedAttachments = (task.attachments || []).map(
              a => a.id === attachmentId ? { ...a, originalName: newName } : a
            );
            setTask(prev => ({ ...prev, attachments: updatedAttachments }));
            trackChange({ attachments: updatedAttachments });
          }}
        />
      </div>
    </>
  );

  // Inline mode: render as panel (not modal)
  if (inline) {
    return (
      <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2 flex-1 min-w-0 mr-4">
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIsEditingTitle(false);
                    editorRef.current?.focus();
                  }
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
                className="flex-1 text-lg font-semibold bg-gray-800 border border-blue-500 rounded px-2 py-1 text-white outline-none"
                autoFocus
                placeholder="Título de la tarea..."
              />
            ) : (
              <>
                <h2 className="text-lg font-semibold text-white truncate">{title || 'Sin título'}</h2>
                <button
                  onClick={() => {
                    setIsEditingTitle(true);
                    setTimeout(() => titleInputRef.current?.select(), 0);
                  }}
                  className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                  title="Editar título"
                >
                  <Pencil size={16} />
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* REQ-006: Favorite toggle - only for saved tasks */}
            {(taskId || isCreatedRef.current) && !task.id.startsWith('temp-') && (
              <button
                onClick={handleToggleFavorite}
                className={`p-2 rounded transition-colors ${
                  task.isFavorite 
                    ? 'text-yellow-400 hover:text-yellow-300 hover:bg-gray-800' 
                    : 'text-gray-400 hover:text-yellow-400 hover:bg-gray-800'
                }`}
                title={task.isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
              >
                <Star size={20} className={task.isFavorite ? 'fill-current' : ''} />
              </button>
            )}
            
            {/* TimeSheet button - only for existing tasks */}
            {(taskId || isCreatedRef.current) && (
              <button
                onClick={() => setShowTimeSheetModal(true)}
                className="p-2 text-gray-400 hover:text-orange-400 hover:bg-gray-800 rounded transition-colors"
                title="Registrar horas"
              >
                <Clock size={20} />
              </button>
            )}
            
            {/* Save status indicator */}
            {saved && (
              <span className="flex items-center gap-1 text-green-400 text-sm">
                <Check size={14} />
                Guardado
              </span>
            )}
            
            {/* Save button */}
            {isDirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Guardar
              </button>
            )}
            
            {/* Expand to popup button */}
            {onExpandToPopup && (
              <button
                onClick={onExpandToPopup}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                title="Abrir en popup"
              >
                <ExternalLink size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderContent()}
        </div>

        {/* Footer - simplified for inline */}
        <div className="px-6 py-3 border-t border-gray-700 flex items-center justify-between text-xs text-gray-500">
          <div>
            {isDirty ? (
              <span className="text-yellow-500">● Cambios sin guardar</span>
            ) : (
              <span>Último guardado: {new Date(task.updatedAt).toLocaleString()}</span>
            )}
          </div>
        </div>

        {/* TimeSheet Modal */}
        {showTimeSheetModal && (taskId || isCreatedRef.current) && (
          <TimeSheetModal
            task={task}
            onClose={() => setShowTimeSheetModal(false)}
            onSaved={() => {
              setToast({ message: 'Horas registradas' });
            }}
          />
        )}

        {/* Quick Create Modals */}
        {showCreateClient && (
          <QuickCreateModal
            type="client"
            onCreated={(item) => {
              setClients(prev => [...prev, item as Client]);
              handleClientChange(item.id);
              refreshClients(); // Refresh global clients list
            }}
            onClose={() => setShowCreateClient(false)}
          />
        )}
        {showCreateProject && selectedClientId && (
          <QuickCreateModal
            type="project"
            clientId={selectedClientId}
            onCreated={(item) => {
              setProjects(prev => [...prev, item as Project]);
              trackChange({ projectId: item.id });
              refreshClients(); // Refresh global clients/projects list
            }}
            onClose={() => setShowCreateProject(false)}
          />
        )}

        {/* Toast */}
        {toast && (
          <Toast
            message={toast.message}
            onClose={() => setToast(null)}
          />
        )}

        {/* Unsaved Changes Modal */}
        <UnsavedChangesModal
          isOpen={showUnsavedModal}
          onDiscard={handleDiscardAndClose}
          onCancel={() => setShowUnsavedModal(false)}
          onSave={handleSaveAndClose}
        />
      </div>
    );
  }

  // Popup mode (original)
  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className={`bg-gray-900 rounded-lg border border-gray-700 flex flex-col shadow-2xl transition-all duration-200 ${
        isMaximized 
          ? 'w-full h-full max-w-none max-h-none m-0 rounded-none' 
          : 'w-full max-w-4xl max-h-[90vh]'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2 flex-1 min-w-0 mr-4">
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIsEditingTitle(false);
                    editorRef.current?.focus();
                  }
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
                className="flex-1 text-lg font-semibold bg-gray-800 border border-blue-500 rounded px-2 py-1 text-white outline-none"
                autoFocus
                placeholder="Título de la tarea..."
              />
            ) : (
              <>
                <h2 className="text-lg font-semibold text-white truncate">{title || 'Sin título'}</h2>
                <button
                  onClick={() => {
                    setIsEditingTitle(true);
                    setTimeout(() => titleInputRef.current?.select(), 0);
                  }}
                  className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                  title="Editar título"
                >
                  <Pencil size={16} />
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* TimeSheet button - only for existing tasks */}
            {/* REQ-006: Favorite toggle - only for saved tasks */}
            {(taskId || isCreatedRef.current) && !task.id.startsWith('temp-') && (
              <button
                onClick={handleToggleFavorite}
                className={`p-2 rounded transition-colors ${
                  task.isFavorite 
                    ? 'text-yellow-400 hover:text-yellow-300 hover:bg-gray-800' 
                    : 'text-gray-400 hover:text-yellow-400 hover:bg-gray-800'
                }`}
                title={task.isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
              >
                <Star size={20} className={task.isFavorite ? 'fill-current' : ''} />
              </button>
            )}
            
            {(taskId || isCreatedRef.current) && (
              <button
                onClick={() => setShowTimeSheetModal(true)}
                className="p-2 text-gray-400 hover:text-orange-400 hover:bg-gray-800 rounded transition-colors"
                title="Registrar horas"
              >
                <Clock size={20} />
              </button>
            )}
            
            {/* Save status indicator */}
            {saved && (
              <span className="flex items-center gap-1 text-green-400 text-sm">
                <Check size={14} />
                Guardado
              </span>
            )}
            
            {isDirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Guardar
              </button>
            )}
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
              title={isMaximized ? "Restaurar tamaño" : "Maximizar"}
            >
              {isMaximized ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
              title="Cerrar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderContent()}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-700 flex items-center justify-between text-xs text-gray-500">
          <div>
            {isDirty ? (
              <span className="text-yellow-500">● Cambios sin guardar</span>
            ) : (
              <span>Último guardado: {new Date(task.updatedAt).toLocaleString()}</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleClose}
              className="px-3 py-1.5 text-gray-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={async () => {
                await handleSave();
                onClose();
              }}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar y Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* TimeSheet Modal */}
      {showTimeSheetModal && (taskId || isCreatedRef.current) && (
        <TimeSheetModal
          task={task}
          onClose={() => setShowTimeSheetModal(false)}
          onSaved={() => {
            setToast({ message: 'Horas registradas' });
          }}
        />
      )}

      {/* Quick Create Modals */}
      {showCreateClient && (
        <QuickCreateModal
          type="client"
          onCreated={(item) => {
            setClients(prev => [...prev, item as Client]);
            handleClientChange(item.id);
            refreshClients(); // Refresh global clients list
          }}
          onClose={() => setShowCreateClient(false)}
        />
      )}
      {showCreateProject && selectedClientId && (
        <QuickCreateModal
          type="project"
          clientId={selectedClientId}
          onCreated={(item) => {
            setProjects(prev => [...prev, item as Project]);
            trackChange({ projectId: item.id });
            refreshClients(); // Refresh global clients/projects list
          }}
          onClose={() => setShowCreateProject(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Unsaved Changes Modal */}
      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        onDiscard={handleDiscardAndClose}
        onCancel={() => setShowUnsavedModal(false)}
        onSave={handleSaveAndClose}
      />
    </div>
  );
}
