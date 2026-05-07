'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, Edit2, Link2, Shield, Key, Copy } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { BillingMethod, BillingAuthType, BillingAuthConfig } from '@/lib/types';

const AUTH_TYPES: { value: BillingAuthType; label: string }[] = [
  { value: 'none', label: 'Sin autenticación' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'apiKeyHeader', label: 'API Key (Header)' },
  { value: 'apiKeyQuery', label: 'API Key (Query)' },
];

interface MethodFormState {
  name: string;
  endpointUrl: string;
  authType: BillingAuthType;
  authConfig: BillingAuthConfig;
  payloadTemplate: string; // JSON string for editing
  nextInvoiceNumber: number;
  invoicePrefix: string;
  clientParentId: string;
}

const emptyForm: MethodFormState = {
  name: '',
  endpointUrl: '',
  authType: 'none',
  authConfig: {},
  payloadTemplate: '',
  nextInvoiceNumber: 1,
  invoicePrefix: '',
  clientParentId: '',
};

export function BillingMethodsManager() {
  const { clients } = useApp();
  const parentClients = clients.filter(c => !c.disabled && !c.parentClientId);
  const [methods, setMethods] = useState<BillingMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<MethodFormState>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchMethods = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/methods');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setMethods(data);
    } catch {
      setError('No se pudieron cargar los métodos de facturación');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMethods(); }, [fetchMethods]);

  const startEdit = (method: BillingMethod) => {
    setEditingId(method.id);
    setShowCreate(false);
    setForm({
      name: method.name,
      endpointUrl: method.endpointUrl,
      authType: method.authType,
      authConfig: method.authConfig || {},
      payloadTemplate: method.payloadTemplate ? JSON.stringify(method.payloadTemplate, null, 2) : '',
      nextInvoiceNumber: method.nextInvoiceNumber ?? 1,
      invoicePrefix: method.invoicePrefix || '',
      clientParentId: method.clientParentId || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowCreate(false);
    setForm({ ...emptyForm });
    setError('');
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.endpointUrl.trim() || !form.clientParentId) {
      setError('Nombre, URL y cliente padre son requeridos');
      return;
    }

    let payloadTemplate: Record<string, unknown> | undefined;
    if (form.payloadTemplate.trim()) {
      try {
        payloadTemplate = JSON.parse(form.payloadTemplate);
      } catch {
        setError('El template de payload no es JSON válido');
        return;
      }
    }

    setSaving(true);
    setError('');
    try {
      const body = {
        name: form.name.trim(),
        endpointUrl: form.endpointUrl.trim(),
        authType: form.authType,
        authConfig: form.authConfig,
        payloadTemplate,
        nextInvoiceNumber: form.nextInvoiceNumber,
        invoicePrefix: form.invoicePrefix.trim() || undefined,
        clientParentId: form.clientParentId,
      };

      if (editingId) {
        const res = await fetch(`/api/billing/methods/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed to update');
      } else {
        const res = await fetch('/api/billing/methods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed to create');
      }
      cancelEdit();
      fetchMethods();
    } catch {
      setError('Error al guardar el método');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este método de facturación?')) return;
    try {
      const res = await fetch(`/api/billing/methods/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      fetchMethods();
    } catch {
      setError('Error al eliminar el método');
    }
  };

  const handleCopyMethod = async (method: BillingMethod) => {
    setError('');
    try {
      const body = {
        name: method.name.includes('(copia)') ? `${method.name}` : `${method.name} (copia)`,
        endpointUrl: method.endpointUrl,
        authType: method.authType,
        authConfig: method.authConfig || {},
        payloadTemplate: method.payloadTemplate ?? undefined,
        nextInvoiceNumber: method.nextInvoiceNumber ?? 1,
        invoicePrefix: method.invoicePrefix ?? undefined,
        clientParentId: method.clientParentId || '',
      };
      const res = await fetch('/api/billing/methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to copy');
      fetchMethods();
    } catch {
      setError('Error al copiar el método');
    }
  };

  const renderAuthFields = () => {
    switch (form.authType) {
      case 'bearer':
        return (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Token</label>
            <input
              type="password"
              value={form.authConfig.token || ''}
              onChange={(e) => setForm(f => ({ ...f, authConfig: { ...f.authConfig, token: e.target.value } }))}
              className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
              placeholder="sk_..."
            />
          </div>
        );
      case 'basic':
        return (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Usuario</label>
              <input
                type="text"
                value={form.authConfig.username || ''}
                onChange={(e) => setForm(f => ({ ...f, authConfig: { ...f.authConfig, username: e.target.value } }))}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Contraseña</label>
              <input
                type="password"
                value={form.authConfig.password || ''}
                onChange={(e) => setForm(f => ({ ...f, authConfig: { ...f.authConfig, password: e.target.value } }))}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
              />
            </div>
          </div>
        );
      case 'apiKeyHeader':
        return (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Header Name</label>
              <input
                type="text"
                value={form.authConfig.headerName || ''}
                onChange={(e) => setForm(f => ({ ...f, authConfig: { ...f.authConfig, headerName: e.target.value } }))}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
                placeholder="X-API-Key"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Header Value</label>
              <input
                type="password"
                value={form.authConfig.headerValue || ''}
                onChange={(e) => setForm(f => ({ ...f, authConfig: { ...f.authConfig, headerValue: e.target.value } }))}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
              />
            </div>
          </div>
        );
      case 'apiKeyQuery':
        return (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Query Param</label>
              <input
                type="text"
                value={form.authConfig.queryParam || ''}
                onChange={(e) => setForm(f => ({ ...f, authConfig: { ...f.authConfig, queryParam: e.target.value } }))}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
                placeholder="api_key"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Query Value</label>
              <input
                type="password"
                value={form.authConfig.queryValue || ''}
                onChange={(e) => setForm(f => ({ ...f, authConfig: { ...f.authConfig, queryValue: e.target.value } }))}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderForm = () => (
    <div className="bg-gray-800 rounded-lg p-4 space-y-3 border border-gray-700">
      <h4 className="text-sm font-semibold text-white">
        {editingId ? 'Editar Método' : 'Nuevo Método de Facturación'}
      </h4>

      {error && <div className="text-red-400 text-xs">{error}</div>}

      <div>
        <label className="block text-xs text-gray-400 mb-1">Cliente Padre</label>
        <select
          value={form.clientParentId}
          onChange={(e) => setForm(f => ({ ...f, clientParentId: e.target.value }))}
          className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
        >
          <option value="">Seleccionar cliente padre...</option>
          {parentClients.map(client => (
            <option key={client.id} value={client.id}>{client.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Nombre</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
          className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
          placeholder="Invoice Generator"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Endpoint URL</label>
        <input
          type="url"
          value={form.endpointUrl}
          onChange={(e) => setForm(f => ({ ...f, endpointUrl: e.target.value }))}
          className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
          placeholder="https://invoice-generator.com"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Tipo de Autenticación</label>
        <select
          value={form.authType}
          onChange={(e) => setForm(f => ({ ...f, authType: e.target.value as BillingAuthType, authConfig: {} }))}
          className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
        >
          {AUTH_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {form.authType !== 'none' && renderAuthFields()}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Prefijo Nro. Factura</label>
          <input
            type="text"
            value={form.invoicePrefix}
            onChange={(e) => setForm(f => ({ ...f, invoicePrefix: e.target.value }))}
            className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
            placeholder="FAC-"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Próximo Nro. Factura</label>
          <input
            type="number"
            min={1}
            value={form.nextInvoiceNumber}
            onChange={(e) => setForm(f => ({ ...f, nextInvoiceNumber: Math.max(1, parseInt(e.target.value) || 1) }))}
            className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">
          Payload Template (JSON) — usar {'{{invoiceNumber}}'}, {'{{date}}'}, {'{{clientName}}'}, {'{{totalHours}}'}, {'{{hours}}'} como placeholders
        </label>
        <textarea
          value={form.payloadTemplate}
          onChange={(e) => setForm(f => ({ ...f, payloadTemplate: e.target.value }))}
          className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm font-mono h-48 resize-y"
          placeholder='{"number":"{{invoiceNumber}}","date":"{{date}}","items":[{"name":"Desarrollo","quantity":"{{hours}}","unit_cost":35}]}'
        />
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={cancelEdit}
          className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 flex items-center gap-1"
        >
          <Save size={14} />
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Key size={20} />
          Métodos de Facturación
        </h3>
        {!showCreate && !editingId && (
          <button
            onClick={() => { setShowCreate(true); setEditingId(null); setForm({ ...emptyForm }); }}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-500 flex items-center gap-1"
          >
            <Plus size={14} />
            Nuevo
          </button>
        )}
      </div>

      {(showCreate || editingId) && renderForm()}

      {loading ? (
        <div className="text-gray-500 text-sm">Cargando...</div>
      ) : methods.length === 0 ? (
        <div className="text-gray-500 text-sm text-center py-8">
          No hay métodos de facturación configurados.
        </div>
      ) : (
        <div className="space-y-2">
          {methods.map(method => (
            <div
              key={method.id}
              className={`bg-gray-800 rounded-lg p-3 border ${editingId === method.id ? 'border-blue-500' : 'border-gray-700'}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link2 size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-white truncate">{method.name}</span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Shield size={10} />
                      {AUTH_TYPES.find(t => t.value === method.authType)?.label || method.authType}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 truncate mt-0.5 pl-5">
                    {method.endpointUrl}
                    <span className="ml-2 text-gray-600">|
                      Nro: {method.invoicePrefix || ''}{String(method.nextInvoiceNumber).padStart(8, '0')}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 truncate mt-0.5 pl-5">
                    Cliente Padre: {method.clientName || 'Sin asignar'}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  <button
                    onClick={() => startEdit(method)}
                    className="p-1.5 text-gray-400 hover:text-blue-400 rounded hover:bg-gray-700"
                    title="Editar"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleCopyMethod(method)}
                    className="p-1.5 text-gray-400 hover:text-yellow-400 rounded hover:bg-gray-700"
                    title="Copiar método"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(method.id)}
                    className="p-1.5 text-gray-400 hover:text-red-400 rounded hover:bg-gray-700"
                    title="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
