'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { IconPicker } from './IconPicker';

interface QuickCreateModalProps {
  type: 'client' | 'project';
  clientId?: string; // Required when creating a project
  onCreated: (item: { id: string; name: string }) => void;
  onClose: () => void;
}

export function QuickCreateModal({ type, clientId, onCreated, onClose }: QuickCreateModalProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Folder');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (type === 'project' && !clientId) {
      setError('Client is required for projects');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const endpoint = type === 'client' ? '/api/clients' : '/api/projects';
      const body = type === 'client' 
        ? { name: name.trim(), icon }
        : { name: name.trim(), icon, clientId };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error('Failed to create');
      }

      const created = await response.json();
      onCreated({ id: created.id, name: created.name });
      onClose();
    } catch {
      setError('Failed to create. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            Create New {type === 'client' ? 'Client' : 'Project'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder={type === 'client' ? 'Client name...' : 'Project name...'}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Icon</label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              {saving ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
