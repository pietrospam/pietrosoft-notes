'use client';

import { useEffect } from 'react';
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
  // close on Esc
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const onAdded = (a: AttachmentMeta) => onChange([...attachments, a]);
  const onDeleted = (id: string) => onChange(attachments.filter(a => a.id !== id));
  const onRenamed = (id: string, name: string) =>
    onChange(
      attachments.map(a => (a.id === id ? { ...a, originalName: name } : a))
    );

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60">
      <div className="bg-gray-900 rounded-lg w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
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