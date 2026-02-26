'use client';

import { useEffect, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onDiscard: () => void;
  onCancel: () => void;
  onSave: () => void;
}

export function UnsavedChangesModal({ isOpen, onDiscard, onCancel, onSave }: UnsavedChangesModalProps) {
  // Keyboard shortcuts: Enter = Save, Escape = Cancel
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  }, [onSave, onCancel]);

  useEffect(() => {
    if (!isOpen) return;
    
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div className="relative bg-gray-900 rounded-lg border border-gray-700 shadow-2xl w-full max-w-xs mx-4 p-4">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 p-1 text-gray-400 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-3">
          <div className="p-2 bg-yellow-500/20 rounded-full">
            <AlertTriangle size={24} className="text-yellow-500" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-base font-semibold text-white text-center mb-1">
          Cambios sin guardar
        </h2>

        {/* Message */}
        <p className="text-gray-400 text-center text-sm mb-4">
          ¿Qué deseas hacer?
        </p>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onDiscard}
            className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm font-medium transition-colors"
          >
            Descartar
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600 rounded-lg text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
