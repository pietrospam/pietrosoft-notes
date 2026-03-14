'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Paperclip } from 'lucide-react';
import { AttachmentsPanel } from './AttachmentsPanel';
import { useApp } from '../context/AppContext';
import type { AttachmentMeta } from '@/lib/types';

export function AttachmentsSidebar() {
  const {
    selectedNoteId,
    filteredNotes,
    updateNote,
    isAttachmentsSidebarOpen,
    setAttachmentsSidebarOpen,
    toggleAttachmentsSidebar,
  } = useApp();
  const [toast, setToast] = useState<{ message: string } | null>(null);

  const selectedNote = filteredNotes.find(n => n.id === selectedNoteId) || null;
  const attachments = selectedNote?.attachments || [];

  // Keep a ref to always have the latest attachments value (fixes multi-upload stale closure)
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  const selectedNoteRef = useRef(selectedNote);
  selectedNoteRef.current = selectedNote;

  // close when clicking outside
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!isAttachmentsSidebarOpen) return;
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setAttachmentsSidebarOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && isAttachmentsSidebarOpen) {
        setAttachmentsSidebarOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isAttachmentsSidebarOpen, setAttachmentsSidebarOpen]);

  // collapse when note changes
  useEffect(() => {
    setAttachmentsSidebarOpen(false);
  }, [selectedNoteId, setAttachmentsSidebarOpen]);

  // Use useCallback with refs to avoid stale closure issues during multi-upload
  const onAdded = useCallback((a: AttachmentMeta) => {
    if (!selectedNoteRef.current) return;
    updateNote(selectedNoteRef.current.id, { attachments: [...attachmentsRef.current, a] });
  }, [updateNote]);

  const onDeleted = useCallback((id: string) => {
    if (!selectedNoteRef.current) return;
    updateNote(selectedNoteRef.current.id, { attachments: attachmentsRef.current.filter(a => a.id !== id) });
  }, [updateNote]);

  const onRenamed = useCallback((id: string, newName: string) => {
    if (!selectedNoteRef.current) return;
    updateNote(selectedNoteRef.current.id, { 
      attachments: attachmentsRef.current.map(a => (a.id === id ? { ...a, originalName: newName } : a))
    });
  }, [updateNote]);

  // don't show panel at all if no note selected
  if (!selectedNote) return null;

  const isTemp = selectedNote.id.startsWith('temp-');

  // show button even for temp note but disable upload in panel if open

  return (
    <>
      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-3 py-1 rounded">
          {toast.message}
        </div>
      )}
      <div>
        {/* collapsed button */}
      <button
        onClick={() => {
          toggleAttachmentsSidebar();
          console.log('toggling attachments sidebar', !isAttachmentsSidebarOpen);
          setToast({ message: isAttachmentsSidebarOpen ? 'Cerrar panel de anexos' : 'Abrir panel de anexos' });
        }}
        aria-label={`Anexos (${attachments.length})`}
        className={`fixed top-1/2 transform -translate-y-1/2 flex items-center gap-1 px-2 py-1 bg-gray-800 rounded-l-lg text-gray-400 hover:text-white hover:bg-gray-700 z-40 ${isAttachmentsSidebarOpen ? 'right-72' : 'right-0'}`}
        title={`Anexos (${attachments.length})`}
      >
        <Paperclip size={16} />
        <span className="text-sm">{attachments.length}</span>
      </button>

      {/* expanded panel */}
      {isAttachmentsSidebarOpen && (
        <div
          ref={panelRef}
          className="fixed right-0 top-0 bottom-0 w-72 bg-gray-900 border-l border-gray-700 z-60 flex flex-col shadow-2xl"
        >
          <AttachmentsPanel
            noteId={selectedNote.id}
            attachments={attachments}
            onAttachmentAdded={onAdded}
            onAttachmentDeleted={onDeleted}
            onAttachmentRenamed={onRenamed}
            {...(isTemp ? { disabledUpload: true } : {})}
          />
        </div>
      )}
    </div>
  </>
  );
}