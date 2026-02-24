'use client';

import { useApp } from '../context/AppContext';
import { 
  Settings,
  Layers,
  Archive,
  Users,
  Building2,
  Clock,
  Star
} from 'lucide-react';

export function Sidebar() {
  const { 
    currentView, 
    setCurrentView, 
    selectedClientId, 
    setSelectedClientId,
    clients, 
    notes,
    favoritesCount, // REQ-006
    confirmNavigation,
  } = useApp();

  const handleNavigate = (action: () => void) => {
    confirmNavigation(action);
  };

  const getCountForClient = (clientId: string | null) => {
    // This is a simplified count - we'd need getClientForNote for accurate counts
    // For now, just count all non-archived notes
    if (clientId === null) {
      return notes.filter(n => !n.archivedAt).length;
    }
    return null; // Don't show count for individual clients for now
  };

  const archivedCount = notes.filter(n => n.archivedAt).length;

  return (
    <aside className="w-14 hover:w-48 bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-200 group overflow-hidden">
      <div className="flex-1 py-4">
        {/* Main navigation */}
        <nav className="space-y-1 px-2">
          {/* REQ-006: Favoritos */}
          <button
            onClick={() => handleNavigate(() => {
              setSelectedClientId(null);
              setCurrentView('favorites');
            })}
            className={`
              w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm
              transition-colors whitespace-nowrap
              ${currentView === 'favorites'
                ? 'bg-yellow-600 text-white' 
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
            `}
          >
            <Star size={18} className={`flex-shrink-0 ${currentView === 'favorites' ? 'fill-current' : ''}`} />
            <span className="opacity-0 group-hover:opacity-100 transition-opacity">Favoritos</span>
            {favoritesCount > 0 && (
              <span className={`ml-auto text-xs opacity-0 group-hover:opacity-100 transition-opacity ${
                currentView === 'favorites' ? 'text-yellow-200' : 'text-gray-500'
              }`}>
                {favoritesCount}
              </span>
            )}
          </button>

          {/* All Notes */}
          <button
            onClick={() => handleNavigate(() => {
              setSelectedClientId(null);
              setCurrentView('all');
            })}
            className={`
              w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm
              transition-colors whitespace-nowrap
              ${selectedClientId === null && currentView === 'all'
                ? 'bg-blue-600 text-white' 
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
            `}
          >
            <Layers size={18} className="flex-shrink-0" />
            <span className="opacity-0 group-hover:opacity-100 transition-opacity">Todas</span>
            <span className={`ml-auto text-xs opacity-0 group-hover:opacity-100 transition-opacity ${
              selectedClientId === null && currentView === 'all' ? 'text-blue-200' : 'text-gray-500'
            }`}>
              {getCountForClient(null)}
            </span>
          </button>

          {/* Divider */}
          <div className="my-2 mx-1 border-t border-gray-800" />

          {/* Clients */}
          {clients.filter(c => !c.disabled).map(client => (
            <button
              key={client.id}
              onClick={() => handleNavigate(() => {
                setSelectedClientId(client.id);
                setCurrentView('all');
              })}
              className={`
                w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm
                transition-colors whitespace-nowrap
                ${selectedClientId === client.id
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
              `}
            >
              <Building2 size={18} className="flex-shrink-0" />
              <span className="opacity-0 group-hover:opacity-100 transition-opacity truncate">
                {client.name}
              </span>
            </button>
          ))}

          {/* Divider */}
          <div className="my-2 mx-1 border-t border-gray-800" />

          {/* Sin Cliente */}
          <button
            onClick={() => handleNavigate(() => {
              setSelectedClientId('none');
              setCurrentView('all');
            })}
            className={`
              w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm
              transition-colors whitespace-nowrap
              ${selectedClientId === 'none'
                ? 'bg-blue-600 text-white' 
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
            `}
          >
            <Users size={18} className="flex-shrink-0" />
            <span className="opacity-0 group-hover:opacity-100 transition-opacity">Sin Cliente</span>
          </button>
        </nav>
      </div>
      
      {/* Bottom navigation */}
      <div className="py-4 border-t border-gray-800">
        <nav className="space-y-1 px-2">
          {/* TimeSheets - REQ-002 */}
          <button
            onClick={() => handleNavigate(() => setCurrentView('timesheets'))}
            className={`
              w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm
              transition-colors whitespace-nowrap
              ${currentView === 'timesheets'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
            `}
          >
            <Clock size={18} className="flex-shrink-0" />
            <span className="opacity-0 group-hover:opacity-100 transition-opacity">TimeSheets</span>
          </button>

          {/* Archived */}
          <button
            onClick={() => handleNavigate(() => setCurrentView('archived'))}
            className={`
              w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm
              transition-colors whitespace-nowrap
              ${currentView === 'archived'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
            `}
          >
            <Archive size={18} className="flex-shrink-0" />
            <span className="opacity-0 group-hover:opacity-100 transition-opacity">Archivados</span>
            {archivedCount > 0 && (
              <span className={`ml-auto text-xs opacity-0 group-hover:opacity-100 transition-opacity ${
                currentView === 'archived' ? 'text-blue-200' : 'text-gray-500'
              }`}>
                {archivedCount}
              </span>
            )}
          </button>

          {/* Config */}
          <button
            onClick={() => handleNavigate(() => setCurrentView('config'))}
            className={`
              w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm
              transition-colors whitespace-nowrap
              ${currentView === 'config'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
            `}
          >
            <Settings size={18} className="flex-shrink-0" />
            <span className="opacity-0 group-hover:opacity-100 transition-opacity">Config</span>
          </button>
        </nav>
      </div>
    </aside>
  );
}
