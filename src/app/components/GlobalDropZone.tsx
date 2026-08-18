'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function GlobalDropZone() {
  const { selectedNote, persistNewNote, refreshNotes } = useApp();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  
  // Ref to always have current selectedNote (fixes stale closure in handleDrop)
  const selectedNoteRef = useRef(selectedNote);
  selectedNoteRef.current = selectedNote;
  
  // Check if we have a valid note to attach to
  const canReceiveFiles = !!selectedNote;

  const uploadFile = useCallback(async (file: File, noteId: string): Promise<boolean> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('noteId', noteId);

    try {
      const response = await fetch('/api/attachments', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Upload failed');
      }

      return true;
    } catch (error) {
      console.error('Failed to upload:', error);
      const message = error instanceof Error ? error.message : 'Upload failed';
      alert(message);
      return false;
    }
  }, []);

  const handleDrop = useCallback(async (files: FileList) => {
    const currentNote = selectedNoteRef.current;
    if (!currentNote || files.length === 0) return;
    
    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });
    
    let targetId = currentNote.id;
    
    // If temporary note, persist it first
    if (targetId.startsWith('temp-')) {
      const savedNote = await persistNewNote({});
      if (!savedNote) {
        setUploading(false);
        return;
      }
      targetId = savedNote.id;
    }
    
    let successCount = 0;
    
    for (let i = 0; i < files.length; i++) {
      setUploadProgress({ current: i + 1, total: files.length });
      const success = await uploadFile(files[i], targetId);
      if (success) {
        successCount++;
      }
    }
    
    // Refresh notes to get attachments from DB (they're stored in Attachment table)
    if (successCount > 0) {
      await refreshNotes();
    }
    
    setUploading(false);
    setUploadProgress({ current: 0, total: 0 });
  }, [persistNewNote, uploadFile, refreshNotes]);

  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      
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
      
      dragCounter--;
      if (dragCounter === 0) {
        setIsDragging(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDropEvent = (e: DragEvent) => {
      e.preventDefault();
      
      dragCounter = 0;
      setIsDragging(false);
      
      if (e.dataTransfer?.files && canReceiveFiles) {
        handleDrop(e.dataTransfer.files);
      }
    };

    // Use capture phase to intercept events before child elements can stopPropagation
    document.addEventListener('dragenter', handleDragEnter, true);
    document.addEventListener('dragleave', handleDragLeave, true);
    document.addEventListener('dragover', handleDragOver, true);
    document.addEventListener('drop', handleDropEvent, true);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter, true);
      document.removeEventListener('dragleave', handleDragLeave, true);
      document.removeEventListener('dragover', handleDragOver, true);
      document.removeEventListener('drop', handleDropEvent, true);
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
      
      {/* Drop zone content - large area covering most of screen */}
      <div className={`
        relative z-10 flex flex-col items-center justify-center
        w-[80vw] h-[70vh] max-w-4xl
        border-4 border-dashed rounded-3xl
        transition-all duration-200
        ${uploading 
          ? 'border-yellow-500 bg-yellow-500/10' 
          : 'border-blue-500 bg-blue-500/10'
        }
      `}>
        {uploading ? (
          <>
            <Loader2 className="w-24 h-24 text-yellow-400 animate-spin mb-6" />
            <p className="text-2xl font-medium text-white">
              Subiendo archivos...
            </p>
            <p className="text-lg text-gray-400 mt-3">
              {uploadProgress.current} de {uploadProgress.total}
            </p>
          </>
        ) : (
          <>
            <Upload className="w-24 h-24 text-blue-400 mb-6" />
            <p className="text-2xl font-medium text-white">
              Soltar archivos aquí
            </p>
            <p className="text-lg text-gray-400 mt-3">
              Se asociarán a la nota actual
            </p>
          </>
        )}
      </div>
    </div>
  );
}
