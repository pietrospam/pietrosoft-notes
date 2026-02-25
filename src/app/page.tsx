'use client';

import { useEffect, useCallback } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { TopBar, Sidebar, NotesList, ConfigPanel, TimeSheetView, UnsavedChangesModal } from './components';
import { TaskEditorModal } from './components/TaskEditorModal';
import { NoteEditorModal } from './components/NoteEditorModal';
import { ConnectionEditorModal } from './components/ConnectionEditorModal';

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
        <ConnectionEditorModal
          key={selectedNote.id}
          noteId={selectedNote.id}
          inline={true}
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
  const { currentView, showUnsavedModal, discardAndExecute, cancelPendingAction, saveAndExecute } = useApp();

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

export default function Home() {
  return (
    <AppProvider>
      <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden">
        <TopBar />
        <div className="flex-1 flex overflow-hidden">
          <Sidebar />
          <MainContent />
        </div>
      </div>
    </AppProvider>
  );
}
