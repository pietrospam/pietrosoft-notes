'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, Check, X, Eye, EyeOff } from 'lucide-react';
import { IconPicker, DynamicIcon } from './IconPicker';
import { useApp } from '../context/AppContext';
import { CLIENT_COLORS } from '@/lib/colorPalette';
import type { Client } from '@/lib/types';

export function ClientsManager() {
  const { refreshClients: refreshGlobalClients } = useApp();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showDisabled, setShowDisabled] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formIcon, setFormIcon] = useState('building');
  const [formDescription, setFormDescription] = useState('');
  const [formColor, setFormColor] = useState('');
  const [formParentClientId, setFormParentClientId] = useState<string | null>(null);

  // Fetch clients
  const fetchClients = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/clients?includeDisabled=${showDisabled}`);
      if (res.ok) {
        setClients(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [showDisabled]);

  const resetForm = () => {
    setFormName('');
    setFormIcon('building');
    setFormDescription('');
    setFormColor('');
    setFormParentClientId(null);
    setEditingClient(null);
    setIsCreating(false);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormName(client.name);
    setFormIcon(client.icon);
    setFormDescription(client.description || '');
    setFormColor(client.color || '');
    setFormParentClientId(client.parentClientId || null);
    setIsCreating(false);
  };

  const handleCreate = () => {
    resetForm();
    setIsCreating(true);
    // Focus name input after state update
    setTimeout(() => nameInputRef.current?.focus(), 0);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;

    try {
      if (editingClient) {
        // Update
        const res = await fetch(`/api/clients/${editingClient.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            icon: formIcon,
            description: formDescription || undefined,
            color: formColor || undefined,
            parentClientId: formParentClientId || null,
          }),
        });
        if (res.ok) {
          fetchClients();
          refreshGlobalClients(); // Refresh sidebar
          resetForm();
        }
      } else {
        // Create
        const res = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            icon: formIcon,
            description: formDescription || undefined,
            color: formColor || undefined,
            parentClientId: formParentClientId || null,
          }),
        });
        if (res.ok) {
          fetchClients();
          refreshGlobalClients(); // Refresh sidebar
          resetForm();
        }
      }
    } catch (error) {
      console.error('Failed to save client:', error);
    }
  };

  const handleDisable = async (client: Client) => {
    if (!confirm(`Are you sure you want to ${client.disabled ? 'enable' : 'disable'} "${client.name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled: !client.disabled }),
      });
      if (res.ok) {
        fetchClients();
      }
    } catch (error) {
      console.error('Failed to toggle client:', error);
    }
  };

  if (isLoading) {
    return <div className="p-4 text-gray-500">Loading clients...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold text-white">Clients</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDisabled(!showDisabled)}
            className={`p-2 rounded-lg transition-colors ${
              showDisabled ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'
            }`}
            title={showDisabled ? 'Hide disabled' : 'Show disabled'}
          >
            {showDisabled ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
          >
            <Plus size={16} />
            New Client
          </button>
        </div>
      </div>

      {/* Form */}
      {(isCreating || editingClient) && (
        <div className="p-4 border-b border-gray-800 bg-gray-900/50">
          <h3 className="text-sm font-medium text-gray-400 mb-3">
            {editingClient ? 'Edit Client' : 'New Client'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name *</label>
              <input
                ref={nameInputRef}
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="Client name"
                autoFocus={isCreating}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="Optional description"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Icon *</label>
              <IconPicker value={formIcon} onChange={setFormIcon} />
            </div>
            {/* REQ-008.3: Color Picker */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Color</label>
              <div className="flex flex-wrap gap-1.5 p-2 bg-gray-800 border border-gray-700 rounded-lg max-h-24 overflow-y-auto">
                {CLIENT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormColor(color)}
                    className={`w-6 h-6 rounded-md transition-all ${
                      formColor === color 
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-800 scale-110' 
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              {formColor && (
                <p className="text-xs text-gray-500 mt-1">
                  Selected: <span style={{ color: formColor }}>{formColor}</span>
                </p>
              )}
            </div>
            {/* REQ-010: Parent Client selector for hierarchy */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cliente Padre</label>
              <select
                value={formParentClientId || ''}
                onChange={(e) => setFormParentClientId(e.target.value || null)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">Sin cliente padre (es cliente principal)</option>
                {clients
                  .filter(c => !c.disabled && c.id !== editingClient?.id && !c.parentClientId)
                  .map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Los sub-clientes aparecen agrupados bajo su cliente padre
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={resetForm}
                className="flex items-center gap-1 px-3 py-1.5 text-gray-400 hover:text-white text-sm transition-colors"
              >
                <X size={16} />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formName.trim()}
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
              >
                <Check size={16} />
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {clients.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No clients yet. Create your first client.
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {clients.map((client) => (
              <div
                key={client.id}
                className={`flex items-center gap-3 p-3 hover:bg-gray-800/50 transition-colors ${
                  client.disabled ? 'opacity-50' : ''
                }`}
              >
                {/* REQ-008.3: Color indicator */}
                {client.color && (
                  <div
                    className="w-3 h-8 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: client.color }}
                    title={client.color}
                  />
                )}
                <DynamicIcon icon={client.icon} className="text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{client.name}</p>
                  {client.description && (
                    <p className="text-xs text-gray-500 truncate">{client.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(client)}
                    className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors"
                    title="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDisable(client)}
                    className={`p-1.5 hover:bg-gray-700 rounded transition-colors ${
                      client.disabled 
                        ? 'text-green-500 hover:text-green-400' 
                        : 'text-gray-500 hover:text-red-400'
                    }`}
                    title={client.disabled ? 'Enable' : 'Disable'}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
