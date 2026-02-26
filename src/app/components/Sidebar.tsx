'use client';

import { useApp } from '../context/AppContext';
import { 
  Settings,
  Layers,
  Archive,
  Users,
  Building2,
  Star,
  ChevronRight,
  ChevronDown,
  LayoutGrid,
  Check
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
    // REQ-010: Tab navigation
    activeTab,
    selectedTimesheetClientId,
    setSelectedTimesheetClientId,
    expandedClientIds,
    toggleClientExpanded,
  } = useApp();

  const handleNavigate = (action: () => void) => {
    confirmNavigation(action);
  };

  const getCountForClient = (clientId: string | null) => {
    if (clientId === null) {
      return notes.filter(n => !n.archivedAt && n.type !== 'timesheet').length;
    }
    return null;
  };

  const archivedCount = notes.filter(n => n.archivedAt).length;

  // REQ-010: Get parent clients (clients that have sub-clients)
  const hasSubClients = (clientId: string) => clients.some(c => !c.disabled && c.parentClientId === clientId);
  // For Bitácora: all top-level clients (no parentClientId)
  const topLevelClients = clients.filter(c => !c.disabled && !c.parentClientId);
  // For TimeSheets: only clients that ARE parents of other clients
  const parentClientsWithSubclients = clients.filter(c => !c.disabled && !c.parentClientId && hasSubClients(c.id));
  const getSubClients = (parentId: string) => clients.filter(c => !c.disabled && c.parentClientId === parentId);
  const isExpanded = (clientId: string) => expandedClientIds.includes(clientId);

  // REQ-010: Render for Bitácora tab (notes navigation)
  const renderBitacoraNav = () => (
    <>
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

        {/* REQ-010: Hierarchical Clients */}
        {topLevelClients.map(client => {
          const subClients = getSubClients(client.id);
          const hasChildren = subClients.length > 0;
          const expanded = isExpanded(client.id);
          
          return (
            <div key={client.id}>
              <div className="flex items-center">
                {/* Expand/collapse button */}
                {hasChildren && (
                  <button
                    onClick={() => toggleClientExpanded(client.id)}
                    className="p-1 text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                  >
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                )}
                
                {/* Client button */}
                <button
                  onClick={() => handleNavigate(() => {
                    setSelectedClientId(client.id);
                    setCurrentView('all');
                  })}
                  className={`
                    flex-1 flex items-center gap-3 px-2 py-2 rounded-lg text-sm
                    transition-colors whitespace-nowrap relative
                    ${!hasChildren ? 'ml-5' : ''}
                    ${selectedClientId === client.id
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
                  `}
                >
                  {client.color && (
                    <div
                      className="absolute left-0 top-1 bottom-1 w-1 rounded-r"
                      style={{ backgroundColor: client.color }}
                    />
                  )}
                  <Building2 size={18} className="flex-shrink-0" />
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity truncate">
                    {client.name}
                  </span>
                </button>
              </div>
              
              {/* Sub-clients */}
              {hasChildren && expanded && (
                <div className="ml-4 border-l border-gray-800 pl-2">
                  {subClients.map(subClient => (
                    <button
                      key={subClient.id}
                      onClick={() => handleNavigate(() => {
                        setSelectedClientId(subClient.id);
                        setCurrentView('all');
                      })}
                      className={`
                        w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-sm
                        transition-colors whitespace-nowrap relative
                        ${selectedClientId === subClient.id
                          ? 'bg-blue-600 text-white' 
                          : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
                      `}
                    >
                      {subClient.color && (
                        <div
                          className="absolute left-0 top-1 bottom-1 w-1 rounded-r"
                          style={{ backgroundColor: subClient.color }}
                        />
                      )}
                      <Building2 size={14} className="flex-shrink-0" />
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity truncate text-xs">
                        {subClient.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Divider */}
        <div className="my-2 mx-1 border-t border-gray-800" />

        {/* Sin Cliente */}
        <button
          onClick={() => handleNavigate(() => {
            setSelectedClientId('none');
            setCurrentView('all');
          })}
          className={`
            w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm ml-5
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
    </>
  );

  // REQ-010: Render for TimeSheets tab (parent client filter)
  const renderTimesheetsNav = () => (
    <>
      <nav className="space-y-1 px-2">
        {/* Header */}
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
          TimeSheets
        </div>
        
        {/* All TimeSheets option */}
        <button
          onClick={() => setSelectedTimesheetClientId(null)}
          className={`
            w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm
            transition-colors whitespace-nowrap
            ${selectedTimesheetClientId === null
              ? 'bg-blue-600 text-white' 
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
          `}
        >
          <LayoutGrid size={18} className="flex-shrink-0" />
          <span className="opacity-0 group-hover:opacity-100 transition-opacity">Todos</span>
          {selectedTimesheetClientId === null && (
            <Check size={14} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </button>

        {/* Divider */}
        <div className="my-2 mx-1 border-t border-gray-800" />

        {/* Parent clients (that have sub-clients) for TimeSheet filtering */}
        {parentClientsWithSubclients.map(client => (
          <button
            key={client.id}
            onClick={() => setSelectedTimesheetClientId(client.id)}
            className={`
              w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm
              transition-colors whitespace-nowrap relative
              ${selectedTimesheetClientId === client.id
                ? 'bg-blue-600 text-white' 
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
            `}
          >
            {client.color && (
              <div
                className="absolute left-0 top-1 bottom-1 w-1 rounded-r"
                style={{ backgroundColor: client.color }}
              />
            )}
            <Building2 size={18} className="flex-shrink-0" />
            <span className="opacity-0 group-hover:opacity-100 transition-opacity truncate">
              {client.name}
            </span>
            {selectedTimesheetClientId === client.id && (
              <Check size={14} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </button>
        ))}
      </nav>
    </>
  );

  return (
    <aside className="w-14 hover:w-48 bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-200 group overflow-hidden" style={{ overflowX: 'hidden' }}>
      <div className="flex-1 py-4" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
        {/* REQ-010: Tab-aware navigation */}
        {activeTab === 'bitacora' ? renderBitacoraNav() : renderTimesheetsNav()}
      </div>
      {/* Bottom navigation - REQ-010: Removed TimeSheets button (moved to tabs) */}
      <div className="py-4 border-t border-gray-800">
        <nav className="space-y-1 px-2">
          {/* Archived - only in Bitácora mode */}
          {activeTab === 'bitacora' && (
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
          )}
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
