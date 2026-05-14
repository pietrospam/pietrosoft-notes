# REQ-020: Comentarios del Sistema

**Estado:** COMPLETADO  
**Spec:** [SPEC-008-system-comments](../specs/SPEC-008-system-comments.md)  
**Prioridad:** Media  
**Fecha:** 2026-03-11

Ampliar el sistema de comentarios automáticos (generados por el sistema) que
registran eventos importantes en las tareas, facilitando el seguimiento de
cambios sin depender únicamente del activity log.

## Contexto

Actualmente, cuando se agrega un anexo a una tarea, se crea automáticamente un
comentario del sistema (`🤖 Sistema`) con información del archivo y un enlace
de descarga. Este patrón debe extenderse a otros eventos relevantes.

## Objetivo

Mantener un registro visible en los comentarios de la tarea de todos los eventos
significativos, permitiendo que el usuario vea el historial de cambios de forma
más accesible que navegando al activity log.

## Eventos a Registrar

### 1. Anexos (Attachments)

| Evento | Mensaje propuesto |
|--------|-------------------|
| Anexo agregado | ✅ Ya implementado: `📎 Se ha agregado un archivo anexo: [nombre](link) (tamaño) - fecha` |
| Anexo eliminado | `🗑️ Se ha eliminado el archivo anexo: "nombre" (tamaño)` |
| Anexo renombrado | `✏️ Se ha renombrado el archivo anexo: "nombre_anterior" → "nombre_nuevo"` |

### 2. Estado de la Tarea

| Evento | Mensaje propuesto |
|--------|-------------------|
| Cambio de estado | `📋 Estado cambiado: {estado_anterior} → {estado_nuevo}` |

Estados posibles: `pendiente`, `en progreso`, `completada`, `cancelada`, etc.

### 3. Favoritos

| Evento | Mensaje propuesto |
|--------|-------------------|
| Agregado a favoritos | `⭐ Tarea marcada como favorita` |
| Quitado de favoritos | `☆ Tarea quitada de favoritos` |

## Especificaciones Técnicas

### 1. Función Centralizada

Crear una función utilitaria para generar comentarios del sistema de forma
consistente:

```typescript
interface SystemCommentOptions {
  noteId: string;
  eventType: SystemEventType;
  metadata: Record<string, unknown>;
}

type SystemEventType = 
  | 'ATTACHMENT_ADDED'
  | 'ATTACHMENT_DELETED'
  | 'ATTACHMENT_RENAMED'
  | 'STATUS_CHANGED'
  | 'FAVORITE_ADDED'
  | 'FAVORITE_REMOVED';

async function createSystemComment(options: SystemCommentOptions): Promise<void>
```

### 2. Formato del Contenido

- Los comentarios del sistema usan formato TipTap con texto en *cursiva*
- Incluir enlaces cuando sea posible (ej: enlaces de descarga para anexos)
- El autor siempre es `🤖 Sistema`

### 3. Puntos de Integración

| Archivo | Eventos |
|---------|---------|
| `/api/attachments/route.ts` | Anexo agregado (ya implementado) |
| `/api/attachments/[id]/route.ts` | Anexo eliminado, renombrado |
| `/api/notes/[id]/route.ts` | Cambio de estado, favoritos |

### 4. Protección de Comentarios del Sistema

- En el frontend: ocultar botones de editar/eliminar cuando `author === '🤖 Sistema'`
- En el backend: rechazar DELETE en `/api/tasks/[id]/comments` si el comentario es del sistema

## Criterios de Aceptación

- [ ] Al eliminar un anexo, se crea un comentario del sistema
- [ ] Al renombrar un anexo, se crea un comentario del sistema
- [ ] Al cambiar el estado de una tarea, se crea un comentario del sistema
- [ ] Al agregar una tarea a favoritos, se crea un comentario del sistema
- [ ] Al quitar una tarea de favoritos, se crea un comentario del sistema
- [ ] Los comentarios del sistema muestran el emoji y texto en cursiva
- [ ] Los comentarios del sistema NO muestran botones de editar/eliminar
- [ ] El backend rechaza intentos de eliminar comentarios del sistema

## Decisiones

1. **Alcance:** Solo eventos principales (anexos, estado, favoritos). No incluir cambios de prioridad, proyecto ni timesheet.
2. **Formato visual:** Texto en *cursiva* (igual que el comentario actual de anexo agregado)
3. **Protección:** Los comentarios del sistema NO pueden ser editados ni eliminados por el usuario

## Notas

- Esta funcionalidad complementa el Activity Log existente pero es más visible
  para el usuario al estar integrada en la sección de comentarios
- Los comentarios del sistema se identifican por el autor `🤖 Sistema`
- El frontend debe ocultar los botones de editar/eliminar para comentarios del sistema

---
