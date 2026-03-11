# REQ-021: Sistema de TODOs

**Estado:** EN PROGRESO  
**Spec:** [SPEC-009-todos](../specs/SPEC-009-todos.md)  
**Prioridad:** Media-Alta  
**Fecha:** 2026-03-11

## Descripción

Implementar un sistema de TODOs asociados a tareas que permita crear recordatorios
con fecha límite (deadline), mostrando notificaciones cuando se vence el plazo y
permitiendo marcarlos como completados.

## Conceptos Clave

### ¿Qué es un TODO?

Un TODO es un **comentario especial** de una tarea que incluye:
- **Fecha de creación**: Cuándo se creó el TODO
- **Deadline**: Fecha/hora límite para completarlo
- **Body**: Contenido/descripción del TODO (texto enriquecido como los comentarios)
- **Estado**: `pending` (pendiente) o `completed` (cumplido)
- **Fecha de completado**: Cuándo se marcó como completado (si aplica)

### Diferencia con Comentarios Normales

| Aspecto | Comentario | TODO |
|---------|------------|------|
| Tiene deadline | ❌ | ✅ (opcional) |
| Tiene estado | ❌ | ✅ |
| Aparece en sidebar | ❌ | ✅ |
| Genera notificación in-app | ❌ | ✅ (al vencer) |
| Genera notificación Telegram | ❌ | ✅ (configurable) |
| Puede ser recurrente | ❌ | ✅ |
| Se puede posponer (snooze) | ❌ | ✅ |

## Funcionalidades

### 1. Creación de TODOs

- Desde el panel de comentarios de una tarea, opción para crear TODO
- Campos requeridos:
  - Contenido (TipTap editor, igual que comentarios)
  - Deadline (selector de fecha y hora)
- El TODO se asocia automáticamente a la tarea actual

### 2. Visualización en Sidebar

Nueva sección en la sidebar: **"🚩 TODOs"** (con banderita roja)

- Lista de TODOs pendientes ordenados por deadline (más próximo primero)
- Cada item muestra:
  - Título/excerpt del TODO (primeras palabras del body)
  - Nombre de la tarea asociada
  - Tiempo restante o "Vencido hace X"
  - Indicador visual si está vencido (rojo)
- Click en un TODO navega a la tarea asociada

### 3. Indicador en Tareas

Las tareas que tienen TODOs pendientes muestran:
- 🚩 Banderita roja en la lista de notas (NotesList)
- Contador de TODOs pendientes (opcional)

### 4. Notificaciones de Vencimiento

Cuando un TODO alcanza su deadline:
- **Banner de notificación** visible en la parte superior de la app
- El banner permanece visible hasta que:
  - Se complete el TODO, o
  - Se descarte manualmente (snooze)
- Múltiples TODOs vencidos se apilan o muestran contador

### 5. Completar/Descartar TODOs

- **Completar** (✓ tilde verde): Marca como cumplido, desaparece de la lista
- **Descartar** (✗): Elimina el TODO sin completarlo (opcional, a discutir)
- Los TODOs completados quedan en el historial de la tarea

## Interfaz de Usuario

### Sidebar - Sección TODOs

```
┌─────────────────────────────┐
│ 🚩 TODOs (3)               │
├─────────────────────────────┤
│ ⚠️ Revisar documentación    │
│    Task: API Backend        │
│    Vencido hace 2h          │
├─────────────────────────────┤
│ 📌 Enviar reporte           │
│    Task: Informe mensual    │
│    Vence en 3h              │
├─────────────────────────────┤
│ 📌 Llamar al cliente        │
│    Task: Soporte ABC        │
│    Vence mañana 10:00       │
└─────────────────────────────┘
```

### Banner de Notificación (TODO vencido)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 🔔 🚩 TODO vencido: "Revisar documentación" - Task: API Backend          │
│                                    [⏰ Snooze ▼] [✓ Completar] [✗ Cerrar] │
└──────────────────────────────────────────────────────────────────────────┘

Dropdown Snooze:
┌─────────────────┐
│ 15 minutos      │
│ 1 hora          │
│ 3 horas         │
│ Mañana 9:00     │
│ Personalizado...│
└─────────────────┘
```

### Lista de Notas - Indicador

```
│ 🚩 📋 Task: API Backend                              │
│    Ticket: ABC-123                                   │
```

### Panel de Comentarios - Crear TODO

```
┌─────────────────────────────────────┐
│ Comentarios                    [+TODO] │
├─────────────────────────────────────┤
│ ... lista de comentarios ...        │
└─────────────────────────────────────┘
```

### Modal/Form Crear TODO

```
┌─────────────────────────────────────────┐
│ Nuevo TODO                          [✗] │
├─────────────────────────────────────────┤
│ Descripción:                            │
│ ┌─────────────────────────────────────┐ │
│ │ [Editor TipTap]                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ⏰ Deadline:                            │
│ [📅 15/03/2026] [🕐 14:00]  ☐ Sin fecha│
│                                         │
│ 🔄 Repetir:                             │
│ [▼ No repetir                        ]  │
│    ├─ No repetir                        │
│    ├─ Diario                            │
│    ├─ Semanal (elegir día)              │
│    └─ Mensual (elegir día)              │
│                                         │
│              [Cancelar] [Crear TODO]    │
└─────────────────────────────────────────┘
```

## Modelo de Datos

### Nueva tabla: `task_todos`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único |
| `task_id` | UUID | FK a `notes.id` (type=TASK) |
| `author` | String | Usuario que creó el TODO |
| `content` | JSON | Contenido TipTap |
| `deadline` | DateTime? | Fecha/hora límite (opcional para checklist) |
| `status` | Enum | `pending`, `completed`, `deleted` |
| `completed_at` | DateTime? | Fecha de completado |
| `deleted_at` | DateTime? | Fecha de eliminación |
| `snoozed_until` | DateTime? | Pospuesto hasta (si aplica) |
| `recurrence_rule` | String? | Regla de recurrencia (null = no recurrente) |
| `recurrence_parent_id` | UUID? | ID del TODO original (para TODOs generados por recurrencia) |
| `created_at` | DateTime | Fecha de creación |

### Valores de `recurrence_rule`

- `DAILY` - Todos los días
- `WEEKLY:1` - Cada semana el lunes (1=lun, 7=dom)
- `MONTHLY:15` - Cada mes el día 15
- `null` - No recurrente

### Índices sugeridos

- `task_id` + `status` (para filtrar TODOs pendientes por tarea)
- `deadline` + `status` (para ordenar por vencimiento)
- `snoozed_until` (para verificar snooze expirado)

### Nueva tabla: `todo_notifications_sent`

Tracking de notificaciones enviadas para evitar duplicados.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único |
| `todo_id` | UUID | FK a `task_todos.id` |
| `notification_type` | Enum | `daily_summary`, `reminder`, `overdue` |
| `reminder_minutes` | Int? | Minutos de antelación (solo para reminders) |
| `sent_at` | DateTime | Fecha/hora de envío |

### Configuración: `telegram-config.json`

Extender la configuración existente:

```json
{
  "enabled": true,
  "botToken": "...",
  "chatId": "...",
  "todoNotifications": {
    "dailySummary": {
      "enabled": true,
      "time": "08:00",
      "days": [1, 2, 3, 4, 5]
    },
    "reminders": {
      "enabled": true,
      "beforeMinutes": [1440, 60, 30]
    },
    "overdueNotification": {
      "enabled": true
    }
  }
}
```

## API

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/todos` | Lista todos los TODOs pendientes |
| GET | `/api/todos/overdue` | TODOs vencidos (para notificaciones) |
| GET | `/api/tasks/[id]/todos` | TODOs de una tarea específica |
| POST | `/api/tasks/[id]/todos` | Crear TODO en una tarea |
| PATCH | `/api/todos/[id]` | Actualizar TODO (completar, editar) |
| PATCH | `/api/todos/[id]/snooze` | Posponer TODO |
| DELETE | `/api/todos/[id]` | Eliminar TODO (soft delete) |

### Respuesta GET /api/todos

```json
{
  "todos": [
    {
      "id": "uuid",
      "taskId": "uuid",
      "taskTitle": "API Backend",
      "author": "Pietro",
      "content": { "type": "doc", ... },
      "deadline": "2026-03-11T15:00:00Z",
      "status": "pending",
      "isOverdue": true,
      "snoozedUntil": null,
      "recurrenceRule": "WEEKLY:1",
      "createdAt": "2026-03-10T10:00:00Z"
    }
  ]
}
```

### Request PATCH /api/todos/[id]/snooze

```json
{
  "until": "2026-03-11T16:00:00Z"
}
```

## Comportamiento

### Polling/Actualización

- La app debe verificar periódicamente si hay TODOs vencidos
- Opciones:
  1. Polling cada minuto
  2. Calcular próximo vencimiento y usar setTimeout
  3. WebSocket (overkill para single-user)

### Persistencia del Banner

- El banner de TODO vencido debe persistir entre navegaciones
- Debe aparecer incluso si el usuario está en otra sección
- Posición fija en la parte superior

## Notificaciones de Telegram

Integración con el bot de Telegram existente (SPEC-007) para enviar recordatorios
de TODOs pendientes.

### 1. Resumen Diario de TODOs

Mensaje automático al inicio de cada día con el listado de TODOs pendientes.

**Contenido del mensaje:**
```
📋 Buenos días! Tus TODOs para hoy:

🚩 VENCIDOS (2):
  ⚠️ Revisar documentación API
     Task: Backend API | Venció: ayer 15:00
  ⚠️ Enviar reporte semanal
     Task: Administración | Venció: hace 2 días

📌 HOY (3):
  • Llamar al cliente ABC
    Task: Soporte | Vence: 10:00
  • Actualizar dependencias
    Task: Mantenimiento | Vence: 14:00
  • Revisar PR #123
    Task: Code Review | Vence: 18:00

📅 PRÓXIMOS (2):
  • Preparar presentación
    Task: Proyecto X | Vence: mañana 09:00
  • Backup mensual
    Task: Infraestructura | Vence: 15/03

Total: 7 TODOs pendientes
```

**Configuración:**
- Horario de envío (default: 08:00)
- Días de envío (default: Lunes a Viernes)
- Habilitar/deshabilitar

### 2. Recordatorios de Vencimiento

Mensaje cuando un TODO está próximo a vencer.

**Contenido del mensaje:**
```
⏰ Recordatorio TODO

🚩 Llamar al cliente ABC
   Task: Soporte ABC
   Vence en: 30 minutos (10:00)

[Ver tarea]
```

**Configuración de antelación:**
- Opciones predefinidas:
  - 15 minutos antes
  - 30 minutos antes
  - 1 hora antes
  - 2 horas antes
  - 1 día antes
- Múltiples recordatorios (ej: 1 día antes + 1 hora antes)
- Por TODO individual o configuración global

### 3. Notificación de TODO Vencido

Mensaje cuando un TODO alcanza su deadline sin completarse.

**Contenido del mensaje:**
```
🔴 TODO VENCIDO

🚩 Llamar al cliente ABC
   Task: Soporte ABC
   Venció: hace 5 minutos

[Completar] [Posponer]
```

### Configuración en la App

Nueva sección en Configuración > Telegram > TODOs:

```
┌─────────────────────────────────────────────────┐
│ 🚩 Notificaciones de TODOs                      │
├─────────────────────────────────────────────────┤
│                                                 │
│ 📋 Resumen diario                               │
│ ┌─────────────────────────────────────────────┐ │
│ │ [✓] Enviar resumen diario de TODOs          │ │
│ │                                             │ │
│ │ Horario: [08:00 ▼]                          │ │
│ │                                             │ │
│ │ Días: [✓]Lu [✓]Ma [✓]Mi [✓]Ju [✓]Vi [ ]Sa [ ]Do │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ⏰ Recordatorios de vencimiento                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ [✓] Enviar recordatorios antes del deadline │ │
│ │                                             │ │
│ │ Recordar con antelación:                    │ │
│ │ [ ] 15 minutos antes                        │ │
│ │ [✓] 30 minutos antes                        │ │
│ │ [✓] 1 hora antes                            │ │
│ │ [ ] 2 horas antes                           │ │
│ │ [✓] 1 día antes                             │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 🔴 Notificación de vencimiento                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ [✓] Notificar cuando un TODO vence          │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Modelo de Datos - Configuración

Agregar a `telegram-config.json` o nueva tabla `todo_notification_config`:

```json
{
  "todoNotifications": {
    "dailySummary": {
      "enabled": true,
      "time": "08:00",
      "days": [1, 2, 3, 4, 5]  // 1=Lunes, 7=Domingo
    },
    "reminders": {
      "enabled": true,
      "beforeMinutes": [1440, 60, 30]  // 1 día, 1 hora, 30 min
    },
    "overdueNotification": {
      "enabled": true
    }
  }
}
```

### Modelo de Datos - Tracking de Notificaciones

Nueva tabla `todo_notifications_sent` para evitar enviar duplicados:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único |
| `todo_id` | UUID | FK a `task_todos.id` |
| `notification_type` | Enum | `daily_summary`, `reminder`, `overdue` |
| `reminder_minutes` | Int? | Minutos de antelación (para reminders) |
| `sent_at` | DateTime | Fecha/hora de envío |

### API Adicional

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/telegram/todo-config` | Obtener configuración de notificaciones |
| PUT | `/api/telegram/todo-config` | Actualizar configuración |
| POST | `/api/telegram/send-todo-summary` | Enviar resumen manualmente (testing) |

### Implementación - Cron Jobs

Usar un sistema de verificación periódica:

1. **Resumen diario**: Verificar cada minuto si es hora de enviar
2. **Recordatorios**: Verificar cada minuto TODOs próximos a vencer
3. **Vencimientos**: Verificar cada minuto TODOs recién vencidos

Alternativa: Next.js cron con Vercel o node-cron para deployment Docker.

## Preguntas Abiertas → Decisiones

| Pregunta | Decisión |
|----------|----------|
| ¿Permitir eliminar TODOs sin completarlos? | ✅ Sí |
| ¿Notificación sonora al vencer? | ✅ Sí |
| ¿Snooze? (posponer) | ✅ Sí |
| ¿TODOs recurrentes? | ✅ Sí |
| ¿Mostrar historial de TODOs completados? | ✅ Sí |
| ¿Límite de TODOs por tarea? | ✅ Sí (definir cantidad) |
| ¿TODOs sin deadline? | ✅ Sí (checklist simple) |

## Decisiones Adicionales

### TODOs en el Flujo de Comentarios

Los TODOs **deben mostrarse integrados** en el flujo de comentarios de la tarea:
- Aparecen cronológicamente junto con los comentarios normales
- Se distinguen visualmente (borde/fondo diferente, icono 🚩)
- Muestran el deadline y estado dentro del comentario
- Se pueden completar directamente desde el flujo de comentarios

```
┌─────────────────────────────────────────────┐
│ Comentarios                                 │
├─────────────────────────────────────────────┤
│ 💬 Pietro - 10:30                           │
│    Revisé el código, falta optimizar...     │
├─────────────────────────────────────────────┤
│ 🚩 TODO - Pietro - 11:00         [✓] [✗]   │
│    ⏰ Vence: 15/03/2026 14:00               │
│    Enviar documentación al cliente          │
│    Estado: Pendiente                        │
├─────────────────────────────────────────────┤
│ 💬 Pietro - 11:15                           │
│    Agregué los tests unitarios...           │
└─────────────────────────────────────────────┘
```

### Snooze (Posponer)

Opciones de snooze al vencer un TODO:
- 15 minutos
- 1 hora
- 3 horas
- Mañana a las 9:00
- Personalizado (selector de fecha/hora)

### TODOs Recurrentes

- Opción al crear: "Repetir cada..."
  - Diario
  - Semanal (elegir día)
  - Mensual (elegir día del mes)
  - Personalizado
- Al completar un TODO recurrente, se crea automáticamente el siguiente
- Campo adicional: `recurrence_rule` (formato iCal RRULE o simplificado)

### TODOs sin Deadline (Checklist)

- Deadline opcional al crear
- TODOs sin deadline no generan notificación
- Aparecen al final de la lista (después de los que tienen deadline)
- Útil como checklist simple dentro de una tarea

### Límite de TODOs por Tarea

- Máximo sugerido: **10 TODOs pendientes** por tarea
- Mostrar advertencia al acercarse al límite
- No bloquear creación, solo advertir

### Notificación Sonora

- Sonido breve al vencer un TODO
- Respetar configuración de sonido del sistema
- Opción para silenciar en configuración de la app

## Criterios de Aceptación

### Creación
- [ ] Puedo crear un TODO desde el panel de comentarios de una tarea
- [ ] Puedo crear un TODO con deadline (fecha y hora)
- [ ] Puedo crear un TODO sin deadline (checklist)
- [ ] Puedo crear un TODO recurrente (diario, semanal, mensual)

### Visualización en Sidebar
- [ ] Los TODOs aparecen en la sección 🚩 TODOs de la sidebar
- [ ] Los TODOs se ordenan por deadline (más próximo primero)
- [ ] Los TODOs sin deadline aparecen al final
- [ ] Click en un TODO navega a la tarea asociada

### Visualización en Comentarios
- [ ] Los TODOs aparecen integrados en el flujo de comentarios
- [ ] Los TODOs se distinguen visualmente de los comentarios normales
- [ ] Puedo completar/eliminar un TODO desde el flujo de comentarios

### Indicadores
- [ ] Las tareas con TODOs pendientes muestran banderita roja 🚩
- [ ] Se muestra contador de TODOs pendientes (opcional)

### Notificaciones (In-App)
- [ ] Al vencer un TODO aparece banner de notificación
- [ ] El banner permanece visible hasta completar/snooze el TODO
- [ ] Suena notificación sonora al vencer (si está habilitado)

### Notificaciones de Telegram
- [ ] Puedo configurar el horario del resumen diario
- [ ] Puedo elegir qué días recibir el resumen diario
- [ ] Recibo resumen diario con TODOs vencidos, de hoy y próximos
- [ ] Puedo configurar la antelación de recordatorios (15min, 30min, 1h, 2h, 1día)
- [ ] Puedo habilitar múltiples recordatorios para el mismo TODO
- [ ] Recibo notificación cuando un TODO vence
- [ ] Puedo habilitar/deshabilitar cada tipo de notificación independientemente
- [ ] No recibo recordatorios duplicados (tracking de envíos)

### Acciones
- [ ] Puedo marcar un TODO como completado (✓)
- [ ] Puedo eliminar un TODO sin completarlo (✗)
- [ ] Puedo posponer (snooze) un TODO vencido
- [ ] Las opciones de snooze incluyen: 15min, 1h, 3h, mañana, personalizado

### Recurrencia
- [ ] Al completar un TODO recurrente, se crea el siguiente automáticamente
- [ ] El nuevo TODO tiene el deadline calculado según la regla

### Historial
- [ ] Los TODOs completados quedan visibles en el historial de la tarea
- [ ] Los TODOs eliminados quedan registrados (soft delete)

### Límites y Advertencias
- [ ] Se muestra advertencia al acercarse al límite de TODOs por tarea

## Notas Técnicas

- Reutilizar el editor TipTap existente para el contenido
- Los TODOs se muestran en el mismo flujo de comentarios (consulta unificada)
- Crear comentario del sistema al completar/eliminar TODO
- El deadline debe incluir hora para mayor precisión
- Usar `snoozed_until` para ocultar temporalmente notificaciones
- Para TODOs recurrentes, crear el siguiente al completar con transaction
- Soft delete para mantener historial (`deleted_at` en lugar de DELETE)
- Polling cada 60 segundos para verificar TODOs vencidos
- Audio API del navegador para notificación sonora

### Integración con Comentarios

La API `/api/tasks/[id]/comments` debe retornar una lista unificada:
- Comentarios normales
- TODOs (como comentarios especiales)

Ordenados por `created_at` para mantener el flujo cronológico.

Opción de implementación:
1. Query separada y merge en frontend
2. Query unificada con UNION en backend

### Integración con Telegram

- Utilizar el módulo existente `src/lib/telegram.ts` para envío de mensajes
- Agregar configuración de TODOs a `telegram-config.json`
- Implementar cron job o intervalo para:
  - Verificar si es hora del resumen diario
  - Verificar TODOs próximos a vencer (según configuración de antelación)
  - Verificar TODOs recién vencidos
- Tracking de notificaciones enviadas para evitar duplicados
- Considerar timezone del usuario para horarios

### Cron Job / Scheduler

Opciones de implementación:
1. **setInterval en el servidor** - Simple pero requiere proceso activo
2. **node-cron** - Más robusto para Docker
3. **API route llamada por cron externo** - Stateless, ideal para serverless
4. **Verificación en cada request** - Fallback si no hay cron

Recomendación: node-cron para Docker, con fallback de verificación en requests.

---
