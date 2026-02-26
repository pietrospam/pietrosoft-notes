'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { BaseEditorModal } from './BaseEditorModal';
import { QuickCreateModal } from './QuickCreateModal';
import { useApp } from '../context/AppContext';
import type { Note, Client, Project } from '@/lib/types';

interface NoteEditorModalProps {
  noteId?: string;    // undefined = create mode
  onClose: () => void;
  onSaved?: () => void;
  inline?: boolean;
  onExpandToPopup?: () => void;
  defaultClientId?: string;
  defaultProjectId?: string;
}

export function NoteEditorModal({ noteId, onClose, onSaved, inline = false, onExpandToPopup, defaultClientId, defaultProjectId }: NoteEditorModalProps) {
  const { refreshClients } = useApp();
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(defaultClientId || '');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(defaultProjectId || '');
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);

  // Load clients and projects
  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(setClients);
    fetch('/api/projects').then(r => r.json()).then(async (allProjects) => {
      setProjects(allProjects);
      // Auto-select "General" project if client is selected but no project
      if (defaultClientId && !defaultProjectId) {
        const generalProject = allProjects.find(
          (p: Project) => p.clientId === defaultClientId && p.name === 'General'
        );
        if (generalProject) {
          setSelectedProjectId(generalProject.id);
        }
      }
    });
  }, [defaultClientId, defaultProjectId]);

  // Filter projects by selected client
  const filteredProjects = selectedClientId 
    ? projects.filter(p => p.clientId === selectedClientId)
    : projects;

  // Create default note for new notes
  const now = new Date().toISOString();
  const defaultNote: Note = {
    id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    type: 'general',
    title: 'Nueva Nota',
    contentText: '',
    contentJson: null,
    attachments: [],
    clientId: selectedClientId || undefined,
    projectId: selectedProjectId || undefined,
    isFavorite: false, // REQ-006
    createdAt: now,
    updatedAt: now,
  };

  const handleClientChange = (clientId: string, trackChange?: (data: Partial<Note>) => void) => {
    setSelectedClientId(clientId);
    // Auto-select "General" project if it exists for this client
    const generalProject = projects.find(
      (p: Project) => p.clientId === clientId && p.name === 'General'
    );
    const newProjectId = generalProject?.id || '';
    setSelectedProjectId(newProjectId);
    trackChange?.({ clientId: clientId || undefined, projectId: newProjectId || undefined });
  };

  const handleFieldsChange = (data: Partial<Note>) => {
    if ('clientId' in data) {
      setSelectedClientId(data.clientId || '');
      setSelectedProjectId('');
    }
    if ('projectId' in data) {
      setSelectedProjectId(data.projectId || '');
    }
  };

  const renderFields = (trackChange: (data: Partial<Note>) => void) => (
    <div className="grid grid-cols-2 gap-4">
      {/* Client Selection */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Cliente</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <select
              value={selectedClientId}
              onChange={(e) => handleClientChange(e.target.value, trackChange)}
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
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                trackChange({ projectId: e.target.value || undefined });
              }}
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
      }}
      onClose={onClose}
      onSaved={onSaved}
      fieldsComponent={renderFields}
      onFieldsChange={handleFieldsChange}
      inline={inline}
      onExpandToPopup={onExpandToPopup}
    />
  );
}
