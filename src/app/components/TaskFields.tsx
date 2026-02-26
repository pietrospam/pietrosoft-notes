'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { QuickCreateModal } from './QuickCreateModal';
import { Toast } from './Toast';
import type { TaskNote, Client, Project, TaskStatus, TaskPriority } from '@/lib/types';

const STATUSES: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'NONE', label: 'None', color: 'bg-gray-500' },
  { value: 'PENDING', label: 'Pending', color: 'bg-yellow-500' },
  { value: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-500' },
  { value: 'COMPLETED', label: 'Completed', color: 'bg-green-500' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'bg-gray-600' },
];

const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'LOW', label: 'Low', color: 'text-gray-400' },
  { value: 'MEDIUM', label: 'Medium', color: 'text-yellow-400' },
  { value: 'HIGH', label: 'High', color: 'text-orange-400' },
  { value: 'CRITICAL', label: 'Critical', color: 'text-red-400' },
];

interface TaskFieldsProps {
  note: TaskNote;
  onChange: (data: Partial<TaskNote>) => void;
}

export function TaskFields({ note, onChange }: TaskFieldsProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [toast, setToast] = useState<{ message: string } | null>(null);

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(setClients);
  }, []);

  useEffect(() => {
    if (note.projectId) {
      // Find the client for this project
      fetch('/api/projects').then(r => r.json()).then((allProjects: Project[]) => {
        const project = allProjects.find(p => p.id === note.projectId);
        if (project) {
          setSelectedClientId(project.clientId);
          setProjects(allProjects.filter(p => p.clientId === project.clientId));
        }
      });
    }
  }, [note.projectId]);

  const handleClientChange = async (clientId: string) => {
    setSelectedClientId(clientId);
    if (clientId) {
      const res = await fetch(`/api/projects?clientId=${clientId}`);
      const projectsList: Project[] = await res.json();
      setProjects(projectsList);
      // Auto-select "General" project if it exists
      const generalProject = projectsList.find((p: Project) => p.name === 'General');
      onChange({ projectId: generalProject?.id || '' });
    } else {
      setProjects([]);
      onChange({ projectId: '' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Validation Summary */}
      {(!note.projectId || !note.ticketPhaseCode || !note.shortDescription) && (
        <div className="p-2 bg-yellow-900/30 border border-yellow-700/50 rounded-lg text-xs text-yellow-400">
          <span className="font-medium">Missing required fields: </span>
          {[
            !note.projectId && 'Project',
            !note.ticketPhaseCode && 'Ticket/Phase Code',
            !note.shortDescription && 'Short Description',
          ].filter(Boolean).join(', ')}
        </div>
      )}

      {/* Row 1: Ticket/Phase - Short Description - Due Date - Budget */}
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Ticket/Fase *</label>
          <input
            type="text"
            value={note.ticketPhaseCode || ''}
            onChange={(e) => onChange({ ticketPhaseCode: e.target.value })}
            className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 ${
              !note.ticketPhaseCode ? 'border-yellow-600' : 'border-gray-700'
            }`}
            placeholder="TASK-001"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Descripción *</label>
          <input
            type="text"
            value={note.shortDescription || ''}
            onChange={(e) => onChange({ shortDescription: e.target.value })}
            className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 ${
              !note.shortDescription ? 'border-yellow-600' : 'border-gray-700'
            }`}
            placeholder="Descripción breve"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Fecha límite</label>
          <input
            type="date"
            value={note.dueDate?.split('T')[0] || ''}
            onChange={(e) => onChange({ dueDate: e.target.value || undefined })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Horas presup.</label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={note.budgetHours ?? ''}
            onChange={(e) => onChange({ budgetHours: e.target.value ? parseFloat(e.target.value) : null })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            placeholder="0"
          />
        </div>
      </div>

      {/* Row 2: Client - Project - Status - Priority */}
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Cliente</label>
          <div className="flex gap-1">
            <div className="relative flex-1">
              <select
                value={selectedClientId}
                onChange={(e) => handleClientChange(e.target.value)}
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
              title="Nuevo cliente"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Proyecto *</label>
          <div className="flex gap-1">
            <div className="relative flex-1">
              <select
                value={note.projectId || ''}
                onChange={(e) => onChange({ projectId: e.target.value })}
                disabled={!selectedClientId}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 appearance-none disabled:opacity-50"
              >
                <option value="">Seleccionar...</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
            <button
              type="button"
              onClick={() => setShowCreateProject(true)}
              disabled={!selectedClientId}
              className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-blue-500 transition-colors disabled:opacity-50"
              title="Nuevo proyecto"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Estado</label>
          <div className="flex flex-wrap gap-1">
            {STATUSES.map(s => (
              <button
                key={s.value}
                type="button"
                onClick={() => onChange({ status: s.value })}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  note.status === s.value
                    ? `${s.color} text-white`
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Prioridad</label>
          <div className="flex flex-wrap gap-1">
            {PRIORITIES.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => onChange({ priority: p.value })}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  note.priority === p.value
                    ? `bg-gray-700 ${p.color}`
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Create Modals */}
      {showCreateClient && (
        <QuickCreateModal
          type="client"
          onCreated={(item) => {
            setClients(prev => [...prev, item as Client]);
            handleClientChange(item.id);
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
            onChange({ projectId: item.id });
          }}
          onClose={() => setShowCreateProject(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
