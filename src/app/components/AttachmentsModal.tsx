'use client';

import { useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { AttachmentsPanel } from './AttachmentsPanel';
import type { AttachmentMeta } from '@/lib/types';

interface AttachmentsModalProps {
  noteId: string;
  attachments: AttachmentMeta[];
  onChange: (newList: AttachmentMeta[]) => void;
  onClose: () => void;
  disabledUpload?: boolean;
}

export function AttachmentsModal({ noteId, attachments, onChange, onClose, disabledUpload }: AttachmentsModalProps) {
  // Keep a ref to always have the latest attachments value
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

  // close on Esc
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Use useCallback with ref to avoid stale closure issues during multi-upload
  const onAdded = useCallback((a: AttachmentMeta) => {
    onChange([...attachmentsRef.current, a]);
  }, [onChange]);

  const onDeleted = useCallback((id: string) => {
    onChange(attachmentsRef.current.filter(a => a.id !== id));
  }, [onChange]);

  const onRenamed = useCallback((id: string, name: string) => {
    onChange(attachmentsRef.current.map(a => (a.id === id ? { ...a, originalName: name } : a)));
  }, [onChange]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999]">
      <div className="bg-gray-900 rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Archivos adjuntos</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <AttachmentsPanel
            noteId={noteId}
            attachments={attachments}
            onAttachmentAdded={onAdded}
            onAttachmentDeleted={onDeleted}
            onAttachmentRenamed={onRenamed}
            {...(disabledUpload ? {} : { onPersistNote: undefined })}
          />
        </div>
      </div>
    </div>
  );
}