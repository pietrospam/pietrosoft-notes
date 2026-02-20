'use client';

import { useRef, useState } from 'react';
import { Paperclip, Download, Trash2, Upload, File, Image as ImageIcon, FileText, Loader2 } from 'lucide-react';
import type { AttachmentMeta } from '@/lib/types';

interface AttachmentsPanelProps {
  noteId: string;
  attachments: AttachmentMeta[];
  onAttachmentAdded: (attachment: AttachmentMeta) => void;
  onAttachmentDeleted: (attachmentId: string) => void;
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
  onAttachmentDeleted 
}: AttachmentsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
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
      alert('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachmentId: string) => {
    if (!confirm('Delete this attachment?')) return;
    
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
      alert('Failed to delete attachment');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="border-t border-gray-800 pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-400">
          <Paperclip size={14} />
          <span>Attachments ({attachments.length})</span>
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
          <span>Add file</span>
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
        <p className="text-xs text-gray-600 py-2">No attachments</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => {
            const Icon = getFileIcon(attachment.mimeType);
            const isDeleting = deletingId === attachment.id;
            
            return (
              <div
                key={attachment.id}
                className="flex items-center gap-3 p-2 bg-gray-900 rounded group hover:bg-gray-800 transition-colors"
              >
                <Icon size={16} className="text-gray-500 flex-shrink-0" />
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300 truncate">{attachment.originalName}</p>
                  <p className="text-xs text-gray-600">{formatFileSize(attachment.size)}</p>
                </div>
                
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={`/api/attachments/${attachment.id}?download=true`}
                    download={attachment.originalName}
                    className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors"
                    title="Download"
                  >
                    <Download size={14} />
                  </a>
                  
                  <button
                    onClick={() => handleDelete(attachment.id)}
                    disabled={isDeleting}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    {isDeleting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
