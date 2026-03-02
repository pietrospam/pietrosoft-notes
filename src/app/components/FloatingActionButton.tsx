'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Users, FolderPlus, Clipboard, FilePlus, Settings, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { NoteType } from '@/lib/types';

export function FloatingActionButton() {
  const { createNote, openConfig, requestTimeSheet, setCurrentView } = useApp();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // close when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (open && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleAction = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  const newNote = (type: NoteType) => {
    return async () => {
      await createNote(type);
    };
  };

  return (
    <div ref={containerRef} className="fixed bottom-5 right-5 z-50">
      <button
        aria-label="Actions"
        className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-lg flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400"
        onClick={() => setOpen(o => !o)}
      >
        <Plus size={24} />
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 right-0 w-48 bg-gray-900 border border-gray-800 rounded-lg shadow-lg py-2">
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
            onClick={() => handleAction(() => { setCurrentView('timesheets'); requestTimeSheet(); })}
          >
            <Clock size={16} className="text-orange-400" />
            Nuevo TimeSheet
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
            onClick={() => handleAction(newNote('task'))}
          >
            <Clipboard size={16} className="text-blue-400" />
            Nueva tarea
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
            onClick={() => handleAction(newNote('connection'))}
          >
            <Users size={16} className="text-green-400" />
            Conexión
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
            onClick={() => handleAction(newNote('general'))}
          >
            <FilePlus size={16} className="text-gray-400" />
            Nota general
          </button>
          <div className="border-t border-gray-700 my-1" />
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
            onClick={() => handleAction(() => openConfig('clients', true))}
          >
            <Users size={16} className="text-gray-400" />
            Nuevo cliente
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
            onClick={() => handleAction(() => openConfig('projects', true))}
          >
            <FolderPlus size={16} className="text-gray-400" />
            Nuevo proyecto
          </button>
          <div className="border-t border-gray-700 my-1" />
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
            onClick={() => handleAction(() => openConfig('preferences'))}
          >
            <Settings size={16} className="text-gray-400" />
            Configuración
          </button>
        </div>
      )}
    </div>
  );
}
