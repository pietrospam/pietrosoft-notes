'use client';

import { useApp, ViewType } from '../context/AppContext';
import { Search, Plus, Download } from 'lucide-react';
import type { NoteType } from '@/lib/types';

const viewToNoteType: Record<ViewType, NoteType> = {
  all: 'general',
  general: 'general',
  task: 'task',
  connection: 'connection',
  timesheet: 'timesheet',
  config: 'general',
  archived: 'general',
};

export function TopBar() {
  const { searchQuery, setSearchQuery, createNote, currentView } = useApp();

  const handleNewNote = async () => {
    const type = viewToNoteType[currentView];
    await createNote(type);
  };

  const handleExportTimesheets = () => {
    // Open CSV export in new tab/download
    window.open('/api/export/timesheets?format=csv', '_blank');
  };

  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-4">
      {/* Logo/Brand */}
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold text-white">Pietrosoft Notes</span>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search 
            size={18} 
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" 
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Export Button (TimeSheet view only) */}
      {currentView === 'timesheet' && (
        <button
          onClick={handleExportTimesheets}
          className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Download size={18} />
          <span>Export CSV</span>
        </button>
      )}

      {/* New Note Button */}
      {currentView !== 'config' && (
        <button
          onClick={handleNewNote}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={18} />
          <span>New Note</span>
        </button>
      )}
    </header>
  );
}
