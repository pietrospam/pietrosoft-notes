'use client';

import { useRef, useState } from 'react';
import { Paperclip, Download, Trash2, Upload, File, Image as ImageIcon, FileText, Loader2, Eye, Pencil, X, Check } from 'lucide-react';
import { AttachmentViewer } from './AttachmentViewer';
import type { AttachmentMeta } from '@/lib/types';

interface AttachmentsPanelProps {
  noteId: string;
  attachments: AttachmentMeta[];
  onAttachmentAdded: (attachment: AttachmentMeta) => void;
  onAttachmentDeleted: (attachmentId: string) => void;
  onAttachmentRenamed?: (attachmentId: string, newName: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return ImageIcon;
  if (mimeType.includes('pdf') || mimeType.includes('document')) return FileText;
  return File;
}

export function AttachmentsPanel({ 
  noteId, 
  attachments, 
  onAttachmentAdded, 
  onAttachmentDeleted,
  onAttachmentRenamed,
}: AttachmentsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingAttachment, setViewingAttachment] = useState<AttachmentMeta | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const handleUpload = async (file: File) => {
    // Skip if noteId is temporary (note not saved yet)
    if (noteId.startsWith('temp-')) {
      alert('Por favor guarda la nota antes de adjuntar archivos');
      return;
    }
    
    setUploading(true);
    
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
      onAttachmentAdded({
        id: data.id,
        filename: data.filename,
        originalName: data.originalName,
        mimeType: data.mimeType,
        size: data.size,
        createdAt: data.createdAt,
      });
    } catch (error) {
      console.error('Failed to upload:', error);
      alert('Error al subir el archivo');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachmentId: string) => {
    if (!confirm('¿Eliminar este anexo?')) return;
    
    setDeletingId(attachmentId);

    try {
      const response = await fetch(`/api/attachments/${attachmentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      onAttachmentDeleted(attachmentId);
    } catch (error) {
      console.error('Failed to delete:', error);
      alert('Error al eliminar el anexo');
    } finally {
      setDeletingId(null);
    }
  };

  const startRename = (attachment: AttachmentMeta) => {
    setRenamingId(attachment.id);
    // Remove extension for editing
    const lastDot = attachment.originalName.lastIndexOf('.');
    setRenameValue(lastDot > 0 ? attachment.originalName.substring(0, lastDot) : attachment.originalName);
  };

  const handleRename = async (attachment: AttachmentMeta) => {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }

    // Preserve original extension
    const lastDot = attachment.originalName.lastIndexOf('.');
    const extension = lastDot > 0 ? attachment.originalName.substring(lastDot) : '';
    const newName = renameValue.trim() + extension;

    if (newName === attachment.originalName) {
      setRenamingId(null);
      return;
    }

    try {
      const response = await fetch(`/api/attachments/${attachment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalName: newName }),
      });

      if (response.ok && onAttachmentRenamed) {
        onAttachmentRenamed(attachment.id, newName);
      }
    } catch (error) {
      console.error('Failed to rename:', error);
    } finally {
      setRenamingId(null);
    }
  };

  // REQ-008.1: Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Upload files sequentially
    for (const file of files) {
      await handleUpload(file);
    }
  };

  return (
    <div 
      className={`border-t border-gray-800 pt-4 mt-4 transition-colors ${isDragOver ? 'bg-blue-900/20 border-blue-500' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-400">
          <Paperclip size={14} />
          <span>Anexos ({attachments.length})</span>
        </div>
        
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Upload size={12} />
          )}
          <span>Agregar</span>
        </button>
        
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleUpload(file);
            }
            e.target.value = '';
          }}
        />
      </div>

      {attachments.length === 0 ? (
        <div className={`text-center py-4 border-2 border-dashed rounded-lg ${isDragOver ? 'border-blue-500 bg-blue-900/10' : 'border-gray-700'}`}>
          {isDragOver ? (
            <p className="text-xs text-blue-400">Suelta los archivos aquí</p>
          ) : (
            <p className="text-xs text-gray-600">Arrastra archivos aquí o usa el botón Agregar</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => {
            const Icon = getFileIcon(attachment.mimeType);
            const isDeleting = deletingId === attachment.id;
            const isRenaming = renamingId === attachment.id;
            
            return (
              <div
                key={attachment.id}
                className="flex items-center gap-3 p-2 bg-gray-900 rounded group hover:bg-gray-800 transition-colors"
              >
                <Icon size={16} className="text-gray-500 flex-shrink-0" />
                
                <div className="flex-1 min-w-0">
                  {isRenaming ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(attachment);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:border-blue-500"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRename(attachment)}
                        className="p-1 text-green-400 hover:bg-gray-700 rounded"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setRenamingId(null)}
                        className="p-1 text-gray-400 hover:bg-gray-700 rounded"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-300 truncate">{attachment.originalName}</p>
                      <p className="text-xs text-gray-600">{formatFileSize(attachment.size)}</p>
                    </>
                  )}
                </div>
                
                {!isRenaming && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Preview */}
                    <button
                      onClick={() => setViewingAttachment(attachment)}
                      className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors"
                      title="Ver"
                    >
                      <Eye size={14} />
                    </button>
                    
                    {/* Download */}
                    <a
                      href={`/api/attachments/${attachment.id}?download=true`}
                      download={attachment.originalName}
                      className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors"
                      title="Descargar"
                    >
                      <Download size={14} />
                    </a>
                    
                    {/* Rename */}
                    <button
                      onClick={() => startRename(attachment)}
                      className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors"
                      title="Renombrar"
                    >
                      <Pencil size={14} />
                    </button>
                    
                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(attachment.id)}
                      disabled={isDeleting}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                      title="Eliminar"
                    >
                      {isDeleting ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Attachment viewer modal */}
      {viewingAttachment && (
        <AttachmentViewer
          attachment={viewingAttachment}
          allAttachments={attachments}
          onClose={() => setViewingAttachment(null)}
          onNavigate={(att) => setViewingAttachment(att)}
        />
      )}
    </div>
  );
}
