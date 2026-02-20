'use client';

import { useApp, ViewType } from '../context/AppContext';
import { 
  FileText, 
  CheckSquare, 
  Link, 
  Clock, 
  Settings,
  Layers,
  Archive
} from 'lucide-react';

const navItems: { view: ViewType; label: string; icon: React.ElementType }[] = [
  { view: 'all', label: 'All Notes', icon: Layers },
  { view: 'general', label: 'General', icon: FileText },
  { view: 'task', label: 'Tasks', icon: CheckSquare },
  { view: 'connection', label: 'Connections', icon: Link },
  { view: 'timesheet', label: 'TimeSheet', icon: Clock },
  { view: 'archived', label: 'Archived', icon: Archive },
];

export function Sidebar() {
  const { currentView, setCurrentView, notes } = useApp();

  const getCount = (view: ViewType) => {
    if (view === 'all') return notes.filter(n => !n.archivedAt).length;
    if (view === 'archived') return notes.filter(n => n.archivedAt).length;
    if (view === 'config') return null;
    return notes.filter(n => n.type === view && !n.archivedAt).length;
  };

  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="flex-1 py-4">
        <nav className="space-y-1 px-2">
          {navItems.map(({ view, label, icon: Icon }) => {
            const isActive = currentView === view;
            const count = getCount(view);
            
            return (
              <button
                key={view}
                onClick={() => setCurrentView(view)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                  transition-colors
                  ${isActive 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
                `}
              >
                <Icon size={18} />
                <span className="flex-1 text-left">{label}</span>
                {count !== null && (
                  <span className={`text-xs ${isActive ? 'text-blue-200' : 'text-gray-500'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        
        <div className="my-4 mx-4 border-t border-gray-800" />
        
        <nav className="px-2">
          <button
            onClick={() => setCurrentView('config')}
            className={`
              w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm
              transition-colors
              ${currentView === 'config'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
            `}
          >
            <Settings size={18} />
            <span>Config</span>
          </button>
        </nav>
      </div>
    </aside>
  );
}
