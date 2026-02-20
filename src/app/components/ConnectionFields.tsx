'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, Copy, Check, Eye, EyeOff, Plus } from 'lucide-react';
import { QuickCreateModal } from './QuickCreateModal';
import type { ConnectionNote, Client } from '@/lib/types';

interface ConnectionFieldsProps {
  note: ConnectionNote;
  onChange: (data: Partial<ConnectionNote>) => void;
}

export function ConnectionFields({ note, onChange }: ConnectionFieldsProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showCreateClient, setShowCreateClient] = useState(false);

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(setClients);
  }, []);

  const handleCopy = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const CopyButton = ({ field, value }: { field: string; value: string }) => (
    <button
      type="button"
      onClick={() => handleCopy(field, value)}
      className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors"
      title="Copy"
    >
      {copied === field ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Client Selection */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Client</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <select
              value={note.clientId || ''}
              onChange={(e) => onChange({ clientId: e.target.value || undefined })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 appearance-none"
            >
              <option value="">No client (general)</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>
          <button
            type="button"
            onClick={() => setShowCreateClient(true)}
            className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-blue-500 transition-colors"
            title="Create new client"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Quick Create Modal */}
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

      {/* URL */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">URL</label>
        <div className="flex gap-2">
          <input
            type="url"
            value={note.url || ''}
            onChange={(e) => onChange({ url: e.target.value || undefined })}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            placeholder="https://..."
          />
          {note.url && <CopyButton field="url" value={note.url} />}
        </div>
      </div>

      {/* Username */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Username</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={note.username || ''}
            onChange={(e) => onChange({ username: e.target.value || undefined })}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            placeholder="username or email"
          />
          {note.username && <CopyButton field="username" value={note.username} />}
        </div>
      </div>

      {/* Password */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Password</label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={note.password || ''}
              onChange={(e) => onChange({ password: e.target.value || undefined })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-10 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {note.password && <CopyButton field="password" value={note.password} />}
        </div>
      </div>

      {/* Security Notice */}
      <p className="text-xs text-yellow-600 flex items-center gap-1">
        ⚠️ Passwords are stored in plain text. Use only for non-critical credentials.
      </p>
    </div>
  );
}
