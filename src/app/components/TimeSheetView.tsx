'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Clock, Trash2, Download, ChevronUp, ChevronDown, AlertCircle, X, Folder, FileText, Filter, XCircle, Save, Plus, Upload } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Toast } from './Toast';
import { TaskEditorModal } from './TaskEditorModal';
import { CargarHorasModal } from './CargarHorasModal';
import type { TaskNote, Project } from '@/lib/types';
import { getContrastTextColor } from '@/lib/colorPalette';

interface TimeSheetGridEntry {
  id: string;
  workDate: string;
  hoursWorked: number;
  description: string;
  taskId: string;
  taskTitle: string;
  taskCode: string;
  taskShortDescription: string;
  projectId: string;
  projectName: string;
  projectCode: string; // Optional project code (e.g. PRJ-001)
  clientId: string;
  clientName: string;
  parentClientId?: string; // REQ-010: Added for parent client grouping
  parentClientName?: string; // REQ-010: Added for parent client grouping
  state: string; // DRAFT or FINAL
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
  const { refreshNotes, selectedTimesheetClientId, clients, showCargarHorasModal, closeCargarHorasModal, openCargarHorasModal } = useApp();
  // NOTE: selectedTimesheetClientId is used for filtering; we previously
  // displayed the parent client name in the header but that was removed.
  // (kept here for potential future logic)
  const [timesheets, setTimesheets] = useState<TimeSheetGridEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>('workDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Inline editing - support multiple rows (hours as string to allow decimal input)
  const [editingRows, setEditingRows] = useState<Map<string, { hours: string; state: string; description: string; workDate: string }>>(new Map());
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  
  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Toast
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' } | null>(null);
  
  // Task detail popup (tooltip style)
  const [taskPopup, setTaskPopup] = useState<TaskDetail | null>(null);
  const [taskPopupPosition, setTaskPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [loadingTask, setLoadingTask] = useState(false);
  
  // Task editor modal (full edit)
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  
  // Hover timeout for task popup
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taskPopupRef = useRef<HTMLDivElement>(null);
  
  // Create TimeSheet modal state - search based
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { globalTimeSheetRequest, clearTimeSheetRequest } = useApp();

  // if another part of app requests a quick timesheet, open modal
  useEffect(() => {
    if (globalTimeSheetRequest) {
      setShowCreateModal(true);
      clearTimeSheetRequest();
    }
  }, [globalTimeSheetRequest, clearTimeSheetRequest]);
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [taskSearchResults, setTaskSearchResults] = useState<Array<TaskNote & { clientName: string; projectName: string }>>([]);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const [allTasksWithContext, setAllTasksWithContext] = useState<Array<TaskNote & { clientName: string; projectName: string }>>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Project detail popup
  const [projectPopup, setProjectPopup] = useState<ProjectDetail | null>(null);
  const [loadingProject, setLoadingProject] = useState(false);

  // Filters
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterClient, setFilterClient] = useState<string>('');
  const [filterProject, setFilterProject] = useState<string>('');
  const [filterState, setFilterState] = useState<'all' | 'DRAFT' | 'FINAL'>('DRAFT'); // Estado: borrador por defecto
  const [filterPositiveHours, setFilterPositiveHours] = useState(true); // Solo horas > 0

  // Column widths (resizable, persisted in localStorage)
  const COLUMN_WIDTHS_KEY = 'timesheet-column-widths';
  const defaultColumnWidths = {
    fecha: 100,
    cliente: 120,
    proyecto: 150,
    ticket: 200,
    horas: 80,
    descripcion: 200,
    estado: 100,
    acciones: 80,
  };
  const [columnWidths, setColumnWidths] = useState<typeof defaultColumnWidths>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(COLUMN_WIDTHS_KEY);
      if (saved) {
        try {
          return { ...defaultColumnWidths, ...JSON.parse(saved) };
        } catch {}
      }
    }
    return defaultColumnWidths;
  });
  
  // Persist column widths to localStorage
  useEffect(() => {
    localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(columnWidths));
  }, [columnWidths]);
  
  // Column resize state
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // Month and Year selectors (always visible, separated)
  const [selectedMonth, setSelectedMonth] = useState(() => (new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  
  // Selected day filter (click on calendar day)
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  
  // Selected week filter (click on week label)
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  
  // Initialize to current week on first load
  const [initializedWeek, setInitializedWeek] = useState(false);

  // Refs for auto-selecting hours input
  const hoursInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Unique clients and projects for filter dropdowns
  const uniqueClients = useMemo(() => {
    const clients = Array.from(new Set(timesheets.map(ts => ts.clientName))).sort();
    return clients;
  }, [timesheets]);

  const uniqueProjects = useMemo(() => {
    const filtered = filterClient 
      ? timesheets.filter(ts => ts.clientName === filterClient)
      : timesheets;
    const projects = Array.from(new Set(filtered.map(ts => ts.projectName))).sort();
    return projects;
  }, [timesheets, filterClient]);

  // Check if any filter is active
  const hasActiveFilters = filterDateFrom || filterDateTo || filterClient || filterProject || filterState !== 'DRAFT' || !filterPositiveHours;

  // Clear all filters
  const clearFilters = () => {
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterClient('');
    setFilterProject('');
    setFilterState('DRAFT');
    setFilterPositiveHours(true);
  };

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
  // Filter timesheets
  const selectedMonthStr = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`;
  
  // REQ-010: Get client IDs that are sub-clients of a parent (NOT including the parent itself)
  const getSubClientIds = (parentId: string): string[] => {
    return clients.filter(c => c.parentClientId === parentId).map(c => c.id);
  };
  
  // Get days range for a specific week index
  const getWeekDaysRange = useCallback((weekIndex: number): { start: number; end: number } | null => {
    const firstDay = new Date(selectedYear, selectedMonth - 1, 1);
    let startDayOfWeek = firstDay.getDay();
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    
    // Calculate start day of week (1-based day of month)
    const weekStartDay = weekIndex * 7 - startDayOfWeek + 1;
    const start = Math.max(1, weekStartDay);
    const end = Math.min(lastDay, weekStartDay + 6);
    
    if (start > lastDay) return null;
    return { start, end };
  }, [selectedYear, selectedMonth]);
  
  const filteredTimesheets = useMemo(() => {
    return timesheets.filter(ts => {
      // State filter
      if (filterState !== 'all' && ts.state !== filterState) return false;
      // Positive hours filter
      if (filterPositiveHours && ts.hoursWorked <= 0) return false;
      // Month filter (always active)
      if (selectedMonthStr) {
        const tsMonth = ts.workDate.slice(0, 7); // YYYY-MM
        if (tsMonth !== selectedMonthStr) return false;
      }
      // Day filter (from calendar click)
      if (selectedDay !== null) {
        const tsDay = parseInt(ts.workDate.slice(8, 10), 10);
        if (tsDay !== selectedDay) return false;
      }
      // Week filter (from week label click)
      if (selectedWeek !== null && selectedDay === null) {
        const weekRange = getWeekDaysRange(selectedWeek);
        if (weekRange) {
          const tsDay = parseInt(ts.workDate.slice(8, 10), 10);
          if (tsDay < weekRange.start || tsDay > weekRange.end) return false;
        }
      }
      // Date from filter
      if (filterDateFrom && ts.workDate < filterDateFrom) return false;
      // Date to filter
      if (filterDateTo && ts.workDate > filterDateTo) return false;
      // Client filter
      if (filterClient && ts.clientName !== filterClient) return false;
      // Project filter
      if (filterProject && ts.projectName !== filterProject) return false;
      
      // REQ-010: Parent client filter from sidebar - show only sub-clients' timesheets
      if (selectedTimesheetClientId) {
        const subClientIds = getSubClientIds(selectedTimesheetClientId);
        if (!subClientIds.includes(ts.clientId)) return false;
      }
      
      return true;
    });
  }, [timesheets, selectedMonthStr, selectedDay, selectedWeek, getWeekDaysRange, filterDateFrom, filterDateTo, filterClient, filterProject, selectedTimesheetClientId, clients, filterState, filterPositiveHours]);

  const totalHours = filteredTimesheets.reduce((sum, ts) => sum + ts.hoursWorked, 0);
  const totalImputadas = filteredTimesheets.filter(ts => ts.state === 'FINAL').reduce((sum, ts) => sum + ts.hoursWorked, 0);
  const totalPendientes = filteredTimesheets.filter(ts => ts.state === 'DRAFT').reduce((sum, ts) => sum + ts.hoursWorked, 0);

  // Spanish month names
  const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const monthName = MONTH_NAMES[selectedMonth - 1];

  // Sort filtered timesheets
  const sortedTimesheets = [...filteredTimesheets].sort((a, b) => {
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

  // Column resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, columnKey: keyof typeof columnWidths) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(columnKey);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = columnWidths[columnKey];
  }, [columnWidths]);

  useEffect(() => {
    if (!resizingColumn) return;
    
    const handleResizeMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX.current;
      const newWidth = Math.max(50, resizeStartWidth.current + delta);
      setColumnWidths(prev => ({ ...prev, [resizingColumn]: newWidth }));
    };
    
    const handleResizeEnd = () => {
      setResizingColumn(null);
    };
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizingColumn]);

  // Resizable table header component
  const ResizableHeader = ({ 
    columnKey, 
    children, 
    onClick, 
    className = '' 
  }: { 
    columnKey: keyof typeof columnWidths; 
    children: React.ReactNode; 
    onClick?: () => void;
    className?: string;
  }) => (
    <th 
      style={{ width: columnWidths[columnKey], minWidth: columnWidths[columnKey] }}
      className={`px-3 py-2 font-medium relative select-none ${className}`}
    >
      <div 
        className={onClick ? 'cursor-pointer hover:text-white transition-colors' : ''}
        onClick={onClick}
      >
        {children}
      </div>
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-500/50 transition-colors"
        onMouseDown={(e) => handleResizeStart(e, columnKey)}
      />
    </th>
  );

  // Handle delete
  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/timesheets/${id}`, {
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
    const headers = ['Fecha', 'Cliente', 'Proyecto', 'Tarea', 'Horas', 'Estado', 'Descripción'];
    
    // CSV rows - use formatDateExport for configurable date formatting
    const rows = sortedTimesheets.map(ts => [
      `"${formatDateExport(ts.workDate)}"`,
      `"${ts.clientName.replace(/"/g, '""')}"`,
      `"${ts.projectName.replace(/"/g, '""')}"`,
      `"${ts.taskTitle.replace(/"/g, '""')}"`,
      ts.hoursWorked.toString(),
      ts.state === 'FINAL' ? 'Imputado' : 'Borrador',
      `"${(ts.description || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
    ]);

    // Add total row
    rows.push(['', '', '', 'TOTAL', totalHours.toFixed(1), '', '']);

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

  // Export to PDF (print-friendly)
  const handleExportPDF = () => {
    if (sortedTimesheets.length === 0) {
      setToast({ message: 'No hay datos para exportar', type: 'error' });
      return;
    }

    // Build print HTML
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setToast({ message: 'Popup bloqueado - permite popups para exportar PDF', type: 'error' });
      return;
    }

    // Build filter info
    const filterInfo = [];
    if (filterDateFrom) filterInfo.push(`Desde: ${formatDateExport(filterDateFrom)}`);
    if (filterDateTo) filterInfo.push(`Hasta: ${formatDateExport(filterDateTo)}`);
    if (filterClient) filterInfo.push(`Cliente: ${filterClient}`);
    if (filterProject) filterInfo.push(`Proyecto: ${filterProject}`);
    const filterText = filterInfo.length > 0 ? filterInfo.join(' | ') : 'Sin filtros aplicados';

    // Build table rows with alternating colors by date
    const uniqueDates = Array.from(new Set(sortedTimesheets.map(ts => ts.workDate))).sort();
    const dateColorMap: Record<string, number> = {};
    uniqueDates.forEach((date, idx) => {
      dateColorMap[date] = idx % 2;
    });

    const rows = sortedTimesheets.map((ts) => {
      const colorClass = dateColorMap[ts.workDate] === 0 ? 'row-even' : 'row-odd';
      // compute client color for badge
      const client = clients.find(c => c.id === ts.clientId);
      const bg = client?.color || '#888';
      const textColor = getContrastTextColor(bg);
      return `<tr class="${colorClass}">
        <td>${formatDateExport(ts.workDate)}</td>
        <td><span style="display:inline-block;padding:2px 6px;border-radius:4px;background:${bg};color:${textColor};font-size:10px;">${ts.clientName}</span></td>
        <td>${ts.projectName}</td>
        <td>${ts.taskTitle}</td>
        <td class="hours">${ts.hoursWorked.toFixed(1)}</td>
        <td class="${ts.state === 'FINAL' ? 'badge-final' : 'badge-draft'}">${ts.state === 'FINAL' ? 'Imputado' : 'Borrador'}</td>
      </tr>`;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>TimeSheets - ${new Date().toLocaleDateString('es')}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; margin: 20px; color: #333; }
          h1 { font-size: 18px; margin-bottom: 5px; }
          .filter-info { font-size: 11px; color: #666; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
          th { background: #f3f4f6; font-weight: 600; }
          .hours { text-align: right; font-family: monospace; }
          .row-even { background: #ffffff; }
          .row-odd { background: #f9fafb; }
          .total-row { background: #1f2937; color: white; font-weight: bold; }
          .badge-draft { color: #d97706; }
          .badge-final { color: #059669; }
          .footer { margin-top: 20px; font-size: 10px; color: #666; text-align: right; }
          @media print {
            body { margin: 0; }
            @page { margin: 15mm; }
          }
        </style>
      </head>
      <body>
        <h1>⏱️ Reporte de TimeSheets</h1>
        <p class="filter-info">${filterText}</p>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Proyecto</th>
              <th>Tarea</th>
              <th class="hours">Horas</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="5">TOTAL GENERAL</td>
              <td class="hours">${totalHours.toFixed(1)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        <p class="footer">Generado el ${new Date().toLocaleDateString('es', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        <script>setTimeout(() => { window.print(); }, 250);</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Open task detail popup
  const handleTaskClick = async (entry: TimeSheetGridEntry) => {
    // Clear any hover timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setTaskPopup(null);
    
    // Open task in full editor modal
    setEditTaskId(entry.taskId);
  };

  // Show task popup on hover (after 1 second)
  const handleTaskHoverStart = async (entry: TimeSheetGridEntry, event: React.MouseEvent) => {
    // Store position for popup
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setTaskPopupPosition({ x: rect.left, y: rect.bottom + 8 });
    
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    // Set timeout to show popup after 1 second
    hoverTimeoutRef.current = setTimeout(async () => {
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
      } finally {
        setLoadingTask(false);
      }
    }, 1000);
  };

  // Cancel hover timeout and close popup immediately
  const handleTaskHoverEnd = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setTaskPopup(null);
    setTaskPopupPosition(null);
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

  // Open create TimeSheet modal - load all tasks with client/project info
  const handleOpenCreateModal = async () => {
    try {
      // Fetch all tasks
      const tasksRes = await fetch('/api/notes?type=task');
      if (!tasksRes.ok) return;
      const tasks: TaskNote[] = await tasksRes.json();
      
      // Fetch all projects and clients for context
      const [projectsRes, clientsRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/clients')
      ]);
      const projects: Project[] = projectsRes.ok ? await projectsRes.json() : [];
      const clients: Array<{ id: string; name: string }> = clientsRes.ok ? await clientsRes.json() : [];
      
      // Build lookup maps
      const projectMap = new Map(projects.map(p => [p.id, p]));
      const clientMap = new Map(clients.map(c => [c.id, c.name]));
      
      // Enrich tasks with client and project names
      const tasksWithContext = tasks.map(task => {
        const project = projectMap.get(task.projectId);
        const clientName = project?.clientId ? clientMap.get(project.clientId) || 'Sin Cliente' : 'Sin Cliente';
        const projectName = project?.name || 'Sin Proyecto';
        return { ...task, clientName, projectName };
      });
      
      setAllTasksWithContext(tasksWithContext);
      setTaskSearchResults(tasksWithContext.slice(0, 10));
      setTaskSearchQuery('');
      setSelectedSearchIndex(0);
      setShowCreateModal(true);
      
      // Focus search input after modal opens
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } catch (err) {
      console.error('Error loading tasks:', err);
      setToast({ message: 'Error al cargar tareas', type: 'error' });
    }
  };

  // Filter tasks based on search query
  const handleTaskSearch = (query: string) => {
    setTaskSearchQuery(query);
    setSelectedSearchIndex(0);
    
    if (!query.trim()) {
      setTaskSearchResults(allTasksWithContext.slice(0, 10));
      return;
    }
    
    const lowerQuery = query.toLowerCase();
    const filtered = allTasksWithContext.filter(task => 
      task.title.toLowerCase().includes(lowerQuery) ||
      (task.ticketPhaseCode?.toLowerCase().includes(lowerQuery)) ||
      task.clientName.toLowerCase().includes(lowerQuery) ||
      task.projectName.toLowerCase().includes(lowerQuery)
    );
    setTaskSearchResults(filtered.slice(0, 10));
  };

  // Handle keyboard navigation in search results
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSearchIndex(prev => Math.min(prev + 1, taskSearchResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSearchIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && taskSearchResults.length > 0) {
      e.preventDefault();
      handleQuickCreateTimesheet(taskSearchResults[selectedSearchIndex]);
    } else if (e.key === 'Escape') {
      setShowCreateModal(false);
    }
  };

  // Create timesheet directly and add to grid in edit mode
  const handleQuickCreateTimesheet = async (task: TaskNote & { clientName: string; projectName: string }) => {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const res = await fetch('/api/timesheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          workDate: today,
          hoursWorked: 0,
          description: task.title,
          state: 'DRAFT',
          projectId: task.projectId || null,
          clientId: null,
        }),
      });
      
      if (res.ok) {
        const newTimesheet = await res.json();
        setShowCreateModal(false);
        await fetchTimesheets();
        
        // Put the new entry in edit mode and focus hours input
        setTimeout(() => {
          setEditingRows(prev => {
            const newMap = new Map(prev);
            newMap.set(newTimesheet.id, { hours: '', state: 'DRAFT', description: task.title, workDate: today });
            return newMap;
          });
          // Focus hours input after state update
          setTimeout(() => {
            const input = hoursInputRefs.current.get(newTimesheet.id);
            if (input) {
              input.focus();
              input.select();
            }
          }, 100);
        }, 200);
        
        setToast({ message: 'TimeSheet creado - ingresa las horas', type: 'success' });
      } else {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || 'Failed to create timesheet');
      }
    } catch (err) {
      console.error('Error creating timesheet:', err);
      setToast({ message: 'Error al crear TimeSheet', type: 'error' });
    }
  };

  // Format date for display in grid - fixed format "Lunes, 20/06"
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr + 'T00:00:00');
    const weekday = date.toLocaleDateString('es', { weekday: 'long' });
    // Capitalize first letter
    const weekdayCapitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${weekdayCapitalized}, ${day}/${month}`;
  };

  // Format date for export - uses configurable format from localStorage
  const formatDateExport = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr + 'T00:00:00');
    const exportFormat = localStorage.getItem('timesheet-export-date-format') || 'DD/MM/YYYY';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    switch (exportFormat) {
      case 'DD/MM/YYYY':
        return `${day}/${month}/${year}`;
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      case 'DD-MM-YYYY':
        return `${day}-${month}-${year}`;
      default:
        return `${day}/${month}/${year}`;
    }
  };

  // Convert YYYY-MM-DD to DD/MM/YYYY for input display
  const isoToDisplayDate = (isoDate: string): string => {
    if (!isoDate) return '';
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  };

  // Convert DD/MM/YYYY to YYYY-MM-DD for storage
  const displayToIsoDate = (displayDate: string): string => {
    if (!displayDate) return '';
    // Handle various input formats
    const cleaned = displayDate.replace(/[^0-9]/g, '');
    if (cleaned.length === 8) {
      // DDMMYYYY
      const day = cleaned.slice(0, 2);
      const month = cleaned.slice(2, 4);
      const year = cleaned.slice(4, 8);
      return `${year}-${month}-${day}`;
    }
    // Try parsing DD/MM/YYYY
    const parts = displayDate.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year.padStart(4, '20')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return displayDate; // Return as-is if can't parse
  };

  // Inline editing handlers (multiple rows)
  const handleRowDoubleClick = (entry: TimeSheetGridEntry) => {
    if (editingRows.has(entry.id)) return; // Already editing
    setEditingRows(prev => {
      const newMap = new Map(prev);
      newMap.set(entry.id, { hours: entry.hoursWorked.toString(), state: entry.state, description: entry.description || '', workDate: entry.workDate });
      return newMap;
    });
    // Auto-select hours input after a short delay
    setTimeout(() => {
      const input = hoursInputRefs.current.get(entry.id);
      if (input) {
        input.select();
      }
    }, 50);
  };

  // Update hours for a specific row (keep as string to allow decimal input)
  const handleEditHoursChange = (id: string, value: string) => {
    setEditingRows(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(id);
      if (current) {
        newMap.set(id, { ...current, hours: value });
      }
      return newMap;
    });
  };

  // Update description for a specific row
  const handleEditDescriptionChange = (id: string, value: string) => {
    setEditingRows(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(id);
      if (current) {
        newMap.set(id, { ...current, description: value });
      }
      return newMap;
    });
  };

  // Update work date for a specific row (accepts DD/MM/YYYY format)
  const handleEditDateChange = (id: string, value: string) => {
    // Convert to ISO format for storage
    const isoDate = displayToIsoDate(value);
    setEditingRows(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(id);
      if (current) {
        newMap.set(id, { ...current, workDate: isoDate });
      }
      return newMap;
    });
  };

  // Toggle state for a specific row (DRAFT -> FINAL -> DRAFT) - works with simple click
  const handleToggleState = async (id: string) => {
    // Get the current state from either editingRows or the original entry
    const editData = editingRows.get(id);
    const entry = timesheets.find(ts => ts.id === id);
    if (!entry) return;
    
    const currentState = editData?.state ?? entry.state;
    const newState = currentState === 'DRAFT' ? 'FINAL' : 'DRAFT';
    
    // If editing, update editing state only (will be saved on Save click)
    if (editingRows.has(id)) {
      setEditingRows(prev => {
        const newMap = new Map(prev);
        const current = newMap.get(id);
        if (current) {
          newMap.set(id, { ...current, state: newState });
        }
        return newMap;
      });
    } else {
      // Direct save if not editing
      setSavingRowId(id);
      try {
        const res = await fetch(`/api/timesheets/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hoursWorked: entry.hoursWorked,
            state: newState,
            description: entry.description,
          }),
        });
        
        if (res.ok) {
          setToast({ message: 'Estado actualizado', type: 'success' });
          await fetchTimesheets();
          await refreshNotes();
        } else {
          throw new Error('Failed to update');
        }
      } catch (err) {
        console.error('Error updating state:', err);
        setToast({ message: 'Error al actualizar estado', type: 'error' });
      } finally {
        setSavingRowId(null);
      }
    }
  };

  // Handle keyboard events for inline editing
  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveInlineEdit(id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit(id);
    }
  };

  const handleSaveInlineEdit = async (id: string) => {
    const editData = editingRows.get(id);
    if (!editData) return;
    
    setSavingRowId(id);
    try {
      const res = await fetch(`/api/timesheets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hoursWorked: parseFloat(editData.hours) || 0,
          state: editData.state,
          description: editData.description,
          workDate: editData.workDate,
        }),
      });
      
      if (res.ok) {
        setToast({ message: 'TimeSheet actualizado', type: 'success' });
        await fetchTimesheets();
        await refreshNotes();
        setEditingRows(prev => {
          const newMap = new Map(prev);
          newMap.delete(id);
          return newMap;
        });
      } else {
        throw new Error('Failed to update');
      }
    } catch (err) {
      console.error('Error updating timesheet:', err);
      setToast({ message: 'Error al actualizar', type: 'error' });
    } finally {
      setSavingRowId(null);
    }
  };

  const handleCancelEdit = (id: string) => {
    setEditingRows(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  };

  // Get day color index (alternating colors by date)
  const getDayColorIndex = useMemo(() => {
    const uniqueDates = Array.from(new Set(sortedTimesheets.map(ts => ts.workDate))).sort();
    const colorMap: Record<string, number> = {};
    uniqueDates.forEach((date, idx) => {
      colorMap[date] = idx % 2;
    });
    return colorMap;
  }, [sortedTimesheets]);

  // Calculate hours by date for calendar
  const hoursByDate = useMemo(() => {
    const hoursMap: Record<string, number> = {};
    timesheets.forEach(ts => {
      // Only count if in selected month
      if (ts.workDate.slice(0, 7) === selectedMonthStr) {
        hoursMap[ts.workDate] = (hoursMap[ts.workDate] || 0) + ts.hoursWorked;
      }
    });
    return hoursMap;
  }, [timesheets, selectedMonthStr]);

  // Get daily hours target from localStorage
  const getDailyHoursTarget = () => {
    if (typeof window === 'undefined') return 8;
    const stored = localStorage.getItem('timesheet-daily-hours');
    return stored ? parseFloat(stored) : 8;
  };

  // Generate calendar days grouped by weeks for horizontal display
  const calendarWeeks = useMemo(() => {
    const year = selectedYear;
    const month = selectedMonth;
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const totalDays = lastDay.getDate();
    
    // Get day of week for first day (0 = Sunday, convert to Monday = 0)
    let startDayOfWeek = firstDay.getDay();
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // Monday = 0
    
    const dailyTarget = getDailyHoursTarget();
    const allDays: Array<{ day: number | null; hours: number; color: 'green' | 'yellow' | 'none'; isWeekend: boolean }> = [];
    
    // Add empty cells for days before first of month
    for (let i = 0; i < startDayOfWeek; i++) {
      const isWeekend = i >= 5; // Saturday (5) or Sunday (6)
      allDays.push({ day: null, hours: 0, color: 'none', isWeekend });
    }
    
    // Add all days of the month
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const hours = hoursByDate[dateStr] || 0;
      let color: 'green' | 'yellow' | 'none' = 'none';
      if (hours >= dailyTarget) {
        color = 'green';
      } else if (hours > 0) {
        color = 'yellow';
      }
      // Calculate day of week (0=Mon, 5=Sat, 6=Sun)
      const dayOfWeek = (startDayOfWeek + day - 1) % 7;
      const isWeekend = dayOfWeek >= 5;
      allDays.push({ day, hours, color, isWeekend });
    }
    
    // Group into weeks (arrays of 7 days)
    const weeks: Array<typeof allDays> = [];
    for (let i = 0; i < allDays.length; i += 7) {
      weeks.push(allDays.slice(i, i + 7));
    }
    
    return weeks;
  }, [selectedYear, selectedMonth, hoursByDate]);
  
  // Initialize to current week when calendar weeks are calculated
  useEffect(() => {
    if (!initializedWeek && calendarWeeks.length > 0) {
      const today = new Date();
      const currentDay = today.getDate();
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();
      
      // Only set current week if we're viewing the current month
      if (selectedMonth === currentMonth && selectedYear === currentYear) {
        // Find which week contains today
        for (let weekIdx = 0; weekIdx < calendarWeeks.length; weekIdx++) {
          const week = calendarWeeks[weekIdx];
          if (week.some(cell => cell.day === currentDay)) {
            setSelectedWeek(weekIdx);
            break;
          }
        }
      }
      setInitializedWeek(true);
    }
  }, [calendarWeeks, initializedWeek, selectedMonth, selectedYear]);

  // Month names for selector
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  // Year options (current year +/- 2 years)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-gray-950 overflow-hidden">
      {/* Header with calendar and selectors */}
      <div className="px-6 py-3 border-b border-gray-800 flex items-center gap-4">
        <div className="flex items-center gap-3">
          <Clock size={24} className="text-orange-400" />
          <h1 className="text-xl font-semibold text-white">
            TimeSheets
          </h1>
          <span className="text-sm text-gray-500">({filteredTimesheets.length})</span>
        </div>
        
        {/* Center section: Year, Month, Calendar */}
        <div className="flex-1 flex items-center justify-center gap-4">
          {/* Year selector */}
          <select
            value={selectedYear}
            onChange={(e) => { setSelectedYear(parseInt(e.target.value)); setSelectedDay(null); setSelectedWeek(null); }}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          
          {/* Month selector */}
          <select
            value={selectedMonth}
            onChange={(e) => { setSelectedMonth(parseInt(e.target.value)); setSelectedDay(null); setSelectedWeek(null); }}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            {monthNames.map((name, idx) => (
              <option key={idx + 1} value={idx + 1}>{name}</option>
            ))}
          </select>
          
          {/* Compact Calendar - all days in one horizontal line with day headers */}
          <div className="flex flex-col bg-gray-900/50 px-2 py-1.5 rounded-lg overflow-x-auto">
            {/* Week labels row */}
            <div className="flex items-center gap-0.5 mb-1">
              {calendarWeeks.map((week, weekIdx) => (
                <div key={weekIdx} className="flex items-center">
                  {weekIdx > 0 && <div className="w-px h-4 mx-1" />}
                  <button
                    onClick={() => {
                      setSelectedDay(null);
                      setSelectedWeek(selectedWeek === weekIdx ? null : weekIdx);
                    }}
                    className={`w-[140px] h-4 flex items-center justify-center text-[10px] font-semibold cursor-pointer transition-colors ${
                      selectedWeek === weekIdx ? 'text-orange-400' : 'text-blue-300 hover:text-blue-200'
                    }`}
                    title={`Filtrar por Semana ${weekIdx + 1}`}
                  >
                    Semana {weekIdx + 1}
                  </button>
                </div>
              ))}
            </div>
            {/* Day headers row */}
            <div className="flex items-center gap-0.5 mb-0.5">
              {calendarWeeks.map((week, weekIdx) => (
                <div key={weekIdx} className="flex items-center">
                  {weekIdx > 0 && <div className="w-px h-3 mx-1" />}
                  {week.map((_, dayIdx) => (
                    <div 
                      key={dayIdx}
                      className={`w-5 h-3 flex items-center justify-center text-[8px] ${
                        dayIdx >= 5 ? 'text-orange-400' : 'text-blue-400'
                      }`}
                    >
                      {['L', 'M', 'X', 'J', 'V', 'S', 'D'][dayIdx]}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {/* Days row */}
            <div className="flex items-center gap-0.5">
              {calendarWeeks.map((week, weekIdx) => (
                <div key={weekIdx} className="flex items-center">
                  {weekIdx > 0 && <div className="w-px h-5 bg-gray-600 mx-1" />}
                  {week.map((cell, dayIdx) => (
                    <div 
                      key={dayIdx}
                      className={`w-5 h-5 flex items-center justify-center rounded-sm transition-colors ${
                        cell.day ? 'cursor-pointer hover:bg-gray-700' : ''
                      } ${
                        cell.isWeekend && cell.day ? 'bg-gray-800' : ''
                      } ${
                        cell.day && cell.day === selectedDay ? 'ring-1 ring-orange-500' : ''
                      }`}
                      title={cell.day && cell.hours > 0 ? `${cell.hours.toFixed(1)}h` : undefined}
                      onClick={() => cell.day && setSelectedDay(selectedDay === cell.day ? null : cell.day)}
                    >
                      {cell.day ? (
                        <span className={`w-4 h-4 flex items-center justify-center rounded-full text-[9px] ${
                          cell.color === 'green' ? 'bg-green-600 text-white font-bold' :
                          cell.color === 'yellow' ? 'bg-yellow-500 text-white font-bold' :
                          cell.isWeekend ? 'text-gray-500' : 'text-gray-400'
                        }`}>
                          {cell.day}
                        </span>
                      ) : (
                        <span className="w-4 h-4" />
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          
          {/* Ver todo el mes link */}
          {(selectedDay !== null || selectedWeek !== null) && (
            <button
              onClick={() => { setSelectedDay(null); setSelectedWeek(null); }}
              className="text-xs text-orange-400 hover:text-orange-300 transition-colors whitespace-nowrap"
              title="Ver todo el mes"
            >
              (ver mes)
            </button>
          )}
        </div>
        
        {/* Right section: Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={openCargarHorasModal}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
            title="Cargar Horas"
          >
            <Upload size={16} />
          </button>
          
          <button
            onClick={handleExportCSV}
            disabled={filteredTimesheets.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium transition-colors"
            title="Exportar CSV"
          >
            <Download size={16} />
          </button>
          
          <button
            onClick={handleExportPDF}
            disabled={filteredTimesheets.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium transition-colors"
          >
            <FileText size={16} />
          </button>
          
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium transition-colors"
            title="Crear registro de TimeSheet"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Filter row - always visible */}
        <div className="px-6 py-3 border-b border-gray-800 flex items-center gap-4 flex-wrap">
          {/* Positive hours filter */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterPositiveHours}
              onChange={(e) => setFilterPositiveHours(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
            />
            <span className="text-sm text-gray-300">Solo horas &gt; 0</span>
          </label>

          {/* State filter toggles */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400 mr-1">Estado:</span>
            <button
              onClick={() => setFilterState('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterState === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterState('DRAFT')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterState === 'DRAFT'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-yellow-400'
              }`}
            >
              Borrador
            </button>
            <button
              onClick={() => setFilterState('FINAL')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterState === 'FINAL'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-green-400'
              }`}
            >
              Imputado
            </button>
          </div>

          <div className="w-px h-6 bg-gray-700" />

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Desde:</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Hasta:</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Cliente:</label>
            <select
              value={filterClient}
              onChange={(e) => { setFilterClient(e.target.value); setFilterProject(''); }}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500 min-w-[150px]"
            >
              <option value="">Todos</option>
              {uniqueClients.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Proyecto:</label>
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500 min-w-[150px]"
            >
              <option value="">Todos</option>
              {uniqueProjects.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              <XCircle size={14} />
              Limpiar filtros
            </button>
          )}
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
      ) : filteredTimesheets.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Filter size={48} className="mx-auto text-gray-700 mb-4" />
            <p className="text-gray-500">No hay resultados con los filtros aplicados</p>
            <button
              onClick={clearFilters}
              className="mt-3 text-sm text-orange-400 hover:text-orange-300 transition-colors"
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {/* Title */}
          <div className="px-4 py-3 border-b border-gray-800">
            <h3 className="text-lg font-medium text-gray-300">
              {selectedDay !== null 
                ? `Horas del ${selectedDay} de ${monthName} ${selectedYear}`
                : selectedWeek !== null
                  ? (() => {
                      const range = getWeekDaysRange(selectedWeek);
                      return range 
                        ? `Horas Semana ${selectedWeek + 1} (${range.start}-${range.end} ${monthName} ${selectedYear})`
                        : `Horas Semana ${selectedWeek + 1} ${monthName} ${selectedYear}`;
                    })()
                  : `Horas ${monthName} ${selectedYear}`
              }
            </h3>
          </div>
          {/* Table */}
          <table className="w-full table-fixed">
            <thead className="bg-gray-900 sticky top-0">
              <tr className="text-left text-sm text-gray-400">
                <ResizableHeader columnKey="fecha" onClick={() => handleSort('workDate')}>
                  Fecha <SortIndicator field="workDate" />
                </ResizableHeader>
                <ResizableHeader columnKey="cliente" onClick={() => handleSort('clientName')}>
                  Cliente <SortIndicator field="clientName" />
                </ResizableHeader>
                <ResizableHeader columnKey="proyecto" onClick={() => handleSort('projectName')}>
                  Proyecto <SortIndicator field="projectName" />
                </ResizableHeader>
                <ResizableHeader columnKey="ticket" onClick={() => handleSort('taskTitle')}>
                  Ticket/Fase <SortIndicator field="taskTitle" />
                </ResizableHeader>
                <ResizableHeader columnKey="horas" onClick={() => handleSort('hoursWorked')}>
                  Horas <SortIndicator field="hoursWorked" />
                </ResizableHeader>
                <ResizableHeader columnKey="descripcion">
                  Descripción
                </ResizableHeader>
                <ResizableHeader columnKey="estado">
                  Estado
                </ResizableHeader>
                <ResizableHeader columnKey="acciones">
                  Acc
                </ResizableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {sortedTimesheets.map((entry) => {
                const editData = editingRows.get(entry.id);
                const isEditing = !!editData;
                const colorIdx = getDayColorIndex[entry.workDate] || 0;
                const bgClass = colorIdx === 0 ? 'bg-gray-950' : 'bg-gray-900/60';
                const currentState = editData?.state ?? entry.state;
                
                return (
                  <tr 
                    key={entry.id}
                    onDoubleClick={() => handleRowDoubleClick(entry)}
                    className={`${bgClass} hover:bg-gray-800/70 transition-colors ${isEditing ? 'ring-1 ring-orange-500' : ''}`}
                  >
                    {/* Fecha */}
                    <td className="px-3 py-1.5 text-sm text-white whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="text"
                          defaultValue={isoToDisplayDate(editData?.workDate ?? entry.workDate)}
                          onBlur={(e) => handleEditDateChange(entry.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleEditDateChange(entry.id, (e.target as HTMLInputElement).value);
                              handleKeyDown(e, entry.id);
                            } else if (e.key === 'Escape') {
                              handleKeyDown(e, entry.id);
                            }
                          }}
                          placeholder="DD/MM/YYYY"
                          className="bg-gray-800 border border-orange-500 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500 w-28"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        formatDate(entry.workDate)
                      )}
                    </td>
                    {/* Cliente badge */}
                    <td className="px-3 py-1.5 text-sm">
                      {/* look up color from client list in context */}
                      {(() => {
                        const client = clients.find(c => c.id === entry.clientId);
                        const bg = client?.color || '#888';
                        const textColor = getContrastTextColor(bg);
                        return (
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                            style={{ backgroundColor: bg, color: textColor }}
                          >
                            {entry.clientName}
                          </span>
                        );
                      })()}
                    </td>
                    {/* Proyecto */}
                    <td className="px-3 py-1.5 text-sm">
                      <button
                        onClick={() => handleProjectClick(entry)}
                        disabled={loadingProject}
                        className="text-gray-300 hover:text-blue-400 hover:underline transition-colors cursor-pointer disabled:cursor-wait"
                        title="Ver detalles del proyecto"
                      >
                        {entry.projectName}
                      </button>
                    </td>
                    {/* Ticket/Fase */}
                    <td className="px-3 py-1.5 text-sm">
                      <button
                        onClick={() => handleTaskClick(entry)}
                        onMouseEnter={(e) => handleTaskHoverStart(entry, e)}
                        onMouseLeave={handleTaskHoverEnd}
                        disabled={loadingTask}
                        className="text-gray-300 hover:text-blue-400 hover:underline transition-colors cursor-pointer disabled:cursor-wait"
                        title="Click para editar | Hover 1s para info"
                      >
                        {entry.taskCode || entry.taskTitle.substring(0, 12)}
                        {entry.taskShortDescription && (
                          <span className="text-gray-500 ml-1">- {entry.taskShortDescription}</span>
                        )}
                      </button>
                    </td>
                    {/* Horas */}
                    <td className="px-3 py-1.5 text-sm text-white font-mono">
                      {isEditing ? (
                        <input
                          ref={(el) => { if (el) hoursInputRefs.current.set(entry.id, el); }}
                          type="text"
                          inputMode="decimal"
                          value={editData?.hours ?? entry.hoursWorked}
                          onChange={(e) => handleEditHoursChange(entry.id, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, entry.id)}
                          className="bg-gray-800 border border-orange-500 rounded px-2 py-0.5 text-sm text-white w-16 focus:outline-none focus:ring-1 focus:ring-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        entry.hoursWorked.toFixed(1)
                      )}
                    </td>
                    {/* Descripción (del registro timesheet) */}
                    <td className="px-3 py-1.5 text-sm text-gray-400 max-w-[200px]" title={entry.description || ''}>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editData?.description ?? entry.description ?? ''}
                          onChange={(e) => handleEditDescriptionChange(entry.id, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, entry.id)}
                          className="bg-gray-800 border border-orange-500 rounded px-2 py-0.5 text-sm text-white w-full focus:outline-none focus:ring-1 focus:ring-orange-500"
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Descripción..."
                        />
                      ) : (
                        <span className="truncate block">{entry.description || '-'}</span>
                      )}
                    </td>
                    {/* Estado - clickeable para cambiar */}
                    <td className="px-3 py-1.5 text-sm">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleState(entry.id); }}
                        disabled={savingRowId === entry.id}
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                          currentState === 'FINAL' 
                            ? 'bg-green-600 hover:bg-green-500 text-white' 
                            : 'bg-yellow-600 hover:bg-yellow-500 text-white'
                        } ${savingRowId === entry.id ? 'opacity-50' : ''}`}
                        title="Click para cambiar estado"
                      >
                        {currentState === 'FINAL' ? 'Imputado' : 'Borrador'}
                      </button>
                    </td>
                    {/* Acciones */}
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSaveInlineEdit(entry.id); }}
                              disabled={savingRowId === entry.id}
                              className="p-1 rounded hover:bg-gray-700 text-orange-400 hover:text-orange-300 transition-colors"
                              title="Guardar (Enter)"
                            >
                              {savingRowId === entry.id ? <span className="animate-spin">⏳</span> : <Save size={14} />}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCancelEdit(entry.id); }}
                              className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-300 transition-colors"
                              title="Cancelar (Esc)"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : null}
                        {deleteConfirm === entry.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(entry.id)}
                              disabled={deleting}
                              className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-medium disabled:opacity-50"
                            >
                              {deleting ? '...' : 'Sí'}
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(entry.id)}
                            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Footer with totals */}
            <tfoot className="bg-gray-900 border-t-2 border-gray-700">
              <tr className="text-sm font-medium">
                <td className="px-3 py-2 text-white" colSpan={2}>
                  Total horas <span className="text-gray-500">({monthName} {selectedYear})</span>
                </td>
                <td className="px-3 py-2 text-white font-mono">
                  {totalHours.toFixed(1)}
                </td>
                <td className="px-3 py-2 text-gray-400">
                  Imputadas: <span className="text-green-400 font-mono">{totalImputadas.toFixed(1)}</span>
                </td>
                <td className="px-3 py-2 text-gray-400" colSpan={2}>
                  Pendientes: <span className="text-yellow-400 font-mono">{totalPendientes.toFixed(1)}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Task Detail Tooltip (appears on hover) */}
      {taskPopup && taskPopupPosition && (
        <div
          ref={taskPopupRef}
          className="fixed z-50 bg-gray-900 rounded-lg border border-gray-700 shadow-xl p-3 max-w-xl"
          style={{
            left: Math.min(taskPopupPosition.x, window.innerWidth - 500),
            top: taskPopupPosition.y,
          }}
          onMouseEnter={() => {
            // Keep popup open if mouse enters it
            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current);
            }
          }}
          onMouseLeave={handleTaskHoverEnd}
        >
          {/* Header row: Title + badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-white font-medium truncate max-w-[200px]" title={taskPopup.title}>
              {taskPopup.title}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
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
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
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
            <span className="text-gray-400 text-xs">
              {taskPopup.clientName || '-'} / {taskPopup.projectName || '-'}
            </span>
          </div>
          {/* Description if exists */}
          {taskPopup.contentText && (
            <p className="text-gray-400 text-xs mt-2 line-clamp-2">
              {taskPopup.contentText}
            </p>
          )}
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

      {/* Create TimeSheet Modal - Search Based */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Plus size={20} className="text-orange-400" />
                Crear TimeSheet
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Search Input */}
            <div className="mb-4">
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
            
            {/* Task Cards Results */}
            <div className="max-h-80 overflow-y-auto space-y-2">
              {taskSearchResults.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4 italic">
                  No se encontraron tareas
                </p>
              ) : (
                taskSearchResults.map((task, idx) => (
                  <button
                    key={task.id}
                    onClick={() => handleQuickCreateTimesheet(task)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      idx === selectedSearchIndex
                        ? 'bg-orange-600/20 border-orange-500'
                        : 'bg-gray-800 border-gray-700 hover:bg-gray-750 hover:border-gray-600'
                    }`}
                  >
                    {/* Primary: Ticket/Phase + Title */}
                    <div className="flex items-start gap-2">
                      {task.ticketPhaseCode && (
                        <span className="shrink-0 px-2 py-0.5 bg-blue-600/30 text-blue-400 text-xs font-mono rounded">
                          {task.ticketPhaseCode}
                        </span>
                      )}
                      <span className="text-white font-medium text-sm line-clamp-2">
                        {task.title}
                      </span>
                    </div>
                    {/* Secondary: Client → Project */}
                    <div className="mt-1.5 text-xs text-gray-500">
                      {task.clientName} → {task.projectName}
                    </div>
                  </button>
                ))
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-700 flex justify-end">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors"
              >
                Cancelar
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

      {/* Task Editor Modal */}
      {editTaskId && (
        <TaskEditorModal
          taskId={editTaskId}
          onClose={() => setEditTaskId(null)}
          onSaved={() => {
            // Refresh timesheets to reflect any task changes
            refreshNotes();
          }}
        />
      )}

      {/* Cargar Horas Modal */}
      <CargarHorasModal
        isOpen={showCargarHorasModal}
        onClose={closeCargarHorasModal}
        timesheets={sortedTimesheets.map(ts => ({
          id: ts.id,
          workDate: ts.workDate,
          hoursWorked: ts.hoursWorked,
          description: ts.description,
          projectName: ts.projectName,
          projectCode: ts.projectCode || '',
          taskCode: ts.taskCode,
          taskShortDescription: ts.taskShortDescription,
          state: ts.state,
          clientName: ts.clientName,
        }))}
        onRefresh={fetchTimesheets}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        parentClientName={selectedTimesheetClientId ? clients.find(c => c.id === selectedTimesheetClientId)?.name : undefined}
      />
    </div>
  );
}
