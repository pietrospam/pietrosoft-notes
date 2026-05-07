'use client';

import { useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Save, X, Clock, BookOpen, Cable, Receipt } from 'lucide-react';
import type { ActiveTab } from '../context/AppContext';

// top-right "new note" dropdown removed, FAB handles creation


// REQ-010: Tab definitions
const tabs: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
  { id: 'bitacora', label: 'Bitácora', icon: BookOpen },
  { id: 'conexiones', label: 'Conexiones', icon: Cable },
  { id: 'timesheets', label: 'TimeSheets', icon: Clock },
  { id: 'billing', label: 'Facturación', icon: Receipt },
];

export function TopBar() {
  const { searchQuery, setSearchQuery, isSaving, lastSaved, selectedNote, confirmNavigation, filteredNotes, setSelectedNoteId, activeTab, setActiveTab } = useApp();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // top-right dropdown removed; no additional state or effects


  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSearchQuery('');
      searchInputRef.current?.blur();
    } else if (e.key === 'Enter' && searchQuery && filteredNotes.length > 0) {
      // Open first matching note
      confirmNavigation(() => {
        setSelectedNoteId(filteredNotes[0].id);
        searchInputRef.current?.blur();
      });
    }
  };

  // REQ-010: Handle tab change
  const handleTabChange = (tab: ActiveTab) => {
    confirmNavigation(() => {
      setActiveTab(tab);
    });
  };

  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-4">
      {/* REQ-010: Tab Navigation */}
      <div className="flex items-center gap-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${isActive 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }
              `}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
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
            placeholder="Buscar notas... (Enter para abrir, Esc para limpiar)"
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


    </header>
  );
}
