'use client';

import { useEffect, useCallback } from 'react';
import { CheckCircle, X } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
}

export function InfoModal({ isOpen, message, onConfirm }: InfoModalProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onConfirm();
    }
  }, [onConfirm]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onConfirm}
      />
      <div className="relative bg-gray-900 rounded-lg border border-gray-700 shadow-2xl w-full max-w-xs mx-4 p-4">
        <button
          onClick={onConfirm}
          className="absolute top-3 right-3 p-1 text-gray-400 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>

        <div className="flex justify-center mb-3">
          <div className="p-2 bg-green-500/20 rounded-full">
            <CheckCircle size={24} className="text-green-500" />
          </div>
        </div>

        <p className="text-gray-200 text-center text-sm mb-4">
          {message}
        </p>

        <div className="flex justify-center">
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
