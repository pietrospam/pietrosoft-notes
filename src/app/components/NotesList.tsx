'use client';

import { useApp } from '../context/AppContext';
import { FileText, CheckSquare, Link, Clock } from 'lucide-react';
import type { NoteType } from '@/lib/types';
import { TaskFilters, TimeSheetFilters } from './FilterPanels';

const typeIcons: Record<NoteType, React.ElementType> = {
  general: FileText,
  task: CheckSquare,
  connection: Link,
  timesheet: Clock,
};

const typeColors: Record<NoteType, string> = {
  general: 'text-gray-400',
  task: 'text-blue-400',
  connection: 'text-green-400',
  timesheet: 'text-orange-400',
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

export function NotesList() {
  const { filteredNotes, selectedNoteId, setSelectedNoteId, isLoading, currentView } = useApp();

  if (currentView === 'config') {
    return (
      <div className="w-72 bg-gray-900 border-r border-gray-800 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Config panel</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-72 bg-gray-900 border-r border-gray-800 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    );
  }

  if (filteredNotes.length === 0) {
    return (
      <div className="w-72 bg-gray-900 border-r border-gray-800 flex items-center justify-center">
        <p className="text-gray-500 text-sm">No notes yet</p>
      </div>
    );
  }

  return (
    <div className="w-72 bg-gray-900 border-r border-gray-800 overflow-y-auto flex flex-col">
      {currentView === 'task' && <TaskFilters />}
      {currentView === 'timesheet' && <TimeSheetFilters />}
      <div className="divide-y divide-gray-800 flex-1">
        {filteredNotes.map(note => {
          const Icon = typeIcons[note.type];
          const isSelected = note.id === selectedNoteId;
          
          return (
            <button
              key={note.id}
              onClick={() => setSelectedNoteId(note.id)}
              className={`
                w-full text-left p-3 transition-colors
                ${isSelected 
                  ? 'bg-gray-800' 
                  : 'hover:bg-gray-800/50'}
              `}
            >
              <div className="flex items-start gap-2">
                <Icon size={16} className={`mt-0.5 ${typeColors[note.type]}`} />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-white truncate">
                    {note.title || 'Untitled'}
                  </h3>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {note.contentText || 'No content'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {formatDate(note.updatedAt)}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
