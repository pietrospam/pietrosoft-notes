# SPEC-008: Comentarios del Sistema

**Requerimiento:** [REQ-020-SystemComments](../docs/REQ-020-SystemComments.md)  
**Estado:** COMPLETADO  
**Fecha:** 2026-03-11

## Resumen

Implementar comentarios automáticos generados por el sistema que registran
eventos importantes en las tareas: cambios de anexos, estado y favoritos.

## Eventos Soportados

| Evento | Emoji | Mensaje |
|--------|-------|---------|
| Anexo agregado | 📎 | `Se ha agregado un archivo anexo: [nombre](link) (tamaño) - fecha` |
| Anexo eliminado | 🗑️ | `Se ha eliminado el archivo anexo: "nombre" (tamaño)` |
| Anexo renombrado | ✏️ | `Se ha renombrado el archivo anexo: "anterior" → "nuevo"` |
| Estado cambiado | 📋 | `Estado cambiado: {anterior} → {nuevo}` |
| Agregado a favoritos | ⭐ | `Tarea marcada como favorita` |
| Quitado de favoritos | ☆ | `Tarea quitada de favoritos` |

## Implementación

### 1. Módulo Centralizado

Crear `/src/lib/system-comments.ts` con la lógica compartida:

```typescript
import prisma from '@/lib/db';

export const SYSTEM_AUTHOR = '🤖 Sistema';

export type SystemEventType = 
  | 'ATTACHMENT_ADDED'
  | 'ATTACHMENT_DELETED'
  | 'ATTACHMENT_RENAMED'
  | 'STATUS_CHANGED'
  | 'FAVORITE_ADDED'
  | 'FAVORITE_REMOVED';

interface SystemCommentParams {
  noteId: string;
  message: string;  // Texto con emoji incluido
  linkText?: string;
  linkHref?: string;
  afterLinkText?: string;
}

/**
 * Crea un comentario del sistema con formato TipTap (cursiva).
 * Solo crea comentarios para notas de tipo TASK.
 */
export async function createSystemComment(params: SystemCommentParams): Promise<void> {
  const { noteId, message, linkText, linkHref, afterLinkText } = params;
  
  try {
    const note = await prisma.note.findUnique({ where: { id: noteId } });
    if (!note || note.type !== 'TASK') return;

    // Build content array
    const contentArray: object[] = [];
    
    if (linkText && linkHref) {
      // Message with link
      contentArray.push({
        type: 'text',
        marks: [{ type: 'italic' }],
        text: message,
      });
      contentArray.push({
        type: 'text',
        marks: [
          { type: 'italic' },
          {
            type: 'link',
            attrs: {
              href: linkHref,
              target: '_blank',
              rel: 'noopener noreferrer nofollow',
              class: null,
            },
          },
        ],
        text: linkText,
      });
      if (afterLinkText) {
        contentArray.push({
          type: 'text',
          marks: [{ type: 'italic' }],
          text: afterLinkText,
        });
      }
    } else {
      // Simple message without link
      contentArray.push({
        type: 'text',
        marks: [{ type: 'italic' }],
        text: message,
      });
    }

    const content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: contentArray,
        },
      ],
    };

    await prisma.taskComment.create({
      data: {
        taskId: noteId,
        author: SYSTEM_AUTHOR,
        content,
      },
    });
  } catch (error) {
    console.error('Error creating system comment:', error);
    // No fallar la operación principal si falla el comentario
  }
}

// Helper para formato de tamaño de archivo
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Helper para formato de fecha
export function formatDate(): string {
  return new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Mapeo de estados a español
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

export function getStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Sin estado';
  return STATUS_LABELS[status] || status;
}
```

### 2. Cambios en `/api/attachments/route.ts`

Refactorizar para usar el módulo centralizado:

```typescript
import { createSystemComment, formatFileSize, formatDate } from '@/lib/system-comments';

// En POST después de crear el attachment:
await createSystemComment({
  noteId,
  message: '📎 Se ha agregado un archivo anexo: ',
  linkText: file.name,
  linkHref: `/api/attachments/${attachment.id}`,
  afterLinkText: ` (${formatFileSize(file.size)}) - ${formatDate()}`,
});
```

### 3. Cambios en `/api/attachments/[id]/route.ts`

#### DELETE - Anexo eliminado

```typescript
import { createSystemComment, formatFileSize, SYSTEM_AUTHOR } from '@/lib/system-comments';

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = params;
    
    // Obtener info antes de eliminar
    const attachment = await prisma.attachment.findUnique({
      where: { id },
      select: { noteId: true, originalName: true, size: true },
    });
    
    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }
    
    // Eliminar
    await prisma.attachment.delete({ where: { id } });
    
    // Crear comentario del sistema
    await createSystemComment({
      noteId: attachment.noteId,
      message: `🗑️ Se ha eliminado el archivo anexo: "${attachment.originalName}" (${formatFileSize(attachment.size)})`,
    });
    
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 });
  }
}
```

#### PATCH - Anexo renombrado

```typescript
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = params;
    const body = await request.json();
    
    if (!body.originalName) {
      return NextResponse.json({ error: 'originalName is required' }, { status: 400 });
    }
    
    // Obtener nombre anterior
    const oldAttachment = await prisma.attachment.findUnique({
      where: { id },
      select: { noteId: true, originalName: true },
    });
    
    if (!oldAttachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }
    
    const oldName = oldAttachment.originalName;
    const newName = body.originalName;
    
    // Actualizar
    const attachment = await prisma.attachment.update({
      where: { id },
      data: { originalName: newName },
    });
    
    // Crear comentario si el nombre cambió
    if (oldName !== newName) {
      await createSystemComment({
        noteId: attachment.noteId,
        message: `✏️ Se ha renombrado el archivo anexo: "${oldName}" → "${newName}"`,
      });
    }
    
    // ... resto del código
  }
}
```

### 4. Cambios en `/api/notes/[id]/route.ts`

Agregar comentarios del sistema para cambios de estado y favoritos:

```typescript
import { createSystemComment, getStatusLabel } from '@/lib/system-comments';

// En PUT, después de detectar cambios y antes de retornar:
if (note.type === 'task' && oldNote) {
  // ... existing activity log code ...
  
  // Crear comentarios del sistema para eventos específicos
  for (const event of events) {
    if (event.eventType === 'STATUS_CHANGED') {
      const oldStatus = getStatusLabel((oldNote as TaskNote).status);
      const newStatus = getStatusLabel((note as TaskNote).status);
      await createSystemComment({
        noteId: note.id,
        message: `📋 Estado cambiado: ${oldStatus} → ${newStatus}`,
      });
    }
    
    if (event.eventType === 'FAVORITED') {
      await createSystemComment({
        noteId: note.id,
        message: '⭐ Tarea marcada como favorita',
      });
    }
    
    if (event.eventType === 'UNFAVORITED') {
      await createSystemComment({
        noteId: note.id,
        message: '☆ Tarea quitada de favoritos',
      });
    }
  }
}
```

### 5. Protección de Comentarios del Sistema

#### Frontend: `TaskComments.tsx`

Ocultar botones de editar/eliminar para comentarios del sistema:

```tsx
import { SYSTEM_AUTHOR } from '@/lib/system-comments';

// En el render de cada comentario:
{c.author !== SYSTEM_AUTHOR && c.author === currentUser && (
  <div className="flex gap-2 mt-1 text-gray-400 justify-end">
    <button onClick={() => startEditing(c.id, c.content as object)} ...>
      <Pencil size={14} />
    </button>
    <button onClick={() => handleDelete(c.id)} ...>
      <Trash2 size={14} />
    </button>
  </div>
)}
```

**Nota:** Como `SYSTEM_AUTHOR` es `🤖 Sistema` y nunca coincidirá con `currentUser`, 
la condición actual `c.author === currentUser` ya protege los comentarios del sistema.
Sin embargo, es buena práctica hacer la verificación explícita.

#### Backend: `/api/tasks/[id]/comments/route.ts`

Rechazar eliminación de comentarios del sistema:

```typescript
import { SYSTEM_AUTHOR } from '@/lib/system-comments';

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }
  
  // Verificar si es comentario del sistema
  const comment = await prisma.taskComment.findUnique({
    where: { id },
    select: { author: true },
  });
  
  if (!comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
  }
  
  if (comment.author === SYSTEM_AUTHOR) {
    return NextResponse.json(
      { error: 'System comments cannot be deleted' }, 
      { status: 403 }
    );
  }
  
  await deleteTaskComment(id);
  return NextResponse.json({ success: true });
}
```

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/lib/system-comments.ts` | **NUEVO** - Módulo centralizado |
| `src/app/api/attachments/route.ts` | Refactorizar para usar módulo |
| `src/app/api/attachments/[id]/route.ts` | Agregar comentarios en DELETE y PATCH |
| `src/app/api/notes/[id]/route.ts` | Agregar comentarios para estado y favoritos |
| `src/app/api/tasks/[id]/comments/route.ts` | Proteger DELETE de comentarios del sistema |
| `src/app/components/TaskComments.tsx` | Verificación explícita (opcional) |

## Orden de Implementación

1. Crear módulo `system-comments.ts`
2. Refactorizar `attachments/route.ts` para usar el módulo
3. Implementar DELETE y PATCH en `attachments/[id]/route.ts`
4. Implementar estado y favoritos en `notes/[id]/route.ts`
5. Proteger DELETE en `tasks/[id]/comments/route.ts`
6. (Opcional) Verificación explícita en frontend

## Pruebas Manuales

### Anexos
- [ ] Subir un archivo → aparece comentario con enlace de descarga
- [ ] Eliminar un archivo → aparece comentario indicando eliminación
- [ ] Renombrar un archivo → aparece comentario con nombre anterior y nuevo

### Estado
- [ ] Cambiar estado de pendiente a en progreso → aparece comentario
- [ ] Cambiar estado de en progreso a completada → aparece comentario

### Favoritos
- [ ] Marcar tarea como favorita → aparece comentario con ⭐
- [ ] Quitar de favoritos → aparece comentario con ☆

### Protección
- [ ] Los comentarios del sistema NO muestran botones editar/eliminar
- [ ] Intentar eliminar por API retorna error 403

---
