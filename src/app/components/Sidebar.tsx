'use client';

import { useApp } from '../context/AppContext';
import { TodosSidebarSection } from './TodosSidebarSection';
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
  Check,
  Cable,
  Clock,
} from 'lucide-react';

export function Sidebar() {
  const { 
    currentView, 
    showArchived,
    setCurrentView, 
    setArchivedFilter,
    selectedClientId, 
    setSelectedClientId,
    clients, 
    notes,
    favoritesCount, // REQ-006
    recentHours, // REQ-011
    confirmNavigation,
    setSearchQuery, // Clear search when navigating
    // REQ-010: Tab navigation
    activeTab,
    activeTypeFilters,
    selectedTimesheetClientId,
    setSelectedTimesheetClientId,
    expandedClientIds,
    toggleClientExpanded,
  } = useApp();

  const handleNavigate = (action: () => void) => {
    confirmNavigation(() => {
      setSearchQuery(''); // Clear search when navigating
      action();
    });
  };

  // REQ-021: Handle TODOs sidebar click - navigate to TODOs view
  const handleShowTodosView = () => {
    handleNavigate(() => {
      setSelectedClientId(null);
      setCurrentView('todos');
    });
  };

  const getCountForClient = (clientId: string | null) => {
    if (clientId === null) {
      return notes.filter(n => !n.archivedAt).length;
    }
    return null;
  };

  const archivedCount = notes.filter(n => {
    if (!n.archivedAt) return false;
    // Apply type filter (for conexiones tab)
    if (activeTypeFilters.length > 0 && !activeTypeFilters.includes(n.type)) return false;
    return true;
  }).length;

  // REQ-011: Recents count (updated within configured hours)
  const recentCount = notes.filter(n => {
    const cutoff = Date.now() - recentHours * 3600 * 1000;
    return new Date(n.updatedAt).getTime() >= cutoff;
  }).length;

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
        {/* REQ-021: TODOs Section - before Favoritos */}
        <TodosSidebarSection onShowTodosView={handleShowTodosView} />

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
          <span className="opacity-0 lg:opacity-100 transition-opacity">Favoritos</span>
          {favoritesCount > 0 && (
            <span className={`ml-auto text-xs opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity ${
              currentView === 'favorites' ? 'text-yellow-200' : 'text-gray-500'
            }`}>{favoritesCount}
            </span>
          )}
        </button>

        {/* REQ-011: Recientes */}
        <button
          onClick={() => handleNavigate(() => {
            setSelectedClientId(null);
            setCurrentView('recents');
          })}
          className={`
            w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm
            transition-colors whitespace-nowrap
            ${currentView === 'recents'
              ? 'bg-blue-600 text-white' 
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
          `}
        >
          <Clock size={18} className="flex-shrink-0" />
          <span className="opacity-0 lg:opacity-100 transition-opacity">Recientes</span>
          {recentCount > 0 && (
            <span className={`ml-auto text-xs opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity ${
              currentView === 'recents' ? 'text-blue-200' : 'text-gray-500'
            }`}>{recentCount}
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
          <span className="opacity-0 lg:opacity-100 transition-opacity">Todas</span>
          <span className={`ml-auto text-xs opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity ${
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
                    className="p-1 text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100 lg:opacity-100"
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
                  <span className="opacity-0 lg:opacity-100 transition-opacity truncate">
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
                      <span className="opacity-0 lg:opacity-100 transition-opacity truncate text-xs">
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
          <span className="opacity-0 lg:opacity-100 transition-opacity">Sin Cliente</span>
        </button>
      </nav>
    </>
  );

  // Render for Conexiones tab (connection notes navigation)
  const renderConexionesNav = () => {
    // Get clients that have at least one connection note (non-archived)
    const clientsWithConnections = new Set<string>();
    notes.forEach(n => {
      if (n.type === 'connection' && !n.archivedAt && n.clientId) {
        clientsWithConnections.add(n.clientId);
        // Also add parent client if this is a sub-client
        const client = clients.find(c => c.id === n.clientId);
        if (client?.parentClientId) {
          clientsWithConnections.add(client.parentClientId);
        }
      }
    });
    
    // Filter top-level clients that have connections (or their sub-clients have)
    const topLevelClientsWithConnections = topLevelClients.filter(c => {
      if (clientsWithConnections.has(c.id)) return true;
      // Check if any sub-client has connections
      const subClients = getSubClients(c.id);
      return subClients.some(sc => clientsWithConnections.has(sc.id));
    });
    
    // Count connection notes
    const connectionCount = notes.filter(n => n.type === 'connection' && !n.archivedAt).length;
    
    // Count favorite connections
    const favoriteConnectionsCount = notes.filter(n => n.type === 'connection' && n.isFavorite && !n.archivedAt).length;
    
    const getConnectionCountForClient = (clientId: string) => {
      // Include sub-clients if this is a parent
      const subClientIds = getSubClients(clientId).map(c => c.id);
      const validIds = [clientId, ...subClientIds];
      return notes.filter(n => 
        n.type === 'connection' && 
        !n.archivedAt && 
        n.clientId && 
        validIds.includes(n.clientId)
      ).length;
    };
    
    return (
      <>
        <nav className="space-y-1 px-2">
          {/* Favoritos (connections) */}
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
            <span className="opacity-0 lg:opacity-100 transition-opacity">Favoritos</span>
            {favoriteConnectionsCount > 0 && (
              <span className={`ml-auto text-xs opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity ${
                currentView === 'favorites' ? 'text-yellow-200' : 'text-gray-500'
              }`}>{favoriteConnectionsCount}
              </span>
            )}
          </button>

          {/* All Connections option */}
          <button
            onClick={() => handleNavigate(() => {
              setSelectedClientId(null);
              setCurrentView('all');
            })}
            className={`
              w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm
              transition-colors whitespace-nowrap
              ${selectedClientId === null && !showArchived && currentView !== 'config' && currentView !== 'favorites'
                ? 'bg-blue-600 text-white' 
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
            `}
          >
            <Cable size={18} className="flex-shrink-0" />
            <span className="opacity-0 lg:opacity-100 transition-opacity">Todas</span>
            <span className={`ml-auto text-xs opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity ${
              selectedClientId === null && currentView === 'all' ? 'text-blue-200' : 'text-gray-500'
            }`}>
              {connectionCount}
            </span>
          </button>

          {/* Divider */}
          <div className="my-2 mx-1 border-t border-gray-800" />

          {/* Clients with connections (hierarchical) */}
          {topLevelClientsWithConnections.map(client => {
            const subClients = getSubClients(client.id).filter(sc => clientsWithConnections.has(sc.id));
            const hasChildren = subClients.length > 0;
            const expanded = isExpanded(client.id);
            const count = getConnectionCountForClient(client.id);
            
            return (
              <div key={client.id}>
                <div className="flex items-center">
                  {/* Expand/collapse button */}
                  {hasChildren && (
                    <button
                      onClick={() => toggleClientExpanded(client.id)}
                      className="p-1 text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100 lg:opacity-100"
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
                    <span className="opacity-0 lg:opacity-100 transition-opacity truncate">
                      {client.name}
                    </span>
                    {count > 0 && (
                      <span className={`ml-auto text-xs opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity ${
                        selectedClientId === client.id ? 'text-blue-200' : 'text-gray-500'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                </div>
                
                {/* Sub-clients with connections */}
                {hasChildren && expanded && (
                  <div className="ml-4 border-l border-gray-800 pl-2">
                    {subClients.map(subClient => {
                      const subCount = notes.filter(n => 
                        n.type === 'connection' && 
                        !n.archivedAt && 
                        n.clientId === subClient.id
                      ).length;
                      
                      return (
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
                          <span className="opacity-0 lg:opacity-100 transition-opacity truncate text-xs">
                            {subClient.name}
                          </span>
                          {subCount > 0 && (
                            <span className={`ml-auto text-xs opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity ${
                              selectedClientId === subClient.id ? 'text-blue-200' : 'text-gray-500'
                            }`}>
                              {subCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </>
    );
  };

  // REQ-026: Render for Billing tab (parent client filter)
  const renderBillingNav = () => (
    <>
      <nav className="space-y-1 px-2">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 py-1 opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity">
          Facturación
        </div>
        <button
          onClick={() => handleNavigate(() => {
            setSelectedClientId(null);
            setCurrentView('billing');
          })}
          className={
            `w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${currentView === 'billing' && selectedClientId === null ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`
          }
        >
          <Building2 size={18} className="flex-shrink-0" />
          <span className="opacity-0 lg:opacity-100 transition-opacity">Todas</span>
        </button>
        <div className="my-2 mx-1 border-t border-gray-800" />
        {parentClientsWithSubclients.map(client => (
          <button
            key={client.id}
            onClick={() => handleNavigate(() => {
              setSelectedClientId(client.id);
              setCurrentView('billing');
            })}
            className={
              `w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors whitespace-nowrap relative ${selectedClientId === client.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`
            }
          >
            {client.color && (
              <div
                className="absolute left-0 top-1 bottom-1 w-1 rounded-r"
                style={{ backgroundColor: client.color }}
              />
            )}
            <Building2 size={18} className="flex-shrink-0" />
            <span className="opacity-0 lg:opacity-100 transition-opacity truncate">
              {client.name}
            </span>
          </button>
        ))}
      </nav>
    </>
  );

  // REQ-010: Render for TimeSheets tab (parent client filter)
  const renderTimesheetsNav = () => (
    <>
      <nav className="space-y-1 px-2">
        {/* Header */}
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 py-1 opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity">
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
          <span className="opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity">Todos</span>
          {selectedTimesheetClientId === null && (
            <Check size={14} className="ml-auto opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity" />
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
            <span className="opacity-0 lg:opacity-100 transition-opacity truncate">
              {client.name}
            </span>
            {selectedTimesheetClientId === client.id && (
              <Check size={14} className="ml-auto opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity" />
            )}
          </button>
        ))}

      </nav>
    </>
  );

  return (
    // desktop (lg+) always show expanded width; smaller screens keep narrow but
    // we no longer auto-expand on hover to avoid unpredictable resizing.
    <aside className="w-14 lg:w-48 bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-200 group overflow-hidden" style={{ overflowX: 'hidden' }}>
      <div className="flex-1 py-4" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
        {/* REQ-010: Tab-aware navigation */}
        {activeTab === 'bitacora' && renderBitacoraNav()}
        {activeTab === 'conexiones' && renderConexionesNav()}
        {activeTab === 'timesheets' && renderTimesheetsNav()}
        {activeTab === 'billing' && renderBillingNav()}
      </div>
      {/* Bottom navigation - REQ-010: Removed TimeSheets button (moved to tabs) */}
      <div className="py-4 border-t border-gray-800">
        <nav className="space-y-1 px-2">
          {/* Archived filter - only in Bitácora and Conexiones mode */}
          {(activeTab === 'bitacora' || activeTab === 'conexiones') && (
            <button
              onClick={() => handleNavigate(() => setArchivedFilter(!showArchived))}
              className={`
                w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm
                transition-colors whitespace-nowrap
                ${showArchived
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
              `}
            >
              <Archive size={18} className="flex-shrink-0" />
              <span className="opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity">Archivados</span>
              {archivedCount > 0 && (
                <span className={`ml-auto text-xs opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity ${
                  showArchived ? 'text-amber-950' : 'text-gray-500'
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
            <span className="opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity">Config</span>
          </button>
        </nav>
      </div>
    </aside>
  );
}
