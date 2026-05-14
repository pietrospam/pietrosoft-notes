# SPEC-007: Telegram Backup Notifications

**Status:** In Progress  
**Epic:** Backup System Enhancement  
**Priority:** Medium  
**Depends on:** REQ-018 (Server Backups), SPEC-006 (Database)

---

## 1. Overview

Implementar integración con Telegram Bot API para enviar notificaciones automáticas cuando se completan o fallan backups del servidor. Los backups exitosos pueden incluir el archivo ZIP como adjunto.

---

## 2. Goals

- **G1:** Notificar backups exitosos con archivo adjunto
- **G2:** Notificar errores de backup
- **G3:** Configuración persistente en base de datos
- **G4:** UI para gestionar configuración de Telegram

---

## 3. Non-Goals

- Comandos bidireccionales desde Telegram
- Múltiples bots o destinatarios
- Queue de mensajes con reintentos
- Webhooks de Telegram

---

## 4. Technical Design

### 4.1 Configuration File

La configuración se almacena en archivo JSON (consistente con `backup-settings.json`):

**Ubicación:** `/data/telegram-config.json`

```typescript
// /data/telegram-config.json
interface TelegramConfig {
  enabled: boolean;
  botToken: string;       // Token completo del bot
  chatId: string;         // ID del chat destino
  notifyAuto: boolean;    // Notificar backups automáticos
  notifyManual: boolean;  // Notificar backups manuales
  notifyErrors: boolean;  // Notificar errores
  sendFile: boolean;      // Adjuntar archivo ZIP
}

// Valores por defecto
const DEFAULT_CONFIG: TelegramConfig = {
  enabled: false,
  botToken: '',
  chatId: '',
  notifyAuto: true,
  notifyManual: true,
  notifyErrors: true,
  sendFile: true,
};
```

**Ventajas del archivo JSON:**
- Solo 1 registro (no justifica tabla en DB)
- Consistente con `backup-settings.json`
- Fácil de editar manualmente si es necesario
- No requiere migración de Prisma

### 4.2 API Endpoints

#### GET /api/telegram/config
Obtener configuración actual (token ofuscado).

```typescript
// Response
{
  enabled: boolean;
  botToken: string;      // "••••wxyz" (últimos 4 chars)
  hasToken: boolean;     // true if token is configured
  chatId: string;
  notifyAuto: boolean;
  notifyManual: boolean;
  notifyErrors: boolean;
  sendFile: boolean;
}
```

#### PUT /api/telegram/config
Actualizar configuración.

```typescript
// Request body
{
  enabled?: boolean;
  botToken?: string;     // Full token (only when changing)
  chatId?: string;
  notifyAuto?: boolean;
  notifyManual?: boolean;
  notifyErrors?: boolean;
  sendFile?: boolean;
}
```

#### POST /api/telegram/test
Enviar mensaje de prueba.

```typescript
// Response
{
  success: boolean;
  message: string;       // "Mensaje enviado" or error
}
```

### 4.3 Telegram Service

```typescript
// src/lib/telegram.ts

interface TelegramConfig {
  botToken: string;
  chatId: string;
}

interface SendMessageOptions {
  text: string;
  parseMode?: 'HTML' | 'Markdown';
}

interface SendDocumentOptions {
  filePath: string;
  caption?: string;
}

class TelegramService {
  private config: TelegramConfig;
  private baseUrl: string;

  constructor(config: TelegramConfig) {
    this.config = config;
    this.baseUrl = `https://api.telegram.org/bot${config.botToken}`;
  }

  async sendMessage(options: SendMessageOptions): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.config.chatId,
        text: options.text,
        parse_mode: options.parseMode || 'HTML',
      }),
    });
    return response.ok;
  }

  async sendDocument(options: SendDocumentOptions): Promise<boolean> {
    const formData = new FormData();
    formData.append('chat_id', this.config.chatId);
    
    const file = await fs.readFile(options.filePath);
    const blob = new Blob([file]);
    formData.append('document', blob, path.basename(options.filePath));
    
    if (options.caption) {
      formData.append('caption', options.caption);
      formData.append('parse_mode', 'HTML');
    }

    const response = await fetch(`${this.baseUrl}/sendDocument`, {
      method: 'POST',
      body: formData,
    });
    return response.ok;
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/getMe`);
      if (response.ok) {
        return { ok: true };
      }
      const data = await response.json();
      return { ok: false, error: data.description || 'Unknown error' };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  }
}
```

### 4.4 Integration with Backup System

Modificar el endpoint de backup existente para llamar al servicio de Telegram:

```typescript
// In /api/backups/route.ts (POST handler)

async function createBackup(type: 'auto' | 'manual') {
  const result = await performBackup();
  
  // After backup completes, notify Telegram (async, don't await)
  notifyTelegram(result, type).catch(err => {
    console.error('Telegram notification failed:', err);
  });
  
  return result;
}

async function notifyTelegram(
  result: BackupResult, 
  type: 'auto' | 'manual'
) {
  const config = await getTelegramConfig();
  
  if (!config.enabled) return;
  if (type === 'auto' && !config.notifyAuto) return;
  if (type === 'manual' && !config.notifyManual) return;

  const telegram = new TelegramService({
    botToken: config.botToken,
    chatId: config.chatId,
  });

  if (result.success) {
    await sendSuccessNotification(telegram, result, type, config);
  } else if (config.notifyErrors) {
    await sendErrorNotification(telegram, result, type);
  }
}
```

### 4.5 Message Templates

```typescript
function formatSuccessMessage(backup: BackupInfo, type: string): string {
  return `✅ <b>Backup Completado</b>

📅 Fecha: ${formatDate(backup.createdAt)}
📦 Tipo: ${type === 'auto' ? 'Automático' : 'Manual'}
💾 Tamaño: ${formatSize(backup.size)}
📁 Archivo: ${backup.filename}`;
}

function formatLargeFileMessage(backup: BackupInfo, type: string): string {
  return `✅ <b>Backup Completado</b>

📅 Fecha: ${formatDate(backup.createdAt)}
📦 Tipo: ${type === 'auto' ? 'Automático' : 'Manual'}
💾 Tamaño: ${formatSize(backup.size)}
📁 Archivo: ${backup.filename}

⚠️ Archivo muy grande para adjuntar (>50MB).
Descárgalo desde la aplicación.`;
}

function formatErrorMessage(error: string, type: string): string {
  return `❌ <b>Error en Backup</b>

📅 Fecha: ${formatDate(new Date())}
📦 Tipo: ${type === 'auto' ? 'Automático' : 'Manual'}
🚫 Error: ${error}

Revisa el sistema lo antes posible.`;
}
```

### 4.6 UI Component

```tsx
// src/app/components/TelegramConfig.tsx

export function TelegramConfig() {
  const [config, setConfig] = useState<TelegramConfigState>(defaultConfig);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [showToken, setShowToken] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    const res = await fetch('/api/telegram/test', { method: 'POST' });
    const data = await res.json();
    setTestResult(data.success ? 'success' : 'error');
    setTesting(false);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium flex items-center gap-2">
        <Send size={20} />
        Notificaciones de Telegram
      </h3>
      
      {/* Toggle principal */}
      <label className="flex items-center gap-2">
        <input 
          type="checkbox" 
          checked={config.enabled}
          onChange={e => updateConfig({ enabled: e.target.checked })}
        />
        Activar notificaciones
      </label>

      {config.enabled && (
        <>
          {/* Bot Token */}
          <div>
            <label>Bot Token</label>
            <div className="flex gap-2">
              <input
                type={showToken ? 'text' : 'password'}
                value={config.botToken}
                onChange={e => updateConfig({ botToken: e.target.value })}
                placeholder="123456789:ABCdefGHI..."
              />
              <button onClick={() => setShowToken(!showToken)}>
                {showToken ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </div>

          {/* Chat ID */}
          <div>
            <label>Chat ID</label>
            <input
              type="text"
              value={config.chatId}
              onChange={e => updateConfig({ chatId: e.target.value })}
              placeholder="123456789"
            />
          </div>

          {/* Test button */}
          <button onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 className="animate-spin" /> : 'Probar conexión'}
          </button>
          {testResult === 'success' && <span className="text-green-500">✅ Conectado</span>}
          {testResult === 'error' && <span className="text-red-500">❌ Error</span>}

          {/* Checkboxes */}
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={config.notifyAuto} ... />
              Notificar backups automáticos
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={config.notifyManual} ... />
              Notificar backups manuales
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={config.notifyErrors} ... />
              Notificar errores
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={config.sendFile} ... />
              Adjuntar archivo de backup
            </label>
          </div>
        </>
      )}
    </div>
  );
}
```

---

## 5. File Structure

```
src/
├── lib/
│   └── telegram.ts              # TelegramService class
├── app/
│   ├── api/
│   │   └── telegram/
│   │       ├── config/
│   │       │   └── route.ts     # GET, PUT config
│   │       └── test/
│   │           └── route.ts     # POST test message
│   └── components/
│       └── TelegramConfig.tsx   # UI component
```

---

## 6. Acceptance Criteria

- [ ] **AC1:** GET /api/telegram/config retorna configuración (token ofuscado)
- [ ] **AC2:** PUT /api/telegram/config guarda configuración
- [ ] **AC3:** POST /api/telegram/test envía mensaje de prueba
- [ ] **AC4:** Backup auto exitoso → mensaje + archivo enviado
- [ ] **AC5:** Backup manual exitoso → mensaje + archivo enviado
- [ ] **AC6:** Backup fallido → mensaje de error enviado
- [ ] **AC7:** Archivo >50MB → solo mensaje (sin adjunto)
- [ ] **AC8:** Toggle desactivado → no se envía nada
- [ ] **AC9:** Error de Telegram no afecta creación de backup
- [ ] **AC10:** UI muestra configuración en Config panel

---

## 7. Testing Checklist

- [ ] Probar con token válido
- [ ] Probar con token inválido (debe mostrar error)
- [ ] Probar con chat ID incorrecto
- [ ] Probar backup auto con notificaciones activadas
- [ ] Probar backup manual con notificaciones activadas
- [ ] Probar con archivo pequeño (<50MB)
- [ ] Probar con archivo grande (>50MB) - debe enviar solo texto
- [ ] Probar con Telegram desactivado - backup debe funcionar igual
- [ ] Probar fallo de red durante envío - backup no debe fallar

---

## 8. Security Considerations

- Bot Token se almacena en servidor (no expuesto al cliente)
- API de config solo retorna token ofuscado
- Considerar rate limiting para evitar spam
- Validar que requests vengan de sesión autenticada (si se implementa auth)

---

## 9. Dependencies

| Package | Purpose | Install |
|---------|---------|---------|
| (none) | Usamos fetch nativo de Node.js 18+ | Built-in |

---

## 10. Implementation Steps

1. Crear archivo `/data/telegram-config.json` con valores por defecto
2. Crear `src/lib/telegram.ts` con TelegramService
3. Crear API endpoints `/api/telegram/config` y `/api/telegram/test`
4. Crear componente UI `TelegramConfig.tsx`
5. Agregar sección en ConfigPanel (pestaña Preferences)
6. Integrar con sistema de backups existente (llamar después de crear backup)
7. Probar end-to-end

---

## 11. Decisions

| Pregunta | Decisión |
|----------|----------|
| ¿Dónde guardar config? | ✅ Archivo JSON `/data/telegram-config.json` |
| ¿Encriptar bot token? | No (single user, servidor local) |
| ¿Dónde en UI? | Nueva sección en "Preferences" del ConfigPanel |
