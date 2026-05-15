'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Receipt,
  FileText,
  Download,
  Trash2,
  Edit2,
  RotateCcw,
  Eye,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  Lock,
  Unlock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { BillingRun } from '@/lib/types';
import { Toast } from './Toast';
import { NoteEditorModal } from './NoteEditorModal';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function BillingScreen() {
  const { clients, selectedClientId, openBillingEditor, openConfig } = useApp();

  // Data
  const [billingRuns, setBillingRuns] = useState<BillingRun[]>([]);

  // States
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [invoicing, setInvoicing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // PDF viewer
  const [viewingPdfId, setViewingPdfId] = useState<string | null>(null);

  // Notes
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeNoteClientId, setActiveNoteClientId] = useState<string | undefined>(undefined);
  const [noteLoading, setNoteLoading] = useState(false);
  const [openBillingNoteAttachments, setOpenBillingNoteAttachments] = useState(false);

  // Also include standalone clients (no parent, no children but have timesheets)
  const openNewBillingEditor = () => {
    openBillingEditor(null);
  };

  // Fetch billing runs
  const fetchRuns = useCallback(async () => {
    setLoadingRuns(true);
    try {
      const params = new URLSearchParams();
      if (selectedClientId) params.set('clientParentId', selectedClientId);

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
  }, [selectedClientId, clients]);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  const formatCurrency = (amount: number, currency: string = 'EUR') =>
    new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);

  const getInvoiceJsonDate = (run: BillingRun): string | null => {
    const jsonDate = run.requestJson?.invoiceDate ?? run.requestJson?.date ?? run.requestJson?.fecha;
    if (!jsonDate || typeof jsonDate !== 'string') return null;
    const parsed = new Date(jsonDate);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('es-ES');
    }
    return jsonDate;
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

  const updateBillingRunFlags = async (run: BillingRun, validated?: boolean, sentToClient?: boolean, locked?: boolean) => {
    try {
      const payload: Record<string, unknown> = {};
      if (validated !== undefined) payload.validated = validated;
      if (sentToClient !== undefined) payload.sentToClient = sentToClient;
      if (locked !== undefined) payload.locked = locked;

      const res = await fetch(`/api/billing/runs/${run.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

  const handleToggleLock = async (run: BillingRun) => {
    await updateBillingRunFlags(run, undefined, undefined, !run.locked);
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
      const title = run.invoiceTitle
      ? `Nota de factura: ${run.invoiceTitle}`
      : run.invoiceNumber
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
      setOpenBillingNoteAttachments(true);
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
    a.href = `/api/billing/runs/${runId}/pdf?download=true`;
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
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 flex flex-wrap gap-3 justify-start">
          <button
            type="button"
            onClick={openNewBillingEditor}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
          >
            <span>Nueva factura</span>
          </button>
          <button
            type="button"
            onClick={() => openConfig('billing', true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600"
          >
            <span>Métodos de facturación</span>
          </button>
        </div>

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
                        <div className="text-sm text-white flex flex-wrap items-center gap-2">
                          <span className="truncate">{run.clientName}</span>
                          <span className="text-gray-500 text-xs">
                            {MONTHS[(run.month || 1) - 1]} {run.year}
                          </span>
                          {getInvoiceJsonDate(run) && (
                            <span className="text-gray-300 text-xs">· {getInvoiceJsonDate(run)}</span>
                          )}
                          {run.validated ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-600 text-xs text-emerald-300">Validada</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-yellow-950 border border-yellow-600 text-xs text-yellow-300">Borrador</span>
                          )}
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-300">{run.methodName}</span>
                        </div>
                        <div className="text-xs text-slate-300 mt-1 leading-snug flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-blue-400">#{run.invoiceNumber}</span>
                          {run.invoiceTitle && <span>{run.invoiceTitle}</span>}
                          {run.totalAmount !== undefined && (
                            <span className="ml-auto text-gray-300 text-xs">{formatCurrency(run.totalAmount, run.currency || 'EUR')}</span>
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
                        onClick={() => openBillingEditor(run)}
                        disabled={run.locked}
                        className="p-1.5 text-gray-400 hover:text-yellow-400 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={run.locked ? 'Registro bloqueado' : 'Editar factura'}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleResend(run)}
                        disabled={invoicing || run.locked}
                        className="p-1.5 text-gray-400 hover:text-blue-400 rounded hover:bg-gray-700 disabled:opacity-50"
                        title="Reenviar"
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(run.id)}
                        disabled={run.locked}
                        className="p-1.5 text-gray-400 hover:text-red-400 rounded hover:bg-gray-700 disabled:opacity-50"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button
                        onClick={() => handleToggleLock(run)}
                        className={
                          `p-1.5 rounded hover:bg-gray-700 ${run.locked ? 'text-red-400 hover:text-red-400' : 'text-gray-400 hover:text-indigo-400'}`
                        }
                        title={run.locked ? 'Desbloquear registro' : 'Bloquear registro'}
                      >
                        {run.locked ? <Unlock size={14} /> : <Lock size={14} />}
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

      {activeNoteId && (
        <NoteEditorModal
          noteId={activeNoteId}
          defaultClientId={activeNoteClientId}
          openAttachmentsOnOpen={openBillingNoteAttachments}
          onClose={() => {
            setActiveNoteId(null);
            setOpenBillingNoteAttachments(false);
          }}
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
