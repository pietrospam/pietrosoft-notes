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
      <div className="relative bg-gray-900 rounded-xl border border-gray-700 shadow-2xl w-full max-w-md mx-4 p-6">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-yellow-500/20 rounded-full">
            <AlertTriangle size={32} className="text-yellow-500" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-white text-center mb-2">
          Cambios sin guardar
        </h2>

        {/* Message */}
        <p className="text-gray-400 text-center mb-6">
          Tienes cambios que no se han guardado. ¿Qué deseas hacer?
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onDiscard}
            className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg font-medium transition-colors"
          >
            Descartar
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600 rounded-lg font-medium transition-colors"
          >
            Cancelar <span className="text-gray-500 text-xs">(Esc)</span>
          </button>
          <button
            onClick={onSave}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Guardar <span className="text-blue-300 text-xs">(↵)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
