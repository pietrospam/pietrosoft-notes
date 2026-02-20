'use client';

import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Plus, Download, Save, FileText, CheckSquare, Link, Clock, ChevronDown, X } from 'lucide-react';
import { Toast } from './Toast';
import type { NoteType } from '@/lib/types';

const noteTypes: { type: NoteType; label: string; icon: React.ElementType }[] = [
  { type: 'general', label: 'General', icon: FileText },
  { type: 'task', label: 'Task', icon: CheckSquare },
  { type: 'connection', label: 'Connection', icon: Link },
  // timesheet removed per REQ-002 - created only from tasks
];

const typeLabels: Record<NoteType, string> = {
  general: 'Nota',
  task: 'Task',
  connection: 'Conexión',
  timesheet: 'TimeSheet',
};

export function TopBar() {
  const { searchQuery, setSearchQuery, createNote, currentView, isSaving, lastSaved, selectedNote, confirmNavigation } = useApp();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateNote = async (type: NoteType) => {
    setDropdownOpen(false);
    // Check for unsaved changes before creating
    confirmNavigation(async () => {
      const note = await createNote(type);
      if (note) {
        setToast({ message: `${typeLabels[type]} creada` });
      }
    });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSearchQuery('');
      searchInputRef.current?.blur();
    }
  };

  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-4">
      {/* Logo/Brand */}
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold text-white">Bitácora</span>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search 
            size={18} 
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" 
          />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Buscar notas... (Esc para limpiar)"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-10 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              title="Limpiar búsqueda (Esc)"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Auto-save status badge */}
      {selectedNote && (
        <div className="flex items-center gap-1 text-xs">
          {isSaving ? (
            <span className="text-blue-400 flex items-center gap-1">
              <Save size={12} className="animate-pulse" />
              Guardando...
            </span>
          ) : lastSaved ? (
            <span className="text-gray-500">
              Guardado {lastSaved.toLocaleTimeString()}
            </span>
          ) : null}
        </div>
      )}

      {/* New Note Dropdown */}
      {currentView !== 'config' && (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={18} />
            <ChevronDown size={14} />
          </button>
          
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 py-1">
              {noteTypes.map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => handleCreateNote(type)}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </header>
  );
}
