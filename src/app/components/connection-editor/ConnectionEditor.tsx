'use client';

/**
 * ConnectionEditor — standalone inline editor for connection notes.
 *
 * Intentionally does NOT use BaseEditorModal to avoid the render-cycle bug
 * where onFieldsChange/setIsDirty dep changes re-triggered the loadNote effect
 * and reset all fields on every keystroke.
 *
 * Design rules:
 * - useEffect for loading has ONLY [noteId] as dependency
 * - All field state is local; AppContext is only used for save/dirty signalling
 * - No render-prop pattern; everything is rendered directly in this component
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Save, Loader2, Pencil, Check, ExternalLink, Star, Archive, ArchiveRestore,
  Trash2, Paperclip, Copy, ChevronDown, Plus, Eye, EyeOff, X,
} from 'lucide-react';
import { TipTapEditor, type TipTapEditorHandle } from '../TipTapEditor';
import { AttachmentsModal } from '../AttachmentsModal';
import { Toast } from '../Toast';
import { UnsavedChangesModal } from '../UnsavedChangesModal';
import { QuickCreateModal } from '../QuickCreateModal';
import { useApp } from '../../context/AppContext';
import type { Note, ConnectionNote, Client, Project, AttachmentMeta } from '@/lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConnectionEditorProps {
  noteId: string;
  onClose: () => void;
  onSaved?: () => void;
  onExpandToPopup?: () => void;
}

// ---------------------------------------------------------------------------
// Clipboard helper (same logic as old component)
// ---------------------------------------------------------------------------

async function copyText(value: string): Promise<boolean> {
  if (!value) return false;
  if (typeof window !== 'undefined' && window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch { /* fall through */ }
  }
  const ta = document.createElement('textarea');
  ta.value = value;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:absolute;left:-9999px';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  return ok;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConnectionEditor({ noteId, onClose, onSaved, onExpandToPopup }: ConnectionEditorProps) {
  // ── AppContext (only stable callbacks needed) ──────────────────────────
  const {
    setPendingChanges,
    setIsDirty: setGlobalDirty,
    setIsSaving: setGlobalSaving,
    setLastSaved: setGlobalLastSaved,
    autoSaveEnabled,
    refreshNotes,
    toggleFavorite,
    deleteNote,
    setSelectedNoteId,
  } = useApp();

  // ── Local field state ──────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [toast, setToast] = useState<{ message: string } | null>(null);

  // Note fields
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [contentJson, setContentJson] = useState<object | null>(null);
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [archivedAt, setArchivedAt] = useState<string | undefined>(undefined);
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([]);

  // ── UI state ──────────────────────────────────────────────────────────
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);

  // Clients / projects (loaded once)
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // ── Refs ──────────────────────────────────────────────────────────────
  const editorRef = useRef<TipTapEditorHandle>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<Partial<ConnectionNote>>({});
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentInitializedRef = useRef(false);

  // ── Load note (ONLY depends on noteId — no callbacks in deps) ─────────
  useEffect(() => {
    setLoading(true);
    contentInitializedRef.current = false;
    pendingRef.current = {};

    fetch(`/api/notes/${noteId}`)
      .then(r => r.json())
      .then((data: ConnectionNote) => {
        setTitle(data.title ?? '');
        setUrl((data.url) ?? '');
        setUsername((data.username) ?? '');
        setPassword((data.password) ?? '');
        setContentJson(data.contentJson ?? null);
        setClientId(data.clientId ?? '');
        setProjectId(data.projectId ?? '');
        setIsFavorite(data.isFavorite ?? false);
        setArchivedAt(data.archivedAt);
        setAttachments(data.attachments ?? []);
        setIsDirty(false);
        setLoading(false);

        setTimeout(() => {
          contentInitializedRef.current = true;
        }, 150);
      })
      .catch(() => {
        setToast({ message: 'Error al cargar la nota' });
        setLoading(false);
      });
  }, [noteId]); // ← ONLY noteId — this is the key fix

  // ── Load clients / projects once ──────────────────────────────────────
  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(setClients).catch(() => {});
    fetch('/api/projects').then(r => r.json()).then(setProjects).catch(() => {});
  }, []);

  const filteredProjects = clientId
    ? projects.filter(p => p.clientId === clientId)
    : projects;

  // ── Mark a field as changed ───────────────────────────────────────────
  const mark = useCallback(
    (changes: Partial<ConnectionNote>) => {
      pendingRef.current = { ...pendingRef.current, ...changes };
      setPendingChanges(pendingRef.current as Partial<Note>);
      setIsDirty(true);
      setGlobalDirty(true);
      scheduleAutoSave();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setPendingChanges, setGlobalDirty],
  );

  // ── Auto-save ─────────────────────────────────────────────────────────
  const scheduleAutoSave = useCallback(() => {
    if (!autoSaveEnabled) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      if (Object.keys(pendingRef.current).length === 0) return;
      try {
        const res = await fetch(`/api/notes/${noteId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pendingRef.current),
        });
        if (res.ok) {
          pendingRef.current = {};
          setPendingChanges({});
          setIsDirty(false);
          setGlobalDirty(false);
          setSaved(true);
          setGlobalLastSaved(new Date());
          refreshNotes();
          setTimeout(() => setSaved(false), 2000);
        }
      } catch { /* silent */ }
    }, 2000);
  }, [autoSaveEnabled, noteId, setPendingChanges, setGlobalDirty, setGlobalLastSaved, refreshNotes]);

  // Cleanup timer on unmount / note change
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [noteId]);

  // ── Save ──────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (Object.keys(pendingRef.current).length === 0) return;
    setSaving(true);
    setGlobalSaving(true);
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingRef.current),
      });
      if (res.ok) {
        pendingRef.current = {};
        setPendingChanges({});
        setIsDirty(false);
        setGlobalDirty(false);
        setSaved(true);
        setGlobalLastSaved(new Date());
        refreshNotes();
        onSaved?.();
        setTimeout(() => setSaved(false), 2000);
      } else {
        setToast({ message: 'Error al guardar' });
      }
    } catch {
      setToast({ message: 'Error al guardar' });
    } finally {
      setSaving(false);
      setGlobalSaving(false);
    }
  }, [noteId, setPendingChanges, setGlobalDirty, setGlobalSaving, setGlobalLastSaved, refreshNotes, onSaved]);

  // ── Favorite ──────────────────────────────────────────────────────────
  const handleToggleFavorite = async () => {
    setIsFavorite(prev => !prev);
    await toggleFavorite(noteId);
  };

  // ── Archive ───────────────────────────────────────────────────────────
  const handleArchive = async () => {
    const wasArchived = !!archivedAt;
    const newVal = wasArchived ? undefined : new Date().toISOString();
    setArchivedAt(newVal);
    await fetch(`/api/notes/${noteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archivedAt: newVal }),
    });
    refreshNotes();
    setToast({ message: wasArchived ? 'Nota restaurada' : 'Nota archivada' });
  };

  // ── Delete ────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta nota?')) return;
    await deleteNote(noteId);
    setSelectedNoteId(null);
    onClose();
  };

  // ── Copy field ────────────────────────────────────────────────────────
  const handleCopy = async (e: React.MouseEvent, field: string, value: string) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await copyText(value);
    if (ok) {
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  // ── Client change (auto-select General project) ────────────────────────
  const handleClientChange = (newClientId: string) => {
    setClientId(newClientId);
    const general = projects.find(p => p.clientId === newClientId && p.name === 'General');
    const newProjectId = general?.id ?? '';
    setProjectId(newProjectId);
    mark({ clientId: newClientId || undefined, projectId: newProjectId || undefined } as Partial<ConnectionNote>);
  };

  // ── Content change (TipTap) ────────────────────────────────────────────
  const handleContentChange = useCallback((json: object) => {
    if (!contentInitializedRef.current) return;
    setContentJson(json);
    mark({ contentJson: json } as Partial<ConnectionNote>);
  }, [mark]);

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <Loader2 className="animate-spin text-blue-400" size={32} />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
        {/* Title */}
        <div className="flex items-center gap-2 flex-1 min-w-0 mr-4">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={e => {
                setTitle(e.target.value);
                mark({ title: e.target.value } as Partial<ConnectionNote>);
              }}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={e => {
                if (e.key === 'Enter') { setIsEditingTitle(false); editorRef.current?.focus(); }
                if (e.key === 'Escape') setIsEditingTitle(false);
              }}
              className="flex-1 text-lg font-semibold bg-gray-800 border border-blue-500 rounded px-2 py-1 text-white outline-none"
              autoFocus
              placeholder="Título..."
            />
          ) : (
            <>
              <h2 className="text-lg font-semibold text-white truncate">{title || 'Sin título'}</h2>
              <button
                onClick={() => { setIsEditingTitle(true); setTimeout(() => titleInputRef.current?.select(), 0); }}
                className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                title="Editar título"
              >
                <Pencil size={16} />
              </button>
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Favorite */}
          <button
            onClick={handleToggleFavorite}
            className={`p-2 rounded transition-colors ${isFavorite ? 'text-yellow-400 hover:text-yellow-300 hover:bg-gray-800' : 'text-gray-400 hover:text-yellow-400 hover:bg-gray-800'}`}
            title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          >
            <Star size={20} className={isFavorite ? 'fill-current' : ''} />
          </button>

          {/* Archive */}
          <button
            onClick={handleArchive}
            className={`p-2 rounded transition-colors ${archivedAt ? 'text-yellow-500 hover:text-yellow-400 hover:bg-gray-800' : 'text-gray-400 hover:text-yellow-400 hover:bg-gray-800'}`}
            title={archivedAt ? 'Restaurar nota' : 'Archivar nota'}
          >
            {archivedAt ? <ArchiveRestore size={20} /> : <Archive size={20} />}
          </button>

          {/* Delete */}
          <button
            onClick={handleDelete}
            className="p-2 rounded transition-colors text-gray-400 hover:text-red-400 hover:bg-gray-800"
            title="Eliminar nota"
          >
            <Trash2 size={20} />
          </button>

          {/* Saved indicator */}
          {saved && (
            <span className="flex items-center gap-1 text-green-400 text-sm">
              <Check size={14} /> Guardado
            </span>
          )}

          {/* Save button */}
          {isDirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Guardar
            </button>
          )}

          {/* Attachments */}
          <button
            onClick={() => setShowAttachmentsModal(true)}
            className="flex items-center p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
            title={`Anexos (${attachments.length})`}
          >
            <Paperclip size={20} />
            <span className="ml-1 text-xs">{attachments.length}</span>
          </button>

          {/* Expand to popup */}
          {onExpandToPopup && (
            <button
              onClick={onExpandToPopup}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
              title="Abrir en popup"
            >
              <ExternalLink size={20} />
            </button>
          )}
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* ── Connection fields ── */}
        <div className="space-y-4 mb-6">

          {/* Row 1: Client + Project */}
          <div className="grid grid-cols-2 gap-4">
            {/* Client */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cliente</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={clientId}
                    onChange={e => handleClientChange(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 appearance-none"
                  >
                    <option value="">Sin cliente</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateClient(true)}
                  className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-blue-500 transition-colors"
                  title="Crear cliente"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Project */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Proyecto</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={projectId}
                    onChange={e => {
                      setProjectId(e.target.value);
                      mark({ projectId: e.target.value || undefined } as Partial<ConnectionNote>);
                    }}
                    disabled={!clientId}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 appearance-none disabled:opacity-50"
                  >
                    <option value="">Sin proyecto</option>
                    {filteredProjects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateProject(true)}
                  disabled={!clientId}
                  className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-blue-500 transition-colors disabled:opacity-50"
                  title="Crear proyecto"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: URL */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">URL</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={e => {
                  setUrl(e.target.value);
                  mark({ url: e.target.value || undefined } as Partial<ConnectionNote>);
                }}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="https://..."
              />
              {url && (
                <>
                  <button
                    type="button"
                    onClick={e => handleCopy(e, 'url', url)}
                    className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors"
                    title="Copiar URL"
                  >
                    {copied === 'url' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-blue-400 transition-colors"
                    title="Ir al enlace"
                  >
                    <ExternalLink size={14} />
                  </a>
                </>
              )}
            </div>
          </div>

          {/* Row 3: Username + Password */}
          <div className="grid grid-cols-2 gap-4">
            {/* Username */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Usuario</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={username}
                  onChange={e => {
                    setUsername(e.target.value);
                    mark({ username: e.target.value || undefined } as Partial<ConnectionNote>);
                  }}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="usuario o email"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-form-type="other"
                />
                {username && (
                  <button
                    type="button"
                    onClick={e => handleCopy(e, 'username', username)}
                    className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors"
                    title="Copiar usuario"
                  >
                    {copied === 'username' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                )}
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Contraseña</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value);
                      mark({ password: e.target.value || undefined } as Partial<ConnectionNote>);
                    }}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-10 text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder="contraseña"
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-form-type="other"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {password && (
                  <button
                    type="button"
                    onClick={e => handleCopy(e, 'password', password)}
                    className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors"
                    title="Copiar contraseña"
                  >
                    {copied === 'password' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Security notice */}
          <p className="text-xs text-yellow-600 flex items-center gap-1">
            ⚠️ Las contraseñas se almacenan en texto plano. Usar solo para credenciales no críticas.
          </p>
        </div>

        {/* ── TipTap editor ── */}
        <div className="border-t border-gray-800 pt-6 -mx-6 px-6 py-4 bg-gray-950">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Contenido</h3>
          <TipTapEditor
            ref={editorRef}
            content={contentJson}
            onChange={handleContentChange}
            noteId={noteId}
            placeholder="Escribe aquí..."
          />
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && <Toast message={toast.message} onClose={() => setToast(null)} />}

      {/* ── Unsaved changes modal ── */}
      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        onDiscard={() => { setShowUnsavedModal(false); onClose(); }}
        onCancel={() => setShowUnsavedModal(false)}
        onSave={async () => { setShowUnsavedModal(false); await handleSave(); onClose(); }}
      />

      {/* ── Attachments modal ── */}
      {showAttachmentsModal && (
        <AttachmentsModal
          noteId={noteId}
          attachments={attachments}
          onChange={() => {
            fetch(`/api/notes/${noteId}`)
              .then(r => r.json())
              .then((data: ConnectionNote) => setAttachments(data.attachments ?? []));
          }}
          onClose={() => setShowAttachmentsModal(false)}
        />
      )}

      {/* ── Quick create client ── */}
      {showCreateClient && (
        <QuickCreateModal
          type="client"
          onCreated={item => {
            setClients(prev => [...prev, item as Client]);
            setClientId(item.id);
            mark({ clientId: item.id } as Partial<ConnectionNote>);
          }}
          onClose={() => setShowCreateClient(false)}
        />
      )}

      {/* ── Quick create project ── */}
      {showCreateProject && clientId && (
        <QuickCreateModal
          type="project"
          clientId={clientId}
          onCreated={item => {
            setProjects(prev => [...prev, item as Project]);
            setProjectId(item.id);
            mark({ projectId: item.id } as Partial<ConnectionNote>);
          }}
          onClose={() => setShowCreateProject(false)}
        />
      )}
    </div>
  );
}
