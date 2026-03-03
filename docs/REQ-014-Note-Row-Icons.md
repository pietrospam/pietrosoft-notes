# REQ-014: Iconos en fila a la derecha en filas de notas

**Estado:** PENDIENTE  
**Prioridad:** Baja/Media  
**Fecha:** 2026-03-03

Actualmente cada fila dentro de la lista de notas utiliza varios iconos y
badges que aparecen en posiciones variadas (algunos en el lado izquierdo, otros
al derecho, algunos encima del nombre del cliente, etc.). Para mejorar la
consistencia visual y liberar espacio para el título/cliente, se desea
reordenarlos en una única hilera alineada hacia la derecha de la tarjeta.

## Objetivo
Mostrar todos los íconos de estado de una nota (favorito, timesheet,
anexos y tipo) en una fila horizontal, situados al mismo nivel vertical que el
badge del cliente y alineados hacia la derecha del contenedor de la nota.

## Especificaciones
1. **Iconos a incluir** (de izquierda a derecha):
   1. **Favoritos** – estrella rellena/outline según esté marcado.
   2. **Timesheet** – ícono de reloj que indica la existencia de entradas de
      timesheet asociadas.
   3. **Anexos** – icono de clip/paperclip acompañado del contador de
      adjuntos.
   4. **Tipo de nota** – pequeño icono que representa general/task/connection.
2. **Posicionamiento**
   - Todos los íconos deben aparecer en la misma línea vertical que el badge
     identificador del cliente (es decir, la primera fila interna de la nota).
   - Estarán alineados a la derecha dentro de la tarjeta/celda, separados por
     espacio pequeño (`gap-x-2` o similar).
   - La lista seguirá siendo `flex` para colocar correctamente los elementos.
3. **Comportamiento y visibilidad**
   - Los iconos se mostrarán en todas las notas, independientemente de si están
     seleccionadas o no; no deben depender del hover.
   - Cuando no aplique un icono (por ejemplo no hay timesheets), su espacio
     simplemente queda vacío, manteniendo el orden visual.
   - Debe mantenerse el orden fijo descrito arriba.
4. **Accesibilidad y tooltip**
   - Cada icono tendrá `title`/`aria-label` apropiado para describir su función.
   - Debe ser legible en tamaños pequeños; usar `size={14}` o similar como se
     hace actualmente.
5. **Migración e impacto**
   - Este cambio es únicamente de presentación; no requiere modificaciones en
     datos o lógica de estado existente.
   - Actualizar `NotesList.tsx` y `TaskEditorModal.tsx` (donde se repite el
     resumen de tareas) para reflejar el nuevo layout.
6. **Pruebas y documentación**
   - Añadir un caso e2e que verifique la presencia y orden correcto de los
     iconos en varias combinaciones de notas (con/ sin adjuntos, favoritos,
     etc.).
   - Documentar en `SPEC-002-ui-skeleton.md` o el archivo de diseño pertinente
     la nueva disposición de iconos.

## Notas adicionales
- El ordenamiento de los iconos refleja la frecuencia de interacción del
  usuario y pretende priorizar visualmente los elementos más relevantes.
- Este requisito puede combinarse con futuros cambios visuales (por ejemplo,
  introducir colores o animaciones ligeras).

Una vez aprobado, la implementación puede llevarse a cabo junto con otras
refactorizaciones de `NotesList`.