'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { X, Copy, Check, Clock } from 'lucide-react';
import { Toast } from './Toast';

// TimeSheet entry for the modal
interface TimeSheetEntry {
  id: string;
  workDate: string;
  hoursWorked: number;
  description: string;
  projectName: string;
  taskCode: string; // Ticket/Fase
  state: string; // DRAFT or FINAL
}

interface CargarHorasModalProps {
  isOpen: boolean;
  onClose: () => void;
  timesheets: TimeSheetEntry[];
  onRefresh: () => Promise<void>;
  selectedMonth: number;
  selectedYear: number;
}

// Spanish month names
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function CargarHorasModal({ isOpen, onClose, timesheets, onRefresh, selectedMonth, selectedYear }: CargarHorasModalProps) {
  const [toast, setToast] = useState<{ message: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  
  // Filters
  const [filterPositiveHours, setFilterPositiveHours] = useState(true);
  const [filterState, setFilterState] = useState<'all' | 'DRAFT' | 'FINAL'>('DRAFT');

  // Filtered timesheets
  const filteredTimesheets = useMemo(() => {
    return timesheets.filter(ts => {
      // Filter by positive hours
      if (filterPositiveHours && ts.hoursWorked <= 0) return false;
      // Filter by state
      if (filterState !== 'all' && ts.state !== filterState) return false;
      return true;
    });
  }, [timesheets, filterPositiveHours, filterState]);

  // Group timesheets by date and calculate daily totals
  const groupedByDate = useMemo(() => {
    const groups: Map<string, { entries: TimeSheetEntry[]; totalHours: number }> = new Map();
    
    // Sort by date first
    const sorted = [...filteredTimesheets].sort((a, b) => a.workDate.localeCompare(b.workDate));
    
    for (const ts of sorted) {
      const existing = groups.get(ts.workDate);
      if (existing) {
        existing.entries.push(ts);
        existing.totalHours += ts.hoursWorked;
      } else {
        groups.set(ts.workDate, { entries: [ts], totalHours: ts.hoursWorked });
      }
    }
    
    return groups;
  }, [filteredTimesheets]);

  // Get color class for hours (>=8 green, <8 yellow)
  const getHoursColorClass = (hours: number): string => {
    if (hours >= 8) return 'text-green-400';
    return 'text-yellow-400';
  };

  // Calculate totals by state (from ALL timesheets, not filtered)
  const totalHours = timesheets.reduce((sum, ts) => sum + ts.hoursWorked, 0);
  const totalImputadas = timesheets.filter(ts => ts.state === 'FINAL').reduce((sum, ts) => sum + ts.hoursWorked, 0);
  const totalPendientes = timesheets.filter(ts => ts.state === 'DRAFT').reduce((sum, ts) => sum + ts.hoursWorked, 0);
  const monthName = MONTH_NAMES[selectedMonth - 1];

  // Format date as DD/MM/YY
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${day}/${month}/${year}`;
  };

  // Copy text to clipboard
  const handleCopy = useCallback(async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setToast({ message: 'Copiado al portapapeles' });
      setTimeout(() => setCopiedField(null), 1500);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      setToast({ message: 'Error al copiar' });
    }
  }, []);

  // Toggle state between DRAFT and FINAL
  const handleToggleState = useCallback(async (id: string, currentState: string) => {
    const newState = currentState === 'DRAFT' ? 'FINAL' : 'DRAFT';
    
    setSavingIds(prev => new Set(prev).add(id));
    
    try {
      const res = await fetch(`/api/timesheets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: newState }),
      });
      
      if (res.ok) {
        setToast({ 
          message: newState === 'FINAL' ? 'Marcado como Imputado' : 'Marcado como Borrador'
        });
        await onRefresh();
      } else {
        throw new Error('Failed to update');
      }
    } catch (err) {
      console.error('Error updating state:', err);
      setToast({ message: 'Error al actualizar estado' });
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [onRefresh]);

  // Render clickable cell
  const ClickableCell = ({ 
    value, 
    fieldId, 
    className = '' 
  }: { 
    value: string; 
    fieldId: string; 
    className?: string;
  }) => {
    const isCopied = copiedField === fieldId;
    return (
      <div 
        onClick={() => handleCopy(value, fieldId)}
        className={`cursor-pointer hover:bg-gray-700 px-2 py-1 rounded transition-colors flex items-center gap-1 group ${className}`}
        title="Click para copiar"
      >
        <span className="truncate flex-1">{value || '-'}</span>
        {isCopied ? (
          <Check size={12} className="text-green-400 flex-shrink-0" />
        ) : (
          <Copy size={12} className="text-gray-500 opacity-0 group-hover:opacity-100 flex-shrink-0" />
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 z-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-4 md:inset-10 lg:inset-20 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800">
          <div className="flex items-center gap-3">
            <Clock className="text-blue-400" size={24} />
            <h2 className="text-xl font-semibold text-white">Cargar Horas</h2>
            <span className="text-gray-400 text-sm">
              ({filteredTimesheets.length} de {timesheets.length} entrada{timesheets.length !== 1 ? 's' : ''})
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Instructions */}
        <div className="px-6 py-2 bg-gray-800/50 border-b border-gray-700">
          <p className="text-sm text-gray-400">
            <span className="text-blue-400">Click</span> en cualquier celda para copiar al portapapeles. 
            Use el botón de estado para cambiar entre <span className="text-yellow-400">Borrador</span> e <span className="text-green-400">Imputado</span>.
          </p>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 bg-gray-800/30 border-b border-gray-700 flex items-center gap-6 flex-wrap">
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
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {filteredTimesheets.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No hay timesheets para mostrar
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-800 z-10">
                <tr className="text-gray-400 text-left">
                  <th className="px-4 py-3 font-medium">Proyecto</th>
                  <th className="px-4 py-3 font-medium">Ticket/Fase</th>
                  <th className="px-4 py-3 font-medium text-right">Horas</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Descripción</th>
                  <th className="px-4 py-3 font-medium text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {Array.from(groupedByDate.entries()).map(([date, { entries, totalHours }]) => (
                  <React.Fragment key={date}>
                    {/* Entries for this date */}
                    {entries.map((ts, idx) => (
                      <tr 
                        key={ts.id} 
                        className={`${idx % 2 === 0 ? 'bg-gray-900' : 'bg-gray-900/50'} hover:bg-gray-800/50 transition-colors`}
                      >
                        {/* Proyecto */}
                        <td className="px-2 py-2">
                          <ClickableCell 
                            value={ts.projectName} 
                            fieldId={`${ts.id}-project`}
                          />
                        </td>
                        
                        {/* Ticket/Fase */}
                        <td className="px-2 py-2">
                          <ClickableCell 
                            value={ts.taskCode} 
                            fieldId={`${ts.id}-ticket`}
                            className="text-blue-400 font-mono"
                          />
                        </td>
                        
                        {/* Horas */}
                        <td className="px-2 py-2">
                          <ClickableCell 
                            value={ts.hoursWorked.toFixed(1)} 
                            fieldId={`${ts.id}-hours`}
                            className="text-right font-mono"
                          />
                        </td>
                        
                        {/* Fecha DD/MM/YY */}
                        <td className="px-2 py-2">
                          <ClickableCell 
                            value={formatDate(ts.workDate)} 
                            fieldId={`${ts.id}-date`}
                            className="font-mono"
                          />
                        </td>
                        
                        {/* Descripción */}
                        <td className="px-2 py-2 max-w-xs">
                          <ClickableCell 
                            value={ts.description} 
                            fieldId={`${ts.id}-desc`}
                          />
                        </td>
                        
                        {/* Estado - clickable button */}
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => handleToggleState(ts.id, ts.state)}
                            disabled={savingIds.has(ts.id)}
                            className={`
                              px-3 py-1 rounded-full text-xs font-medium transition-all
                              ${savingIds.has(ts.id) 
                                ? 'opacity-50 cursor-wait' 
                                : 'cursor-pointer hover:scale-105'
                              }
                              ${ts.state === 'FINAL' 
                                ? 'bg-green-900/50 text-green-400 border border-green-700 hover:bg-green-900' 
                                : 'bg-yellow-900/50 text-yellow-400 border border-yellow-700 hover:bg-yellow-900'
                              }
                            `}
                            title={ts.state === 'FINAL' ? 'Click para marcar como Borrador' : 'Click para marcar como Imputado'}
                          >
                            {savingIds.has(ts.id) 
                              ? '...' 
                              : ts.state === 'FINAL' 
                                ? 'Imputado' 
                                : 'Borrador'
                            }
                          </button>
                        </td>
                      </tr>
                    ))}
                    
                    {/* Daily subtotal row */}
                    <tr className="bg-gray-800/80 border-t-2 border-gray-600">
                      <td colSpan={2} className="px-4 py-2 text-right text-gray-400 text-xs font-medium italic">
                        Subtotal {formatDate(date)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className={`font-mono font-bold ${getHoursColorClass(totalHours)}`}>
                            {totalHours.toFixed(1)}
                          </span>
                          <span 
                            className={`w-2 h-2 rounded-full ${totalHours >= 8 ? 'bg-green-400' : 'bg-yellow-400'}`}
                            title={totalHours >= 8 ? '≥ 8 horas' : '< 8 horas'}
                          />
                        </div>
                      </td>
                      <td colSpan={3} className="px-4 py-2 text-gray-500 text-xs">
                        {entries.length} entrada{entries.length !== 1 ? 's' : ''}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer with totals */}
        <div className="px-6 py-3 border-t border-gray-700 bg-gray-800">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6 text-sm">
              <div className="text-gray-400">
                Total horas <span className="text-gray-500">({monthName} {selectedYear})</span>: 
                <span className="text-white font-mono font-semibold ml-1">{totalHours.toFixed(1)}</span>
              </div>
              <div className="text-gray-400">
                Imputadas: <span className="text-green-400 font-mono font-semibold">{totalImputadas.toFixed(1)}</span>
              </div>
              <div className="text-gray-400">
                Pendientes: <span className="text-yellow-400 font-mono font-semibold">{totalPendientes.toFixed(1)}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast 
          message={toast.message} 
          onClose={() => setToast(null)} 
        />
      )}
    </>
  );
}
