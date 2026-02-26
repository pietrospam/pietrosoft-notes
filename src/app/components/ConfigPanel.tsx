'use client';

import { useState, useRef, useEffect } from 'react';
import { Building2, FolderKanban, Database, Download, Upload, Loader2, Settings, Save, Clock, Trash2 } from 'lucide-react';
import { ClientsManager } from './ClientsManager';
import { ProjectsManager } from './ProjectsManager';
import { useApp } from '../context/AppContext';

type ConfigTab = 'clients' | 'projects' | 'backup' | 'preferences';

function BackupManager() {
  const { refreshNotes } = useApp();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/workspace/export');
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'backup.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm('This will replace all existing data. Are you sure you want to continue?')) {
      event.target.value = '';
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/workspace/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      console.log('Import response:', result);

      if (response.ok) {
        setImportResult({ 
          success: true, 
          message: `Imported: ${result.imported.notes} notes, ${result.imported.clients} clients, ${result.imported.projects} projects, ${result.imported.attachments} attachments` 
        });
        refreshNotes();
      } else {
        const msg = result.error || 'Import failed';
        const details = result.details ? `\nDetails: ${result.details}` : '';
        setImportResult({ success: false, message: msg + details });
      }
    } catch (error) {
      console.error('Import error:', error);
      setImportResult({ success: false, message: 'Import failed. Please try again.' });
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-xl font-semibold text-white mb-6">Backup & Restore</h2>
      
      <div className="space-y-6">
        {/* Export Section */}
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h3 className="text-lg font-medium text-white mb-2">Export Workspace</h3>
          <p className="text-gray-400 text-sm mb-4">
            Download a complete backup of all your notes, clients, projects, attachments (including blob data), and database tables as a ZIP file.
          </p>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {isExporting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Download size={18} />
            )}
            {isExporting ? 'Exporting...' : 'Export Backup'}
          </button>
        </div>

        {/* Wipe Section */}
        <div className="bg-gray-900 rounded-lg p-4 border border-red-800">
          <h3 className="text-lg font-medium text-white mb-2">Wipe Application Data</h3>
          <p className="text-red-400 text-sm mb-4">
            This will permanently delete <strong>all</strong> notes, clients, projects,
            attachments and configuration from both the database and the file storage.
          </p>
          <button
            onClick={async () => {
              if (!confirm('Are you absolutely sure? This action cannot be undone.')) return;
              try {
                const res = await fetch('/api/workspace/wipe', { method: 'POST' });
                if (res.ok) {
                  alert('Workspace wiped successfully.');
                  refreshNotes();
                } else {
                  const json = await res.json();
                  alert('Wipe failed: ' + (json.error || 'unknown error'));
                }
              } catch (err) {
                console.error('Wipe error:', err);
                alert('Wipe failed.');
              }
            }}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Trash2 size={18} />
            Wipe Workspace
          </button>
        </div>

        {/* Import Section */}
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h3 className="text-lg font-medium text-white mb-2">Import Workspace</h3>
          <p className="text-gray-400 text-sm mb-4">
            Restore data from a previous backup ZIP file. <span className="text-yellow-500">Warning: This will replace all existing data.</span>
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {isImporting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Upload size={18} />
            )}
            {isImporting ? 'Importing...' : 'Import Backup'}
          </button>

          {importResult && (
            <div className={`mt-4 p-3 rounded-lg text-sm ${
              importResult.success 
                ? 'bg-green-900/50 text-green-300 border border-green-700' 
                : 'bg-red-900/50 text-red-300 border border-red-700'
            }`}>
              {importResult.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PreferencesManager() {
  const { autoSaveEnabled, toggleAutoSave } = useApp();
  
  // TimeSheet preferences
  const [dailyHoursTarget, setDailyHoursTarget] = useState<number>(8);
  const [exportDateFormat, setExportDateFormat] = useState<string>('DD/MM/YYYY');
  
  // Load from localStorage on mount
  useEffect(() => {
    const savedHours = localStorage.getItem('timesheet-daily-hours');
    const savedFormat = localStorage.getItem('timesheet-export-date-format');
    if (savedHours) setDailyHoursTarget(parseFloat(savedHours));
    if (savedFormat) setExportDateFormat(savedFormat);
  }, []);
  
  const handleDailyHoursChange = (hours: number) => {
    setDailyHoursTarget(hours);
    localStorage.setItem('timesheet-daily-hours', hours.toString());
  };
  
  const handleExportFormatChange = (format: string) => {
    setExportDateFormat(format);
    localStorage.setItem('timesheet-export-date-format', format);
  };

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-xl font-semibold text-white mb-6">Preferencias</h2>
      
      <div className="space-y-6">
        {/* Auto-save Section */}
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Save size={20} className="text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-white">Auto-guardado</h3>
                <p className="text-gray-400 text-sm">
                  Guardar automáticamente los cambios después de 2 segundos de inactividad
                </p>
              </div>
            </div>
            <button
              onClick={toggleAutoSave}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoSaveEnabled ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoSaveEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div className="mt-3 text-sm text-gray-500">
            {autoSaveEnabled ? (
              <span className="text-green-400">✓ Auto-guardado activado</span>
            ) : (
              <span className="text-yellow-400">⚠ Deberás guardar manualmente con el botón de guardar</span>
            )}
          </div>
        </div>
        
        {/* TimeSheet Settings */}
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Clock size={20} className="text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-white">TimeSheets</h3>
              <p className="text-gray-400 text-sm">Configuración de la vista de TimeSheets</p>
            </div>
          </div>
          
          <div className="space-y-4 ml-11">
            {/* Daily hours target */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm text-white">Horas diarias objetivo</label>
                <p className="text-xs text-gray-500">Horas esperadas por día de trabajo</p>
              </div>
              <input
                type="number"
                min={1}
                max={24}
                step={0.5}
                value={dailyHoursTarget}
                onChange={(e) => handleDailyHoursChange(parseFloat(e.target.value) || 8)}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white w-20 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            
            {/* Export date format */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm text-white">Formato de fecha para exportación</label>
                <p className="text-xs text-gray-500">Usado en CSV y PDF</p>
              </div>
              <select
                value={exportDateFormat}
                onChange={(e) => handleExportFormatChange(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY (20/02/2026)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (2026-02-20)</option>
                <option value="DD-MM-YYYY">DD-MM-YYYY (20-02-2026)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Info about manual save */}
        <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800/50">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Guardado manual</h4>
          <p className="text-gray-500 text-sm">
            Siempre puedes guardar manualmente usando el botón de guardar (💾) en la barra del editor.
            Un punto amarillo indicará cuando hay cambios sin guardar.
          </p>
        </div>
      </div>
    </div>
  );
}

export function ConfigPanel() {
  const [activeTab, setActiveTab] = useState<ConfigTab>('clients');

  return (
    <div className="flex-1 bg-gray-950 flex overflow-hidden">
      {/* Tab Sidebar */}
      <div className="w-48 bg-gray-900 border-r border-gray-800">
        <div className="p-4">
          <h2 className="text-lg font-semibold text-white mb-4">Configuration</h2>
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('clients')}
              className={`
                w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                ${activeTab === 'clients'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }
              `}
            >
              <Building2 size={18} />
              Clients
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={`
                w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                ${activeTab === 'projects'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }
              `}
            >
              <FolderKanban size={18} />
              Projects
            </button>
            <button
              onClick={() => setActiveTab('backup')}
              className={`
                w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                ${activeTab === 'backup'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }
              `}
            >
              <Database size={18} />
              Backup
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className={`
                w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                ${activeTab === 'preferences'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }
              `}
            >
              <Settings size={18} />
              Preferencias
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'clients' && <ClientsManager />}
        {activeTab === 'projects' && <ProjectsManager />}
        {activeTab === 'backup' && <BackupManager />}
        {activeTab === 'preferences' && <PreferencesManager />}
      </div>
    </div>
  );
}
