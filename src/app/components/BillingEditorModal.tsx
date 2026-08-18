'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, ChevronDown, Plus, Minus, Loader2 } from 'lucide-react';
import type { BillingMethod, BillingPreview, BillingRun } from '@/lib/types';
import { buildExternalPayload } from '@/lib/billing-utils';
import { useApp } from '../context/AppContext';

interface BillingItemDraft {
  id: string;
  name: string;
  quantity: number;
  unitCost: number;
  total: number;
  description?: string;
}

interface BillingEditorModalProps {
  open: boolean;
  billingRun?: BillingRun;
  clientId: string;
  clientName: string;
  onClose: () => void;
  onSaved: () => void;
}

const formatCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);

const parseIsoDate = (value?: string): Date | null => {
  if (!value) return null;
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0));
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const formatInvoiceTitle = (invoiceNumber: string) => {
  const match = invoiceNumber.match(/^([^0-9]*)([0-9]+)$/);
  if (!match) {
    return `Factura ${invoiceNumber}`;
  }
  const [, prefix, numberParts] = match;
  return `Factura ${prefix}${String(numberParts).padStart(8, '0')}`;
};

const parseAnyDateToIso = (value?: unknown): string | undefined => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return formatIsoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)));
};

const addDaysIso = (date: Date, days: number) => {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const lastDayOfMonthIso = (year: number, month: number) => formatIsoDate(new Date(Date.UTC(year, month, 0, 0, 0, 0, 0)));

const DEFAULT_BILLING_DATE = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
const DEFAULT_PERIOD_START = new Date(Date.UTC(DEFAULT_BILLING_DATE.getFullYear(), DEFAULT_BILLING_DATE.getMonth(), 1)).toISOString().slice(0, 10);
const DEFAULT_PERIOD_END = new Date(Date.UTC(DEFAULT_BILLING_DATE.getFullYear(), DEFAULT_BILLING_DATE.getMonth() + 1, 0)).toISOString().slice(0, 10);

export function BillingEditorModal({
  open,
  billingRun,
  clientId,
  // clientName, // kept in props interface but not used in body
  onClose,
  onSaved,
}: BillingEditorModalProps) {
  const { clients, openConfig } = useApp();
  const defaultPeriodStart = DEFAULT_PERIOD_START;
  const defaultPeriodEnd = DEFAULT_PERIOD_END;

  const [clientParentId, setClientParentId] = useState(billingRun?.clientParentId || clientId);
  const [methods, setMethods] = useState<BillingMethod[]>([]);
  const [preview, setPreview] = useState<BillingPreview | null>(null);
  const [methodId, setMethodId] = useState(billingRun?.methodId || '');
  const [invoiceTitle, setInvoiceTitle] = useState(billingRun?.invoiceTitle || '');
  const [invoiceNumber, setInvoiceNumber] = useState(billingRun?.invoiceNumber || '');
  const [invoiceNumberDirty, setInvoiceNumberDirty] = useState(false);
  const [invoiceTitleDirty, setInvoiceTitleDirty] = useState(false);
  const [invoiceDateIso, setInvoiceDateIso] = useState(lastDayOfMonthIso(DEFAULT_BILLING_DATE.getFullYear(), DEFAULT_BILLING_DATE.getMonth() + 1));
  const [invoiceDateDirty, setInvoiceDateDirty] = useState(false);
  const [dueDateIso, setDueDateIso] = useState('');
  const [dueDateDirty, setDueDateDirty] = useState(false);
  const [selectedYear, setSelectedYear] = useState(billingRun?.year ?? DEFAULT_BILLING_DATE.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(billingRun?.month ?? DEFAULT_BILLING_DATE.getMonth() + 1);
  const [periodStart, setPeriodStart] = useState(billingRun?.periodStart || defaultPeriodStart);
  const [periodEnd, setPeriodEnd] = useState(billingRun?.periodEnd || defaultPeriodEnd);
  const [currency, setCurrency] = useState(billingRun?.currency || 'EUR');
  const [exchangeRateUsd, setExchangeRateUsd] = useState<number | undefined>(billingRun?.exchangeRateUsd ?? (billingRun?.currency === 'EUR' ? undefined : 1));
  const [items, setItems] = useState<BillingItemDraft[]>([]);
  const invoiceDate = useMemo(() => {
    const parsed = parseIsoDate(invoiceDateIso);
    if (parsed) return parsed;
    return new Date(Date.UTC(selectedYear, selectedMonth, 0, 0, 0, 0, 0));
  }, [invoiceDateIso, selectedYear, selectedMonth]);

  const selectedMethod = useMemo(
    () => methods.find((method) => method.id === methodId),
    [methods, methodId]
  );
  const [saving, setSaving] = useState(false);
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const computedDueDateIso = useMemo(() => {
    if (!selectedMethod || selectedMethod.paymentTermDays <= 0) return '';
    return formatIsoDate(addDaysIso(invoiceDate, selectedMethod.paymentTermDays));
  }, [selectedMethod, invoiceDate]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showRequestJson, setShowRequestJson] = useState(false);
  const [requestJsonDraft, setRequestJsonDraft] = useState('');
  const [requestJsonDirty, setRequestJsonDirty] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const billingClients = clients.filter((client) => !client.disabled && !client.parentClientId);

  useEffect(() => {
    if (!open) return;
    if (billingRun) {
      setClientParentId(billingRun.clientParentId);
      setMethodId(billingRun.methodId);
      setInvoiceTitle(billingRun.invoiceTitle || '');
      setInvoiceNumber(billingRun.invoiceNumber || '');
      setInvoiceNumberDirty(false);
      setInvoiceTitleDirty(false);
      setSelectedYear(billingRun.year);
      setSelectedMonth(billingRun.month);
      setPeriodStart(billingRun.periodStart);
      setPeriodEnd(billingRun.periodEnd);
      setCurrency(billingRun.currency || 'EUR');
      setExchangeRateUsd(billingRun.exchangeRateUsd ?? (billingRun.currency === 'EUR' ? undefined : 1));
      setRequestJsonDirty(false);
      setShowRequestJson(false);
      setJsonError(null);

      const existingInvoiceDate = parseAnyDateToIso(
        billingRun.requestJson?.invoiceDate ?? billingRun.requestJson?.date ?? billingRun.requestJson?.fecha
      );
      setInvoiceDateIso(existingInvoiceDate || lastDayOfMonthIso(billingRun.year, billingRun.month));
      setInvoiceDateDirty(Boolean(existingInvoiceDate));

      const existingDueDate = parseAnyDateToIso(billingRun.requestJson?.due_date ?? billingRun.requestJson?.dueDate);
      setDueDateIso(existingDueDate ?? '');
      setDueDateDirty(Boolean(existingDueDate));
    } else {
      setClientParentId(clientId);
      setMethodId('');
      setInvoiceTitle('');
      setInvoiceNumber('');
      setInvoiceNumberDirty(false);
      setInvoiceTitleDirty(false);
      setInvoiceDateIso(lastDayOfMonthIso(DEFAULT_BILLING_DATE.getFullYear(), DEFAULT_BILLING_DATE.getMonth() + 1));
      setInvoiceDateDirty(false);
      setDueDateIso('');
      setDueDateDirty(false);
      setSelectedYear(DEFAULT_BILLING_DATE.getFullYear());
      setSelectedMonth(DEFAULT_BILLING_DATE.getMonth() + 1);
      setPeriodStart(defaultPeriodStart);
      setPeriodEnd(defaultPeriodEnd);
      setCurrency('EUR');
      setExchangeRateUsd(undefined);
      setItems([]);
      setRequestJsonDirty(false);
      setShowRequestJson(false);
      setJsonError(null);
    }
    setExpandedDays(new Set());
    setHoursExpanded(false);
  }, [open, billingRun, defaultPeriodEnd, defaultPeriodStart, clientId]);

  useEffect(() => {
    if (!open) return;
    const nextCurrency = selectedMethod?.currency || 'EUR';
    setCurrency(nextCurrency);
    if (nextCurrency === 'EUR') {
      if (!billingRun) {
        setExchangeRateUsd(undefined);
      }
    } else if (exchangeRateUsd === undefined) {
      setExchangeRateUsd(1);
    }
  }, [open, selectedMethod, billingRun, exchangeRateUsd]);

  useEffect(() => {
    if (!open || invoiceDateDirty) return;
    setInvoiceDateIso(lastDayOfMonthIso(selectedYear, selectedMonth));
  }, [open, selectedYear, selectedMonth, invoiceDateDirty]);

  useEffect(() => {
    if (!open || dueDateDirty) return;
    setDueDateIso(computedDueDateIso);
  }, [open, computedDueDateIso, dueDateDirty]);

  useEffect(() => {
    if (!open || billingRun || !methodId || invoiceNumberDirty) return;

    const fetchNextInvoiceNumber = async () => {
      try {
        const res = await fetch(`/api/billing/methods/${methodId}/next-number`);
        if (!res.ok) {
          const errorBody = await res.json().catch(() => null);
          console.error('Error fetching next invoice number:', errorBody);
          return;
        }
        const data = await res.json();
        if (typeof data.nextInvoiceNumber === 'string') {
          setInvoiceNumber(data.nextInvoiceNumber);
        }
      } catch (err) {
        console.error('Error fetching next invoice number:', err);
      }
    };

    fetchNextInvoiceNumber();
  }, [open, billingRun, methodId, invoiceNumberDirty]);

  useEffect(() => {
    if (!open || invoiceTitleDirty || !invoiceNumber) return;
    if (!invoiceTitle || invoiceTitle.startsWith('Factura')) {
      setInvoiceTitle(formatInvoiceTitle(invoiceNumber));
    }
  }, [open, invoiceNumber, invoiceTitleDirty, invoiceTitle]);

  const fetchMethods = useCallback(async () => {
    if (!clientParentId) return;
    try {
      const params = new URLSearchParams({ clientParentId });
      const res = await fetch(`/api/billing/methods?${params.toString()}`);
      if (res.ok) {
        setMethods(await res.json());
      }
    } catch (err) {
      console.error('Error loading billing methods:', err);
    }
  }, [clientParentId]);

  const fetchPreview = useCallback(async () => {
    if (!clientParentId || !periodStart || !periodEnd) {
      setPreview(null);
      return;
    }
    setLoadingPreview(true);
    try {
      const params = new URLSearchParams({
        clientParentId,
        year: String(selectedYear),
        month: String(selectedMonth),
        periodStart,
        periodEnd,
      });
      const res = await fetch(`/api/billing/preview?${params.toString()}`);
      if (res.ok) {
        setPreview(await res.json());
      }
    } catch (err) {
      console.error('Error loading billing preview:', err);
    } finally {
      setLoadingPreview(false);
    }
  }, [clientParentId, selectedYear, selectedMonth, periodStart, periodEnd]);

  useEffect(() => {
    if (!open) return;
    fetchMethods();
  }, [open, fetchMethods]);

  useEffect(() => {
    if (!open) return;
    fetchPreview();
  }, [open, fetchPreview]);

  useEffect(() => {
    if (billingRun?.items?.length) {
      setItems(billingRun.items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unitCost: item.unitCost,
        total: item.total,
        description: item.description,
      })));
      return;
    }

    if (preview) {
      const defaultItem = {
        id: 'default-item',
        name: 'Horas de servicio',
        quantity: preview.totalHours,
        unitCost: 35,
        total: preview.totalHours * 35,
      };
      setItems([defaultItem]);
    } else {
      setItems([]);
    }
  }, [billingRun, preview]);

  const buildRequestPayload = useCallback(() => {
    const effectiveCurrency = selectedMethod?.currency || currency || 'EUR';
    const payload: Record<string, unknown> = {
      clientParentId,
      year: selectedYear,
      month: selectedMonth,
      methodId,
      invoiceNumber,
      periodStart,
      periodEnd,
      totalHours: preview?.totalHours ?? 0,
      items: items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit_cost: item.unitCost,
        total: item.total,
        description: item.description,
      })),
    };
    if (effectiveCurrency) payload.currency = effectiveCurrency;
    return payload;
  }, [clientParentId, selectedYear, selectedMonth, methodId, invoiceNumber, periodStart, periodEnd, preview, items, currency, selectedMethod]);

  const buildExternalRequestPayload = useCallback(() => {
    const effectiveCurrency = selectedMethod?.currency || currency || 'EUR';
    const paymentTermDays = selectedMethod?.paymentTermDays || 0;
    const payload = selectedMethod && preview
      ? buildExternalPayload(
          selectedMethod.payloadTemplate ?? undefined,
          preview,
          invoiceNumber,
          invoiceDate,
          effectiveCurrency,
          paymentTermDays,
          items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unit_cost: item.unitCost,
            total: item.total,
            description: item.description,
          })),
          dueDateDirty ? dueDateIso : undefined
        )
      : buildRequestPayload();

    if (effectiveCurrency) payload.currency = effectiveCurrency;
    return payload;
  }, [selectedMethod, preview, invoiceNumber, invoiceDate, currency, dueDateDirty, items, buildRequestPayload, dueDateIso]);

  const getEffectiveRequestPayload = () => {
    if (requestJsonDirty) {
      try {
        return JSON.parse(requestJsonDraft);
      } catch {
        return buildExternalRequestPayload();
      }
    }
    return buildExternalRequestPayload();
  };

  useEffect(() => {
    if (!open || requestJsonDirty) return;

    if (billingRun?.requestJson) {
      setRequestJsonDraft(JSON.stringify(billingRun.requestJson, null, 2));
      setJsonError(null);
      return;
    }

    const initialPayload = buildExternalRequestPayload();
    setRequestJsonDraft(JSON.stringify(initialPayload, null, 2));
    setJsonError(null);
  }, [open, requestJsonDirty, billingRun, buildExternalRequestPayload]);

  useEffect(() => {
    if (!open || requestJsonDirty) return;
    if (!invoiceDateDirty && !dueDateDirty) return;
    const updatedPayload = buildExternalRequestPayload();
    setRequestJsonDraft(JSON.stringify(updatedPayload, null, 2));
  }, [open, requestJsonDirty, invoiceDateDirty, dueDateDirty, buildExternalRequestPayload]);

  useEffect(() => {
    if (!open || billingRun) return;
    if (!invoiceNumber && methodId) {
      const method = methods.find((method) => method.id === methodId);
      if (method) {
        setInvoiceNumber(`${method.invoicePrefix || ''}${String(method.nextInvoiceNumber).padStart(8, '0')}`);
      }
    }
  }, [open, billingRun, invoiceNumber, methodId, methods]);

  useEffect(() => {
    if (!open || invoiceTitleDirty) return;
    if (!invoiceTitle && invoiceNumber) {
      setInvoiceTitle(`Factura ${invoiceNumber}`);
    }
  }, [open, invoiceNumber, invoiceTitleDirty, invoiceTitle]);

  const updateItem = (id: string, field: keyof Omit<BillingItemDraft, 'id'>, value: string) => {
    setItems((current) => current.map((item) => {
      if (item.id !== id) return item;
      const next = { ...item };
      if (field === 'name') next.name = value;
      if (field === 'description') next.description = value;
      if (field === 'quantity' || field === 'unitCost') {
        const numeric = Number(value);
        next[field] = Number.isNaN(numeric) ? 0 : numeric;
      }
      next.total = next.quantity * next.unitCost;
      return next;
    }));
  };

  const addItem = () => {
    setItems((current) => [
      ...current,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: '',
        quantity: 0,
        unitCost: 0,
        total: 0,
      },
    ]);
  };

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const getItemTotal = () => items.reduce((sum, item) => sum + item.total, 0);

  const saveDraft = async (newState: BillingRun['invoiceState'] = 'borrador') => {
    if (!clientParentId || !methodId) return;
    if (jsonError) {
      setToast({ message: 'JSON inválido. Corrige antes de guardar.', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const effectivePayload = getEffectiveRequestPayload();
      const body = {
        ...buildRequestPayload(),
        requestJsonOverride: effectivePayload,
        invoiceTitle: invoiceTitle.trim() || null,
        saveAsDraft: true,
        invoiceState: newState,
      } as Record<string, unknown>;

      const endpoint = billingRun ? `/api/billing/runs/${billingRun.id}` : '/api/billing/runs';
      const method = billingRun ? 'PUT' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setToast({ message: 'Factura guardada', type: 'success' });
        onSaved();
        onClose();
      } else {
        const data = await res.json();
        setToast({ message: data.error || 'Error al guardar', type: 'error' });
      }
    } catch (err) {
      console.error('Error saving draft billing:', err);
      setToast({ message: 'Error de conexión', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const sendInvoice = async () => {
    if (!clientParentId || !methodId) return;
    if (jsonError) {
      setToast({ message: 'JSON inválido. Corrige antes de enviar.', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const effectivePayload = getEffectiveRequestPayload();
      const body = {
        ...buildRequestPayload(),
        requestJsonOverride: effectivePayload,
        invoiceTitle: invoiceTitle.trim() || null,
      } as Record<string, unknown>;

      const endpoint = '/api/billing/runs';
      const payload = billingRun
        ? { ...body, runId: billingRun.id }
        : { ...body };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setToast({ message: 'Factura enviada', type: 'success' });
        onSaved();
        onClose();
      } else {
        const data = await res.json();
        setToast({ message: data.error || 'Error al enviar', type: 'error' });
      }
    } catch (err) {
      console.error('Error sending billing:', err);
      setToast({ message: 'Error de conexión', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="w-full">
      <div className="w-full bg-gray-900 rounded-lg border border-gray-700 overflow-hidden shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-gray-700 gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">
              {billingRun ? 'Editar factura' : 'Nueva factura'}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cliente Padre</label>
              <select
                value={clientParentId}
                onChange={(e) => {
                  setClientParentId(e.target.value);
                  setMethodId('');
                  setInvoiceNumber('');
                  setInvoiceNumberDirty(false);
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
              >
                <option value="">Seleccionar cliente...</option>
                {billingClients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Método</label>
              <select
                value={methodId}
                onChange={(e) => {
                  const selected = e.target.value;
                  if (selected === '__create_new__') {
                    setMethodId('');
                    openConfig('billing', true);
                    return;
                  }
                  setMethodId(selected);
                  if (!invoiceNumberDirty) {
                    setInvoiceNumber('');
                  }
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
              >
                <option value="">Seleccionar método...</option>
                {methods.map((method) => (
                  <option key={method.id} value={method.id}>{method.name}</option>
                ))}
                <option value="__create_new__">Crear nuevo método...</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Mes</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
              >
                {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Año</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
              >
                {[2024, 2025, 2026, 2027].map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Periodo desde</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => {
                  setPeriodStart(e.target.value);
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Periodo hasta</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => {
                  setPeriodEnd(e.target.value);
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Número de factura</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => {
                  setInvoiceNumber(e.target.value);
                  setInvoiceNumberDirty(true);
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Título de factura</label>
              <input
                type="text"
                value={invoiceTitle}
                onChange={(e) => {
                  setInvoiceTitle(e.target.value);
                  setInvoiceTitleDirty(true);
                }}
                placeholder={invoiceNumber ? formatInvoiceTitle(invoiceNumber) : `Factura ${selectedYear}-${String(selectedMonth).padStart(2, '0')}`}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fecha de factura</label>
              <input
                type="date"
                value={invoiceDateIso}
                onChange={(e) => {
                  setInvoiceDateIso(e.target.value);
                  setInvoiceDateDirty(true);
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fecha de vencimiento</label>
              <input
                type="date"
                value={dueDateIso}
                onChange={(e) => {
                  setDueDateIso(e.target.value);
                  setDueDateDirty(true);
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Moneda del método</label>
              <div className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white">
                {selectedMethod?.currency || currency || 'EUR'}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Relación tipo de cambio USD</label>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={exchangeRateUsd ?? ''}
                onChange={(e) => setExchangeRateUsd(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500">Horas</p>
                <p className="text-sm text-white">{preview ? preview.totalHours.toFixed(1) : '0.0'}h totales</p>
              </div>
              <button
                type="button"
                onClick={() => setHoursExpanded((current) => !current)}
                className="flex items-center gap-1 text-xs text-blue-300 hover:text-blue-200"
              >
                {hoursExpanded ? 'Ocultar desglose' : 'Ver desglose'}
                <ChevronDown size={14} className={`${hoursExpanded ? 'rotate-180' : ''} transition-transform`} />
              </button>
            </div>
            {loadingPreview ? (
              <div className="text-sm text-gray-400 py-2 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Cargando horas...
              </div>
            ) : preview ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-4 text-sm text-gray-300">
                  <div>Total horas: <strong className="text-white">{preview.totalHours.toFixed(1)}</strong></div>
                  <div>Entradas: <strong className="text-white">{preview.entryCount}</strong></div>
                  <div>Días: <strong className="text-white">{preview.dailyEntries.length}</strong></div>
                </div>
                {hoursExpanded && (
                  <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-gray-800 bg-gray-900 p-2 text-sm text-gray-300">
                    {preview.dailyEntries.map((day) => {
                      const expanded = expandedDays.has(day.date);
                      return (
                        <div key={day.date} className="rounded-lg border border-gray-800 bg-gray-950 mb-2">
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedDays((current) => {
                                const next = new Set(current);
                                if (next.has(day.date)) next.delete(day.date);
                                else next.add(day.date);
                                return next;
                              });
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 text-left text-sm text-white"
                          >
                            <span>{day.date.split('-').reverse().join('/')}</span>
                            <span className="text-gray-400">{day.totalHours.toFixed(1)}h</span>
                          </button>
                          {expanded && (
                            <div className="border-t border-gray-800 px-3 py-2 space-y-2">
                              {day.entries.map((entry, idx) => (
                                <div key={`${day.date}-${idx}`} className="grid grid-cols-[1fr_1fr_auto] gap-2 text-[12px] text-gray-300">
                                  <span className="truncate">{entry.projectName}</span>
                                  <span className="truncate">{entry.taskCode || entry.taskTitle}</span>
                                  <span className="font-mono">{entry.hours.toFixed(1)}h</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500">Items de factura</p>
              </div>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 rounded text-xs text-white hover:bg-blue-500"
              >
                <Plus size={14} /> Agregar item
              </button>
            </div>
            <div className="space-y-0 divide-y divide-gray-800">
              {items.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-end py-2">
                  <div className="col-span-5">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                      placeholder="Descripción"
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm text-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm text-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitCost}
                      onChange={(e) => updateItem(item.id, 'unitCost', e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm text-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <div className="bg-gray-800 rounded px-2 py-2 text-sm text-white">{formatCurrency(item.total, currency || 'EUR')}</div>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-300">
                      <Minus size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between items-center text-sm text-gray-300">
              <span>Total items:</span>
              <span className="font-semibold text-white">{formatCurrency(getItemTotal(), currency || 'EUR')}</span>
            </div>
          </div>

          <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
            <button
              type="button"
              onClick={() => setShowRequestJson((current) => !current)}
              className="flex items-center justify-between w-full px-3 py-2 bg-gray-800 rounded text-sm text-white hover:bg-gray-700"
            >
              <span>Ver / editar Request JSON</span>
              <span className="text-gray-400">{showRequestJson ? 'Ocultar' : 'Mostrar'}</span>
            </button>
            {showRequestJson && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={requestJsonDraft}
                  onChange={(e) => {
                    setRequestJsonDraft(e.target.value);
                    setRequestJsonDirty(true);
                    try {
                      JSON.parse(e.target.value);
                      setJsonError(null);
                    } catch (err) {
                      setJsonError(err instanceof Error ? err.message : 'JSON inválido');
                    }
                  }}
                  className="w-full min-h-[220px] bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white font-mono resize-y"
                />
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>JSON enviado al servicio al guardar o facturar.</span>
                  {jsonError && <span className="text-red-400">{jsonError}</span>}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={() => saveDraft('borrador')}
              disabled={saving || Boolean(jsonError)}
              className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : 'Guardar borrador'}
            </button>
            <button
              type="button"
              onClick={sendInvoice}
              disabled={saving || Boolean(jsonError)}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-500 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : 'Facturar'}
            </button>
          </div>
          {toast && (
            <div className={`px-3 py-2 rounded text-sm ${toast.type === 'success' ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'}`}>
              {toast.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
