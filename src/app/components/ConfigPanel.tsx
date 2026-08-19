'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Building2, FolderKanban, Database, Download, Upload, Loader2, Settings, Save, Clock, Trash2, Server, Shield, ShieldOff, RotateCcw, RefreshCw, Plus, FolderOpen, Timer, Calendar, Clipboard, Pencil, X } from 'lucide-react';
import { ClientsManager } from './ClientsManager';
import { ProjectsManager } from './ProjectsManager';
import { BillingMethodsManager } from './BillingMethodsManager';
import { useApp } from '../context/AppContext';
import { InfoModal } from './InfoModal';

export type ConfigTab = 'clients' | 'projects' | 'backup' | 'preferences' | 'billing' | 'system';

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
    taskTodos?: number;
    todoNotificationsSent?: number;
    billingMethods?: number;
    billingRuns?: number;
    billingRunItems?: number;
  };
}

interface BackupSettings {
  retentionCount: number;
  maxAgeDays: number;
  autoBackupEnabled: boolean;
  autoBackupFrequency: 'daily' | 'weekly' | 'monthly';
  autoBackupTime: string;
  backupDirectory: string;
  lastAutoBackup?: string;
}

const RESTORE_COUNT_LABELS: Array<{ key: string; label: string }> = [
  { key: 'notes', label: 'Notas' },
  { key: 'clients', label: 'Clientes' },
  { key: 'projects', label: 'Proyectos' },
  { key: 'timesheets', label: 'Timesheets' },
  { key: 'attachments', label: 'Adjuntos' },
  { key: 'activityLogs', label: 'Activity Logs' },
  { key: 'taskComments', label: 'Comentarios de tareas' },
  { key: 'taskTodos', label: 'TODOs de tareas' },
  { key: 'billingMethods', label: 'Metodos de facturacion' },
  { key: 'billingRuns', label: 'Corridas de facturacion' },
  { key: 'billingRunItems', label: 'Items de facturacion' },
  { key: 'todoNotificationsSent', label: 'Notificaciones de TODO enviadas' },
];

function SystemDatabaseSection() {
  const [stats, setStats] = useState<{
    databaseName: string;
    databaseSizeBytes: number;
    totalRows: number;
    totalDiskBytes: number;
    tableCount: number;
    tables: Array<{ tableName: string; rowCount: number; sizeBytes: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/system/database');
        if (!res.ok) {
          throw new Error('No se pudo cargar la información de la base de datos');
        }
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'No se pudo cargar la información');
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const prettyTableName = (tableName: string) => {
    const tableLabels: Record<string, string> = {
      notes: 'Notas',
      clients: 'Clientes',
      projects: 'Proyectos',
      timesheets: 'Timesheets',
      attachments: 'Adjuntos',
      task_activity_logs: 'Activity Logs',
      task_comments: 'Comentarios',
      task_todos: 'TODOs',
      billing_methods: 'Métodos',
      billing_runs: 'Runs',
      billing_run_items: 'Items',
      todo_notifications_sent: 'Notif. TODO',
    };

    return tableLabels[tableName] ?? tableName.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-violet-500/20 rounded-lg">
          <Database size={20} className="text-violet-400" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-white">Base de Datos</h3>
          <p className="text-gray-400 text-sm">Estado, tamaño y cantidad de registros por tabla</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 text-red-300 border border-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10 text-gray-400">
          <Loader2 className="animate-spin mr-2" size={18} />
          Cargando métricas de la base de datos...
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl border border-gray-700 bg-slate-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-gray-400">Base</div>
              <div className="mt-2 text-lg font-semibold text-white">{stats.databaseName}</div>
            </div>
            <div className="rounded-xl border border-gray-700 bg-slate-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-gray-400">Tamaño</div>
              <div className="mt-2 text-lg font-semibold text-white">{formatBytes(stats.databaseSizeBytes)}</div>
            </div>
            <div className="rounded-xl border border-gray-700 bg-slate-950/60 p-3">
              <div className="text-xs uppercase tracking-wide text-gray-400">Total filas</div>
              <div className="mt-2 text-lg font-semibold text-white">{stats.totalRows.toLocaleString()}</div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-700 bg-slate-950/40 overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-800 px-3 py-2">
              <div className="text-sm font-medium text-white">Tablas</div>
              <div className="text-xs text-gray-400">{stats.tableCount} tablas · {formatBytes(stats.totalDiskBytes)}</div>
            </div>

            <div className="divide-y divide-gray-800">
              {stats.tables.map((table) => (
                <div key={table.tableName} className="grid grid-cols-[minmax(0,1fr)_110px_110px] items-center gap-3 px-3 py-2 text-sm">
                  <div className="text-gray-200 truncate">{prettyTableName(table.tableName)}</div>
                  <div className="text-right font-mono text-gray-100">{table.rowCount.toLocaleString()}</div>
                  <div className="text-right font-mono text-gray-400">{formatBytes(table.sizeBytes)}</div>
                </div>
              ))}
            </div>
          </div>
        </> 
      ) : null}
    </div>
  );
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
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [uploadFilename, setUploadFilename] = useState('');
  const [uploadProtected, setUploadProtected] = useState(false);
  const [uploadedBackupFilename, setUploadedBackupFilename] = useState<string | null>(null);
  const [editingFilename, setEditingFilename] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [editingProtected, setEditingProtected] = useState(false);
  const [savingFilename, setSavingFilename] = useState<string | null>(null);
  const [showRestoreSummaryModal, setShowRestoreSummaryModal] = useState(false);
  const [restoreSummaryFilename, setRestoreSummaryFilename] = useState('');
  const [restoreSummaryCounts, setRestoreSummaryCounts] = useState<Record<string, number>>({});
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Check if settings have changed
  const hasSettingsChanges = useCallback(() => {
    if (!settings || !originalSettings) return false;
    return settings.retentionCount !== originalSettings.retentionCount ||
      settings.maxAgeDays !== originalSettings.maxAgeDays ||
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
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const errorMessage = data?.error || 'Failed to create backup';
        throw new Error(errorMessage);
      }
      setSuccessMessage(`Backup creado: ${data.filename}`);
      fetchBackups();
    } catch (err) {
      setError('No se pudo crear el backup');
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const uploadBackupFile = async (file: File, desiredFilename: string, shouldProtect: boolean) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadedBackupFilename(null);
    setError(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (desiredFilename.trim()) {
        formData.append('filename', desiredFilename.trim());
      }
      formData.append('protected', String(shouldProtect));

      const data = await new Promise<{ filename: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/backups');

        xhr.upload.onprogress = (progressEvent) => {
          if (!progressEvent.lengthComputable) return;
          setUploadProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
        };

        xhr.onerror = () => reject(new Error('No se pudo subir el backup'));
        xhr.onload = () => {
          try {
            const parsed = JSON.parse(xhr.responseText || '{}') as { error?: string; filename?: string };
            if (xhr.status >= 200 && xhr.status < 300 && parsed.filename) {
              resolve({ filename: parsed.filename });
              return;
            }
            reject(new Error(parsed.error || 'Failed to upload backup'));
          } catch {
            reject(new Error('Respuesta inválida del servidor'));
          }
        };

        xhr.send(formData);
      });

      setUploadProgress(100);
      setUploadedBackupFilename(data.filename);
      setSuccessMessage(`Backup subido: ${data.filename}`);
      await fetchBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el backup');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelectedUploadFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedUploadFile(file);
    const effectiveFilename = uploadFilename.trim() || file.name.replace(/\.zip$/i, '');
    setUploadFilename(effectiveFilename);
    void uploadBackupFile(file, effectiveFilename, uploadProtected);
  };

  const resetUploadState = () => {
    setIsUploading(false);
    setUploadProgress(0);
    setSelectedUploadFile(null);
    setUploadFilename('');
    setUploadProtected(false);
    setUploadedBackupFilename(null);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
    }
  };

  const openUploadModal = () => {
    resetUploadState();
    setShowUploadModal(true);
  };

  const closeUploadModal = () => {
    if (isUploading) return;
    setShowUploadModal(false);
    resetUploadState();
  };

  const handleRestoreUploadedBackup = async () => {
    if (!uploadedBackupFilename) return;
    await handleRestore(uploadedBackupFilename);
  };

  const handleCloseRestoreSummaryModal = () => {
    setShowRestoreSummaryModal(false);
    window.location.reload();
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

      const restoredCounts = (data?.restored ?? {}) as Record<string, number>;
      setRestoreSummaryFilename(filename);
      setRestoreSummaryCounts(restoredCounts);
      setShowRestoreSummaryModal(true);
      setShowUploadModal(false);
      setSuccessMessage(`Backup restaurado: ${restoredCounts.notes ?? 0} notas, ${restoredCounts.clients ?? 0} clientes, ${restoredCounts.projects ?? 0} proyectos`);
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

  const handleStartEditing = (backup: BackupMetadata) => {
    setEditingFilename(backup.filename);
    setEditingName(backup.filename.replace(/\.zip$/i, ''));
    setEditingDescription(backup.description || '');
    setEditingProtected(backup.protected);
  };

  const handleCancelEditing = () => {
    setEditingFilename(null);
    setEditingName('');
    setEditingDescription('');
    setEditingProtected(false);
  };

  const handleSaveBackupMetadata = async (currentFilename: string) => {
    setSavingFilename(currentFilename);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/backups/${encodeURIComponent(currentFilename)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: editingName.trim() || currentFilename,
          description: editingDescription.trim(),
          protected: editingProtected,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to update backup');
      }

      setSuccessMessage(`Backup actualizado: ${data.filename || currentFilename}`);
      handleCancelEditing();
      await fetchBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el backup');
      console.error(err);
    } finally {
      setSavingFilename(null);
    }
  };

  const handleDownload = async (filename: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/backups/${encodeURIComponent(filename)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to download backup');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const disposition = res.headers.get('Content-Disposition');
      const match = disposition?.match(/filename="(.+)"/);
      const downloadName = match?.[1] || filename;
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descargar el backup');
      console.error('Download error:', err);
    }
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
      hour12: false,
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
            onClick={openUploadModal}
            disabled={isUploading}
            className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            title="Subir backup"
          >
            <Upload size={18} />
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

      {showRestoreSummaryModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 px-4" onClick={handleCloseRestoreSummaryModal}>
          <div className="w-full max-w-lg rounded-xl border border-gray-700 bg-gray-900 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
              <h4 className="text-base font-semibold text-white">Restauracion completada</h4>
              <button
                onClick={handleCloseRestoreSummaryModal}
                className="p-2 text-gray-400 hover:text-white"
                title="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <p className="text-sm text-gray-300">
                Backup restaurado: <span className="font-medium text-white">{restoreSummaryFilename}</span>
              </p>

              <div className="overflow-hidden rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800 text-gray-300">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Tabla</th>
                      <th className="px-3 py-2 text-right font-medium">Registros importados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RESTORE_COUNT_LABELS.map((item) => (
                      <tr key={item.key} className="border-t border-gray-800 text-gray-200">
                        <td className="px-3 py-2">{item.label}</td>
                        <td className="px-3 py-2 text-right font-mono">{restoreSummaryCounts[item.key] ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-yellow-300">
                Presiona Aceptar para recargar la aplicacion con los datos restaurados.
              </p>
            </div>

            <div className="flex justify-end border-t border-gray-800 px-5 py-4">
              <button
                onClick={handleCloseRestoreSummaryModal}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
              >
                Aceptar y recargar
              </button>
            </div>
          </div>
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
            <div className="space-y-3">
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

              <div className="flex items-center gap-3">
                <select
                  value={settings.maxAgeDays}
                  onChange={(e) => updateSettings({ maxAgeDays: parseInt(e.target.value) })}
                  className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value={0}>Sin límite por edad</option>
                  <option value={7}>Más de 7 días</option>
                  <option value={15}>Más de 15 días</option>
                  <option value={30}>Más de 30 días</option>
                  <option value={60}>Más de 60 días</option>
                  <option value={90}>Más de 90 días</option>
                </select>
                <span className="text-xs text-gray-500">
                  Borra backups no protegidos que superen esa antigüedad
                </span>
              </div>
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
                  <div className="flex items-center gap-1">
                    <select
                      value={settings.autoBackupTime.split(':')[0] || '03'}
                      onChange={(e) => {
                        const minute = settings.autoBackupTime.split(':')[1] || '00';
                        updateSettings({ autoBackupTime: `${e.target.value}:${minute}` });
                      }}
                      className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <span className="text-gray-500">:</span>
                    <select
                      value={settings.autoBackupTime.split(':')[1] || '00'}
                      onChange={(e) => {
                        const hour = settings.autoBackupTime.split(':')[0] || '03';
                        updateSettings({ autoBackupTime: `${hour}:${e.target.value}` });
                      }}
                      className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      {Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0')).map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
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

      {showUploadModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 px-4" onClick={closeUploadModal}>
          <div className="w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
              <div>
                <h4 className="text-base font-semibold text-white">Subir backup al servidor</h4>
                <p className="mt-1 text-sm text-gray-400">Definí el nombre si querés y la subida comienza apenas elegís el ZIP.</p>
              </div>
              <button
                onClick={closeUploadModal}
                disabled={isUploading}
                className="p-2 text-gray-400 hover:text-white disabled:opacity-50"
                title="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto px-5 py-5">
              <input
                ref={uploadInputRef}
                type="file"
                accept=".zip"
                onChange={handleSelectedUploadFile}
                className="hidden"
              />

              <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">Archivo ZIP</p>
                    <p className="mt-1 truncate text-sm text-gray-400">
                      {selectedUploadFile ? selectedUploadFile.name : 'Ningún archivo seleccionado'}
                    </p>
                  </div>
                  <button
                    onClick={() => uploadInputRef.current?.click()}
                    disabled={isUploading}
                    className="shrink-0 rounded-lg bg-gray-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-600 disabled:opacity-50"
                  >
                    {uploadedBackupFilename ? 'Elegir otro ZIP' : 'Elegir ZIP'}
                  </button>
                </div>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-300">Nombre del backup</span>
                <input
                  type="text"
                  value={uploadFilename}
                  onChange={(e) => setUploadFilename(e.target.value)}
                  placeholder="backup-cliente-2026-08-18"
                  disabled={isUploading || !!uploadedBackupFilename}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-60"
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={uploadProtected}
                  onChange={(e) => setUploadProtected(e.target.checked)}
                  disabled={isUploading || !!uploadedBackupFilename}
                  className="rounded border-gray-600 bg-gray-900 text-purple-600 focus:ring-purple-500 disabled:opacity-60"
                />
                Dejar protegido al subirlo
              </label>

              {(isUploading || uploadProgress > 0) && (
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
                    <span>{uploadedBackupFilename ? 'Subida completada' : 'Progreso de subida'}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-[width] duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {uploadedBackupFilename && (
                <div className="rounded-lg border border-emerald-700/50 bg-emerald-900/20 px-3 py-3 text-sm text-emerald-300">
                  El backup ya fue subido al servidor como <span className="font-medium">{uploadedBackupFilename}</span>. Si querés, podés restaurarlo ahora mismo.
                </div>
              )}
              <div className="rounded-lg border border-yellow-700/50 bg-yellow-900/20 px-3 py-3 text-xs text-yellow-300">
                Restauración completa obligatoria: también se restaura data/*. Puede tardar bastante con backups grandes.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-800 px-5 py-4">
              <button
                onClick={closeUploadModal}
                disabled={isUploading}
                className="rounded-lg px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800 hover:text-white disabled:opacity-50"
              >
                Cancelar
              </button>
              {uploadedBackupFilename && (
                <button
                  onClick={handleRestoreUploadedBackup}
                  disabled={!!restoringFilename}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-900"
                >
                  {restoringFilename === uploadedBackupFilename ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                  {restoringFilename === uploadedBackupFilename ? 'Restaurando...' : 'Restaurar ahora'}
                </button>
              )}
            </div>
            {restoringFilename === uploadedBackupFilename && (
              <div className="px-5 pb-4 text-xs text-yellow-300">
                Restaurando backup grande. Este proceso puede tardar varios minutos en TEST.
              </div>
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
              className="p-3 bg-slate-900/70 rounded-xl border border-gray-700/60 hover:border-gray-600/70 transition-colors shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
            >
              <div className="flex items-center justify-between gap-3 min-w-0 py-0.5">
                <div className="flex-1 min-w-0">
                  {editingFilename === backup.filename ? (
                    <div className="space-y-2 pr-3 w-full">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                      <input
                        type="text"
                        value={editingDescription}
                        onChange={(e) => setEditingDescription(e.target.value)}
                        placeholder="Descripción opcional"
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                      <label className="flex items-center gap-2 text-xs text-gray-300">
                        <input
                          type="checkbox"
                          checked={editingProtected}
                          onChange={(e) => setEditingProtected(e.target.checked)}
                          className="rounded border-gray-600 bg-gray-900 text-purple-600 focus:ring-purple-500"
                        />
                        Protegido
                      </label>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-white font-medium text-sm truncate leading-tight">
                        {backup.filename}
                      </span>
                      {backup.protected && (
                        <span title="Protegido" className="shrink-0">
                          <Shield size={14} className="text-yellow-500" />
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0 rounded-md border border-gray-700/50 bg-gray-950/40 px-1 py-0.5">
                  {editingFilename === backup.filename ? (
                    <>
                      <button
                        onClick={() => handleSaveBackupMetadata(backup.filename)}
                        disabled={savingFilename === backup.filename}
                        className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
                        title="Guardar cambios"
                      >
                        {savingFilename === backup.filename ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      </button>
                      <button
                        onClick={handleCancelEditing}
                        disabled={savingFilename === backup.filename}
                        className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
                        title="Cancelar"
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleStartEditing(backup)}
                        className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-purple-400 hover:bg-gray-700 rounded-md transition-colors"
                        title="Editar nombre y señalización"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleToggleProtect(backup.filename, backup.protected)}
                        className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-yellow-400 hover:bg-gray-700 rounded-md transition-colors"
                        title={backup.protected ? 'Quitar protección' : 'Proteger'}
                      >
                        {backup.protected ? <ShieldOff size={16} /> : <Shield size={16} />}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDownload(backup.filename)}
                    className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded-md transition-colors"
                    title="Descargar"
                  >
                    <Download size={16} />
                  </button>
                  <button
                    onClick={() => handleRestore(backup.filename)}
                    disabled={restoringFilename === backup.filename}
                    className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
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
                    className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={backup.protected ? 'No se puede eliminar (protegido)' : 'Eliminar'}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="mt-2">
                {backup.description && (
                  <div className="text-xs text-gray-300 truncate">{backup.description}</div>
                )}
                <div className="mt-2 text-xs text-gray-500">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span>{formatDate(backup.createdAt)}</span>
                    <span>{formatSize(backup.sizeBytes)}</span>
                  </div>

                  {backup.stats && (
                    <details className="group mt-2 block text-[11px] text-gray-400">
                      <summary className="cursor-pointer list-none select-none text-gray-300 hover:text-white [&::-webkit-details-marker]:hidden">
                        <span className="inline-flex items-center gap-1 rounded-md border border-gray-700/50 bg-gray-900/60 px-2 py-1">
                          <span className="text-gray-400 transition-transform duration-200 group-open:rotate-90">▸</span>
                          <span className="font-medium text-gray-200">Registros</span>
                          <span className="text-gray-400">{backup.stats.notes ?? 0}n / {backup.stats.clients ?? 0}c / {backup.stats.projects ?? 0}p</span>
                        </span>
                      </summary>
                      <div className="mt-2 rounded-lg border border-gray-700/60 bg-gray-900/80 p-2 shadow-inner">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          <div className="text-gray-300">Notas</div><div className="text-right font-mono text-gray-200">{backup.stats.notes ?? 0}</div>
                          <div className="text-gray-300">Clientes</div><div className="text-right font-mono text-gray-200">{backup.stats.clients ?? 0}</div>
                          <div className="text-gray-300">Proyectos</div><div className="text-right font-mono text-gray-200">{backup.stats.projects ?? 0}</div>
                          <div className="text-gray-300">Timesheets</div><div className="text-right font-mono text-gray-200">{backup.stats.timesheets ?? 0}</div>
                          <div className="text-gray-300">Adjuntos</div><div className="text-right font-mono text-gray-200">{backup.stats.attachments ?? 0}</div>
                          <div className="text-gray-300">Activity Logs</div><div className="text-right font-mono text-gray-200">{backup.stats.activityLogs ?? 0}</div>
                          <div className="text-gray-300">Comentarios</div><div className="text-right font-mono text-gray-200">{backup.stats.taskComments ?? 0}</div>
                          <div className="text-gray-300">TODOs</div><div className="text-right font-mono text-gray-200">{backup.stats.taskTodos ?? 0}</div>
                          <div className="text-gray-300">Métodos</div><div className="text-right font-mono text-gray-200">{backup.stats.billingMethods ?? 0}</div>
                          <div className="text-gray-300">Runs</div><div className="text-right font-mono text-gray-200">{backup.stats.billingRuns ?? 0}</div>
                          <div className="text-gray-300">Items</div><div className="text-right font-mono text-gray-200">{backup.stats.billingRunItems ?? 0}</div>
                          <div className="text-gray-300">Notif. TODO</div><div className="text-right font-mono text-gray-200">{backup.stats.todoNotificationsSent ?? 0}</div>
                        </div>
                      </div>
                    </details>
                  )}
                </div>
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
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

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

        {/* Server Backups Section */}
        <ServerBackupsSection />
      </div>
    </div>
  );
}

function PreferencesManager() {
  const { autoSaveEnabled, toggleAutoSave, copyWithImagesOnCopy, setCopyWithImagesOnCopy, recentHours, setRecentHours } = useApp();
  
  // TimeSheet preferences with original tracking
  const [dailyHoursTarget, setDailyHoursTarget] = useState<number>(8);
  const [exportDateFormat, setExportDateFormat] = useState<string>('DD/MM/YYYY');
  const [originalDailyHours, setOriginalDailyHours] = useState<number>(8);
  const [originalExportFormat, setOriginalExportFormat] = useState<string>('DD/MM/YYYY');
  const [timesheetSaved, setTimesheetSaved] = useState(false);

  // Recents preferences
  const [recentsHours, setRecentsHours] = useState<number>(8);
  const [originalRecentsHours, setOriginalRecentsHours] = useState<number>(8);
  const [recentsSaved, setRecentsSaved] = useState(false);
  
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

    // Recents view interval
    const savedRecent = localStorage.getItem('bitacora-recents-hours');
    const recent = savedRecent ? parseInt(savedRecent, 10) : recentHours;
    setRecentsHours(!Number.isNaN(recent) ? recent : recentHours);
    setOriginalRecentsHours(!Number.isNaN(recent) ? recent : recentHours);
  }, [recentHours]);
  
  // Check if timesheet settings have changed
  const hasTimesheetChanges = () => {
    return dailyHoursTarget !== originalDailyHours || exportDateFormat !== originalExportFormat;
  };

  const hasRecentsChanges = () => {
    return recentsHours !== originalRecentsHours;
  };
  
  const handleSaveTimesheetSettings = () => {
    localStorage.setItem('timesheet-daily-hours', dailyHoursTarget.toString());
    localStorage.setItem('timesheet-export-date-format', exportDateFormat);
    setOriginalDailyHours(dailyHoursTarget);
    setOriginalExportFormat(exportDateFormat);
    setTimesheetSaved(true);
    setTimeout(() => setTimesheetSaved(false), 3000);
  };

  const handleSaveRecentsSettings = () => {
    const validHours = Math.min(168, Math.max(1, Math.round(recentsHours)));
    setRecentHours(validHours);
    setOriginalRecentsHours(validHours);
    setRecentsSaved(true);
    setTimeout(() => setRecentsSaved(false), 3000);
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

        {/* Copy with images on Ctrl+C */}
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-lg">
                <Clipboard size={20} className="text-indigo-400" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-white">Copiar con imágenes (Ctrl+C)</h3>
                <p className="text-gray-400 text-sm">
                  Al usar Ctrl+C dentro del editor, convierte imágenes en datos embebidos para pegar en Outlook u otros editores.
                </p>
              </div>
            </div>
            <button
              onClick={() => setCopyWithImagesOnCopy(!copyWithImagesOnCopy)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                copyWithImagesOnCopy ? 'bg-indigo-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  copyWithImagesOnCopy ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div className="mt-3 text-sm text-gray-500">
            {copyWithImagesOnCopy ? (
              <span className="text-green-400">✓ Activado</span>
            ) : (
              <span className="text-yellow-400">⚠ El portapapeles funcionará normalmente sin embebidos</span>
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

        {/* Recents settings */}
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Clock size={20} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-white">Recientes</h3>
              <p className="text-gray-400 text-sm">Notas modificadas en las últimas horas</p>
            </div>
          </div>

          <div className="space-y-4 ml-11">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm text-white">Intervalo (horas)</label>
                <p className="text-xs text-gray-500">Muestra notas actualizadas en las últimas N horas</p>
              </div>
              <input
                type="number"
                min={1}
                max={168}
                value={recentsHours}
                onChange={(e) => setRecentsHours(parseInt(e.target.value, 10) || 1)}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white w-20 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="pt-3 border-t border-gray-700">
              <button
                onClick={handleSaveRecentsSettings}
                disabled={!hasRecentsChanges()}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                  hasRecentsChanges()
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                {recentsSaved ? (
                  <>
                    <span className="text-green-400">✓</span>
                    ¡Guardado!
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    {hasRecentsChanges() ? 'Guardar cambios' : 'Sin cambios pendientes'}
                  </>
                )}
              </button>
              {hasRecentsChanges() && (
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
            <button
              onClick={() => setActiveTab('system')}
              className={`
                w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                ${activeTab === 'system'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }
              `}
            >
              <Server size={18} />
              Sistema
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`
                w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                ${activeTab === 'billing'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }
              `}
            >
              <Clipboard size={18} />
              Facturación
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
        {activeTab === 'system' && <SystemDatabaseSection />}
        {activeTab === 'billing' && <BillingMethodsManager />}
      </div>
    </div>
  );
}
