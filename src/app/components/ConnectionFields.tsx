'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, Eye, EyeOff, Plus } from 'lucide-react';
import { QuickCreateModal } from './QuickCreateModal';
import type { ConnectionNote, Client } from '@/lib/types';

interface ConnectionFieldsProps {
  note: ConnectionNote;
  onChange: (data: Partial<ConnectionNote>) => void;
}

export function ConnectionFields({ note, onChange }: ConnectionFieldsProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showCreateClient, setShowCreateClient] = useState(false);

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(setClients);
  }, []);

  return (
    <div className="space-y-4">
      {/* Row 1: Client - URL */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Cliente</label>
          <div className="flex gap-1">
            <div className="relative flex-1">
              <select
                value={note.clientId || ''}
                onChange={(e) => onChange({ clientId: e.target.value || undefined })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 appearance-none"
              >
                <option value="">Seleccionar...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
            <button
              type="button"
              onClick={() => setShowCreateClient(true)}
              className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-blue-500 transition-colors"
              title="Crear cliente"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">URL</label>
          <input
            type="url"
            value={note.url || ''}
            onChange={(e) => onChange({ url: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            placeholder="https://example.com"
          />
        </div>
      </div>

      {/* Row 2: Username - Password */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Usuario</label>
          <input
            type="text"
            value={note.username || ''}
            onChange={(e) => onChange({ username: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            placeholder="usuario"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Contraseña</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={note.password || ''}
              onChange={(e) => onChange({ password: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-10 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="••••••••"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Create Client Modal */}
      {showCreateClient && (
        <QuickCreateModal
          type="client"
          onCreated={(item) => {
            setClients(prev => [...prev, item as Client]);
            onChange({ clientId: item.id });
          }}
          onClose={() => setShowCreateClient(false)}
        />
      )}
    </div>
  );
}
