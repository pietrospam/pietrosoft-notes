'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, Clock, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { QuickCreateModal } from './QuickCreateModal';
import type { TaskNote, Client, Project, TaskStatus, TaskPriority } from '@/lib/types';

const STATUSES: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'NONE', label: 'None', color: 'bg-gray-500' },
  { value: 'TODO', label: 'To Do', color: 'bg-yellow-500' },
  { value: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-500' },
  { value: 'DONE', label: 'Done', color: 'bg-green-500' },
  { value: 'BLOCKED', label: 'Blocked', color: 'bg-red-500' },
  { value: 'CANCELED', label: 'Canceled', color: 'bg-gray-600' },
];

const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'LOW', label: 'Low', color: 'text-gray-400' },
  { value: 'MEDIUM', label: 'Medium', color: 'text-yellow-400' },
  { value: 'HIGH', label: 'High', color: 'text-orange-400' },
  { value: 'URGENT', label: 'Urgent', color: 'text-red-400' },
];

interface TaskFieldsProps {
  note: TaskNote;
  onChange: (data: Partial<TaskNote>) => void;
}

export function TaskFields({ note, onChange }: TaskFieldsProps) {
  const { setSelectedNoteId, setCurrentView } = useApp();
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);

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
      const projectsList = await res.json();
      setProjects(projectsList);
    } else {
      setProjects([]);
    }
    onChange({ projectId: '' }); // Clear project when client changes
  };

  const handleAddTimeSheet = async () => {
    // Create a new timesheet linked to this task
    const today = new Date().toISOString().split('T')[0];
    const response = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'timesheet',
        title: `Time: ${note.title || note.shortDescription || 'Task'}`,
        contentJson: null,
        taskId: note.id,
        workDate: today,
        hoursWorked: 0,
        description: '',
        state: 'PENDING',
      }),
    });
    
    if (response.ok) {
      const newNote = await response.json();
      // Navigate to timesheet view and select the new note
      setCurrentView('timesheet');
      setSelectedNoteId(newNote.id);
    }
  };

  return (
    <div className="space-y-4">
      {/* Add TimeSheet Button */}
      <button
        onClick={handleAddTimeSheet}
        className="flex items-center gap-2 w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
      >
        <Clock size={16} />
        <span>Add TimeSheet Entry</span>
      </button>

      {/* Client & Project Selection */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Client</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <select
                value={selectedClientId}
                onChange={(e) => handleClientChange(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 appearance-none"
              >
                <option value="">Select client...</option>
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
        <div>
          <label className="block text-xs text-gray-500 mb-1">Project *</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <select
                value={note.projectId || ''}
                onChange={(e) => onChange({ projectId: e.target.value })}
                disabled={!selectedClientId}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 appearance-none disabled:opacity-50"
              >
                <option value="">Select project...</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
            <button
              type="button"
              onClick={() => setShowCreateProject(true)}
              disabled={!selectedClientId}
              className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Create new project"
            >
              <Plus size={16} />
            </button>
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

      {/* Ticket/Phase Code & Short Description */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Ticket/Phase Code *</label>
          <input
            type="text"
            value={note.ticketPhaseCode || ''}
            onChange={(e) => onChange({ ticketPhaseCode: e.target.value })}
            className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 ${
              !note.ticketPhaseCode ? 'border-yellow-600' : 'border-gray-700'
            }`}
            placeholder="e.g., TASK-001"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Short Description *</label>
          <input
            type="text"
            value={note.shortDescription || ''}
            onChange={(e) => onChange({ shortDescription: e.target.value })}
            className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 ${
              !note.shortDescription ? 'border-yellow-600' : 'border-gray-700'
            }`}
            placeholder="Brief task summary"
          />
        </div>
      </div>

      {/* Status & Priority */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
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
          <label className="block text-xs text-gray-500 mb-1">Priority</label>
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

      {/* Budget Hours & Due Date */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Budget Hours</label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={note.budgetHours ?? ''}
            onChange={(e) => onChange({ budgetHours: e.target.value ? parseFloat(e.target.value) : null })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Due Date</label>
          <input
            type="date"
            value={note.dueDate?.split('T')[0] || ''}
            onChange={(e) => onChange({ dueDate: e.target.value || undefined })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
