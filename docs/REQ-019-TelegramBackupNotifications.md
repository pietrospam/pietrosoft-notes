# REQ-019: Notificaciones de Backup por Telegram

## Resumen

Enviar notificaciones automáticas a Telegram cuando se genere un backup del servidor, incluyendo el archivo ZIP como adjunto. También notificar si un backup falla.

---

## 1. Objetivos

1. **Visibilidad**: El usuario recibe confirmación inmediata de backups exitosos sin acceder a la app
2. **Acceso remoto**: El archivo de backup queda disponible en Telegram para descarga desde cualquier dispositivo
3. **Alertas de fallos**: El usuario se entera inmediatamente si un backup automático falla
4. **Configurabilidad**: El usuario puede activar/desactivar y elegir qué tipos de backup notificar

---

## 2. Requisitos Funcionales

### 2.1 Configuración de Telegram

| ID | Descripción |
|----|-------------|
| RF-01 | El sistema debe permitir configurar el Token del Bot de Telegram |
| RF-02 | El sistema debe permitir configurar el Chat ID destino |
| RF-03 | El sistema debe validar la conexión con un botón "Probar conexión" |
| RF-04 | El sistema debe mostrar estado de la conexión (conectado/error) |

### 2.2 Notificaciones de Backup Exitoso

| ID | Descripción |
|----|-------------|
| RF-05 | Al completarse un backup, enviar mensaje a Telegram con información del backup |
| RF-06 | El mensaje debe incluir: fecha/hora, tipo (auto/manual), tamaño, nombre del archivo |
| RF-07 | El archivo ZIP del backup debe adjuntarse al mensaje |
| RF-08 | Si el archivo excede el límite de Telegram (50MB), enviar solo notificación con advertencia |

### 2.3 Notificaciones de Error

| ID | Descripción |
|----|-------------|
| RF-09 | Si un backup falla, enviar mensaje de error a Telegram |
| RF-10 | El mensaje de error debe incluir: fecha/hora, tipo de backup, descripción del error |
| RF-11 | El mensaje de error debe usar emoji ⚠️ o ❌ para destacar visualmente |

### 2.4 Control de Notificaciones

| ID | Descripción |
|----|-------------|
| RF-12 | Toggle global para activar/desactivar notificaciones de Telegram |
| RF-13 | Opción para notificar solo backups automáticos |
| RF-14 | Opción para notificar solo backups manuales |
| RF-15 | Opción para notificar ambos tipos |
| RF-16 | Opción para activar/desactivar notificación de errores |

---

## 3. Requisitos No Funcionales

| ID | Descripción |
|----|-------------|
| RNF-01 | Las credenciales de Telegram deben almacenarse en el servidor (no en el cliente) |
| RNF-02 | El Token del Bot debe ocultarse en la UI (mostrar solo últimos 4 caracteres) |
| RNF-03 | El envío a Telegram no debe bloquear la creación del backup (async) |
| RNF-04 | Si Telegram falla, el backup debe completarse igual (notificación es secundaria) |
| RNF-05 | Límite de archivo adjunto: 50MB (límite de Telegram Bot API) |

---

## 4. Configuración Requerida

### 4.1 Variables de Entorno (opcionales)

```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
```

### 4.2 Configuración en UI (Config > Preferences)

```typescript
interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
  notifyAutoBackups: boolean;
  notifyManualBackups: boolean;
  notifyErrors: boolean;
  sendFile: boolean;  // Enviar archivo adjunto o solo notificación
}
```

---

## 5. Formato de Mensajes

### 5.1 Backup Exitoso

```
✅ Backup Completado

📅 Fecha: 2026-03-10 15:30:00
📦 Tipo: Automático
💾 Tamaño: 12.5 MB
📁 Archivo: backup-2026-03-10-15-30-00.zip

[Archivo adjunto: backup-2026-03-10-15-30-00.zip]
```

### 5.2 Backup con Archivo Grande (>50MB)

```
✅ Backup Completado

📅 Fecha: 2026-03-10 15:30:00
📦 Tipo: Manual
💾 Tamaño: 78.2 MB
📁 Archivo: backup-2026-03-10-15-30-00.zip

⚠️ Archivo muy grande para adjuntar (>50MB).
Descárgalo desde la aplicación.
```

### 5.3 Error de Backup

```
❌ Error en Backup

📅 Fecha: 2026-03-10 15:30:00
📦 Tipo: Automático
🚫 Error: No se pudo conectar a la base de datos

Revisa el sistema lo antes posible.
```

---

## 6. UI - Mockup Conceptual

En **Config > Preferences** (o nueva pestaña "Notificaciones"):

```
┌─────────────────────────────────────────────────┐
│ 🔔 Notificaciones de Telegram                   │
├─────────────────────────────────────────────────┤
│ [✓] Activar notificaciones                      │
│                                                 │
│ Bot Token:  [••••••••••••wxyz]  [👁]           │
│ Chat ID:    [123456789        ]                │
│                                                 │
│ [Probar conexión]  ✅ Conectado                 │
│                                                 │
│ ─────────────────────────────────               │
│ Notificar:                                      │
│ [✓] Backups automáticos                        │
│ [✓] Backups manuales                           │
│ [✓] Errores de backup                          │
│                                                 │
│ [✓] Adjuntar archivo de backup                 │
└─────────────────────────────────────────────────┘
```

---

## 7. Criterios de Aceptación

- [ ] AC-01: Usuario puede configurar Bot Token y Chat ID
- [ ] AC-02: Botón "Probar conexión" envía mensaje de prueba
- [ ] AC-03: Backup automático exitoso envía notificación + archivo
- [ ] AC-04: Backup manual exitoso envía notificación + archivo
- [ ] AC-05: Backup fallido envía notificación de error
- [ ] AC-06: Archivo >50MB envía solo notificación (sin adjunto)
- [ ] AC-07: Toggle desactivado no envía ninguna notificación
- [ ] AC-08: Fallo en Telegram no afecta la creación del backup

---

## 8. Dependencias

- **REQ-018**: Sistema de Backups del Servidor (debe estar implementado)
- **Externo**: Bot de Telegram creado por el usuario via @BotFather

---

## 9. Cómo Crear el Bot de Telegram

1. Abrir Telegram y buscar `@BotFather`
2. Enviar `/newbot`
3. Seguir instrucciones para nombrar el bot
4. Copiar el **Token** proporcionado
5. Iniciar conversación con tu nuevo bot
6. Para obtener Chat ID: enviar mensaje al bot, luego visitar:
   `https://api.telegram.org/bot<TOKEN>/getUpdates`
7. Buscar `"chat":{"id":XXXXXXXX}` en la respuesta

---

## 10. Fuera de Alcance (v1)

- Comandos bidireccionales desde Telegram
- Múltiples destinatarios
- Resumen diario de actividad
- Horario silencioso
