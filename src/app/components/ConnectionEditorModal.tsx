'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, Plus, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { BaseEditorModal } from './BaseEditorModal';
import { QuickCreateModal } from './QuickCreateModal';
import { useApp } from '../context/AppContext';
import type { Note, ConnectionNote, Client, Project } from '@/lib/types';

interface ConnectionEditorModalProps {
  noteId?: string;    // undefined = create mode
  onClose: () => void;
  onSaved?: () => void;
  inline?: boolean;
  onExpandToPopup?: () => void;
}

export function ConnectionEditorModal({ noteId, onClose, onSaved, inline = false, onExpandToPopup }: ConnectionEditorModalProps) {
  const { refreshClients } = useApp();
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);

  // Load clients and projects
  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(setClients);
    fetch('/api/projects').then(r => r.json()).then(setProjects);
  }, []);

  // Filter projects by selected client
  const filteredProjects = selectedClientId 
    ? projects.filter(p => p.clientId === selectedClientId)
    : projects;

  // Create default note for new notes
  const now = new Date().toISOString();
  const defaultNote: Note = {
    id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    type: 'connection',
    title: 'Nueva Conexión',
    contentText: '',
    contentJson: null,
    attachments: [],
    clientId: selectedClientId || undefined,
    projectId: selectedProjectId || undefined,
    url: url || undefined,
    username: username || undefined,
    password: password || undefined,
    isFavorite: false, // REQ-006
    createdAt: now,
    updatedAt: now,
  } as ConnectionNote;

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
      title="Copiar"
    >
      {copied === field ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
    </button>
  );

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedProjectId('');
  };

  const handleFieldsChange = (data: Partial<Note>) => {
    if ('clientId' in data) {
      setSelectedClientId(data.clientId || '');
      setSelectedProjectId('');
    }
    if ('projectId' in data) {
      setSelectedProjectId(data.projectId || '');
    }
    if ('url' in data) {
      setUrl((data as ConnectionNote).url || '');
    }
    if ('username' in data) {
      setUsername((data as ConnectionNote).username || '');
    }
    if ('password' in data) {
      setPassword((data as ConnectionNote).password || '');
    }
  };

  const fieldsComponent = (
    <div className="space-y-4">
      {/* Row 1: Client and Project */}
      <div className="grid grid-cols-2 gap-4">
        {/* Client Selection */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Cliente</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <select
                value={selectedClientId}
                onChange={(e) => handleClientChange(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 appearance-none"
              >
                <option value="">Sin cliente</option>
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
              title="Crear cliente"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Project Selection */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Proyecto</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 appearance-none"
                disabled={!selectedClientId}
              >
                <option value="">Sin proyecto</option>
                {filteredProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
            <button
              type="button"
              onClick={() => setShowCreateProject(true)}
              className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-blue-500 transition-colors"
              title="Crear proyecto"
              disabled={!selectedClientId}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: URL */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">URL</label>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            placeholder="https://..."
          />
          {url && <CopyButton field="url" value={url} />}
        </div>
      </div>

      {/* Row 3: Username and Password */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Usuario</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="usuario o email"
            />
            {username && <CopyButton field="username" value={username} />}
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Contraseña</label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-10 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="contraseña"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {password && <CopyButton field="password" value={password} />}
          </div>
        </div>
      </div>

      {/* Security Notice */}
      <p className="text-xs text-yellow-600 flex items-center gap-1">
        ⚠️ Las contraseñas se almacenan en texto plano. Usar solo para credenciales no críticas.
      </p>

      {/* Quick Create Modals */}
      {showCreateClient && (
        <QuickCreateModal
          type="client"
          onCreated={(item) => {
            setClients(prev => [...prev, item as Client]);
            setSelectedClientId(item.id);
            refreshClients(); // Refresh global clients list
          }}
          onClose={() => setShowCreateClient(false)}
        />
      )}

      {showCreateProject && selectedClientId && (
        <QuickCreateModal
          type="project"
          clientId={selectedClientId}
          onCreated={(item) => {
            setProjects(prev => [...prev, item as Project]);
            setSelectedProjectId(item.id);
            refreshClients(); // Refresh global clients/projects list
          }}
          onClose={() => setShowCreateProject(false)}
        />
      )}
    </div>
  );

  return (
    <BaseEditorModal
      noteId={noteId}
      defaultNote={{
        ...defaultNote,
        clientId: selectedClientId || undefined,
        projectId: selectedProjectId || undefined,
        url: url || undefined,
        username: username || undefined,
        password: password || undefined,
      } as Note}
      onClose={onClose}
      onSaved={onSaved}
      fieldsComponent={fieldsComponent}
      onFieldsChange={handleFieldsChange}
      inline={inline}
      onExpandToPopup={onExpandToPopup}
    />
  );
}
