'use client';

import { AppProvider, useApp } from './context/AppContext';
import { TopBar, Sidebar, NotesList, EditorPanel, ConfigPanel, TimeSheetView } from './components';

function MainContent() {
  const { currentView } = useApp();

  if (currentView === 'config') {
    return <ConfigPanel />;
  }

  if (currentView === 'timesheets') {
    return <TimeSheetView />;
  }

  return (
    <>
      <NotesList />
      <EditorPanel />
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
