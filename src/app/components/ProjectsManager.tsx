'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Check, X, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { DynamicIcon } from './IconPicker';
import type { Client, Project } from '@/lib/types';

export function ProjectsManager() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showDisabled, setShowDisabled] = useState(false);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // Fetch data
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [projectsRes, clientsRes] = await Promise.all([
        fetch(`/api/projects?includeDisabled=${showDisabled}`),
        fetch('/api/clients'),
      ]);
      
      if (projectsRes.ok) setProjects(await projectsRes.json());
      if (clientsRes.ok) setClients(await clientsRes.json());
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [showDisabled]);

  const resetForm = () => {
    setFormName('');
    setFormClientId('');
    setFormCode('');
    setFormDescription('');
    setEditingProject(null);
    setIsCreating(false);
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormName(project.name);
    setFormClientId(project.clientId);
    setFormCode(project.code || '');
    setFormDescription(project.description || '');
    setIsCreating(false);
  };

  const handleCreate = () => {
    resetForm();
    setIsCreating(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formClientId) return;

    try {
      if (editingProject) {
        // Update
        const res = await fetch(`/api/projects/${editingProject.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            clientId: formClientId,
            code: formCode || undefined,
            description: formDescription || undefined,
          }),
        });
        if (res.ok) {
          fetchData();
          resetForm();
        }
      } else {
        // Create
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            clientId: formClientId,
            code: formCode || undefined,
            description: formDescription || undefined,
          }),
        });
        if (res.ok) {
          fetchData();
          resetForm();
        }
      }
    } catch (error) {
      console.error('Failed to save project:', error);
    }
  };

  const handleDisable = async (project: Project) => {
    if (!confirm(`Are you sure you want to ${project.disabled ? 'enable' : 'disable'} "${project.name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled: !project.disabled }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to toggle project:', error);
    }
  };

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Unknown';
  };

  const getClientIcon = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.icon || 'building';
  };

  if (isLoading) {
    return <div className="p-4 text-gray-500">Loading projects...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold text-white">Projects</h2>
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
            disabled={clients.length === 0}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
          >
            <Plus size={16} />
            New Project
          </button>
        </div>
      </div>

      {/* Form */}
      {(isCreating || editingProject) && (
        <div className="p-4 border-b border-gray-800 bg-gray-900/50">
          <h3 className="text-sm font-medium text-gray-400 mb-3">
            {editingProject ? 'Edit Project' : 'New Project'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Client *</label>
              <div className="relative">
                <select
                  value={formClientId}
                  onChange={(e) => setFormClientId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
                >
                  <option value="">Select a client...</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="Project name"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Code</label>
              <input
                type="text"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="Optional project code"
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
                disabled={!formName.trim() || !formClientId}
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
            Create a client first before adding projects.
          </div>
        ) : projects.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No projects yet. Create your first project.
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {projects.map((project) => (
              <div
                key={project.id}
                className={`flex items-center gap-3 p-3 hover:bg-gray-800/50 transition-colors ${
                  project.disabled ? 'opacity-50' : ''
                }`}
              >
                <DynamicIcon icon={getClientIcon(project.clientId)} className="text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {project.name}
                    {project.code && (
                      <span className="ml-2 text-xs text-gray-500">({project.code})</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {getClientName(project.clientId)}
                    {project.description && ` • ${project.description}`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(project)}
                    className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors"
                    title="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDisable(project)}
                    className={`p-1.5 hover:bg-gray-700 rounded transition-colors ${
                      project.disabled 
                        ? 'text-green-500 hover:text-green-400' 
                        : 'text-gray-500 hover:text-red-400'
                    }`}
                    title={project.disabled ? 'Enable' : 'Disable'}
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
