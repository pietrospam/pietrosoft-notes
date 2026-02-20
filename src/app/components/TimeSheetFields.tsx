'use client';

import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import type { TimeSheetNote, TaskNote, TimeSheetState } from '@/lib/types';

const STATES: { value: TimeSheetState; label: string; color: string }[] = [
  { value: 'NONE', label: 'None', color: 'bg-gray-500' },
  { value: 'PENDING', label: 'Pending', color: 'bg-yellow-500' },
  { value: 'IMPUTED', label: 'Imputed', color: 'bg-green-500' },
];

interface TimeSheetFieldsProps {
  note: TimeSheetNote;
  onChange: (data: Partial<TimeSheetNote>) => void;
}

export function TimeSheetFields({ note, onChange }: TimeSheetFieldsProps) {
  const [tasks, setTasks] = useState<TaskNote[]>([]);

  useEffect(() => {
    fetch('/api/notes?type=task')
      .then(r => r.json())
      .then((notes: TaskNote[]) => setTasks(notes));
  }, []);

  const selectedTask = tasks.find(t => t.id === note.taskId);

  return (
    <div className="space-y-4">
      {/* Task Selection */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Related Task *</label>
        <div className="relative">
          <select
            value={note.taskId || ''}
            onChange={(e) => onChange({ taskId: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 appearance-none"
          >
            <option value="">Select task...</option>
            {tasks.map(t => (
              <option key={t.id} value={t.id}>
                {t.ticketPhaseCode} - {t.title}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
        {selectedTask && (
          <p className="text-xs text-gray-500 mt-1">
            {selectedTask.shortDescription}
          </p>
        )}
      </div>

      {/* Work Date & Hours */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Work Date *</label>
          <input
            type="date"
            value={note.workDate?.split('T')[0] || ''}
            onChange={(e) => onChange({ workDate: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Hours Worked *</label>
          <input
            type="number"
            step="0.25"
            min="0"
            max="24"
            value={note.hoursWorked ?? ''}
            onChange={(e) => onChange({ hoursWorked: parseFloat(e.target.value) || 0 })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            placeholder="0.0"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Work Description *</label>
        <textarea
          value={note.description || ''}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={3}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
          placeholder="What did you work on?"
        />
      </div>

      {/* State */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Imputation State</label>
        <div className="flex gap-2">
          {STATES.map(s => (
            <button
              key={s.value}
              type="button"
              onClick={() => onChange({ state: s.value })}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                note.state === s.value
                  ? `${s.color} text-white`
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
