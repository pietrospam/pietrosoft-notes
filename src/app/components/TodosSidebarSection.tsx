'use client';

/**
 * TodosSidebarSection Component
 * REQ-021: Sección de TODOs en la sidebar
 * 
 * Muestra un botón que navega a la vista de TODOs.
 * Al hacer click, NO se despliega una lista - se navega a TodosCardsView.
 */

import { useEffect, useState, useCallback } from 'react';
import { Flag } from 'lucide-react';

interface TodosSidebarSectionProps {
  onShowTodosView: () => void;  // Navigate to TODOs view
  refreshTrigger?: number;
}

export function TodosSidebarSection({ onShowTodosView, refreshTrigger = 0 }: TodosSidebarSectionProps) {
  const [counts, setCounts] = useState({ totalPending: 0, totalOverdue: 0 });
  const [loading, setLoading] = useState(true);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/todos?count=true');
      if (res.ok) {
        const data = await res.json();
        setCounts(data);
      }
    } catch (error) {
      console.error('Error fetching TODO counts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts, refreshTrigger]);

  // Refetch every minute for deadline updates
  useEffect(() => {
    const interval = setInterval(fetchCounts, 60000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  if (loading) {
    return (
      <div className="px-2 py-2">
        <div className="flex items-center gap-2 text-gray-500">
          <Flag size={16} />
          <span className="text-sm opacity-0 lg:opacity-100">TODOs</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2">
      {/* Section header - click navigates to TODOs view */}
      <button
        onClick={onShowTodosView}
        className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm
          text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
      >
        <Flag 
          size={18} 
          className={counts.totalOverdue > 0 ? 'text-red-500' : (counts.totalPending > 0 ? 'text-orange-500' : 'text-gray-400')} 
        />
        <span className="opacity-0 lg:opacity-100 transition-opacity">TODOs</span>
        {counts.totalPending > 0 && (
          <span className={`ml-auto px-1.5 py-0.5 text-xs rounded-full ${
            counts.totalOverdue > 0 
              ? 'bg-red-600 text-white' 
              : 'bg-orange-600 text-white'
          }`}>
            {counts.totalPending}
          </span>
        )}
      </button>
    </div>
  );
}
