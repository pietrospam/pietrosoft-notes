# REQ-016: Comentarios en Tareas

**Estado:** PENDIENTE  
**Prioridad:** Media-Alta  
**Fecha:** 2026-03-03

Añadir un sistema de comentarios asociado a las tareas que permita a los
usuarios dejar anotaciones con formato rico (RTF similar al cuerpo de las notas),
registrando autor y marca temporal y conservando cada edición en el historial de
cambios de la tarea.

## Objetivo

Facilitar la comunicación y el registro de decisiones dentro de cada tarea sin
mezclar la información con la descripción principal, manteniendo un histórico
completo y enlazado con el log de actividad.

## Especificaciones

1. **Tabla de comentarios**
   - Nombre `task_comments`.
   - Campos:
     - `id` (texto, PK, uuid)
     - `task_id` (texto) referencia a `notes.id` donde `type = 'task'`.
     - `author` (texto) – identificador del usuario que escribió el comentario.
     - `content` (json) – contenido enriquecido compatible con TipTap, igual que
       `note.contentJson`.
     - `created_at` (timestamp) – fecha/hora de creación.
   - Indices en `task_id` y `created_at`.
   - Restricción de integridad referencial con `ON DELETE CASCADE`.

2. **Persistencia**
   - La aplicación debe exponer API para listar/crear/editar/eliminar
     comentarios de una tarea.
   - El contenido se guarda como JSON y el front‑end utilizará el mismo editor
     TipTap ya usado para el cuerpo de la nota.

3. **Interfaz**
   - En el editor de tareas (inline/popup) agregar un panel o pestaña "Comentarios"
     donde aparezca la lista de entradas ordenadas cronológicamente.
   - Cada comentario es editable por su autor, con el mismo editor RTF. Las
     modificaciones se guardan y se anotan en el historial de la tarea.

4. **Historial de cambios**
   - Crear un evento de tipo `COMMENT_CREATED`, `COMMENT_UPDATED` y
     `COMMENT_DELETED` en `task_activity_logs` cuando se realice cada acción,
     incluyendo `author` y `commentId` como metadata.

5. **Seguridad y permisos**
   - Solo usuarios autenticados pueden añadir/editar comentarios.
   - Un usuario sólo puede editar/eliminar sus propios comentarios.

6. **API y backend**
   - Añadir nuevas rutas bajo `/api/tasks/[id]/comments` para manejar operaciones
     CRUD.
   - Actualizar repositorios y tipos para incluir `TaskComment`.

7. **Migraciones**
   - Generar una nueva migración que crea la tabla `task_comments` según la
     especificación, así como los índices y claves foráneas necesarias.

8. **Pruebas**
   - Escribir tests unitarios/integración que verifiquen la creación y edición
     de comentarios y la entrada correspondiente en el historial.

9. **Documentación**
   - Actualizar `SPEC-002-ui-skeleton.md` y posiblemente otros documentos de
     especificación de UI para incluir el componente de comentarios.

## Notas adicionales

- El formato de los comentarios se mantiene sencillo y coincide con el del body
  de las notas (uso de TipTap con los mismos plugins).
- Esta funcionalidad complementa el historial de actividad ya existente y no
  sustituye al cuerpo de la tarea.
- El diseño debe permitir expandir cada comentario para ver fecha y autor.


---

La implementación deberá comenzar con la migración y el ajuste de la capa de
datos; la parte visual se planificará en una solicitud posterior.
