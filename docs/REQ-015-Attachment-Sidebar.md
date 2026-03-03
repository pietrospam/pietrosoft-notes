# REQ-015: Panel lateral de anexos colapsable

**Estado:** PENDIENTE  
**Prioridad:** Media  
**Fecha:** 2026-03-03

El sistema actualmente muestra los archivos adjuntos dentro de cada editor de
nota, tarea o conexión. El usuario quiere un acceso más rápido y menos intrusivo
a los anexos, especialmente cuando está escribiendo en el cuerpo de la nota.

## Objetivo
Mostrar la lista de anexos en un panel lateral que pueda abrirse y cerrarse
sin abandonar el flujo de edición. El panel debe ser independiente del editor
principal y funcionar tanto en vistas inline como en modales.

## Especificaciones
1. **Visualización inicial**
   - Un pequeño botón fijo en el borde derecho de la pantalla.  
   - El botón muestra un icono de clip (`Paperclip`) y la cantidad de archivos
     adjuntos presentes en la nota seleccionada.  
   - El panel está **colapsado** por defecto (tan sólo el botón es visible).

2. **Expansión / colapso**
   - Al hacer clic en el botón, el panel se **extiende horizontalmente** desde la
     derecha, cubriendo parte del contenido de la nota (superposición, no
     desplazamiento).  
   - Si el usuario vuelve a hacer clic en el clip o hace clic fuera del panel,
     este se cierra y vuelve al estado de botón plegado.
   - El panel se cierra automáticamente si la nota seleccionada cambia (se evita
     mostrar anexos equivocados).

3. **Contenido del panel**
   - Mientras está abierto reutiliza el componente existente
     `AttachmentsPanel` para listar, subir, renombrar y borrar archivos.
   - Si la nota es temporal (`id` comienza con `temp-`), el panel se mostrará
     pero el botón de subida estará deshabilitado y sobre él aparecerá una
     leyenda: "Guarda la nota para poder añadir archivos".
   - Al agregar/eliminar/renombrar se debe propagar el cambio al estado de la
     nota mediante `updateNote()` del contexto, igual que hace el editor.

4. **Accesibilidad y teclado**
   - El botón debe ser focalizable y accionable con `Enter`/`Space`.
   - El panel debe cerrar con `Esc` si está abierto y tiene el foco.
   - Lectores de pantalla deben anunciar "Anexos, X archivos" para el botón y
     "Panel de anexos" para el panel expandido.

5. **Persistencia de preferencia** (optativo / futura iteración)
   - Podría guardarse en localStorage si el usuario prefiere mantenerlo abierto
     o cerrado entre sesiones.

## Notas adicionales
- El panel debe permanecer funcional también cuando se edita una tarea o una
  conexión; el comportamiento se basa únicamente en `selectedNoteId`.
- No debe afectar al flujo de datos ya implementado en el editor; es una vista
  alternativa de los mismos anexos.
- El diseño debe dejar espacio suficiente para que el contenido del editor siga
  siendo legible cuando el panel está abierto.

---

> Este requerimiento será implementado después de finalizar los ajustes en el
> FAB y en la navegación tabular.  Las pruebas e2e deberán cubrir apertura,
> cierre, y operaciones CRUD de anexos desde el panel.