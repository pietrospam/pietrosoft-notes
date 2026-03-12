'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Building2, FolderKanban, Database, Download, Upload, Loader2, Settings, Save, Clock, Trash2, Server, Shield, ShieldOff, RotateCcw, RefreshCw, Plus, FolderOpen, Timer, Calendar } from 'lucide-react';
import { ClientsManager } from './ClientsManager';
import { ProjectsManager } from './ProjectsManager';
import { useApp } from '../context/AppContext';
import { InfoModal } from './InfoModal';

export type ConfigTab = 'clients' | 'projects' | 'backup' | 'preferences';

interface BackupMetadata {
  filename: string;
  createdAt: string;
  sizeBytes: number;
  type: 'auto' | 'manual';
  description?: string;
  protected: boolean;
  stats?: {
    notes: number;
    clients: number;
    projects: number;
    attachments: number;
    timesheets: number;
    activityLogs: number;
    taskComments?: number;
  };
}

interface BackupSettings {
  retentionCount: number;
  autoBackupEnabled: boolean;
  autoBackupFrequency: 'daily' | 'weekly' | 'monthly';
  autoBackupTime: string;
  backupDirectory: string;
  lastAutoBackup?: string;
}

function ServerBackupsSection() {
  const { refreshNotes } = useApp();
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [settings, setSettings] = useState<BackupSettings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<BackupSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [restoringFilename, setRestoringFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Check if settings have changed
  const hasSettingsChanges = useCallback(() => {
    if (!settings || !originalSettings) return false;
    return settings.retentionCount !== originalSettings.retentionCount ||
      settings.autoBackupEnabled !== originalSettings.autoBackupEnabled ||
      settings.autoBackupFrequency !== originalSettings.autoBackupFrequency ||
      settings.autoBackupTime !== originalSettings.autoBackupTime;
  }, [settings, originalSettings]);

  const fetchBackups = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/backups');
      if (!res.ok) throw new Error('Failed to fetch backups');
      const data = await res.json();
      setBackups(data);
    } catch (err) {
      setError('No se pudo cargar la lista de backups');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/backups/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
      setSettings(data);
      setOriginalSettings(data);
    } catch (err) {
      console.error('Failed to fetch backup settings:', err);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
    fetchSettings();
  }, [fetchBackups, fetchSettings]);

  const handleCreateBackup = async () => {
    setIsCreating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'Manual backup' }),
      });
      if (!res.ok) throw new Error('Failed to create backup');
      const data = await res.json();
      setSuccessMessage(`Backup creado: ${data.filename}`);
      fetchBackups();
    } catch (err) {
      setError('No se pudo crear el backup');
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestore = async (filename: string) => {
    if (!confirm(`¿Estás seguro de restaurar el backup "${filename}"?\n\nEsto reemplazará TODOS los datos actuales.`)) {
      return;
    }
    setRestoringFilename(filename);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/backups/${encodeURIComponent(filename)}/restore`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to restore');
      setSuccessMessage(`Backup restaurado: ${data.restored.notes} notas, ${data.restored.clients} clientes, ${data.restored.projects} proyectos`);
      refreshNotes();
    } catch (err) {
      setError('No se pudo restaurar el backup');
      console.error(err);
    } finally {
      setRestoringFilename(null);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`¿Eliminar el backup "${filename}"?`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/backups/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      fetchBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
      console.error(err);
    }
  };

  const handleToggleProtect = async (filename: string, currentlyProtected: boolean) => {
    setError(null);
    try {
      const res = await fetch(`/api/backups/${encodeURIComponent(filename)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protected: !currentlyProtected }),
      });
      if (!res.ok) throw new Error('Failed to update');
      fetchBackups();
    } catch (err) {
      setError('No se pudo actualizar la protección');
      console.error(err);
    }
  };

  const handleDownload = (filename: string) => {
    window.open(`/api/backups/${encodeURIComponent(filename)}`, '_blank');
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setIsSavingSettings(true);
    setError(null);
    try {
      const res = await fetch('/api/backups/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      const data = await res.json();
      setSettings(data.settings);
      setOriginalSettings(data.settings);
      setSuccessMessage('Configuración guardada');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError('No se pudo guardar la configuración');
      console.error(err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Update local settings
  const updateSettings = (newSettings: Partial<BackupSettings>) => {
    if (!settings) return;
    setSettings({ ...settings, ...newSettings });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Server size={20} className="text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-white">Backups en Servidor</h3>
            <p className="text-gray-400 text-sm">Backups almacenados en el servidor</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${showSettings ? 'text-purple-400 bg-purple-500/20' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            title="Configuración"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={fetchBackups}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title="Refrescar lista"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleCreateBackup}
            disabled={isCreating}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            {isCreating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            Crear Backup
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 text-red-300 border border-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-900/50 text-green-300 border border-green-700 rounded-lg text-sm">
          {successMessage}
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && settings && (
        <div className="mb-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700/50 space-y-4">
          {/* Backup Directory */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              <FolderOpen size={14} className="inline mr-1" />
              Directorio de Backups
            </label>
            <div className="text-sm text-gray-400 bg-gray-900 px-3 py-2 rounded font-mono break-all">
              {settings.backupDirectory}
            </div>
          </div>

          {/* Retention */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              <Timer size={14} className="inline mr-1" />
              Retención de Backups
            </label>
            <div className="flex items-center gap-3">
              <select
                value={settings.retentionCount}
                onChange={(e) => updateSettings({ retentionCount: parseInt(e.target.value) })}
                className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value={0}>Ilimitado</option>
                <option value={5}>Últimos 5 backups</option>
                <option value={10}>Últimos 10 backups</option>
                <option value={20}>Últimos 20 backups</option>
                <option value={30}>Últimos 30 backups</option>
                <option value={50}>Últimos 50 backups</option>
              </select>
              <span className="text-xs text-gray-500">
                (Los backups protegidos no se eliminan)
              </span>
            </div>
          </div>

          {/* Auto-backup */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Calendar size={14} className="inline mr-1" />
              Backup Automático
            </label>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateSettings({ autoBackupEnabled: !settings.autoBackupEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.autoBackupEnabled ? 'bg-purple-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.autoBackupEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm text-gray-300">
                  {settings.autoBackupEnabled ? 'Activado' : 'Desactivado'}
                </span>
              </div>
              
              {settings.autoBackupEnabled && (
                <div className="flex items-center gap-3 ml-14">
                  <select
                    value={settings.autoBackupFrequency}
                    onChange={(e) => updateSettings({ autoBackupFrequency: e.target.value as BackupSettings['autoBackupFrequency'] })}
                    className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="daily">Diario</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensual</option>
                  </select>
                  <span className="text-xs text-gray-500">a las</span>
                  <input
                    type="time"
                    value={settings.autoBackupTime}
                    onChange={(e) => updateSettings({ autoBackupTime: e.target.value })}
                    className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              )}
              
              {settings.lastAutoBackup && (
                <div className="text-xs text-gray-500 ml-14">
                  Último backup automático: {formatDate(settings.lastAutoBackup)}
                </div>
              )}
            </div>
          </div>
          
          {/* Save Button */}
          <div className="pt-3 border-t border-gray-700">
            <button
              onClick={handleSaveSettings}
              disabled={isSavingSettings || !hasSettingsChanges()}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                hasSettingsChanges()
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isSavingSettings ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save size={16} />
                  {hasSettingsChanges() ? 'Guardar cambios' : 'Sin cambios pendientes'}
                </>
              )}
            </button>
            {hasSettingsChanges() && (
              <p className="text-xs text-yellow-400 text-center mt-2">
                Tienes cambios sin guardar
              </p>
            )}
          </div>
        </div>
      )}

      {/* Backup List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-gray-400" size={24} />
        </div>
      ) : backups.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No hay backups disponibles
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {backups.map((backup) => (
            <div
              key={backup.filename}
              className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50 hover:border-gray-600/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium text-sm truncate">
                    {backup.filename}
                  </span>
                  {backup.protected && (
                    <span title="Protegido">
                      <Shield size={14} className="text-yellow-500 flex-shrink-0" />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>{formatDate(backup.createdAt)}</span>
                  <span>{formatSize(backup.sizeBytes)}</span>
                  {backup.stats && (
                    <span>
                      {backup.stats.notes}n / {backup.stats.clients}c / {backup.stats.projects}p
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => handleToggleProtect(backup.filename, backup.protected)}
                  className="p-1.5 text-gray-400 hover:text-yellow-400 hover:bg-gray-700 rounded transition-colors"
                  title={backup.protected ? 'Quitar protección' : 'Proteger'}
                >
                  {backup.protected ? <ShieldOff size={16} /> : <Shield size={16} />}
                </button>
                <button
                  onClick={() => handleDownload(backup.filename)}
                  className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded transition-colors"
                  title="Descargar"
                >
                  <Download size={16} />
                </button>
                <button
                  onClick={() => handleRestore(backup.filename)}
                  disabled={restoringFilename === backup.filename}
                  className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                  title="Restaurar"
                >
                  {restoringFilename === backup.filename ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RotateCcw size={16} />
                  )}
                </button>
                <button
                  onClick={() => handleDelete(backup.filename)}
                  disabled={backup.protected}
                  className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={backup.protected ? 'No se puede eliminar (protegido)' : 'Eliminar'}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BackupManager() {
  const { refreshNotes } = useApp();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
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
        const msg = `Imported: ${result.imported.notes} notes, ${result.imported.timesheets || 0} timesheets, ${result.imported.clients} clients, ${result.imported.projects} projects, ${result.imported.attachments} attachments, ${result.imported.activityLogs || 0} activity logs`;
        setImportResult({ success: true, message: msg });
        // show modal asking user to refresh UI
        setInfoMessage(msg + '\nPlease refresh to update the interface.');
        setShowInfoModal(true);
        // also refresh notes state in the background so sidebar updates soon
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
        {/* render info modal for operations */}
        <InfoModal
          isOpen={showInfoModal}
          message={infoMessage || ''}
          onConfirm={() => {
            setShowInfoModal(false);
            window.location.reload();
          }}
        />
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
                const json = await res.json();
                if (res.ok) {
                  const msg = 'Workspace wiped successfully.';
                  setInfoMessage(msg + '\nPlease refresh to update the interface.');
                  setShowInfoModal(true);
                  refreshNotes();
                } else {
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

        {/* Server Backups Section */}
        <ServerBackupsSection />
      </div>
    </div>
  );
}

function PreferencesManager() {
  const { autoSaveEnabled, toggleAutoSave } = useApp();
  
  // TimeSheet preferences with original tracking
  const [dailyHoursTarget, setDailyHoursTarget] = useState<number>(8);
  const [exportDateFormat, setExportDateFormat] = useState<string>('DD/MM/YYYY');
  const [originalDailyHours, setOriginalDailyHours] = useState<number>(8);
  const [originalExportFormat, setOriginalExportFormat] = useState<string>('DD/MM/YYYY');
  const [timesheetSaved, setTimesheetSaved] = useState(false);
  
  // Lazy import TelegramConfig to avoid SSR issues
  const [TelegramConfigComponent, setTelegramConfigComponent] = useState<React.ComponentType | null>(null);
  
  useEffect(() => {
    import('./TelegramConfig').then(mod => {
      setTelegramConfigComponent(() => mod.TelegramConfig);
    });
  }, []);
  
  // Load from localStorage on mount
  useEffect(() => {
    const savedHours = localStorage.getItem('timesheet-daily-hours');
    const savedFormat = localStorage.getItem('timesheet-export-date-format');
    const hours = savedHours ? parseFloat(savedHours) : 8;
    const format = savedFormat || 'DD/MM/YYYY';
    setDailyHoursTarget(hours);
    setOriginalDailyHours(hours);
    setExportDateFormat(format);
    setOriginalExportFormat(format);
  }, []);
  
  // Check if timesheet settings have changed
  const hasTimesheetChanges = () => {
    return dailyHoursTarget !== originalDailyHours || exportDateFormat !== originalExportFormat;
  };
  
  const handleSaveTimesheetSettings = () => {
    localStorage.setItem('timesheet-daily-hours', dailyHoursTarget.toString());
    localStorage.setItem('timesheet-export-date-format', exportDateFormat);
    setOriginalDailyHours(dailyHoursTarget);
    setOriginalExportFormat(exportDateFormat);
    setTimesheetSaved(true);
    setTimeout(() => setTimesheetSaved(false), 3000);
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
                onChange={(e) => setDailyHoursTarget(parseFloat(e.target.value) || 8)}
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
                onChange={(e) => setExportDateFormat(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY (20/02/2026)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (2026-02-20)</option>
                <option value="DD-MM-YYYY">DD-MM-YYYY (20-02-2026)</option>
              </select>
            </div>
            
            {/* Save Button for TimeSheet settings */}
            <div className="pt-3 border-t border-gray-700">
              <button
                onClick={handleSaveTimesheetSettings}
                disabled={!hasTimesheetChanges()}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                  hasTimesheetChanges()
                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                {timesheetSaved ? (
                  <>
                    <span className="text-green-400">✓</span>
                    ¡Guardado!
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    {hasTimesheetChanges() ? 'Guardar cambios' : 'Sin cambios pendientes'}
                  </>
                )}
              </button>
              {hasTimesheetChanges() && (
                <p className="text-xs text-yellow-400 text-center mt-2">
                  Tienes cambios sin guardar
                </p>
              )}
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

        {/* Telegram Notifications */}
        {TelegramConfigComponent && <TelegramConfigComponent />}
      </div>
    </div>
  );
}

export function ConfigPanel() {
  const { configRequest, clearConfigRequest } = useApp();
  const [activeTab, setActiveTab] = useState<ConfigTab>('clients');

  // respond to external open-config requests
  useEffect(() => {
    if (configRequest) {
      setActiveTab(configRequest.tab);
      if (!configRequest.create) {
        clearConfigRequest();
      }
    }
  }, [configRequest, clearConfigRequest]);

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
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'clients' && <ClientsManager />}
        {activeTab === 'projects' && <ProjectsManager />}
        {activeTab === 'backup' && <BackupManager />}
        {activeTab === 'preferences' && <PreferencesManager />}
      </div>
    </div>
  );
}
