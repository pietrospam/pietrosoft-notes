'use client';

import { useState, useEffect } from 'react';
import { Filter, X, ChevronDown } from 'lucide-react';
import type { Client, Project, TaskStatus } from '@/lib/types';
import { useApp } from '../context/AppContext';

const STATUSES: { value: TaskStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'DONE', label: 'Done' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'CANCELED', label: 'Canceled' },
];

export function TaskFilters() {
  const { taskFilters: filters, setTaskFilters } = useApp();
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/clients').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
    ]).then(([c, p]) => {
      setClients(c);
      setProjects(p);
    });
  }, []);

  const filteredProjects = filters.clientId
    ? projects.filter(p => p.clientId === filters.clientId)
    : projects;

  const hasFilters = filters.status || filters.clientId || filters.projectId;

  return (
    <div className="p-2 border-b border-gray-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors w-full ${
          hasFilters 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-800 text-gray-400 hover:text-white'
        }`}
      >
        <Filter size={14} />
        <span>Filters{hasFilters ? ' (active)' : ''}</span>
        <ChevronDown size={14} className={`transition-transform ml-auto ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="mt-2 p-3 bg-gray-800/50 border border-gray-700 rounded-lg space-y-3">
          {/* Status filter */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setTaskFilters({ ...filters, status: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
            >
              {STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Client filter */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Client</label>
            <select
              value={filters.clientId}
              onChange={(e) => setTaskFilters({ ...filters, clientId: e.target.value, projectId: '' })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
            >
              <option value="">All Clients</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Project filter */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Project</label>
            <select
              value={filters.projectId}
              onChange={(e) => setTaskFilters({ ...filters, projectId: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
            >
              <option value="">All Projects</option>
              {filteredProjects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {hasFilters && (
            <button
              onClick={() => setTaskFilters({ status: '', clientId: '', projectId: '' })}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
            >
              <X size={12} />
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function TimeSheetFilters() {
  const { timeSheetFilters: filters, setTimeSheetFilters } = useApp();
  const [clients, setClients] = useState<Client[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(setClients);
  }, []);

  const hasFilters = filters.startDate || filters.endDate || filters.clientId;

  return (
    <div className="p-2 border-b border-gray-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors w-full ${
          hasFilters 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-800 text-gray-400 hover:text-white'
        }`}
      >
        <Filter size={14} />
        <span>Filters{hasFilters ? ' (active)' : ''}</span>
        <ChevronDown size={14} className={`transition-transform ml-auto ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="mt-2 p-3 bg-gray-800/50 border border-gray-700 rounded-lg space-y-3">
          {/* Start date */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setTimeSheetFilters({ ...filters, startDate: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
            />
          </div>

          {/* End date */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setTimeSheetFilters({ ...filters, endDate: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
            />
          </div>

          {/* Client filter */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Client</label>
            <select
              value={filters.clientId}
              onChange={(e) => setTimeSheetFilters({ ...filters, clientId: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
            >
              <option value="">All Clients</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {hasFilters && (
            <button
              onClick={() => setTimeSheetFilters({ startDate: '', endDate: '', clientId: '' })}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
            >
              <X size={12} />
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
