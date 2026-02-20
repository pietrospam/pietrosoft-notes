'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface ToastProps {
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, action, duration = 3000, onClose }: ToastProps) {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(onClose, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(onClose, 300);
  };

  return (
    <div 
      className={`
        fixed bottom-4 right-4 z-50 flex items-center gap-3 
        bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 shadow-lg
        transition-all duration-300
        ${isLeaving ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}
      `}
    >
      <span className="text-white text-sm">{message}</span>
      
      {action && (
        <button
          onClick={() => {
            action.onClick();
            handleClose();
          }}
          className="text-blue-400 hover:text-blue-300 text-sm font-medium"
        >
          {action.label}
        </button>
      )}
      
      <button
        onClick={handleClose}
        className="text-gray-400 hover:text-white ml-2"
      >
        <X size={16} />
      </button>
    </div>
  );
}
