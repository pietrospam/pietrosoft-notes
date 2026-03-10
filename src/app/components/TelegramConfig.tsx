'use client';

/**
 * TelegramConfig Component
 * SPEC-007: Telegram Backup Notifications
 */

import { useState, useEffect } from 'react';
import { Send, Eye, EyeOff, Loader2, CheckCircle, XCircle, AlertCircle, HelpCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface TelegramConfigState {
  enabled: boolean;
  botToken: string;
  hasToken: boolean;
  chatId: string;
  notifyAuto: boolean;
  notifyManual: boolean;
  notifyErrors: boolean;
  sendFile: boolean;
}

export function TelegramConfig() {
  const [config, setConfig] = useState<TelegramConfigState>({
    enabled: false,
    botToken: '',
    hasToken: false,
    chatId: '',
    notifyAuto: true,
    notifyManual: true,
    notifyErrors: true,
    sendFile: true,
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testMessage, setTestMessage] = useState<string>('');
  const [showToken, setShowToken] = useState(false);
  const [newToken, setNewToken] = useState<string>('');
  const [editingToken, setEditingToken] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Load configuration on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/telegram/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (error) {
      console.error('Failed to load Telegram config:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (updates: Partial<TelegramConfigState>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/telegram/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setEditingToken(false);
        setNewToken('');
      }
    } catch (error) {
      console.error('Failed to save Telegram config:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setTestMessage('');
    
    try {
      const res = await fetch('/api/telegram/test', { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        setTestResult('success');
        setTestMessage(data.botName ? `Conectado como @${data.botName}` : 'Conexión exitosa');
      } else {
        setTestResult('error');
        setTestMessage(data.error || 'Error desconocido');
      }
    } catch {
      setTestResult('error');
      setTestMessage('Error de conexión');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveToken = () => {
    if (newToken.trim()) {
      saveConfig({ botToken: newToken.trim() });
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <div className="flex items-center gap-3">
          <Loader2 className="animate-spin text-gray-400" size={20} />
          <span className="text-gray-400">Cargando configuración...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Send size={20} className="text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-white">Notificaciones de Telegram</h3>
            <p className="text-gray-400 text-sm">Recibe los backups en tu Telegram</p>
          </div>
        </div>
        
        {/* Main toggle */}
        <button
          onClick={() => saveConfig({ enabled: !config.enabled })}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            config.enabled ? 'bg-blue-600' : 'bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              config.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {config.enabled && (
        <div className="space-y-4 mt-4 pt-4 border-t border-gray-800">
          {/* Bot Token */}
          <div>
            <label className="block text-sm text-white mb-1">Bot Token</label>
            {editingToken ? (
              <div className="flex gap-2">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={newToken}
                  onChange={(e) => setNewToken(e.target.value)}
                  placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz..."
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={() => setShowToken(!showToken)}
                  className="p-2 bg-gray-800 border border-gray-700 rounded hover:bg-gray-700"
                >
                  {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  onClick={handleSaveToken}
                  disabled={!newToken.trim() || saving}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded text-sm"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : 'Guardar'}
                </button>
                <button
                  onClick={() => { setEditingToken(false); setNewToken(''); }}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="password"
                  value={config.hasToken ? config.botToken : ''}
                  readOnly
                  placeholder="No configurado"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-400"
                />
                <button
                  onClick={() => setEditingToken(true)}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                >
                  {config.hasToken ? 'Cambiar' : 'Configurar'}
                </button>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Obtén el token creando un bot con @BotFather en Telegram
            </p>
          </div>

          {/* Chat ID */}
          <div>
            <label className="block text-sm text-white mb-1">Chat ID</label>
            <input
              type="text"
              value={config.chatId}
              onChange={(e) => setConfig(prev => ({ ...prev, chatId: e.target.value }))}
              onBlur={() => saveConfig({ chatId: config.chatId })}
              placeholder="123456789"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Tu ID de usuario o grupo donde recibir las notificaciones
            </p>
          </div>

          {/* Test connection */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleTest}
              disabled={testing || !config.hasToken || !config.chatId}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 rounded text-sm flex items-center gap-2"
            >
              {testing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              Probar conexión
            </button>
            
            {testResult === 'success' && (
              <span className="flex items-center gap-1 text-green-400 text-sm">
                <CheckCircle size={16} />
                {testMessage}
              </span>
            )}
            {testResult === 'error' && (
              <span className="flex items-center gap-1 text-red-400 text-sm">
                <XCircle size={16} />
                {testMessage}
              </span>
            )}
          </div>

          {/* Notification options */}
          <div className="pt-4 border-t border-gray-800">
            <p className="text-sm text-white mb-3">Notificar:</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={config.notifyAuto}
                  onChange={(e) => saveConfig({ notifyAuto: e.target.checked })}
                  className="rounded bg-gray-800 border-gray-600"
                />
                Backups automáticos
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={config.notifyManual}
                  onChange={(e) => saveConfig({ notifyManual: e.target.checked })}
                  className="rounded bg-gray-800 border-gray-600"
                />
                Backups manuales
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={config.notifyErrors}
                  onChange={(e) => saveConfig({ notifyErrors: e.target.checked })}
                  className="rounded bg-gray-800 border-gray-600"
                />
                Errores de backup
              </label>
            </div>
          </div>

          {/* File attachment option */}
          <div className="pt-4 border-t border-gray-800">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={config.sendFile}
                onChange={(e) => saveConfig({ sendFile: e.target.checked })}
                className="rounded bg-gray-800 border-gray-600"
              />
              Adjuntar archivo de backup (máx. 50MB)
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              Si está desactivado o el archivo excede 50MB, solo se enviará una notificación de texto
            </p>
          </div>

          {/* Help section - always visible, collapsible */}
          <div className="border border-gray-700 rounded-lg mt-4 overflow-hidden">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="w-full flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                <HelpCircle size={16} className="text-blue-400" />
                <span className="text-sm text-gray-200 font-medium">Cómo configurar Telegram</span>
              </div>
              {showHelp ? (
                <ChevronUp size={16} className="text-gray-400" />
              ) : (
                <ChevronDown size={16} className="text-gray-400" />
              )}
            </button>
            
            {showHelp && (
              <div className="p-4 space-y-4 bg-gray-900/50">
                {/* Step 1: Create Bot */}
                <div>
                  <h4 className="text-sm font-medium text-blue-400 mb-2">1. Crear un Bot en Telegram</h4>
                  <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside ml-2">
                    <li>Abre Telegram y busca <code className="bg-gray-800 px-1 rounded">@BotFather</code></li>
                    <li>Envía el comando <code className="bg-gray-800 px-1 rounded">/newbot</code></li>
                    <li>Sigue las instrucciones para nombrar tu bot</li>
                    <li>BotFather te dará un <strong className="text-white">Token</strong> similar a:
                      <code className="block bg-gray-800 px-2 py-1 rounded mt-1 text-yellow-400">
                        1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
                      </code>
                    </li>
                    <li>Copia ese token y pégalo arriba en &quot;Bot Token&quot;</li>
                  </ol>
                </div>

                {/* Step 2: Get Chat ID */}
                <div>
                  <h4 className="text-sm font-medium text-blue-400 mb-2">2. Obtener tu Chat ID</h4>
                  <p className="text-xs text-gray-400 mb-2">Hay varias formas de obtener tu Chat ID:</p>
                  
                  <div className="space-y-3 ml-2">
                    {/* Option A */}
                    <div className="bg-gray-800/50 p-2 rounded">
                      <p className="text-xs text-green-400 font-medium mb-1">Opción A: Usando @userinfobot (más fácil)</p>
                      <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
                        <li>Busca <code className="bg-gray-800 px-1 rounded">@userinfobot</code> en Telegram</li>
                        <li>Inicia la conversación con <code className="bg-gray-800 px-1 rounded">/start</code></li>
                        <li>El bot te responderá con tu ID</li>
                      </ol>
                    </div>

                    {/* Option B */}
                    <div className="bg-gray-800/50 p-2 rounded">
                      <p className="text-xs text-green-400 font-medium mb-1">Opción B: Usando @RawDataBot</p>
                      <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
                        <li>Busca <code className="bg-gray-800 px-1 rounded">@RawDataBot</code> en Telegram</li>
                        <li>Envía cualquier mensaje</li>
                        <li>El bot te responderá con información detallada incluyendo tu Chat ID</li>
                      </ol>
                    </div>

                    {/* Option C */}
                    <div className="bg-gray-800/50 p-2 rounded">
                      <p className="text-xs text-green-400 font-medium mb-1">Opción C: Usando la API (método técnico)</p>
                      <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
                        <li>Primero inicia una conversación con TU bot (el que creaste)</li>
                        <li>Envía cualquier mensaje a tu bot</li>
                        <li>Visita esta URL en tu navegador (reemplaza TOKEN con tu token):
                          <code className="block bg-gray-800 px-2 py-1 rounded mt-1 text-yellow-400 break-all">
                            https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates
                          </code>
                        </li>
                        <li>Busca el campo <code className="bg-gray-800 px-1 rounded">&quot;chat&quot;:&#123;&quot;id&quot;:</code> en la respuesta</li>
                      </ol>
                    </div>
                  </div>
                </div>

                {/* Step 3: Important */}
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={14} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-yellow-300 font-medium">Importante</p>
                      <ul className="text-xs text-gray-400 mt-1 space-y-1 list-disc list-inside">
                        <li>Debes iniciar una conversación con tu bot antes de que pueda enviarte mensajes</li>
                        <li>El Token es secreto - no lo compartas públicamente</li>
                        <li>Usa &quot;Probar conexión&quot; para verificar que todo funciona</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* External links */}
                <div className="flex items-center gap-4 pt-2 border-t border-gray-800">
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLink size={12} />
                    @BotFather
                  </a>
                  <a
                    href="https://t.me/userinfobot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLink size={12} />
                    @userinfobot
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
