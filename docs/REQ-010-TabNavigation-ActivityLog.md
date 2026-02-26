# REQ-010: Navegación por Tabs, Historial de Actividad y Jerarquía de Clientes

**Estado:** PENDIENTE  
**Prioridad:** Alta  
**Fecha:** 2026-02-26

---

## 1. Resumen del Cambio

### 1.1 Situación Actual
- La aplicación tiene un Sidebar con navegación que incluye: Favoritos, Todas, Clientes, Sin Cliente, TimeSheets, Archivados y Config
- TimeSheets está ubicado en la parte inferior del Sidebar como opción separada
- El título "Bitácora" aparece en el TopBar pero no tiene funcionalidad de navegación
- No existe registro de actividad/cambios para las tareas

### 1.2 Nueva Visión

#### Parte A: Navegación por Tabs
- El área donde actualmente se muestra "Bitácora" se convierte en un **selector de tabs**
- Dos tabs principales: **"Bitácora"** y **"TimeSheets"**
- Cada tab muestra una vista completamente diferente de la aplicación
- La opción de TimeSheets se **remueve del Sidebar** (ya que se accede desde el tab)

#### Parte B: Historial de Actividad de Tareas
- Cada acción realizada sobre una Task genera un registro de log
- El log es accesible desde un botón "Historial de cambios" en la tarea
- El historial muestra: fecha, hora, tipo de evento y descripción

#### Parte C: Jerarquía de Clientes (Cliente Principal)
- Algunos clientes pueden agruparse bajo un "Cliente Principal"
- El Sidebar muestra los clientes agrupados jerárquicamente
- Un cliente puede ser independiente o pertenecer a un cliente principal

---

## 2. Parte A: Navegación por Tabs

### 2.1 Cambios en TopBar

#### 2.1.1 Nuevo componente de tabs
Reemplazar el texto estático "Bitácora" por un selector de tabs:

```
┌──────────────────────────────────────────────────────────────────────┐
│  [Bitácora] [TimeSheets]  │  🔍 Buscar notas...  │     Guardado...   │
└──────────────────────────────────────────────────────────────────────┘
```

- **Tab activo:** Fondo destacado (azul/primario), texto blanco
- **Tab inactivo:** Fondo transparente, texto gris, hover con fondo sutil
- Diseño compacto, integrado visualmente con el TopBar existente

#### 2.1.2 Comportamiento de los tabs
| Tab | Vista que activa | Descripción |
|-----|------------------|-------------|
| Bitácora | `all`, `favorites`, `archived`, etc. | Vista principal de notas/tareas/conexiones |
| TimeSheets | `timesheets` | Vista de gestión de TimeSheets por cliente principal |

### 2.2 Cambios en Sidebar

#### 2.2.1 Remover opción de TimeSheets
- Eliminar el botón "TimeSheets" de la sección inferior del Sidebar
- Mantener: Archivados y Config en la sección inferior

#### 2.2.2 Comportamiento contextual del Sidebar
- **Cuando Tab = Bitácora:** El Sidebar muestra navegación completa (Favoritos, Todas, Clientes, Archivados, Config)
- **Cuando Tab = TimeSheets:** El Sidebar muestra la lista de **Clientes Principales** para seleccionar

### 2.3 Vista de TimeSheets - Filtrado por Cliente Principal

#### 2.3.1 Importancia del Cliente Principal
El cliente principal es el campo **más relevante** para la vista de TimeSheets porque:
- Las horas se **acumulan por cliente principal**
- **No se pueden mezclar** horas de distintos clientes principales en la misma grilla
- Cada cliente principal tiene su propio reporte de horas

#### 2.3.2 Sidebar en modo TimeSheets
Cuando se activa el tab TimeSheets, el Sidebar muestra:

```
┌─────────────────────────────┐
│ 📊 TIMESHEETS               │
│ ─────────────────────────── │
│ 📋 Todos                ✓   │  ← Ver todas las grillas
│ ─────────────────────────── │
│ 🏢 ACME Corporation         │  ← Cliente principal
│ 🏢 TechStart Inc            │  ← Cliente principal
│ 🏢 Global Bank              │  ← Cliente principal
│ ─────────────────────────── │
│ ⚙️  Config                   │
└─────────────────────────────┘
```

- Opción "Todos" al inicio para ver todas las grillas
- Lista de clientes principales (parentClientId = null) **que tengan sub-clientes**
- Los clientes que son sub-clientes NO aparecen en esta lista
- Los clientes principales que NO tienen sub-clientes tampoco aparecen
- El elemento seleccionado tiene un indicador visual (✓)

#### 2.3.3 Comportamiento de la vista de TimeSheets

**Cabecera dinámica**
- El título de la pantalla siempre muestra `TimeSheets` junto con el número de registros
- Si se ha filtrado por un cliente padre, el nombre de ese cliente aparece junto al título
  con un pequeño punto de color que refleja el `color` definido en el cliente padre

**Opción A: Sin filtro (Todos)**
Cuando se selecciona "Todos" o no hay filtro activo:
- Se muestran **múltiples grillas**, una por cada cliente principal
- Cada grilla está claramente separada con el nombre del cliente principal como encabezado
- Cada grilla tiene sus propios subtotales y totales
- Las grillas se ordenan alfabéticamente por nombre del cliente principal

```
┌─────────────────────────────────────────────────────────────────┐
│ 🏢 ACME Corporation                                             │
├─────────────────────────────────────────────────────────────────┤
│ Fecha      │ Proyecto    │ Tarea      │ Horas │ Estado │ ...   │
│ 26/02/2026 │ Web         │ Homepage   │ 4h    │ ✓      │       │
│            │             │            │ ───── │        │       │
│            │             │ Subtotal   │ 4h ⚠️ │        │       │
├─────────────────────────────────────────────────────────────────┤
│                                   Total ACME: 4h               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 🏢 TechStart Inc                                                │
├─────────────────────────────────────────────────────────────────┤
│ Fecha      │ Proyecto    │ Tarea      │ Horas │ Estado │ ...   │
│ 26/02/2026 │ MVP         │ Backend    │ 6h    │ ✓      │       │
│            │             │            │ ───── │        │       │
│            │             │ Subtotal   │ 6h ⚠️ │        │       │
├─────────────────────────────────────────────────────────────────┤
│                               Total TechStart: 6h              │
└─────────────────────────────────────────────────────────────────┘
```

**Opción B: Filtrado por cliente principal específico**
Cuando se selecciona un cliente principal:
- Se muestra **una sola grilla** del cliente seleccionado
- La grilla incluye **únicamente** TimeSheets de los **sub-clientes** del cliente principal
- NO se muestran las horas del cliente principal en sí mismo, solo las de sus sub-clientes
- Los subtotales y totales son exclusivos de ese cliente principal

#### 2.3.4 Persistencia del filtro
- Se guarda en localStorage: `bitacora-timesheet-client`
- Valor `null` o `'all'` = ver todas las grillas
- Valor con ID = filtrar por ese cliente principal
- Al recargar, se restaura la última selección

### 2.4 Estado y persistencia
- El tab activo se guarda en localStorage para persistir entre sesiones
- Al cargar la aplicación, se restaura el último tab seleccionado
- Clave sugerida: `bitacora-active-tab`

### 2.5 Cambios en AppContext

### 2.6 Backup & Restore / Wipe
- Sección de configuración -> pestaña "Backup" incluye:
  * Exportar workspace completo (carpeta `data` ZIP).
  * Importar ZIP para restaurar los datos (sobrescribe todo).
  * **Nuevo:** botón de "Wipe Workspace" que borra toda la información en la
    base de datos y elimina el contenido de la carpeta de datos. Requiere
    confirmación y no tiene deshacer.


- Nuevo estado: `activeTab: 'bitacora' | 'timesheets'`
- Nueva función: `setActiveTab(tab: string)`
- Nuevo estado: `selectedTimesheetClientId: string | null` (null = todos, string = filtrado)
- Nueva función: `setSelectedTimesheetClientId(clientId: string | null)`
- Integrar con `currentView` existente:
  - Si `activeTab = 'timesheets'`, forzar `currentView = 'timesheets'`
  - Si `activeTab = 'bitacora'`, permitir cualquier `currentView` excepto `'timesheets'`

---

## 3. Parte B: Historial de Actividad de Tareas

### 3.1 Nueva tabla en Base de Datos

#### 3.1.1 Modelo TaskActivityLog

```prisma
model TaskActivityLog {
  id          String   @id @default(uuid())
  taskId      String   @map("task_id")
  eventType   String   @map("event_type")
  description String?
  createdAt   DateTime @default(now()) @map("created_at")
  
  task        Note     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  
  @@index([taskId])
  @@index([createdAt])
  @@map("task_activity_logs")
}
```

#### 3.1.2 Campos
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String (UUID) | Identificador único del registro |
| taskId | String | Referencia a la tarea (Note con type='TASK') |
| eventType | String | Tipo de evento (ver sección 3.2) |
| description | String? | Texto descriptivo adicional (opcional) |
| createdAt | DateTime | Fecha y hora del evento |

### 3.2 Tipos de Eventos a Registrar

| eventType | Cuándo se genera | Description (ejemplo) |
|-----------|------------------|----------------------|
| `CREATED` | Al crear la tarea | "Tarea creada" |
| `TITLE_CHANGED` | Al modificar el título | "Título cambiado de 'X' a 'Y'" |
| `STATUS_CHANGED` | Al cambiar el estado | "Estado cambiado de PENDING a IN_PROGRESS" |
| `PRIORITY_CHANGED` | Al cambiar la prioridad | "Prioridad cambiada de MEDIUM a HIGH" |
| `PROJECT_CHANGED` | Al cambiar el proyecto | "Proyecto cambiado a 'Website Redesign'" |
| `CLIENT_CHANGED` | Al cambiar el cliente | "Cliente cambiado a 'ACME Corp'" |
| `DUE_DATE_CHANGED` | Al modificar fecha de vencimiento | "Fecha de vencimiento cambiada a 2026-03-15" |
| `CONTENT_UPDATED` | Al modificar el contenido/descripción | "Contenido actualizado" |
| `TIMESHEET_ADDED` | Al agregar un registro de TimeSheet | "TimeSheet agregado: 2h - Desarrollo" |
| `TIMESHEET_MODIFIED` | Al modificar un TimeSheet asociado | "TimeSheet modificado: horas actualizadas" |
| `TIMESHEET_DELETED` | Al eliminar un TimeSheet asociado | "TimeSheet eliminado" |
| `ATTACHMENT_ADDED` | Al agregar un adjunto | "Adjunto agregado: documento.pdf" |
| `ATTACHMENT_DELETED` | Al eliminar un adjunto | "Adjunto eliminado: imagen.png" |
| `ARCHIVED` | Al archivar la tarea | "Tarea archivada" |
| `UNARCHIVED` | Al desarchivar la tarea | "Tarea desarchivada" |
| `FAVORITED` | Al marcar como favorita | "Marcada como favorita" |
| `UNFAVORITED` | Al desmarcar favorita | "Desmarcada de favoritos" |

### 3.3 Cambios en la UI - TaskEditorModal

#### 3.3.1 Nuevo botón "Historial de cambios"
- Ubicación: En la barra de herramientas/header del TaskEditorModal
- Icono sugerido: `History` o `Clock` de lucide-react
- Solo visible para tareas existentes (no en modo creación)

```
┌─────────────────────────────────────────────────────────────────┐
│ 📝 Mi Tarea                              [📎] [🕐] [⭐] [📤] [✕] │
└─────────────────────────────────────────────────────────────────┘
                                            ↑
                                    Nuevo botón "Historial"
```

#### 3.3.2 Modal/Panel de Historial
Al hacer clic en el botón, se abre un modal/panel lateral con:

```
┌─────────────────────────────────────────────────┐
│ Historial de Cambios                      [✕]  │
├─────────────────────────────────────────────────┤
│                                                 │
│ 📅 26/02/2026                                   │
│ ────────────────────────────────────────────    │
│ 🕐 14:35  Estado cambiado                       │
│           PENDING → IN_PROGRESS                 │
│                                                 │
│ 🕐 10:22  TimeSheet agregado                    │
│           2h - Reunión de planificación         │
│                                                 │
│ 📅 25/02/2026                                   │
│ ────────────────────────────────────────────    │
│ 🕐 16:45  Prioridad cambiada                    │
│           MEDIUM → HIGH                         │
│                                                 │
│ 🕐 09:00  Tarea creada                          │
│                                                 │
└─────────────────────────────────────────────────┘
```

- Registros ordenados por fecha/hora descendente (más recientes primero)
- Agrupados por fecha con separador visual
- Cada registro muestra: hora, tipo de evento, y descripción si aplica

### 3.4 API Endpoints

#### 3.4.1 GET /api/notes/[id]/activity
Obtiene el historial de actividad de una tarea.

**Response:**
```json
{
  "logs": [
    {
      "id": "uuid-1",
      "eventType": "STATUS_CHANGED",
      "description": "Estado cambiado de PENDING a IN_PROGRESS",
      "createdAt": "2026-02-26T14:35:00.000Z"
    },
    ...
  ]
}
```

#### 3.4.2 POST /api/notes/[id]/activity (interno)
Crea un nuevo registro de actividad. Este endpoint es de uso interno, llamado automáticamente desde los servicios de backend.

### 3.5 Integración con Operaciones Existentes

#### 3.5.1 Crear tarea (POST /api/notes)
- Después de crear la tarea, registrar evento `CREATED`

#### 3.5.2 Actualizar tarea (PATCH /api/notes/[id])
- Comparar valores anteriores con nuevos
- Registrar eventos específicos para cada campo modificado
- Un solo save puede generar múltiples registros de log

#### 3.5.3 Operaciones de TimeSheet
- Al crear TimeSheet vinculado a tarea: `TIMESHEET_ADDED`
- Al modificar TimeSheet: `TIMESHEET_MODIFIED`
- Al eliminar TimeSheet: `TIMESHEET_DELETED`

#### 3.5.4 Operaciones de Attachments
- Al agregar adjunto a tarea: `ATTACHMENT_ADDED`
- Al eliminar adjunto de tarea: `ATTACHMENT_DELETED`

### 3.6 Auto-creación de TimeSheet Placeholder

#### 3.6.1 Propósito
Al final del día, el usuario puede ver en qué tareas trabajó y asignarles las horas correspondientes si no lo hizo antes. Para esto, cada vez que se registra actividad sobre una tarea, el sistema puede crear automáticamente un registro de TimeSheet "placeholder".

#### 3.6.2 Comportamiento
Al registrar un evento de actividad sobre una tarea:

1. **Verificar** si existe un registro de TimeSheet para esa tarea con fecha de **hoy**
2. **Si NO existe:** Crear un registro de TimeSheet con:
   - `taskId`: ID de la tarea
   - `workDate`: Fecha de hoy
   - `hoursWorked`: **0** (cero horas, placeholder)
   - `description`: Descripción basada en el evento (ej: "Trabajé en esta tarea")
   - `state`: `DRAFT` (borrador)
3. **Si YA existe:** No hacer nada (ya hay un registro para hoy)

#### 3.6.3 Descripción automática según evento
| eventType | Descripción del TimeSheet |
|-----------|--------------------------|
| `CREATED` | "Tarea creada" |
| `TITLE_CHANGED` | "Actualización de título" |
| `STATUS_CHANGED` | "Cambio de estado" |
| `CONTENT_UPDATED` | "Actualización de contenido" |
| `ATTACHMENT_ADDED` | "Agregado adjunto" |
| Otros | "Trabajé en esta tarea" |

#### 3.6.4 Casos donde NO se crea TimeSheet automático
- Si el evento es sobre TimeSheet (`TIMESHEET_ADDED`, `TIMESHEET_MODIFIED`, `TIMESHEET_DELETED`)
- Si ya existe un TimeSheet para esa tarea con fecha de hoy (sin importar las horas)

#### 3.6.5 Flujo de trabajo esperado
```
Usuario trabaja en Tarea X → Sistema registra actividad
                           → Sistema verifica TimeSheet de hoy
                           → No existe → Crea TimeSheet con 0h
                           
Al final del día:
Usuario va a TimeSheets → Ve registro de 0h en Tarea X
                        → Edita y pone las horas reales (ej: 2h)
                        → Marca como "Imputado" si corresponde
```

#### 3.6.6 Beneficios
- El usuario no olvida tareas en las que trabajó
- Funciona como recordatorio para imputar horas
- Los TimeSheets con 0h son fáciles de identificar (requieren atención)
- Al filtrar por estado "Borrador" se ven las horas pendientes de completar

---

## 4. Parte C: Jerarquía de Clientes (Cliente Principal)

### 4.1 Concepto

Algunos clientes pueden agruparse bajo un "Cliente Principal". Esto permite:
- Organizar clientes relacionados (ej: subsidiarias, divisiones, proyectos de un mismo grupo)
- Visualización jerárquica en el Sidebar
- Filtrar por cliente principal para ver todas las notas de sus sub-clientes

### 4.2 Cambios en Base de Datos

#### 4.2.1 Modificación del modelo Client

```prisma
model Client {
  id              String    @id
  name            String
  description     String?
  color           String?
  active          Boolean   @default(true)
  parentClientId  String?   @map("parent_client_id")  // NEW: Referencia al cliente principal
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  
  // Relaciones existentes
  notes           Note[]    @relation("ClientNotes")
  projects        Project[]
  
  // NEW: Relaciones jerárquicas
  parentClient    Client?   @relation("ClientHierarchy", fields: [parentClientId], references: [id])
  subClients      Client[]  @relation("ClientHierarchy")

  @@map("clients")
}
```

#### 4.2.2 Migración SQL

```sql
-- Migration: add_client_hierarchy
ALTER TABLE clients ADD COLUMN parent_client_id VARCHAR(255) REFERENCES clients(id) ON DELETE SET NULL;
CREATE INDEX idx_clients_parent ON clients(parent_client_id);
```

### 4.3 Comportamiento

#### 4.3.1 Tipos de clientes
| Tipo | parentClientId | Descripción |
|------|----------------|-------------|
| Cliente Principal | `null` | Cliente de primer nivel, puede tener sub-clientes |
| Sub-cliente | ID del padre | Pertenece a un cliente principal |
| Cliente Independiente | `null` | Cliente sin sub-clientes (comportamiento actual) |

#### 4.3.2 Reglas de negocio
- Un cliente puede tener múltiples sub-clientes
- Un sub-cliente solo puede tener un cliente principal (no jerárquía multinivel)
- Si se desactiva un cliente principal, sus sub-clientes permanecen activos
- Si se elimina un cliente principal, sus sub-clientes pasan a ser independientes (`parentClientId = null`)

### 4.4 Cambios en la UI

#### 4.4.1 Sidebar - Vista jerárquica

```
┌─────────────────────────────┐
│ ⭐ Favoritos                │
│ 📑 Todas                    │
│ ─────────────────────────── │
│ 🏢 ACME Corporation    ▼    │  ← Cliente principal (expandible)
│    ├─ 🏢 ACME USA           │  ← Sub-cliente
│    └─ 🏢 ACME Europe        │  ← Sub-cliente
│ 🏢 TechStart Inc            │  ← Cliente independiente
│ 🏢 Global Bank         ▼    │  ← Cliente principal
│    ├─ 🏢 GB Retail          │
│    └─ 🏢 GB Corporate       │
│ ─────────────────────────── │
│ 👤 Sin Cliente              │
└─────────────────────────────┘
```

- Los clientes principales muestran un indicador de expansión (▼/▶)
- Click en el indicador expande/colapsa los sub-clientes
- Click en el nombre del cliente principal filtra por todas las notas del grupo
- Click en un sub-cliente filtra solo por ese cliente específico
- Indentación visual para sub-clientes

#### 4.4.2 Filtrado por Cliente Principal
Al seleccionar un cliente principal:
- Se muestran todas las notas del cliente principal
- Se incluyen las notas de todos sus sub-clientes
- El badge de conteo muestra el total combinado

#### 4.4.3 Configuración de Clientes (ClientsManager)

Agregar campo "Cliente Principal" en el formulario de edición/creación de cliente:

```
┌─────────────────────────────────────────────┐
│ Editar Cliente                              │
├─────────────────────────────────────────────┤
│ Nombre:      [ACME USA                    ] │
│ Descripción: [División estadounidense     ] │
│ Color:       [🔵 Azul              ▼      ] │
│ Cliente Principal: [ACME Corporation  ▼   ] │  ← NUEVO
│              [ ] Sin cliente principal      │
│                                             │
│              [Cancelar]  [Guardar]          │
└─────────────────────────────────────────────┘
```

- Dropdown con todos los clientes que pueden ser principales
- Opción "Sin cliente principal" para clientes independientes
- Un cliente no puede ser su propio padre
- Un sub-cliente no puede aparecer como opción de cliente principal

### 4.5 API Endpoints

#### 4.5.1 GET /api/clients (modificado)
Incluir información de jerarquía en la respuesta:

```json
[
  {
    "id": "acme-corp",
    "name": "ACME Corporation",
    "parentClientId": null,
    "subClients": [
      { "id": "acme-usa", "name": "ACME USA" },
      { "id": "acme-eu", "name": "ACME Europe" }
    ]
  },
  {
    "id": "acme-usa",
    "name": "ACME USA",
    "parentClientId": "acme-corp"
  }
]
```

#### 4.5.2 PATCH /api/clients/[id] (modificado)
Permitir actualizar `parentClientId`:

```json
{
  "parentClientId": "acme-corp"  // o null para hacerlo independiente
}
```

### 4.6 Persistencia de estado
- El estado expandido/colapsado de cada cliente principal se guarda en localStorage
- Clave: `bitacora-client-expanded-{clientId}`
- Por defecto, los clientes principales se muestran colapsados

---

## 5. Criterios de Aceptación

### Parte A: Navegación por Tabs
- [ ] El TopBar muestra tabs "Bitácora" y "TimeSheets" en lugar del texto estático
- [ ] Hacer clic en cada tab cambia la vista correspondiente
- [ ] La opción TimeSheets se remueve del Sidebar
- [ ] En tab Bitácora: el Sidebar muestra navegación completa (Favoritos, Todas, Clientes, etc.)
- [ ] En tab TimeSheets: el Sidebar muestra solo clientes principales para seleccionar
- [ ] El tab activo se persiste en localStorage
- [ ] Al recargar, se restaura el último tab seleccionado

### Parte A.1: TimeSheets por Cliente Principal
- [ ] El Sidebar en modo TimeSheets muestra opción "Todos" + lista de clientes principales
- [ ] Solo se muestran clientes principales en el selector (no sub-clientes)
- [ ] **Sin filtro (Todos):** se muestran múltiples grillas, una por cada cliente principal
- [ ] Cada grilla tiene encabezado con nombre del cliente principal
- [ ] Cada grilla tiene sus propios subtotales y totales
- [ ] **Con filtro:** se muestra una sola grilla del cliente seleccionado (+ sus sub-clientes)
- [ ] El filtro seleccionado se persiste en localStorage
- [ ] Al recargar, se restaura el último filtro seleccionado

### Parte B: Historial de Actividad
- [ ] Existe la tabla `task_activity_logs` en la base de datos
- [ ] Al crear una tarea se registra evento `CREATED`
- [ ] Al modificar campos de la tarea se registran los eventos correspondientes
- [ ] Al agregar/modificar/eliminar TimeSheets se registran eventos
- [ ] Al agregar/eliminar adjuntos se registran eventos
- [ ] El botón "Historial de cambios" aparece en TaskEditorModal (solo tareas existentes)
- [ ] El modal de historial muestra los registros ordenados por fecha descendente
- [ ] Los registros se agrupan visualmente por fecha

### Parte B.1: Auto-creación de TimeSheet Placeholder
- [ ] Al registrar actividad en tarea, se verifica si existe TimeSheet de hoy
- [ ] Si NO existe TimeSheet de hoy, se crea uno con 0 horas
- [ ] El TimeSheet creado tiene estado DRAFT (borrador)
- [ ] La descripción del TimeSheet refleja el tipo de actividad realizada
- [ ] Si YA existe TimeSheet de hoy, no se crea otro
- [ ] Los eventos de TimeSheet (TIMESHEET_*) NO crean TimeSheet automático
- [ ] Los TimeSheets con 0h son visibles en la grilla para completar después

### Parte C: Jerarquía de Clientes
- [ ] El modelo Client tiene campo `parentClientId` opcional
- [ ] El Sidebar muestra clientes jerárquicamente con indicadores de expansión
- [ ] Click en cliente principal muestra notas del grupo completo
- [ ] Click en sub-cliente muestra solo sus notas
- [ ] ClientsManager permite asignar/cambiar cliente principal
- [ ] El estado expandido/colapsado se persiste en localStorage
- [ ] Un cliente no puede ser su propio padre
- [ ] Al eliminar cliente principal, sub-clientes pasan a ser independientes

---

## 6. Componentes Afectados

### Parte A: Navegación por Tabs y TimeSheets por Cliente Principal
- `TopBar.tsx` - Agregar selector de tabs (Bitácora / TimeSheets)
- `Sidebar.tsx` - Vista contextual según tab activo:
  - Tab Bitácora: navegación completa con jerarquía de clientes
  - Tab TimeSheets: selector de clientes principales únicamente
- `AppContext.tsx` - Nuevos estados:
  - `activeTab: 'bitacora' | 'timesheets'`
  - `selectedTimesheetClientId: string | null`
- `page.tsx` - Ajustar layout según tab activo
- `TimeSheetView.tsx` - Filtrar por cliente principal seleccionado
- `src/app/api/timesheets/route.ts` - Aceptar filtro por cliente principal (incluye sub-clientes)

### Parte B: Historial de Actividad
- `prisma/schema.prisma` - Nueva tabla TaskActivityLog
- `src/lib/repositories/activity-log-repo.ts` - Nuevo repositorio (crear)
- `src/app/api/notes/[id]/activity/route.ts` - Nuevo endpoint (crear)
- `src/app/api/notes/route.ts` - Integrar logging en create
- `src/app/api/notes/[id]/route.ts` - Integrar logging en update
- `TaskEditorModal.tsx` - Botón y modal de historial
- `TaskActivityLogModal.tsx` - Nuevo componente (crear)

### Parte C: Jerarquía de Clientes
- `prisma/schema.prisma` - Agregar parentClientId al modelo Client
- `Sidebar.tsx` - Vista jerárquica de clientes con expansión/colapso
- `ClientsManager.tsx` - Campo para seleccionar cliente principal
- `src/app/api/clients/route.ts` - Incluir subClients en respuesta
- `src/app/api/clients/[id]/route.ts` - Permitir actualizar parentClientId
- `AppContext.tsx` - Estado de expansión de clientes, filtrado por grupo

---

## 7. Migraciones de Base de Datos

### 7.1 Migración para Activity Log
```sql
-- Migration: add_task_activity_log
CREATE TABLE task_activity_logs (
  id VARCHAR(36) PRIMARY KEY,
  task_id VARCHAR(255) NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_task_activity_task_id (task_id),
  INDEX idx_task_activity_created (created_at)
);
```

### 7.2 Migración para Jerarquía de Clientes
```sql
-- Migration: add_client_hierarchy
ALTER TABLE clients ADD COLUMN parent_client_id VARCHAR(255) REFERENCES clients(id) ON DELETE SET NULL;
CREATE INDEX idx_clients_parent ON clients(parent_client_id);
```

---

## 8. Notas de Implementación

### 8.1 Performance (Historial de Actividad)
- El historial se carga on-demand (solo cuando el usuario abre el modal)
- Considerar paginación si el historial crece mucho (>100 registros)
- Índices en taskId y createdAt para consultas eficientes

### 8.2 Descripción automática
- Generar descripciones legibles automáticamente basadas en el tipo de evento
- Incluir valores anteriores y nuevos cuando sea relevante
- Ejemplo: "Estado cambiado de PENDING a IN_PROGRESS"

### 8.3 Formato de fechas
- Mostrar fecha completa para el agrupador: "26 de febrero de 2026"
- Mostrar solo hora para cada registro: "14:35"
- Usar formato relativo para fechas recientes: "Hoy", "Ayer"

### 8.4 Jerarquía de Clientes
- Solo se permite un nivel de jerarquía (principal → sub-clientes)
- Los sub-clientes no pueden tener sus propios sub-clientes
- Validar en el backend que no se creen ciclos (A padre de B, B padre de A)
- El color del cliente principal puede heredarse visualmente a los sub-clientes (opcional)

### 8.5 Estado de expansión en Sidebar
- Usar localStorage para persistir qué clientes están expandidos
- Formato: `{ "client-id-1": true, "client-id-2": false }`
- Por defecto, todos colapsados para no ocupar mucho espacio
