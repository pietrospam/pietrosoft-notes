'use client';

import { useEffect, useCallback, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { TopBar, Sidebar, NotesList, ConfigPanel, TimeSheetView, UnsavedChangesModal, FloatingActionButton, Toast, GlobalDropZone, TodosCardsView, BillingScreen } from './components';
import { BillingEditorModal } from './components/BillingEditorModal';
import { TaskEditorModal } from './components/TaskEditorModal';
import { NoteEditorModal } from './components/NoteEditorModal';
import { ConnectionEditorModal } from './components/ConnectionEditorModal';
import { ConnectionEditor } from './components/connection-editor/ConnectionEditor';

function InlineEditorPanel() {
  const { 
    selectedNoteId, 
    filteredNotes,
    editorModal,
    openEditorModal,
    refreshNotes,
    isNotesListCollapsed,
    setNotesListCollapsed,
  } = useApp();
  
  // ESC key handler to expand NotesList when collapsed
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isNotesListCollapsed) {
      setNotesListCollapsed(false);
    }
  }, [isNotesListCollapsed, setNotesListCollapsed]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  
  // Check if we have a note selected (not creating, existing note selected in list)
  // Find the selected note to determine its type
  const selectedNote = filteredNotes.find(n => n.id === selectedNoteId);
  
  // Don't show inline editor if:
  // - No note selected
  // - Modal is open in create mode
  // - editorModal.isOpen && mode === 'popup' (being shown as popup from timesheet)
  if (!selectedNote || (editorModal.isOpen && editorModal.mode === 'create')) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900 text-gray-500">
        <p>Selecciona una nota para editarla</p>
      </div>
    );
  }
  
  // Handler to expand inline to popup mode
  const handleExpandToPopup = () => {
    openEditorModal(selectedNote.type, selectedNote.id);
  };
  
  // Render the appropriate editor inline
  switch (selectedNote.type) {
    case 'task':
      return (
        <TaskEditorModal
          key={selectedNote.id}
          taskId={selectedNote.id}
          inline={true}
          onClose={() => {}} // Inline mode doesn't close
          onSaved={() => refreshNotes()}
          onExpandToPopup={handleExpandToPopup}
        />
      );
    case 'connection':
      return (
        <ConnectionEditor
          key={selectedNote.id}
          noteId={selectedNote.id}
          onClose={() => {}}
          onSaved={() => refreshNotes()}
          onExpandToPopup={handleExpandToPopup}
        />
      );
    case 'general':
    default:
      return (
        <NoteEditorModal
          key={selectedNote.id}
          noteId={selectedNote.id}
          inline={true}
          onClose={() => {}}
          onSaved={() => refreshNotes()}
          onExpandToPopup={handleExpandToPopup}
        />
      );
  }
}

function MainContent() {
  const { 
    currentView, 
    showUnsavedModal, 
    discardAndExecute, 
    cancelPendingAction, 
    saveAndExecute,
    todosFilterTaskId,
    setCurrentView,
    setSelectedNoteId,
    selectedClientId,
    clients,
    billingEditorRun,
    closeBillingEditor,
  } = useApp();

  if (currentView === 'config') {
    return (
      <>
        <ConfigPanel />
        <UnsavedChangesModal
          isOpen={showUnsavedModal}
          onDiscard={discardAndExecute}
          onCancel={cancelPendingAction}
          onSave={saveAndExecute}
        />
      </>
    );
  }

  if (currentView === 'timesheets') {
    return (
      <>
        <TimeSheetView />
        <UnsavedChangesModal
          isOpen={showUnsavedModal}
          onDiscard={discardAndExecute}
          onCancel={cancelPendingAction}
          onSave={saveAndExecute}
        />
      </>
    );
  }

  // REQ-026: Billing view
  if (currentView === 'billing') {
    return (
      <>
        <BillingScreen />
        <UnsavedChangesModal
          isOpen={showUnsavedModal}
          onDiscard={discardAndExecute}
          onCancel={cancelPendingAction}
          onSave={saveAndExecute}
        />
      </>
    );
  }

  if (currentView === 'billingEditor') {
    const defaultClient = clients.find((client) => client.id === selectedClientId);

    return (
      <div className="flex-1 flex flex-col bg-gray-950 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-end">
          <button
            type="button"
            onClick={() => setCurrentView('billing')}
            className="px-3 py-2 bg-gray-800 text-gray-200 rounded hover:bg-gray-700"
          >
            Volver al historial
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <BillingEditorModal
            open
            billingRun={billingEditorRun ?? undefined}
            clientId={defaultClient?.id || ''}
            clientName={billingEditorRun?.clientName || defaultClient?.name || 'Seleccionar cliente'}
            onClose={closeBillingEditor}
            onSaved={() => {
              closeBillingEditor();
            }}
          />
        </div>
      </div>
    );
  }

  // REQ-021: TODOs view - dual panel: TodosCardsView (left) + InlineEditorPanel (right)
  if (currentView === 'todos') {
    return (
      <>
        <TodosCardsView 
          filterTaskId={todosFilterTaskId}
          onNavigateToTask={(taskId) => setSelectedNoteId(taskId)}
          onClose={todosFilterTaskId ? () => setCurrentView('all') : undefined}
        />
        <InlineEditorPanel />
        <UnsavedChangesModal
          isOpen={showUnsavedModal}
          onDiscard={discardAndExecute}
          onCancel={cancelPendingAction}
          onSave={saveAndExecute}
        />
      </>
    );
  }

  // Notes views - dual panel layout: NotesList + InlineEditorPanel
  return (
    <>
      <NotesList />
      <InlineEditorPanel />
      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        onDiscard={discardAndExecute}
        onCancel={cancelPendingAction}
        onSave={saveAndExecute}
      />
    </>
  );
}

// pull the visibility state inside a component that is a child of the provider
function AppLayout() {
  const { isSidebarVisible, saveCurrentNote } = useApp();
  const [toast, setToast] = useState<{ message: string } | null>(null);

  // keyboard shortcut for save
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveCurrentNote().then(() => {
          setToast({ message: 'Cambios guardados' });
        });
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [saveCurrentNote]);

  // REQ-021: Poll for TODO notifications every minute
  useEffect(() => {
    const checkNotifications = async () => {
      try {
        await fetch('/api/todos/notify', { method: 'POST' });
      } catch (error) {
        console.error('Error checking TODO notifications:', error);
      }
    };

    // Check immediately on mount
    checkNotifications();
    
    // Then check every minute
    const interval = setInterval(checkNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      <TopBar />
      <div className="flex-1 flex overflow-hidden relative">
        {isSidebarVisible && <Sidebar />}
        <MainContent />
      </div>
      <FloatingActionButton />
      <GlobalDropZone />
      {toast && (
        <Toast message={toast.message} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <AppLayout />
    </AppProvider>
  );
}
