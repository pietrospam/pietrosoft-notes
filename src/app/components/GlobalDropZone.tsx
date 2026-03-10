'use client';

import { useEffect, useState, useCallback } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { AttachmentMeta } from '@/lib/types';

export function GlobalDropZone() {
  const { selectedNoteId, filteredNotes, updateNote, persistNewNote } = useApp();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  
  // Find the selected note
  const selectedNote = filteredNotes.find(n => n.id === selectedNoteId);
  
  // Check if we have a valid note to attach to
  const canReceiveFiles = !!selectedNote;

  const uploadFile = useCallback(async (file: File, noteId: string): Promise<AttachmentMeta | null> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('noteId', noteId);

    try {
      const response = await fetch('/api/attachments', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      return {
        id: data.id,
        filename: data.filename,
        originalName: data.originalName,
        mimeType: data.mimeType,
        size: data.size,
        createdAt: data.createdAt,
      };
    } catch (error) {
      console.error('Failed to upload:', error);
      return null;
    }
  }, []);

  const handleDrop = useCallback(async (files: FileList) => {
    if (!selectedNote || files.length === 0) return;
    
    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });
    
    let targetId = selectedNote.id;
    
    // If temporary note, persist it first
    if (targetId.startsWith('temp-')) {
      const savedNote = await persistNewNote({});
      if (!savedNote) {
        setUploading(false);
        return;
      }
      targetId = savedNote.id;
    }
    
    const newAttachments: AttachmentMeta[] = [];
    
    for (let i = 0; i < files.length; i++) {
      setUploadProgress({ current: i + 1, total: files.length });
      const attachment = await uploadFile(files[i], targetId);
      if (attachment) {
        newAttachments.push(attachment);
      }
    }
    
    if (newAttachments.length > 0) {
      const updatedAttachments = [...(selectedNote.attachments || []), ...newAttachments];
      await updateNote(targetId, { attachments: updatedAttachments });
    }
    
    setUploading(false);
    setUploadProgress({ current: 0, total: 0 });
  }, [selectedNote, persistNewNote, uploadFile, updateNote]);

  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Only show if files are being dragged and we have a note selected
      if (e.dataTransfer?.types.includes('Files') && canReceiveFiles) {
        dragCounter++;
        if (dragCounter === 1) {
          setIsDragging(true);
        }
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      dragCounter--;
      if (dragCounter === 0) {
        setIsDragging(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDropEvent = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      dragCounter = 0;
      setIsDragging(false);
      
      if (e.dataTransfer?.files && canReceiveFiles) {
        handleDrop(e.dataTransfer.files);
      }
    };

    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDropEvent);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDropEvent);
    };
  }, [canReceiveFiles, handleDrop]);

  // Don't render anything if not dragging/uploading
  if (!isDragging && !uploading) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
    >
      {/* Backdrop overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm pointer-events-auto" />
      
      {/* Drop zone content */}
      <div className={`
        relative z-10 flex flex-col items-center justify-center p-12
        border-4 border-dashed rounded-2xl
        transition-all duration-200
        ${uploading 
          ? 'border-yellow-500 bg-yellow-500/10' 
          : 'border-blue-500 bg-blue-500/10'
        }
      `}>
        {uploading ? (
          <>
            <Loader2 className="w-16 h-16 text-yellow-400 animate-spin mb-4" />
            <p className="text-xl font-medium text-white">
              Subiendo archivos...
            </p>
            <p className="text-gray-400 mt-2">
              {uploadProgress.current} de {uploadProgress.total}
            </p>
          </>
        ) : (
          <>
            <Upload className="w-16 h-16 text-blue-400 mb-4" />
            <p className="text-xl font-medium text-white">
              Soltar archivos aquí
            </p>
            <p className="text-gray-400 mt-2">
              Se asociarán a la nota actual
            </p>
          </>
        )}
      </div>
    </div>
  );
}
