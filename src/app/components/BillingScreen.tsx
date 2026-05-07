'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Receipt,
  Send,
  FileText,
  Download,
  Trash2,
  Edit2,
  RotateCcw,
  Eye,
  X,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { BillingMethod, BillingRun, BillingPreview } from '@/lib/types';
import { Toast } from './Toast';
import { NoteEditorModal } from './NoteEditorModal';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function BillingScreen() {
  const { clients } = useApp();

  const now = new Date();
  const defaultBillingDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Selectors
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedYear, setSelectedYear] = useState(defaultBillingDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(defaultBillingDate.getMonth() + 1);
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [periodStartInput, setPeriodStartInput] = useState('');
  const [periodEndInput, setPeriodEndInput] = useState('');

  // Data
  const [methods, setMethods] = useState<BillingMethod[]>([]);
  const [preview, setPreview] = useState<BillingPreview | null>(null);
  const [billingRuns, setBillingRuns] = useState<BillingRun[]>([]);
  const [expandedPreviewDays, setExpandedPreviewDays] = useState<Set<string>>(new Set());

  // States
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [invoicing, setInvoicing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Edit request modal
  const [editingRun, setEditingRun] = useState<BillingRun | null>(null);
  const [editJson, setEditJson] = useState('');

  // PDF viewer
  const [viewingPdfId, setViewingPdfId] = useState<string | null>(null);

  // Notes
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeNoteClientId, setActiveNoteClientId] = useState<string | undefined>(undefined);
  const [noteLoading, setNoteLoading] = useState(false);

  // Also include standalone clients (no parent, no children but have timesheets)
  const topLevelClients = clients.filter(c => !c.disabled && !c.parentClientId);

  useEffect(() => {
    if (!selectedClientId && topLevelClients.length > 0) {
      const qualita = topLevelClients.find(c => c.name.toLowerCase() === 'qualita');
      setSelectedClientId(qualita?.id ?? topLevelClients[0].id);
    }
  }, [selectedClientId, topLevelClients]);

  useEffect(() => {
    const start = new Date(Date.UTC(selectedYear, selectedMonth - 1, 1));
    const end = new Date(Date.UTC(selectedYear, selectedMonth, 0));
    const startIso = start.toISOString().slice(0, 10);
    const endIso = end.toISOString().slice(0, 10);
    setPeriodStart(startIso);
    setPeriodEnd(endIso);
    setPeriodStartInput(formatTimelineDate(startIso));
    setPeriodEndInput(formatTimelineDate(endIso));
  }, [selectedYear, selectedMonth]);

  const formatTimelineDate = (isoDate: string) => {
    if (!isoDate) return '';
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  };

  const parseTimelineDate = (value: string): string | null => {
    const match = value.match(/^([0-3]\d)\/([0-1]\d)\/(\d{4})$/);
    if (!match) return null;
    const [, day, month, year] = match;
    const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    // preserve exactly dd/mm/yyyy semantics
    return iso;
  };

  // Fetch billing methods for selected parent client
  const fetchMethods = useCallback(async (clientParentId?: string) => {
    try {
      const params = new URLSearchParams();
      if (clientParentId) params.set('clientParentId', clientParentId);
      const res = await fetch(`/api/billing/methods?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMethods(data);
        if (data.length > 0) {
          setSelectedMethodId((current) => {
            if (current && data.some((method: BillingMethod) => method.id === current)) {
              return current;
            }
            return data[0].id;
          });
        } else {
          setSelectedMethodId('');
        }
      }
    } catch (err) {
      console.error('Error loading billing methods:', err);
    }
  }, []);

  // Fetch preview
  const fetchPreview = useCallback(async () => {
    if (!selectedClientId) {
      setPreview(null);
      return;
    }
    setLoadingPreview(true);
    try {
      const params = new URLSearchParams({
        clientParentId: selectedClientId,
        year: String(selectedYear),
        month: String(selectedMonth),
      });
      if (periodStart) params.set('periodStart', periodStart);
      if (periodEnd) params.set('periodEnd', periodEnd);

      const res = await fetch(`/api/billing/preview?${params.toString()}`);
      if (res.ok) {
        setPreview(await res.json());
      }
    } catch (err) {
      console.error('Error loading preview:', err);
    } finally {
      setLoadingPreview(false);
    }
  }, [selectedClientId, selectedYear, selectedMonth, periodStart, periodEnd]);

  // Fetch billing runs
  const fetchRuns = useCallback(async () => {
    setLoadingRuns(true);
    try {
      const params = new URLSearchParams();
      if (selectedClientId) params.set('clientParentId', selectedClientId);
      if (selectedYear) params.set('year', String(selectedYear));
      if (selectedMonth) params.set('month', String(selectedMonth));

      const res = await fetch(`/api/billing/runs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        // Enrich with client names
        const enriched = data.map((r: BillingRun) => ({
          ...r,
          clientName: clients.find(c => c.id === r.clientParentId)?.name || r.clientParentId,
        }));
        setBillingRuns(enriched);
      }
    } catch (err) {
      console.error('Error loading billing runs:', err);
    } finally {
      setLoadingRuns(false);
    }
  }, [selectedClientId, selectedYear, selectedMonth, clients]);

  useEffect(() => { fetchMethods(selectedClientId); }, [fetchMethods, selectedClientId]);
  useEffect(() => { fetchPreview(); }, [fetchPreview]);
  useEffect(() => { fetchRuns(); }, [fetchRuns]);
  useEffect(() => {
    setExpandedPreviewDays(new Set());
  }, [preview?.dailyEntries.length]);

  const togglePreviewDay = (date: string) => {
    setExpandedPreviewDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const formatPreviewDate = (date: string) => {
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  };

  // Handle invoice
  const handleInvoice = async () => {
    if (!selectedClientId || !selectedMethodId) {
      setToast({ message: 'Selecciona cliente y método de facturación', type: 'error' });
      return;
    }
    if (!preview || preview.totalHours === 0) {
      setToast({ message: 'No hay horas FINAL para facturar en este período', type: 'error' });
      return;
    }

    setInvoicing(true);
    try {
      const res = await fetch('/api/billing/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientParentId: selectedClientId,
          year: selectedYear,
          month: selectedMonth,
          methodId: selectedMethodId,
          periodStart,
          periodEnd,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({
          message: data.status === 'success'
            ? `Factura generada correctamente (${data.invoiceNumber})`
            : `Facturación completada con errores: ${data.errorText || 'Error desconocido'}`,
          type: data.status === 'success' ? 'success' : 'error',
        });
        fetchRuns();
      } else {
        setToast({ message: data.error || 'Error al facturar', type: 'error' });
      }
    } catch (error) {
      console.error('Error during billing:', error);
      setToast({ message: 'Error de conexión al facturar', type: 'error' });
    } finally {
      setInvoicing(false);
    }
  };

  // Handle resend
  const handleResend = async (run: BillingRun) => {
    setInvoicing(true);
    try {
      const res = await fetch('/api/billing/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientParentId: run.clientParentId,
          year: run.year,
          month: run.month,
          methodId: run.methodId,
          requestJsonOverride: run.requestJson,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({
          message: data.status === 'success' ? 'Factura reenviada correctamente' : `Reenvío con error: ${data.errorText}`,
          type: data.status === 'success' ? 'success' : 'error',
        });
        fetchRuns();
      } else {
        setToast({ message: data.error || 'Error al reenviar', type: 'error' });
      }
    } catch {
      setToast({ message: 'Error de conexión', type: 'error' });
    } finally {
      setInvoicing(false);
    }
  };

  // Handle edit request JSON
  const startEditRequest = (run: BillingRun) => {
    setEditingRun(run);
    setEditJson(JSON.stringify(run.requestJson, null, 2));
  };

  const saveEditRequest = async () => {
    if (!editingRun) return;
    try {
      const parsed = JSON.parse(editJson);
      const res = await fetch(`/api/billing/runs/${editingRun.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestJson: parsed }),
      });
      if (res.ok) {
        setToast({ message: 'Request actualizado', type: 'success' });
        setEditingRun(null);
        fetchRuns();
      }
    } catch {
      setToast({ message: 'JSON inválido', type: 'error' });
    }
  };

  const updateBillingRunFlags = async (run: BillingRun, validated?: boolean, sentToClient?: boolean) => {
    try {
      const res = await fetch(`/api/billing/runs/${run.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ validated, sentToClient }),
      });
      if (res.ok) {
        await res.json();
        setToast({ message: 'Factura actualizada', type: 'success' });
        fetchRuns();
      } else {
        const body = await res.json();
        setToast({ message: body.error || 'Error al actualizar factura', type: 'error' });
      }
    } catch {
      setToast({ message: 'Error de conexión', type: 'error' });
    }
  };

  const handleMarkValidated = async (run: BillingRun) => {
    if (run.validated) return;
    await updateBillingRunFlags(run, true, undefined);
  };

  const handleMarkSent = async (run: BillingRun) => {
    if (run.sentToClient) return;
    await updateBillingRunFlags(run, undefined, true);
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este registro de facturación?')) return;
    try {
      await fetch(`/api/billing/runs/${id}`, { method: 'DELETE' });
      setToast({ message: 'Registro eliminado', type: 'success' });
      fetchRuns();
    } catch {
      setToast({ message: 'Error al eliminar', type: 'error' });
    }
  };

  const openBillingRunNote = async (run: BillingRun) => {
    if (run.noteId) {
      setActiveNoteId(run.noteId);
      setActiveNoteClientId(run.clientParentId);
      return;
    }

    setNoteLoading(true);
    try {
      const title = run.invoiceNumber
        ? `Nota de factura ${run.invoiceNumber}`
        : `Nota de facturación ${run.year}-${String(run.month).padStart(2, '0')}`;

      const createRes = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'general',
          title,
          contentText: 'Nota asociada a la ejecución de facturación.',
          clientId: run.clientParentId,
        }),
      });

      if (!createRes.ok) {
        const errorBody = await createRes.json().catch(() => ({}));
        setToast({ message: errorBody.error || 'Error al crear la nota', type: 'error' });
        return;
      }

      const note = await createRes.json();
      const attachRes = await fetch(`/api/billing/runs/${run.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId: note.id }),
      });

      if (!attachRes.ok) {
        const errorBody = await attachRes.json().catch(() => ({}));
        setToast({ message: errorBody.error || 'Error al asociar la nota', type: 'error' });
        return;
      }

      setActiveNoteId(note.id);
      setActiveNoteClientId(run.clientParentId);
      fetchRuns();
    } catch (err) {
      console.error('Error creating billing note:', err);
      setToast({ message: 'Error de conexión al crear nota', type: 'error' });
    } finally {
      setNoteLoading(false);
    }
  };

  // Download PDF
  const downloadPdf = (runId: string, filename?: string) => {
    const a = document.createElement('a');
    a.href = `/api/billing/runs/${runId}/pdf`;
    a.download = filename || 'invoice.pdf';
    a.click();
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={14} className="text-green-400" />;
      case 'failed':
        return <AlertCircle size={14} className="text-red-400" />;
      default:
        return <Clock size={14} className="text-yellow-400" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'success': return 'Exitoso';
      case 'failed': return 'Fallido';
      default: return 'Pendiente';
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-950 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800 flex-shrink-0">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Receipt size={20} />
          Facturación
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Selectors */}
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Client */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Cliente Padre</label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full bg-gray-800 text-white px-3 py-2 rounded text-sm border border-gray-700"
              >
                <option value="">Seleccionar cliente...</option>
                {topLevelClients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Period Start */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Periodo desde</label>
              <input
                type="text"
                placeholder="dd/mm/YYYY"
                value={periodStartInput}
                onChange={(e) => setPeriodStartInput(e.target.value)}
                onBlur={() => {
                  const parsed = parseTimelineDate(periodStartInput);
                  if (parsed) {
                    setPeriodStart(parsed);
                  } else {
                    setPeriodStartInput(formatTimelineDate(periodStart));
                  }
                }}
                className="w-full bg-gray-800 text-white px-3 py-2 rounded text-sm border border-gray-700"
              />
            </div>

            {/* Period End */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Periodo hasta</label>
              <input
                type="text"
                placeholder="dd/mm/YYYY"
                value={periodEndInput}
                onChange={(e) => setPeriodEndInput(e.target.value)}
                onBlur={() => {
                  const parsed = parseTimelineDate(periodEndInput);
                  if (parsed) {
                    setPeriodEnd(parsed);
                  } else {
                    setPeriodEndInput(formatTimelineDate(periodEnd));
                  }
                }}
                className="w-full bg-gray-800 text-white px-3 py-2 rounded text-sm border border-gray-700"
              />
            </div>

            {/* Month */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Mes</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full bg-gray-800 text-white px-3 py-2 rounded text-sm border border-gray-700"
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>

            {/* Year */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Año</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full bg-gray-800 text-white px-3 py-2 rounded text-sm border border-gray-700"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Method */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Método de Facturación</label>
              <select
                value={selectedMethodId}
                onChange={(e) => setSelectedMethodId(e.target.value)}
                className="w-full bg-gray-800 text-white px-3 py-2 rounded text-sm border border-gray-700"
              >
                <option value="">Seleccionar método...</option>
                {methods.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Preview */}
        {selectedClientId && (
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h3 className="text-sm font-semibold text-white mb-3 flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="flex items-center gap-2">
                <FileText size={16} />
                Vista Previa — {preview?.clientName || '...'}
              </span>
              <span className="text-gray-500 font-normal">
                Factura: {MONTHS[selectedMonth - 1]} {selectedYear}
                {' • '}
                Periodo: {formatTimelineDate(preview?.periodStart || periodStart)} → {formatTimelineDate(preview?.periodEnd || periodEnd)}
              </span>
            </h3>

            {loadingPreview ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
                <Loader2 size={16} className="animate-spin" />
                Calculando horas...
              </div>
            ) : preview ? (
              <>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">{preview.totalHours.toFixed(1)}h</div>
                    <div className="text-xs text-gray-500">Total Horas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">{preview.entryCount}</div>
                    <div className="text-xs text-gray-500">Entries</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-400">{preview.entries.length}</div>
                    <div className="text-xs text-gray-500">Tareas</div>
                  </div>
                </div>

                {preview.dailyEntries.length > 0 && (
                  <div className="overflow-x-auto mb-4 border border-gray-700 rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wide">
                        <tr>
                          <th className="text-left py-2 px-2">Fecha</th>
                          <th className="text-left py-2 px-2">Imputaciones</th>
                          <th className="text-left py-2 px-2">Horas</th>
                          <th className="text-left py-2 px-2">Detalle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.dailyEntries.map((day) => {
                          const expanded = expandedPreviewDays.has(day.date);
                          return (
                            <React.Fragment key={day.date}>
                              <tr className="border-t border-gray-700 bg-gray-900 text-white text-sm">
                                <td className="py-2 px-2 font-mono">{formatPreviewDate(day.date)}</td>
                                <td className="py-2 px-2">{day.entries.length}</td>
                                <td className="py-2 px-2 font-mono">{day.totalHours.toFixed(1)}h</td>
                                <td className="py-2 px-2">
                                  <button
                                    type="button"
                                    onClick={() => togglePreviewDay(day.date)}
                                    className="text-xs text-blue-300 hover:text-blue-200"
                                  >
                                    {expanded ? 'Ocultar' : 'Ver'}
                                  </button>
                                </td>
                              </tr>
                              {expanded && (
                                <tr className="bg-gray-950">
                                  <td colSpan={4} className="p-0">
                                    <div className="overflow-x-auto">
                                      <table className="min-w-full text-[11px]">
                                        <thead className="text-gray-500 uppercase tracking-wide">
                                          <tr>
                                            <th className="text-left py-2 px-2 min-w-[84px]">Fecha</th>
                                            <th className="text-left py-2 px-2 min-w-[120px]">Proyecto</th>
                                            <th className="text-left py-2 px-2 min-w-[110px]">Ticket/Fase</th>
                                            <th className="text-right py-2 px-2 min-w-[60px]">Horas</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {day.entries.map((entry, idx) => (
                                            <tr key={idx} className="border-t border-gray-800 text-gray-300 text-sm">
                                              <td className="py-1 px-2 font-mono">{day.date.split('-').reverse().join('/')}</td>
                                              <td className="py-1 px-2 truncate max-w-[12rem]">{entry.projectName}</td>
                                              <td className="py-1 px-2 truncate max-w-[12rem]">{entry.taskCode || entry.taskTitle}</td>
                                              <td className="py-1 px-2 text-right font-mono">{entry.hours.toFixed(1)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Invoice button */}
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleInvoice}
                    disabled={invoicing || !selectedMethodId || preview.totalHours === 0}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
                  >
                    {invoicing ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                    {invoicing ? 'Facturando...' : 'Facturar'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-gray-500 text-sm py-4 text-center">
                No hay horas en estado FINAL para este período.
              </div>
            )}
          </div>
        )}

        {/* Billing Runs History */}
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Clock size={16} />
            Historial de Facturación
            {billingRuns.length > 0 && (
              <span className="text-xs text-gray-500 font-normal ml-1">({billingRuns.length})</span>
            )}
          </h3>

          {loadingRuns ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
              <Loader2 size={16} className="animate-spin" />
              Cargando...
            </div>
          ) : billingRuns.length === 0 ? (
            <div className="text-gray-500 text-sm py-6 text-center">
              No hay registros de facturación para los filtros seleccionados.
            </div>
          ) : (
            <div className="space-y-2">
              {billingRuns.map(run => (
                <div
                  key={run.id}
                  className="bg-gray-800 rounded-lg p-3 border border-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {statusIcon(run.status)}
                      <div className="min-w-0">
                        <div className="text-sm text-white flex items-center gap-2">
                          <span className="font-mono text-xs text-blue-400">#{run.invoiceNumber}</span>
                          <span className="truncate">{run.clientName}</span>
                          <span className="text-gray-500 text-xs">
                            {MONTHS[(run.month || 1) - 1]} {run.year}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2 mt-0.5">
                          <span>{run.totalHours.toFixed(1)}h</span>
                          {run.totalAmount && <span>{run.currency || 'EUR'} {run.totalAmount.toFixed(2)}</span>}
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-300">{statusLabel(run.status)}</span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-300">{run.methodName}</span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-300">{new Date(run.createdAt).toLocaleString()}</span>
                          {run.noteId && (
                            <span className="px-2 py-0.5 rounded-full bg-orange-950 border border-orange-700 text-xs text-orange-300">Nota registrada</span>
                          )}
                          {run.validated ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-600 text-xs text-emerald-300">Validada</span>
                          ) : (
                            <button
                              onClick={() => handleMarkValidated(run)}
                              className="px-2 py-0.5 rounded-full bg-yellow-950 border border-yellow-600 text-xs text-yellow-300 hover:bg-yellow-900"
                            >
                              Marcar validada
                            </button>
                          )}
                          {run.sentToClient ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-600 text-xs text-emerald-300">Enviada</span>
                          ) : (
                            <button
                              onClick={() => handleMarkSent(run)}
                              className="px-2 py-0.5 rounded-full bg-blue-950 border border-blue-600 text-xs text-blue-300 hover:bg-blue-900"
                            >
                              Marcar enviada
                            </button>
                          )}
                        </div>
                        {run.errorText && (
                          <div className="text-xs text-red-400 mt-1 truncate">{run.errorText}</div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <button
                        onClick={() => openBillingRunNote(run)}
                        disabled={noteLoading}
                        className="p-1.5 text-gray-400 hover:text-orange-400 rounded hover:bg-gray-700 disabled:opacity-50"
                        title={run.noteId ? 'Abrir nota de facturación' : 'Crear nota de facturación'}
                      >
                        <FileText size={14} />
                      </button>
                      {run.pdfFilename && (
                        <>
                          <button
                            onClick={() => setViewingPdfId(viewingPdfId === run.id ? null : run.id)}
                            className="p-1.5 text-gray-400 hover:text-blue-400 rounded hover:bg-gray-700"
                            title="Ver PDF"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => downloadPdf(run.id, run.pdfFilename)}
                            className="p-1.5 text-gray-400 hover:text-green-400 rounded hover:bg-gray-700"
                            title="Descargar PDF"
                          >
                            <Download size={14} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => startEditRequest(run)}
                        className="p-1.5 text-gray-400 hover:text-yellow-400 rounded hover:bg-gray-700"
                        title="Editar Request"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleResend(run)}
                        disabled={invoicing}
                        className="p-1.5 text-gray-400 hover:text-blue-400 rounded hover:bg-gray-700 disabled:opacity-50"
                        title="Reenviar"
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(run.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400 rounded hover:bg-gray-700"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Inline PDF viewer */}
                  {viewingPdfId === run.id && run.pdfFilename && (
                    <div className="mt-3 border-t border-gray-700 pt-3">
                      <iframe
                        src={`/api/billing/runs/${run.id}/pdf`}
                        className="w-full h-96 rounded bg-white"
                        title="PDF Viewer"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Request Modal */}
      {editingRun && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Editar Request JSON — #{editingRun.invoiceNumber}
              </h3>
              <button onClick={() => setEditingRun(null)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-4">
              <textarea
                value={editJson}
                onChange={(e) => setEditJson(e.target.value)}
                className="w-full h-full min-h-[300px] bg-gray-800 text-white px-3 py-2 rounded text-sm font-mono resize-none border border-gray-700"
              />
            </div>
            <div className="px-4 py-3 border-t border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setEditingRun(null)}
                className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={saveEditRequest}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-500 flex items-center gap-1"
              >
                <Send size={14} />
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {activeNoteId && (
        <NoteEditorModal
          noteId={activeNoteId}
          defaultClientId={activeNoteClientId}
          onClose={() => setActiveNoteId(null)}
          onSaved={() => {
            setToast({ message: 'Nota guardada', type: 'success' });
            fetchRuns();
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
