# REQ-018: Server-Side Backup Management

## Resumen

Implementar un sistema completo de gestión de backups almacenados en el servidor, permitiendo backups automáticos programados, backups manuales a demanda, visualización, restauración y eliminación de backups, con políticas de retención configurables.

---

## 1. Objetivos

1. **Persistencia**: Los backups se almacenan en el servidor, no dependen de que el usuario los descargue
2. **Automatización**: Backups programables (diario, semanal, etc.)
3. **Gestión**: Interface para ver, restaurar y eliminar backups
4. **Retención**: Políticas automáticas para limitar el espacio usado
5. **Confiabilidad**: El usuario puede restaurar el sistema a cualquier punto guardado

---

## 2. Requisitos Funcionales

### 2.1 Backups Automáticos Programados

| ID | Descripción |
|----|-------------|
| RF-01 | El sistema debe permitir configurar backups automáticos con frecuencia: Deshabilitado, Diario, Semanal, Mensual |
| RF-02 | Para backups diarios, el usuario puede configurar la hora de ejecución (ej: 03:00 AM) |
| RF-03 | Para backups semanales, el usuario puede configurar el día de la semana y la hora |
| RF-04 | Para backups mensuales, el usuario puede configurar el día del mes y la hora |
| RF-05 | El sistema debe registrar la última ejecución de backup automático y mostrarla en la UI |
| RF-06 | Si un backup automático falla, debe registrarse el error y reintentarse en el siguiente ciclo |

### 2.2 Backups Manuales (A Demanda)

| ID | Descripción |
|----|-------------|
| RF-07 | El usuario debe poder crear un backup manualmente con un click |
| RF-08 | El backup manual debe incluir una descripción/etiqueta opcional |
| RF-09 | Los backups manuales deben diferenciarse visualmente de los automáticos |
| RF-10 | El sistema debe mostrar progreso durante la creación del backup |

### 2.3 Listado y Visualización de Backups

| ID | Descripción |
|----|-------------|
| RF-11 | El sistema debe mostrar una lista de todos los backups disponibles |
| RF-12 | Cada backup debe mostrar: fecha/hora, tamaño, tipo (auto/manual), descripción |
| RF-13 | La lista debe estar ordenada por fecha descendente (más reciente primero) |
| RF-14 | El usuario debe poder filtrar backups por tipo (auto/manual) |
| RF-15 | El sistema debe mostrar el espacio total usado por backups |

### 2.4 Restauración de Backups

| ID | Descripción |
|----|-------------|
| RF-16 | El usuario debe poder restaurar el sistema desde cualquier backup listado |
| RF-17 | Antes de restaurar, el sistema debe mostrar confirmación con advertencia |
| RF-18 | La restauración debe reemplazar completamente los datos actuales |
| RF-19 | Opcionalmente, ofrecer crear un backup del estado actual antes de restaurar |
| RF-20 | Mostrar progreso durante la restauración |
| RF-21 | Tras restaurar, solicitar al usuario refrescar la aplicación |

### 2.5 Eliminación de Backups

| ID | Descripción |
|----|-------------|
| RF-22 | El usuario debe poder eliminar backups individuales |
| RF-23 | El sistema debe pedir confirmación antes de eliminar |
| RF-24 | Permitir selección múltiple para eliminar varios backups a la vez |
| RF-25 | Los backups marcados como "protegidos" no pueden eliminarse automáticamente |

### 2.6 Políticas de Retención

| ID | Descripción |
|----|-------------|
| RF-26 | El usuario debe poder configurar el número máximo de backups a retener |
| RF-27 | El usuario debe poder configurar el espacio máximo en disco para backups (MB/GB) |
| RF-28 | El usuario debe poder configurar la antigüedad máxima de backups (días) |
| RF-29 | La depuración automática debe ejecutarse después de cada backup automático |
| RF-30 | La depuración debe eliminar primero los backups más antiguos |
| RF-31 | Los backups manuales con etiqueta "protegido" no deben eliminarse automáticamente |

### 2.7 Descarga de Backups

| ID | Descripción |
|----|-------------|
| RF-32 | El usuario debe poder descargar cualquier backup del servidor a su equipo local |
| RF-33 | Mantener la funcionalidad actual de "Export Backup" que descarga directamente |

---

## 3. Requisitos No Funcionales

| ID | Descripción |
|----|-------------|
| RNF-01 | El directorio de backups debe ser configurable via variable de entorno `BACKUP_DIR` |
| RNF-02 | El directorio de backups debe montarse como volumen en Docker para persistencia |
| RNF-03 | Los backups deben comprimirse en formato ZIP con nivel de compresión alto |
| RNF-04 | El nombre del archivo debe incluir timestamp: `backup-YYYY-MM-DD-HH-mm-ss.zip` |
| RNF-05 | La UI debe ser responsive y funcionar en dispositivos móviles |
| RNF-06 | Las operaciones de backup/restore no deben bloquear la aplicación para otros usuarios |

---

## 4. Modelo de Datos

### 4.1 Configuración de Backups (localStorage o DB)

```typescript
interface BackupConfig {
  // Scheduling
  autoBackupEnabled: boolean;
  frequency: 'disabled' | 'daily' | 'weekly' | 'monthly';
  scheduledHour: number;      // 0-23
  scheduledMinute: number;    // 0-59
  scheduledDayOfWeek?: number; // 0-6 (Sunday-Saturday) for weekly
  scheduledDayOfMonth?: number; // 1-28 for monthly
  
  // Retention
  maxBackups: number;         // 0 = unlimited
  maxSizeMB: number;          // 0 = unlimited
  maxAgeDays: number;         // 0 = unlimited
  
  // Last execution
  lastAutoBackup?: string;    // ISO timestamp
  lastAutoBackupStatus?: 'success' | 'failed';
  lastAutoBackupError?: string;
}
```

### 4.2 Metadata de Backup

```typescript
interface BackupMetadata {
  filename: string;
  createdAt: string;          // ISO timestamp
  sizeBytes: number;
  type: 'auto' | 'manual';
  description?: string;
  protected: boolean;
  
  // Stats del contenido
  stats?: {
    notes: number;
    clients: number;
    projects: number;
    attachments: number;
    timesheets: number;
  };
}
```

### 4.3 Estructura del Archivo ZIP

Cada backup es un archivo ZIP autónomo con toda la información necesaria para restaurar el sistema:

```
backup-2026-03-06-15-30-00.zip
├── manifest.json              ← Metadata del backup (lectura rápida)
├── db/
│   ├── clients.json
│   ├── projects.json
│   ├── notes.json
│   ├── attachments.json       ← Incluye blob en base64
│   ├── timesheets.json
│   └── activityLogs.json
└── data/                      ← Archivos legacy si existen
    └── ...
```

### 4.4 Manifest.json (dentro del ZIP)

El manifest contiene toda la metadata del backup y se puede leer sin extraer el ZIP completo:

```json
{
  "version": "1.0",
  "createdAt": "2026-03-06T15:30:00.000Z",
  "type": "manual",
  "description": "Antes de migración",
  "protected": false,
  "stats": {
    "notes": 156,
    "clients": 8,
    "projects": 23,
    "attachments": 45,
    "timesheets": 1240,
    "activityLogs": 890
  },
  "appVersion": "1.0.0"
}
```

### 4.5 Lectura de Metadata sin Extraer

```typescript
import JSZip from 'jszip';
import { promises as fs } from 'fs';

async function readBackupManifest(zipPath: string): Promise<BackupMetadata> {
  const zipBuffer = await fs.readFile(zipPath);
  const zip = await JSZip.loadAsync(zipBuffer);
  
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    // Fallback para backups legacy sin manifest
    return {
      filename: path.basename(zipPath),
      createdAt: extractDateFromFilename(zipPath),
      sizeBytes: (await fs.stat(zipPath)).size,
      type: 'manual',
      protected: false
    };
  }
  
  const manifest = JSON.parse(await manifestFile.async('text'));
  return {
    filename: path.basename(zipPath),
    sizeBytes: (await fs.stat(zipPath)).size,
    ...manifest
  };
}
```

---

## 5. API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/backups` | Lista todos los backups con metadata |
| POST | `/api/backups` | Crea un nuevo backup manual |
| GET | `/api/backups/:filename` | Descarga un backup específico |
| DELETE | `/api/backups/:filename` | Elimina un backup |
| POST | `/api/backups/:filename/restore` | Restaura desde un backup |
| PATCH | `/api/backups/:filename` | Actualiza metadata (ej: proteger) |
| GET | `/api/backups/config` | Obtiene configuración de backups |
| PUT | `/api/backups/config` | Actualiza configuración de backups |
| POST | `/api/backups/cleanup` | Ejecuta depuración manual según políticas |

---

## 6. UI/UX

### 6.1 Sección en ConfigPanel > Backup

```
┌─────────────────────────────────────────────────────────────┐
│ Backup & Restore                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─ Server Backups ────────────────────────────────────────┐ │
│ │                                                         │ │
│ │  [+ Crear Backup]  [⚙ Configuración]                    │ │
│ │                                                         │ │
│ │  Espacio usado: 245 MB (12 backups)                     │ │
│ │                                                         │ │
│ │  ┌──────────────────────────────────────────────────┐   │ │
│ │  │ 📦 backup-2026-03-06-15-30-00.zip               │   │ │
│ │  │    Manual • 45.2 MB • Hace 2 horas              │   │ │
│ │  │    "Antes de migración"                         │   │ │
│ │  │    [Restaurar] [Descargar] [🔒] [🗑️]            │   │ │
│ │  ├──────────────────────────────────────────────────┤   │ │
│ │  │ 🤖 backup-2026-03-06-03-00-00.zip               │   │ │
│ │  │    Automático • 44.8 MB • Hace 14 horas         │   │ │
│ │  │    [Restaurar] [Descargar] [🔒] [🗑️]            │   │ │
│ │  └──────────────────────────────────────────────────┘   │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Configuración de Backups Automáticos ──────────────────┐ │
│ │                                                         │ │
│ │  Frecuencia: [Diario ▼]                                 │ │
│ │  Hora: [03:00]                                          │ │
│ │                                                         │ │
│ │  Último backup: 06/03/2026 03:00 ✓ Exitoso              │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Políticas de Retención ────────────────────────────────┐ │
│ │                                                         │ │
│ │  Máximo de backups:    [30    ] (0 = sin límite)        │ │
│ │  Espacio máximo (MB):  [1024  ] (0 = sin límite)        │ │
│ │  Antigüedad máx (días):[90    ] (0 = sin límite)        │ │
│ │                                                         │ │
│ │  [Ejecutar depuración ahora]                            │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Export/Import Local ───────────────────────────────────┐ │
│ │  (Funcionalidad actual - descargar/subir desde el PC)   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Iconos y Estados

| Icono | Significado |
|-------|-------------|
| 📦 | Backup manual |
| 🤖 | Backup automático |
| 🔒 | Backup protegido (no se elimina automáticamente) |
| ✓ | Operación exitosa |
| ⚠️ | Advertencia |
| ❌ | Error |

---

## 7. Implementación del Scheduler

### 7.1 Opciones de Implementación

**Opción A: Cron Job externo (Docker)**
- Agregar un cron job en el contenedor que llame al endpoint
- Pros: Simple, confiable
- Cons: Requiere modificar Dockerfile

**Opción B: Node-cron dentro de la app**
- Usar librería `node-cron` para programar tareas
- Pros: Todo integrado, configurable desde UI
- Cons: Se reinicia si la app reinicia

**Opción C: API Route con verificación periódica**
- Un endpoint que verifica si debe ejecutarse y se llama periódicamente
- Pros: Funciona con cualquier scheduler externo
- Cons: Menos preciso

### 7.2 Recomendación

Usar **Opción B (node-cron)** con persistencia de configuración en base de datos. El scheduler se inicializa al arrancar la aplicación y se reconfigura cuando el usuario cambia la configuración.

---

## 8. Docker Configuration

### 8.1 Volumen para Backups

```yaml
# docker-compose.yml
services:
  app:
    volumes:
      - ./data:/app/data
      - ./backups:/app/backups  # Nuevo volumen
    environment:
      - BACKUP_DIR=/app/backups
```

### 8.2 Variables de Entorno

```env
BACKUP_DIR=/app/backups
BACKUP_MAX_COUNT=30
BACKUP_MAX_SIZE_MB=2048
BACKUP_MAX_AGE_DAYS=90
```

---

## 9. Casos de Uso

### CU-01: Crear backup manual
1. Usuario navega a Configuración > Backup
2. Click en "Crear Backup"
3. Opcionalmente ingresa descripción
4. Sistema crea el backup y muestra progreso
5. Backup aparece en la lista

### CU-02: Restaurar backup
1. Usuario ve lista de backups
2. Click en "Restaurar" en el backup deseado
3. Sistema muestra confirmación con advertencia
4. Opcionalmente ofrece crear backup previo
5. Usuario confirma
6. Sistema restaura y solicita refresh

### CU-03: Configurar backups automáticos
1. Usuario abre configuración de backups
2. Selecciona frecuencia (Diario)
3. Configura hora (03:00)
4. Guarda configuración
5. Sistema programa el backup automático

### CU-04: Depuración automática
1. Se ejecuta backup automático
2. Sistema verifica políticas de retención
3. Si se excede límite de backups, elimina los más antiguos (no protegidos)
4. Si se excede espacio, elimina los más antiguos (no protegidos)
5. Si hay backups más antiguos que el límite de días, los elimina (no protegidos)

---

## 10. Criterios de Aceptación

- [ ] **AC-01**: Se puede crear un backup manual desde la UI
- [ ] **AC-02**: Los backups se almacenan en el directorio configurado del servidor
- [ ] **AC-03**: La lista muestra todos los backups con su metadata
- [ ] **AC-04**: Se puede restaurar el sistema desde cualquier backup
- [ ] **AC-05**: Se puede eliminar backups individuales
- [ ] **AC-06**: Se pueden configurar backups automáticos (diario/semanal/mensual)
- [ ] **AC-07**: Los backups automáticos se ejecutan según la programación
- [ ] **AC-08**: Las políticas de retención se aplican correctamente
- [ ] **AC-09**: Los backups protegidos no se eliminan automáticamente
- [ ] **AC-10**: Se puede descargar cualquier backup del servidor
- [ ] **AC-11**: El volumen de Docker persiste los backups entre reinicios

---

## 11. Priorización

### Fase 1 (MVP)
- RF-07, RF-08: Backup manual
- RF-11, RF-12, RF-13: Listado de backups
- RF-16, RF-17, RF-18, RF-21: Restauración
- RF-22, RF-23: Eliminación
- RF-32: Descarga

### Fase 2
- RF-01 a RF-06: Backups automáticos
- RF-26 a RF-31: Políticas de retención

### Fase 3
- RF-10, RF-20: Indicadores de progreso
- RF-14, RF-24, RF-25: Features adicionales
- RF-19: Backup previo a restauración

---

## 12. Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Disco lleno por backups | Alto | Políticas de retención, alertas |
| Backup corrupto | Alto | Verificación de integridad post-creación |
| Restauración falla a mitad | Alto | Backup previo automático, transacciones |
| Scheduler no ejecuta | Medio | Logs, última ejecución visible en UI |
| Permisos de escritura | Medio | Verificar al iniciar, mensaje de error claro |
| **Base de datos borrada/corrupta** | **Crítico** | **Backups autónomos en filesystem (ver sección 14)** |

---

## 13. Dependencias

- `archiver`: Para crear archivos ZIP (ya instalado)
- `jszip`: Para leer manifest de backups sin extraer (a instalar)
- `node-cron`: Para programar backups automáticos (a instalar)
- Volumen Docker adicional para `/app/backups`

---

## 14. Recuperación ante Desastre (DB Perdida/Corrupta)

### 14.1 Principio Fundamental

**Los backups son completamente independientes de la base de datos.**

- Los archivos ZIP se almacenan en el filesystem (`./backups/`)
- Cada ZIP contiene un `manifest.json` con toda la metadata necesaria
- El endpoint `/api/backups` lee directamente del directorio, NO de la DB
- La pantalla de backup DEBE funcionar aunque la DB esté vacía o corrupta

### 14.2 Flujo de Recuperación Total

```
┌─────────────────────────────────────────────────────────────┐
│ 1. DESASTRE: Base de datos se pierde o corrompe             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Usuario accede a la aplicación                           │
│    → Ve pantalla vacía o error en datos                     │
│    → Pero la app sigue funcionando                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Usuario navega a Configuración > Backup                  │
│    → El sistema lista ZIPs del directorio (NO usa DB)       │
│    → Muestra fecha, tamaño, descripción desde manifest.json │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Usuario selecciona backup y hace click en "Restaurar"    │
│    → Sistema extrae datos del ZIP                           │
│    → Ejecuta prisma db push para recrear schema             │
│    → Inserta todos los datos (clients, projects, notes...)  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Sistema recuperado completamente                         │
│    → Usuario refresca la app                                │
│    → Todo funciona como antes del desastre                  │
└─────────────────────────────────────────────────────────────┘
```

### 14.3 Requisitos Técnicos para Recuperación

| Requisito | Implementación |
|-----------|----------------|
| Listado sin DB | `GET /api/backups` lee `fs.readdir(BACKUP_DIR)` |
| Metadata sin DB | Lee `manifest.json` desde cada ZIP con `jszip` |
| UI sin datos | ConfigPanel debe renderizar aunque `prisma.client.findMany()` falle |
| Restauración recrea DB | Usar `prisma.$executeRaw` para truncar + reinsertar |

### 14.4 Código de Ejemplo: Listado Resiliente

```typescript
// GET /api/backups/route.ts
export async function GET() {
  const backupDir = process.env.BACKUP_DIR || './backups';
  
  try {
    await fs.access(backupDir);
  } catch {
    // Directorio no existe, crear y retornar lista vacía
    await fs.mkdir(backupDir, { recursive: true });
    return NextResponse.json([]);
  }
  
  const files = await fs.readdir(backupDir);
  const zipFiles = files.filter(f => f.endsWith('.zip'));
  
  const backups: BackupMetadata[] = [];
  
  for (const filename of zipFiles) {
    const filePath = path.join(backupDir, filename);
    try {
      // Leer manifest del ZIP (NO de la DB)
      const metadata = await readBackupManifest(filePath);
      backups.push(metadata);
    } catch (err) {
      // Si falla leer manifest, usar datos básicos del filesystem
      const stat = await fs.stat(filePath);
      backups.push({
        filename,
        createdAt: stat.mtime.toISOString(),
        sizeBytes: stat.size,
        type: 'manual',
        protected: false
      });
    }
  }
  
  // Ordenar por fecha descendente
  backups.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  return NextResponse.json(backups);
}
```

### 14.5 Verificación de Integridad

Al restaurar, el sistema debe verificar que el ZIP sea válido:

```typescript
async function verifyBackupIntegrity(zipPath: string): Promise<boolean> {
  try {
    const zip = await JSZip.loadAsync(await fs.readFile(zipPath));
    
    // Verificar que existan los archivos esenciales
    const required = ['manifest.json', 'db/notes.json', 'db/clients.json'];
    for (const file of required) {
      if (!zip.file(file)) {
        return false;
      }
    }
    
    // Verificar que el JSON sea válido
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('text'));
    if (!manifest.createdAt) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}
```

---

## 15. Configuración de Backups Automáticos con Cron

Los backups automáticos requieren un **cron job externo** que llame al endpoint de la API. Esto garantiza que los backups se ejecuten incluso si ningún usuario tiene la aplicación abierta.

### 15.1 API Endpoint para Backup Automático

```
POST /api/backups/auto
```

Este endpoint:
1. Lee la configuración de backup (`backup-settings.json`)
2. Verifica si el backup automático está habilitado
3. Verifica si ha pasado suficiente tiempo desde el último backup (según frecuencia configurada)
4. Si es necesario, crea un nuevo backup
5. Aplica la política de retención (elimina backups antiguos)
6. Actualiza `lastAutoBackup` en la configuración

**Respuesta exitosa:**
```json
{
  "success": true,
  "filename": "backup-auto-2026-03-06-03-00-00.zip",
  "sizeBytes": 1234567,
  "stats": { "notes": 100, "clients": 5, ... },
  "type": "auto"
}
```

**Respuesta si no es necesario backup:**
```json
{
  "skipped": true,
  "reason": "Auto backup not due yet",
  "lastAutoBackup": "2026-03-05T03:00:00.000Z",
  "frequency": "daily"
}
```

### 15.2 Configuración de Cron en Linux/macOS

```bash
# Editar crontab del usuario
crontab -e

# Agregar una de las siguientes líneas:
```

**Opción A: Ejecutar cada hora (recomendado)**
El endpoint ignora llamadas si el backup no está programado todavía:
```bash
0 * * * * curl -s -X POST http://localhost:3001/api/backups/auto >> /var/log/bitacora-backup.log 2>&1
```

**Opción B: Ejecutar una vez al día a las 3:00 AM**
```bash
0 3 * * * curl -s -X POST http://localhost:3001/api/backups/auto >> /var/log/bitacora-backup.log 2>&1
```

**Opción C: Ejecutar semanalmente (domingos a las 2:00 AM)**
```bash
0 2 * * 0 curl -s -X POST http://localhost:3001/api/backups/auto >> /var/log/bitacora-backup.log 2>&1
```

### 15.3 Configuración de Cron en Docker

Si la aplicación corre en Docker, hay varias opciones:

**Opción A: Cron en el host (recomendado)**
Agregar al crontab del servidor que ejecuta Docker:
```bash
0 * * * * curl -s -X POST http://localhost:3001/api/backups/auto >> /var/log/bitacora-backup.log 2>&1
```

**Opción B: Cron dentro del contenedor**
Modificar `Dockerfile` para incluir cron:
```dockerfile
# Instalar cron
RUN apk add --no-cache dcron

# Copiar crontab
COPY crontab /etc/crontabs/root

# Modificar start.sh para iniciar cron
```

Archivo `crontab`:
```
0 * * * * wget -q -O - http://localhost:3000/api/backups/auto
```

**Opción C: Contenedor separado de cron**
```yaml
# docker-compose.yml
services:
  backup-cron:
    image: alpine:latest
    command: >
      sh -c "apk add --no-cache curl && 
             echo '0 * * * * curl -s -X POST http://app:3000/api/backups/auto' | crontab - && 
             crond -f"
    depends_on:
      - app
    networks:
      - default
```

### 15.4 Configuración con systemd timer (alternativa a cron)

```bash
# /etc/systemd/system/bitacora-backup.service
[Unit]
Description=Bitacora Auto Backup
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/bin/curl -s -X POST http://localhost:3001/api/backups/auto
```

```bash
# /etc/systemd/system/bitacora-backup.timer
[Unit]
Description=Run Pietrosoft backup hourly

[Timer]
OnCalendar=hourly
Persistent=true

[Install]
WantedBy=timers.target
```

Activar:
```bash
sudo systemctl enable bitacora-backup.timer
sudo systemctl start bitacora-backup.timer
```

### 15.5 Verificar Estado del Backup Automático

```
GET /api/backups/auto
```

Respuesta:
```json
{
  "enabled": true,
  "frequency": "daily",
  "scheduledTime": "03:00",
  "lastAutoBackup": "2026-03-05T03:00:15.000Z",
  "isDue": false
}
```

### 15.6 Logs y Monitoreo

Para verificar que los backups se ejecutan correctamente:

```bash
# Ver log del cron
tail -f /var/log/bitacora-backup.log

# Verificar último backup
curl http://localhost:3001/api/backups | jq '.[0]'

# Ver estado del backup automático
curl http://localhost:3001/api/backups/auto
```

### 15.7 Configuración desde la UI

La configuración del backup automático se realiza desde:
**Configuration → Backup → Backups en Servidor → ⚙️ (Settings)**

- **Retención**: Cuántos backups mantener (los protegidos no se eliminan)
- **Backup Automático**: Activar/desactivar
- **Frecuencia**: Diario, Semanal, Mensual
- **Hora**: A qué hora ejecutar

> **Importante**: Activar el backup en la UI solo define la configuración. Para que se ejecute automáticamente, **debe existir un cron externo** que llame a `/api/backups/auto`.

---

## 16. Resumen de Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/backups` | Listar todos los backups |
| POST | `/api/backups` | Crear backup manual |
| GET | `/api/backups/settings` | Obtener configuración |
| PUT | `/api/backups/settings` | Actualizar configuración |
| GET | `/api/backups/auto` | Estado del backup automático |
| POST | `/api/backups/auto` | Ejecutar backup automático (llamar desde cron) |
| GET | `/api/backups/[filename]` | Descargar backup |
| DELETE | `/api/backups/[filename]` | Eliminar backup |
| PATCH | `/api/backups/[filename]` | Actualizar metadata (protección, descripción) |
| POST | `/api/backups/[filename]/restore` | Restaurar desde backup |
