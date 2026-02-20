'use client';

import { useState, useRef } from 'react';
import { Building2, FolderKanban, Database, Download, Upload, Loader2 } from 'lucide-react';
import { ClientsManager } from './ClientsManager';
import { ProjectsManager } from './ProjectsManager';
import { useApp } from '../context/AppContext';

type ConfigTab = 'clients' | 'projects' | 'backup';

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

      if (response.ok) {
        setImportResult({ 
          success: true, 
          message: `Imported: ${result.imported.notes} notes, ${result.imported.clients} clients, ${result.imported.projects} projects, ${result.imported.attachments} attachments` 
        });
        refreshNotes();
      } else {
        setImportResult({ success: false, message: result.error || 'Import failed' });
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
            Download a complete backup of all your notes, clients, projects, and attachments as a ZIP file.
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
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'clients' && <ClientsManager />}
        {activeTab === 'projects' && <ProjectsManager />}
        {activeTab === 'backup' && <BackupManager />}
      </div>
    </div>
  );
}
