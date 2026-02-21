'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Clock, Trash2, Download, ChevronUp, ChevronDown, AlertCircle, X, CheckSquare, Folder, FileText, Filter, XCircle, Save } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Toast } from './Toast';

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
  const { refreshNotes } = useApp();
  const [timesheets, setTimesheets] = useState<TimeSheetGridEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>('workDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Inline editing - support multiple rows
  const [editingRows, setEditingRows] = useState<Map<string, { hours: number; state: string; description: string }>>(new Map());
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  
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

  // Filters
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterClient, setFilterClient] = useState<string>('');
  const [filterProject, setFilterProject] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Month and Year selectors (always visible, separated)
  const [selectedMonth, setSelectedMonth] = useState(() => (new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  // Refs for auto-selecting hours input
  const hoursInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Unique clients and projects for filter dropdowns
  const uniqueClients = useMemo(() => {
    const clients = Array.from(new Set(timesheets.map(ts => ts.clientName))).sort();
    return clients;
  }, [timesheets]);

  const uniqueProjects = useMemo(() => {
    const projects = Array.from(new Set(timesheets.map(ts => ts.projectName))).sort();
    return projects;
  }, [timesheets]);

  // Check if any filter is active
  const hasActiveFilters = filterDateFrom || filterDateTo || filterClient || filterProject;

  // Clear all filters
  const clearFilters = () => {
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterClient('');
    setFilterProject('');
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
  
  const filteredTimesheets = useMemo(() => {
    return timesheets.filter(ts => {
      // Month filter (always active)
      if (selectedMonthStr) {
        const tsMonth = ts.workDate.slice(0, 7); // YYYY-MM
        if (tsMonth !== selectedMonthStr) return false;
      }
      // Date from filter
      if (filterDateFrom && ts.workDate < filterDateFrom) return false;
      // Date to filter
      if (filterDateTo && ts.workDate > filterDateTo) return false;
      // Client filter
      if (filterClient && ts.clientName !== filterClient) return false;
      // Project filter
      if (filterProject && ts.projectName !== filterProject) return false;
      return true;
    });
  }, [timesheets, selectedMonthStr, filterDateFrom, filterDateTo, filterClient, filterProject]);

  const totalHours = filteredTimesheets.reduce((sum, ts) => sum + ts.hoursWorked, 0);

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
      return `<tr class="${colorClass}">
        <td>${formatDateExport(ts.workDate)}</td>
        <td>${ts.clientName}</td>
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
              <td colspan="4">TOTAL GENERAL</td>
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

  // Inline editing handlers (multiple rows)
  const handleRowDoubleClick = (entry: TimeSheetGridEntry) => {
    if (editingRows.has(entry.id)) return; // Already editing
    setEditingRows(prev => {
      const newMap = new Map(prev);
      newMap.set(entry.id, { hours: entry.hoursWorked, state: entry.state, description: entry.description || '' });
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

  // Update hours for a specific row
  const handleEditHoursChange = (id: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setEditingRows(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(id);
      if (current) {
        newMap.set(id, { ...current, hours: numValue });
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
        const res = await fetch(`/api/notes/${id}`, {
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
      const res = await fetch(`/api/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hoursWorked: editData.hours,
          state: editData.state,
          description: editData.description,
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

  // Generate calendar days for selected month
  const calendarData = useMemo(() => {
    const year = selectedYear;
    const month = selectedMonth;
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const totalDays = lastDay.getDate();
    
    // Get day of week for first day (0 = Sunday, convert to Monday = 0)
    let startDayOfWeek = firstDay.getDay();
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // Monday = 0
    
    const dailyTarget = getDailyHoursTarget();
    const days: Array<{ day: number | null; hours: number; color: 'green' | 'yellow' | 'none' }> = [];
    
    // Add empty cells for days before first of month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ day: null, hours: 0, color: 'none' });
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
      days.push({ day, hours, color });
    }
    
    return days;
  }, [selectedYear, selectedMonth, hoursByDate]);

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
      <div className="px-6 py-3 border-b border-gray-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Clock size={24} className="text-orange-400" />
          <h1 className="text-xl font-semibold text-white">TimeSheets</h1>
          <span className="text-sm text-gray-500">({filteredTimesheets.length})</span>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Compact Calendar inline */}
          <div className="flex items-center gap-1 bg-gray-900/50 px-2 py-1 rounded-lg">
            <div className="grid grid-cols-7 gap-0.5 text-[10px]">
              {/* Day headers */}
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
                <div key={d} className="w-5 h-4 flex items-center justify-center text-gray-500">{d}</div>
              ))}
              {/* Calendar days with circles */}
              {calendarData.map((cell, idx) => (
                <div 
                  key={idx}
                  className="w-5 h-5 flex items-center justify-center"
                  title={cell.day && cell.hours > 0 ? `${cell.hours.toFixed(1)}h` : undefined}
                >
                  {cell.day && (
                    <span className={`w-4 h-4 flex items-center justify-center rounded-full text-[9px] ${
                      cell.color === 'green' ? 'bg-green-600 text-white font-bold' :
                      cell.color === 'yellow' ? 'bg-yellow-500 text-white font-bold' :
                      'text-gray-400'
                    }`}>
                      {cell.day}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Month selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            {monthNames.map((name, idx) => (
              <option key={idx + 1} value={idx + 1}>{name}</option>
            ))}
          </select>
          
          {/* Year selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          
          {/* More filters toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showFilters || hasActiveFilters 
                ? 'bg-orange-600 text-white' 
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <Filter size={16} />
            {hasActiveFilters && (
              <span className="bg-white text-orange-600 text-xs rounded-full px-1.5 py-0.5 font-bold">!</span>
            )}
          </button>
          
          <button
            onClick={handleExportCSV}
            disabled={filteredTimesheets.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium transition-colors"
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
        </div>
      </div>

      {/* Filter row */}
      {showFilters && (
        <div className="px-6 py-3 border-b border-gray-800 bg-gray-900/50 flex items-center gap-4 flex-wrap">
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
              onChange={(e) => setFilterClient(e.target.value)}
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
      )}

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
          {/* Table */}
          <table className="w-full">
            <thead className="bg-gray-900 sticky top-0">
              <tr className="text-left text-sm text-gray-400">
                <th 
                  className="px-3 py-2 font-medium cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('workDate')}
                >
                  Fecha <SortIndicator field="workDate" />
                </th>
                <th 
                  className="px-3 py-2 font-medium cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('projectName')}
                >
                  Proyecto <SortIndicator field="projectName" />
                </th>
                <th 
                  className="px-3 py-2 font-medium cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('taskTitle')}
                >
                  Ticket/Fase <SortIndicator field="taskTitle" />
                </th>
                <th 
                  className="px-3 py-2 font-medium text-right cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('hoursWorked')}
                >
                  Horas <SortIndicator field="hoursWorked" />
                </th>
                <th className="px-3 py-2 font-medium">Descripción</th>
                <th className="px-3 py-2 font-medium text-center">Estado</th>
                <th className="px-3 py-2 font-medium text-center w-24">Acc</th>
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
                      {formatDate(entry.workDate)}
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
                        disabled={loadingTask}
                        className="text-gray-300 hover:text-blue-400 hover:underline transition-colors cursor-pointer disabled:cursor-wait"
                        title="Ver detalles de la tarea"
                      >
                        {entry.taskCode || entry.taskTitle.substring(0, 12)}
                      </button>
                    </td>
                    {/* Horas */}
                    <td className="px-3 py-1.5 text-sm text-white text-right font-mono">
                      {isEditing ? (
                        <input
                          ref={(el) => { if (el) hoursInputRefs.current.set(entry.id, el); }}
                          type="text"
                          inputMode="decimal"
                          value={editData?.hours ?? entry.hoursWorked}
                          onChange={(e) => handleEditHoursChange(entry.id, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, entry.id)}
                          className="bg-gray-800 border border-orange-500 rounded px-2 py-0.5 text-sm text-white w-16 text-right focus:outline-none focus:ring-1 focus:ring-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                    <td className="px-3 py-1.5 text-sm text-center">
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
                      <div className="flex items-center justify-center gap-1">
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
                <td className="px-3 py-2 text-white" colSpan={3}>
                  Total General
                </td>
                <td className="px-3 py-2 text-white text-right font-mono">
                  {totalHours.toFixed(1)}
                </td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
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
