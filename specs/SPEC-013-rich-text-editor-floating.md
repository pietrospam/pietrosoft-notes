# SPEC-013: Rich Text Editor Enhancements + Floating Editing UI

## Resumen

Mejoras para el editor de notas y comentarios: mantener comportamientos estándar de teclado en rich text y agregar una interfaz flotante para edición cuando el usuario está activo en el editor.

## Requerimientos

- REQ-026: Facturación (parte del editor de notas)
- REQ-008: Miscellaneous (editor UX)
- REQ-021: TODOs / comentarios en tareas

## Objetivo

Asegurar que el editor rich text se comporte de forma natural para notas y comentarios, y que el área de edición muestre una interfaz flotante clara y centrada mientras el usuario escribe.

## Comportamiento esperado

1. `Enter` debe crear un nuevo párrafo.
2. `Shift+Enter` debe insertar un salto de línea suave.
3. `Ctrl+Enter` / `Cmd+Enter` no debe tener funcionalidad especial (debe ser ignorado por la aplicación en el contexto del editor).
4. El editor debe poder mostrar un panel flotante mientras el usuario edita contenido, sin bloquear toda la interfaz.

## Alcance

### A. Editor de notas

- `NoteEditorModal` / `BaseEditorModal` debe mantener el comportamiento rich text estándar.
- El editor debe mostrar una barra flotante o panel emergente con controles básicos de edición cuando el foco esté en el contenido.
- La barra flotante debe ser visible siempre que el editor tenga foco y debe ocultarse cuando se pierde el foco.

### B. Comentarios de tareas

- El editor de comentarios en `TaskComments.tsx` debe comportarse igual que el editor de notas en cuanto a teclado.
- El panel flotante debe aparecer cuando se edita un comentario nuevo o se edita un comentario existente.
- El panel debe ser compacto y estar ubicado cerca del editor para no interferir con el contenido.

## UX / UI

### Barra flotante de edición

Debe incluir al menos estas acciones:
- Negrita
- Cursiva
- Subrayado
- Tachado
- Encabezados / títulos (H1, H2, H3)
- Tamaño de texto + y -
- Listas con viñetas
- Listas numeradas
- Citas en bloque
- Código en línea / bloque de código
- Enlaces
- Imágenes
- Tablas básicas
- Color de texto / resaltado
- Indentación + y -

### Comportamiento del flotante

- Se muestra cuando el editor tiene foco.
- Se oculta cuando el editor pierde foco.
- Debe ubicarse cerca del área de edición, idealmente arriba del cursor o en la parte superior del editor.
- Debe ser lo más discreto posible, sin ocupar demasiado espacio.

## Criterios de aceptación

- [ ] En notas, `Enter` crea un párrafo.
- [ ] En notas, `Shift+Enter` crea un salto de línea suave.
- [ ] En notas, `Ctrl+Enter` no ejecuta ninguna acción adicional.
- [ ] En comentarios, el comportamiento de teclado es idéntico al de notas.
- [ ] Un panel flotante aparece mientras se edita y desaparece al perder foco.
- [ ] El panel flotante incluye los controles de formato requeridos.
- [ ] El comportamiento no altera otras entradas de texto externas al editor rich text.

## Consideraciones técnicas

- El editor actual está basado en `TipTap` y ya tiene un handler `handleKeyDown`.
- La lógica de teclado debe implementarse en `TipTapEditor.tsx` para que se aplique a todos los usos de rich text.
- El flotante puede implementarse dentro de `TipTapEditor.tsx`, o bien como un pequeño componente UI asociado a ese editor.
- Debe respetar el modo `readOnly` y no mostrarse en vistas donde solo se lee contenido.

## No hacer

- No cambiar el comportamiento de `Enter` en títulos de notas o campos de texto simple.
- No aplicar el panel flotante a inputs de formulario que no sean rich text.
- No convertir `Ctrl+Enter` en una acción de envío o guardado.

## Notas

- Este spec cubre tanto la experiencia de edición de notas como la experiencia de comentarios.
- La implementación debe priorizar la consistencia entre ambos contextos.
