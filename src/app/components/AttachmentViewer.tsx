'use client';

import { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AttachmentMeta } from '@/lib/types';

interface AttachmentViewerProps {
  attachment: AttachmentMeta;
  allAttachments?: AttachmentMeta[];
  onClose: () => void;
  onNavigate?: (attachment: AttachmentMeta) => void;
}

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'];
const TEXT_TYPES = [
  'text/plain', 'text/markdown', 'text/html', 'text/css', 'text/csv',
  'application/json', 'application/xml', 'text/xml', 'application/javascript',
  'text/javascript', 'application/typescript', 'text/typescript',
  'application/x-yaml', 'text/yaml', 'application/sql', 'text/x-sql',
];

function isImageType(mimeType: string): boolean {
  return IMAGE_TYPES.includes(mimeType) || mimeType.startsWith('image/');
}

function isTextType(mimeType: string): boolean {
  return TEXT_TYPES.includes(mimeType) || 
         mimeType.startsWith('text/') ||
         mimeType.includes('json') ||
         mimeType.includes('xml') ||
         mimeType.includes('javascript') ||
         mimeType.includes('yaml');
}

function isPdfType(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

export function AttachmentViewer({ attachment, allAttachments, onClose, onNavigate }: AttachmentViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const url = `/api/attachments/${attachment.id}`;
  const downloadUrl = `${url}?download=true`;

  // Load text content
  useEffect(() => {
    if (isTextType(attachment.mimeType)) {
      setLoading(true);
      fetch(url)
        .then(res => res.text())
        .then(text => {
          setTextContent(text);
          setLoading(false);
        })
        .catch(() => {
          setTextContent('Error loading file content');
          setLoading(false);
        });
    }
  }, [attachment.id, attachment.mimeType, url]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        setZoom(z => Math.min(z + 0.25, 3));
      } else if (e.key === '-') {
        setZoom(z => Math.max(z - 0.25, 0.25));
      } else if (allAttachments && onNavigate) {
        const currentIndex = allAttachments.findIndex(a => a.id === attachment.id);
        if (e.key === 'ArrowLeft' && currentIndex > 0) {
          onNavigate(allAttachments[currentIndex - 1]);
        } else if (e.key === 'ArrowRight' && currentIndex < allAttachments.length - 1) {
          onNavigate(allAttachments[currentIndex + 1]);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, attachment.id, allAttachments, onNavigate]);

  // Navigation buttons
  const currentIndex = allAttachments?.findIndex(a => a.id === attachment.id) ?? -1;
  const canGoPrev = allAttachments && currentIndex > 0;
  const canGoNext = allAttachments && currentIndex < allAttachments.length - 1;

  return (
    <div 
      className="fixed inset-0 bg-black/90 z-50 flex flex-col"
      onClick={onClose}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-3 bg-gray-900/80"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-white font-medium truncate">{attachment.originalName}</h3>
        <div className="flex items-center gap-2">
          {isImageType(attachment.mimeType) && (
            <>
              <button
                onClick={() => setZoom(z => Math.max(z - 0.25, 0.25))}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title="Zoom out"
              >
                <ZoomOut size={20} />
              </button>
              <span className="text-gray-400 text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title="Zoom in"
              >
                <ZoomIn size={20} />
              </button>
            </>
          )}
          <a
            href={downloadUrl}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Descargar"
            onClick={e => e.stopPropagation()}
          >
            <Download size={20} />
          </a>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div 
        className="flex-1 flex items-center justify-center overflow-auto p-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Navigation arrows */}
        {canGoPrev && onNavigate && (
          <button
            onClick={() => onNavigate(allAttachments![currentIndex - 1])}
            className="absolute left-4 p-3 bg-gray-800/80 hover:bg-gray-700 rounded-full text-white transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        
        {canGoNext && onNavigate && (
          <button
            onClick={() => onNavigate(allAttachments![currentIndex + 1])}
            className="absolute right-4 p-3 bg-gray-800/80 hover:bg-gray-700 rounded-full text-white transition-colors"
          >
            <ChevronRight size={24} />
          </button>
        )}

        {/* Image viewer */}
        {isImageType(attachment.mimeType) && (
          <img
            src={url}
            alt={attachment.originalName}
            className="max-w-full max-h-full object-contain transition-transform"
            style={{ transform: `scale(${zoom})` }}
          />
        )}

        {/* Text viewer */}
        {isTextType(attachment.mimeType) && (
          <div className="w-full max-w-4xl max-h-full bg-gray-900 rounded-lg overflow-auto">
            {loading ? (
              <div className="p-4 text-gray-400">Cargando...</div>
            ) : (
              <pre className="p-4 text-sm text-gray-300 font-mono whitespace-pre-wrap break-words">
                {textContent}
              </pre>
            )}
          </div>
        )}

        {/* PDF viewer */}
        {isPdfType(attachment.mimeType) && (
          <iframe
            src={url}
            className="w-full h-full bg-white rounded-lg"
            title={attachment.originalName}
          />
        )}

        {/* Unsupported type */}
        {!isImageType(attachment.mimeType) && !isTextType(attachment.mimeType) && !isPdfType(attachment.mimeType) && (
          <div className="text-center text-gray-400">
            <p className="mb-4">Vista previa no disponible para este tipo de archivo</p>
            <a
              href={downloadUrl}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Download size={18} />
              <span>Descargar archivo</span>
            </a>
          </div>
        )}
      </div>

      {/* Footer with file info */}
      <div 
        className="px-4 py-2 bg-gray-900/80 text-center text-gray-500 text-sm"
        onClick={e => e.stopPropagation()}
      >
        {attachment.mimeType} • {formatFileSize(attachment.size)}
        {allAttachments && allAttachments.length > 1 && (
          <span className="ml-4">
            {currentIndex + 1} / {allAttachments.length}
          </span>
        )}
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
