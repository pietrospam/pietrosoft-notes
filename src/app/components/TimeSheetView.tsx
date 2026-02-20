'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, Edit2, Trash2, Download, ChevronUp, ChevronDown, AlertCircle, X, CheckSquare, Folder } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TimeSheetModal } from './TimeSheetModal';
import { Toast } from './Toast';
import type { TaskNote } from '@/lib/types';

interface TimeSheetGridEntry {
  id: string;
  workDate: string;
  hoursWorked: number;
  description: string;
  taskId: string;
  taskTitle: string;
  taskCode: string;
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  createdAt: string;
  updatedAt: string;
}

// Task detail for popup
interface TaskDetail {
  id: string;
  title: string;
  status: string;
  priority: string;
  contentText: string;
  projectName: string;
  clientName: string;
}

// Project detail for popup
interface ProjectDetail {
  id: string;
  name: string;
  description: string;
  clientName: string;
}

type SortField = 'workDate' | 'clientName' | 'projectName' | 'taskTitle' | 'hoursWorked';
type SortDirection = 'asc' | 'desc';

export function TimeSheetView() {
  const { notes, refreshNotes } = useApp();
  const [timesheets, setTimesheets] = useState<TimeSheetGridEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>('workDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Edit modal
  const [editingTask, setEditingTask] = useState<TaskNote | null>(null);
  const [editingDate, setEditingDate] = useState<string>('');
  
  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Toast
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' } | null>(null);
  
  // Task detail popup
  const [taskPopup, setTaskPopup] = useState<TaskDetail | null>(null);
  const [loadingTask, setLoadingTask] = useState(false);
  
  // Project detail popup
  const [projectPopup, setProjectPopup] = useState<ProjectDetail | null>(null);
  const [loadingProject, setLoadingProject] = useState(false);

  // Fetch timesheets from API
  const fetchTimesheets = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/timesheets');
      if (res.ok) {
        const data = await res.json();
        setTimesheets(data);
      } else {
        setError('Error al cargar timesheets');
      }
    } catch (err) {
      console.error('Error fetching timesheets:', err);
      setError('Error al cargar timesheets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTimesheets();
  }, [fetchTimesheets]);

  // Get total hours
  const totalHours = timesheets.reduce((sum, ts) => sum + ts.hoursWorked, 0);

  // Sort timesheets
  const sortedTimesheets = [...timesheets].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'workDate':
        comparison = a.workDate.localeCompare(b.workDate);
        break;
      case 'clientName':
        comparison = a.clientName.localeCompare(b.clientName);
        break;
      case 'projectName':
        comparison = a.projectName.localeCompare(b.projectName);
        break;
      case 'taskTitle':
        comparison = a.taskTitle.localeCompare(b.taskTitle);
        break;
      case 'hoursWorked':
        comparison = a.hoursWorked - b.hoursWorked;
        break;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Handle column header click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Render sort indicator
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' 
      ? <ChevronUp size={14} className="inline ml-1" />
      : <ChevronDown size={14} className="inline ml-1" />;
  };

  // Handle edit
  const handleEdit = (entry: TimeSheetGridEntry) => {
    // Find the task note to pass to the modal
    const taskNote = notes.find(n => n.id === entry.taskId) as TaskNote | undefined;
    if (taskNote) {
      setEditingTask(taskNote);
      setEditingDate(entry.workDate);
    } else {
      // If task not in local notes, create a minimal task object
      setEditingTask({
        id: entry.taskId,
        type: 'task',
        title: entry.taskTitle,
        contentText: '',
        contentJson: null,
        attachments: [],
        projectId: entry.projectId,
        ticketPhaseCode: '',
        shortDescription: '',
        status: 'PENDING',
        priority: 'MEDIUM',
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      });
      setEditingDate(entry.workDate);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        setToast({ message: 'TimeSheet eliminado exitosamente', type: 'success' });
        await fetchTimesheets();
        await refreshNotes();
      } else {
        throw new Error('Failed to delete');
      }
    } catch (err) {
      console.error('Error deleting timesheet:', err);
      setToast({ message: 'Error al eliminar timesheet', type: 'error' });
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (sortedTimesheets.length === 0) {
      setToast({ message: 'No hay datos para exportar', type: 'error' });
      return;
    }

    // CSV header
    const headers = ['Fecha', 'Cliente', 'Proyecto', 'Tarea', 'Horas', 'Descripción'];
    
    // CSV rows
    const rows = sortedTimesheets.map(ts => [
      ts.workDate,
      `"${ts.clientName.replace(/"/g, '""')}"`,
      `"${ts.projectName.replace(/"/g, '""')}"`,
      `"${ts.taskTitle.replace(/"/g, '""')}"`,
      ts.hoursWorked.toString(),
      `"${(ts.description || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
    ]);

    // Add total row
    rows.push(['', '', '', 'TOTAL', totalHours.toFixed(1), '']);

    // Build CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    // Download
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timesheets-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    setToast({ message: 'CSV exportado exitosamente', type: 'success' });
  };

  // Open task detail popup
  const handleTaskClick = async (entry: TimeSheetGridEntry) => {
    setLoadingTask(true);
    try {
      const res = await fetch(`/api/notes/${entry.taskId}`);
      if (res.ok) {
        const task = await res.json();
        setTaskPopup({
          id: task.id,
          title: task.title,
          status: task.status || 'NONE',
          priority: task.priority || 'MEDIUM',
          contentText: task.contentText || '',
          projectName: entry.projectName,
          clientName: entry.clientName,
        });
      }
    } catch (err) {
      console.error('Error fetching task:', err);
      setToast({ message: 'Error al cargar tarea', type: 'error' });
    } finally {
      setLoadingTask(false);
    }
  };

  // Open project detail popup
  const handleProjectClick = async (entry: TimeSheetGridEntry) => {
    if (!entry.projectId) return;
    
    setLoadingProject(true);
    try {
      const res = await fetch(`/api/projects/${entry.projectId}`);
      if (res.ok) {
        const project = await res.json();
        setProjectPopup({
          id: project.id,
          name: project.name,
          description: project.description || '',
          clientName: entry.clientName,
        });
      }
    } catch (err) {
      console.error('Error fetching project:', err);
      setToast({ message: 'Error al cargar proyecto', type: 'error' });
    } finally {
      setLoadingProject(false);
    }
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('es', { 
      weekday: 'short',
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-950 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock size={24} className="text-orange-400" />
          <h1 className="text-xl font-semibold text-white">TimeSheets</h1>
          <span className="text-sm text-gray-500">
            ({timesheets.length} registros)
          </span>
        </div>
        
        <button
          onClick={handleExportCSV}
          disabled={timesheets.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium transition-colors"
        >
          <Download size={16} />
          Exportar CSV
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">Cargando timesheets...</p>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle size={20} />
            <p>{error}</p>
          </div>
        </div>
      ) : timesheets.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Clock size={48} className="mx-auto text-gray-700 mb-4" />
            <p className="text-gray-500">No hay timesheets registrados</p>
            <p className="text-gray-600 text-sm mt-2">
              Los timesheets se crean desde las tareas
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {/* Table */}
          <table className="w-full">
            <thead className="bg-gray-900 sticky top-0">
              <tr className="text-left text-sm text-gray-400">
                <th 
                  className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('workDate')}
                >
                  Fecha <SortIndicator field="workDate" />
                </th>
                <th 
                  className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('clientName')}
                >
                  Cliente <SortIndicator field="clientName" />
                </th>
                <th 
                  className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('projectName')}
                >
                  Proyecto <SortIndicator field="projectName" />
                </th>
                <th 
                  className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('taskTitle')}
                >
                  Tarea <SortIndicator field="taskTitle" />
                </th>
                <th 
                  className="px-4 py-3 font-medium text-right cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('hoursWorked')}
                >
                  Horas <SortIndicator field="hoursWorked" />
                </th>
                <th className="px-4 py-3 font-medium">Descripción</th>
                <th className="px-4 py-3 font-medium text-center w-24">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {sortedTimesheets.map(entry => (
                <tr 
                  key={entry.id}
                  className="hover:bg-gray-900/50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-white">
                    {formatDate(entry.workDate)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {entry.clientName}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => handleProjectClick(entry)}
                      disabled={loadingProject}
                      className="text-gray-300 hover:text-blue-400 hover:underline transition-colors cursor-pointer disabled:cursor-wait inline-flex items-center gap-1"
                      title="Ver detalles del proyecto"
                    >
                      {entry.projectName}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm max-w-[200px] truncate" title={entry.taskTitle}>
                    <button
                      onClick={() => handleTaskClick(entry)}
                      disabled={loadingTask}
                      className="text-gray-300 hover:text-blue-400 hover:underline transition-colors cursor-pointer truncate max-w-full text-left disabled:cursor-wait inline-flex items-center gap-1"
                      title="Ver detalles de la tarea"
                    >
                      {entry.taskTitle}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-white text-right font-mono">
                    {entry.hoursWorked.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400 max-w-[200px] truncate" title={entry.description}>
                    {entry.description || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleEdit(entry)}
                        className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-blue-400 transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>
                      {deleteConfirm === entry.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(entry.id)}
                            disabled={deleting}
                            className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-medium disabled:opacity-50"
                          >
                            {deleting ? '...' : 'Sí'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(entry.id)}
                          className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Footer with totals */}
            <tfoot className="bg-gray-900 border-t-2 border-gray-700">
              <tr className="text-sm font-medium">
                <td className="px-4 py-3 text-white" colSpan={4}>
                  Total
                </td>
                <td className="px-4 py-3 text-white text-right font-mono">
                  {totalHours.toFixed(1)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editingTask && (
        <TimeSheetModal
          task={editingTask}
          initialDate={editingDate}
          onClose={() => {
            setEditingTask(null);
            setEditingDate('');
          }}
          onSaved={() => {
            fetchTimesheets();
            refreshNotes();
            setToast({ message: 'TimeSheet actualizado exitosamente', type: 'success' });
          }}
        />
      )}

      {/* Task Detail Popup */}
      {taskPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckSquare size={20} className="text-blue-400" />
                <h3 className="text-lg font-semibold text-white">Detalle de Tarea</h3>
              </div>
              <button
                onClick={() => setTaskPopup(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 uppercase">Título</label>
                <p className="text-white">{taskPopup.title}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 uppercase">Estado</label>
                  <p className="text-gray-300">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      taskPopup.status === 'COMPLETED' ? 'bg-green-600' :
                      taskPopup.status === 'IN_PROGRESS' ? 'bg-blue-600' :
                      taskPopup.status === 'CANCELLED' ? 'bg-red-600' :
                      'bg-gray-600'
                    }`}>
                      {taskPopup.status === 'PENDING' ? 'Pendiente' :
                       taskPopup.status === 'IN_PROGRESS' ? 'En Progreso' :
                       taskPopup.status === 'COMPLETED' ? 'Completado' :
                       taskPopup.status === 'CANCELLED' ? 'Cancelado' :
                       taskPopup.status}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">Prioridad</label>
                  <p className="text-gray-300">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      taskPopup.priority === 'CRITICAL' ? 'bg-red-600' :
                      taskPopup.priority === 'HIGH' ? 'bg-orange-600' :
                      taskPopup.priority === 'MEDIUM' ? 'bg-yellow-600' :
                      'bg-gray-600'
                    }`}>
                      {taskPopup.priority === 'LOW' ? 'Baja' :
                       taskPopup.priority === 'MEDIUM' ? 'Media' :
                       taskPopup.priority === 'HIGH' ? 'Alta' :
                       taskPopup.priority === 'CRITICAL' ? 'Crítica' :
                       taskPopup.priority}
                    </span>
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 uppercase">Cliente</label>
                  <p className="text-gray-300">{taskPopup.clientName || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">Proyecto</label>
                  <p className="text-gray-300">{taskPopup.projectName || '-'}</p>
                </div>
              </div>
              
              {taskPopup.contentText && (
                <div>
                  <label className="text-xs text-gray-500 uppercase">Descripción</label>
                  <p className="text-gray-300 text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {taskPopup.contentText}
                  </p>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setTaskPopup(null)}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Detail Popup */}
      {projectPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Folder size={20} className="text-green-400" />
                <h3 className="text-lg font-semibold text-white">Detalle de Proyecto</h3>
              </div>
              <button
                onClick={() => setProjectPopup(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 uppercase">Nombre</label>
                <p className="text-white">{projectPopup.name}</p>
              </div>
              
              <div>
                <label className="text-xs text-gray-500 uppercase">Cliente</label>
                <p className="text-gray-300">{projectPopup.clientName || '-'}</p>
              </div>
              
              {projectPopup.description && (
                <div>
                  <label className="text-xs text-gray-500 uppercase">Descripción</label>
                  <p className="text-gray-300 text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {projectPopup.description}
                  </p>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setProjectPopup(null)}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
