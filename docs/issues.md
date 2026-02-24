# Issues

## Issue 1: No funciona Archivar una nota
ESTADO : RESUELTO
DESCRIPCION : En cualquier lugar que intente presionar el boton para archivar, no hace nada.
RESOLUCION : Se agregó el handler para `archivedAt` en notes-repo.ts que convierte el campo a boolean `archived`.
OBSERVACION:  Cuando se archiva quiero que muestre un toast que me permita deshacer (por 3 segundos) o alguna indicacion que se ha archivado.
RESOLUCION OBSERVACION: Se creó componente Toast.tsx y se agregó al EditorPanel. Ahora muestra "Nota archivada" con botón "Deshacer" por 3 segundos.


## Issue 2: No funciona Anexar archivos
ESTADO : RESUELTO
DESCRIPCION : En cualquier lugar que intente Anexar archivos no funciona
RESOLUCION : Se agregó el handler para `attachments` en notes-repo.ts para persistir el JSON.
RESOLUCION 2: Se corrigieron permisos del directorio /data/attachments en el servidor (chmod 777).
OBservacion: SIGUE SIN FUNCIONAR!
RESOLUCION 3: El docker prune eliminó el volumen. Se recrearon permisos en /data y /data/attachments con chmod 777.
OBSERVACION 2: SIGUE SIN FUNCIONAR!
RESOLUCION FINAL: El problema de raíz era un mismatch de UID. El directorio `./data` montado tiene UID 1000 (del host), pero el Dockerfile creaba un usuario `nextjs` con UID 1001. Se modificó el Dockerfile para usar directamente el usuario `node` (UID 1000, GID 1000) que ya existe en la imagen base `node:18-alpine`. Ahora el contenedor puede escribir en `/data/attachments`.

## Issue 3: No funciona pegar una imagen que tengo en clipboard tomada con una captura de pantalla
ESTADO : RESUELTO
DESCRIPCION : En el body de la nota, intento pegar una imagen que tengo en clipboard tomada con una captura de pantalla, pero no hace nada.
RESOLUCION : Se corrigió el bug de stale closure en TipTapEditor.tsx usando `noteIdRef` para que handlePaste/handleDrop siempre tengan el noteId actual.
RESOLUCION 2: Se corrigieron permisos del directorio /data/attachments en el servidor.
OBservacion: SIGUE SIN FUNCIONAR!
RESOLUCION 3: Ver Issue 2 - El problema era el mismatch de UID entre el host (1000) y el contenedor (1001). Resuelto usando el usuario `node` existente.

## Issue 4: No funciona pegar una imagen que tengo en clipboard tomada con una captura de pantalla
ESTADO : RESUELTO (duplicado de Issue 3)
DESCRIPCION : En el body de la nota, intento pegar una imagen que tengo en clipboard tomada con una captura de pantalla, pero no hace nada.
RESOLUCION : Duplicado - ver Issue 3.


## Issue 5: Funcionamiento SINCRONICO en botones
ESTADO : RESUELTO
DESCRIPCION : cuando edito una nota, y cambio el status, demora en cambiar el boton activo, creo que es porque estas usando eventos sincronicos, esto tiene impacto negativo en la UX. cambialo a asincronico para que sea mejor .
RESOLUCION : Se implementó optimistic updates en AppContext.tsx - el estado local se actualiza inmediatamente y luego se sincroniza con el servidor. Si falla, hace rollback.
OBSERVACION: los botones de estado siguen siendo lentos en cambiar de color.
RESOLUCION OBSERVACION: El problema era el debounce de 500ms. Se cambió TaskFields y ConnectionFields para usar updateNote directamente sin debounce.
OBSERVACION:SIGUE ESTANDO LENTO
RESOLUCION 2: El problema era que updateNote tenía dependencia en [state.notes], lo que causaba que se recreara en cada cambio y provocaba re-renders innecesarios. Se cambió a usar `notesRef` para evitar el stale closure sin recrear el callback.

## Issue 6: No se muestra información
ESTADO : RESUELTO
DESCRIPCION : La aplicacion web no carga nada de la base de datos.
RESOLUCION : Se eliminaron las llamadas a `ensureWorkspaceDirectories()` de las rutas API que usan PostgreSQL. Este código era de la versión anterior con almacenamiento en archivos y fallaba porque intentaba crear `/data/notes` sin permisos.

## Issue 7: No se guarda la informacion que edito en la nota.
ESTADO : RESUELTO
DESCRIPCION : abro o creo una nota, cuando la edito, no tengo ningun boton guarda, ni auto-guardado... no tengo como guardar..
si presiono F5 se pierde todo.
RESOLUCION : El problema era que faltaba la columna `content_json` en la base de datos. El schema de Prisma solo tenía `content` (String para HTML), pero no guardaba el JSON estructurado de TipTap. Se realizó:
1. Agregó campo `contentJson Json? @map("content_json")` al schema de Prisma
2. Actualizó `toNote()` para leer `p.contentJson` en lugar de null hardcodeado
3. Agregó handler para `contentJson` en `updateNote()` y `createNote()`
4. Creó migración `20260220000000_add_content_json` para agregar la columna
Ahora el auto-guardado con debounce de 1 segundo funciona correctamente.
OBSERVACION: Agrega al lado del boton Nueva nota un badge que indique cuando se hiso el auto save , la fecha y hora
RESOLUCION OBSERVACION: Se agregó `lastSaved` e `isSaving` al contexto global (AppContext.tsx). TopBar ahora muestra un badge junto al botón "New Note" que indica "Guardando..." durante el guardado y "Guardado HH:MM:SS" después del éxito.

## Issue 8: No se refresca correctanmente la información de las notas cuando cambio de una a otra.
ESTADO : RESUELTO
DESCRIPcION: Especialmente el body no se refresca.
RESOLUCION: Se agregó `key={selectedNote.id}` al componente TipTapEditor en EditorPanel.tsx. Esto fuerza a React a destruir y recrear el editor cuando se cambia de nota, evitando que TipTap mantenga estado interno de la nota anterior.


## Issue 9: No funciona crear una Timesheet
ESTADO : RESUELTO
DESCRIPCION : Al intentar crear una nota de tipo Timesheet, no se crea correctamente.
RESOLUCION : La validación del API en POST /api/notes requería campos obligatorios para timesheet (taskId, workDate, hoursWorked, description), pero el dropdown solo enviaba type y title. Se hicieron opcionales todos los campos de timesheet al crear, igual que se hizo con task.


## Issue 10: la pestaña del navegador no muestra "Bitacora" sino que muestra "Create Next App" 
ESTADO : RESUELTO
DESCRIPCION :  la pestaña del navegador no muestra "Bitacora" sino que muestra "Create Next App" 
RESOLUCION : Se actualizó el metadata en layout.tsx para mostrar "Bitácora" como título y descripción apropiada.


## Issue 11: No se guarda/recupera la descripción del TimeSheet desde una Task
ESTADO : RESUELTO
DESCRIPCION : Cuando agrego un timesheet desde el popup dentro de una tarea, la descripción aparentemente no se guarda. Al volver a abrir el popup para editar un timesheet existente (mismo día), no recupera la descripción que había ingresado anteriormente.
RESOLUCION : El campo `description` de timesheet se almacena en el campo `content` de la base de datos. Se agregó el mapeo en notes-repo.ts tanto en `createNote` como en `updateNote` para guardar `description` → `content`. 


## Issue 12: Comportamiento extraño al editar el título de una nota nueva
ESTADO : RESUELTO
DESCRIPCION : Cuando se crea una nota nueva, el título por defecto (ej: "Nueva Nota", "Nueva Tarea") queda visible y parece texto estático en lugar de un campo editable. No es obvio que se puede hacer click para modificarlo. El campo de título no tiene indicación visual de que es editable.
SOLUCION PROPUESTA: 
1. Agregar un ícono de "lápiz" junto al título que indique que es editable
2. Cuando la nota es nueva (isNewNote), seleccionar automáticamente el texto del título para facilitar la edición
3. Mejorar el feedback visual del campo de título (mostrar borde o fondo al hacer hover/focus)

RESOLUCION : Se implementó en EditorPanel.tsx:
1. Se agregó ícono de lápiz (Pencil de lucide-react) que aparece al hacer hover sobre el título en notas existentes
2. Cuando se crea una nota nueva (isNewNote), se auto-selecciona el texto del título para facilitar la edición inmediata
3. Se mejoró el feedback visual: borde inferior azul cuando está en foco, borde gris al hover, transparente en estado normal
4. Se agregó placeholder en español "Título de la nota..."


## Issue 13: No se puede editar el nombre de una nota nueva (backspace no funciona)
ESTADO : RESUELTO
DESCRIPCION : Al crear una nota nueva, el texto "Nueva Nota" se selecciona automáticamente pero al presionar backspace no se borra el texto. Cualquier tecla presionada no modifica el título de la nota.
CAUSA : El useEffect que sincroniza el estado local del título con selectedNote tenía como dependencia el objeto `selectedNote`. Como `selectedNote` se deriva del array de notas del estado global, cada vez que algo cambiaba en el contexto (cualquier cambio de estado), React creaba una nueva referencia del objeto aunque el contenido fuera el mismo. Esto disparaba el useEffect que ejecutaba `setTitle(selectedNote.title)`, sobrescribiendo cualquier cambio que el usuario intentara hacer.
RESOLUCION : Se agregó un ref (`prevNoteIdRef`) para trackear el ID de la nota anterior. Ahora el useEffect solo resetea el título cuando realmente cambia de nota (el ID es diferente), no simplemente cuando cambia la referencia del objeto. Esto permite que el usuario edite el título sin que sea sobrescrito por el useEffect.


## Issue 14: Enter en título debe mover foco al body, Ctrl+Enter para salto de línea
ESTADO : RESUELTO
DESCRIPCION : Cuando se está editando el título de una nota/tarea:
- Al presionar Enter, debe mover el foco al body (editor TipTap)
- Para generar un salto de línea en el título, se debe usar Ctrl+Enter
SOLUCION PROPUESTA: Agregar un handler onKeyDown en el input del título que:
1. Si es Enter solo (sin Ctrl), prevenir default y hacer focus al editor TipTap
2. Si es Ctrl+Enter, permitir el comportamiento normal (salto de línea si aplica, aunque en input type="text" no aplica)
RESOLUCION : Se implementó:
1. Se modificó TipTapEditor para usar forwardRef y exponer un método `focus()` via useImperativeHandle
2. Se agregó una ref al editor en EditorPanel
3. Se agregó handler `handleTitleKeyDown` que al presionar Enter (sin Ctrl) hace focus al editor TipTap
4. Ctrl+Enter no tiene efecto especial ya que input type="text" no soporta saltos de línea


## Issue 15: Auto-save no respeta configuración de usuario
ESTADO : RESUELTO
DESCRIPCION : Teniendo el auto-guardado desactivado en la configuración, la aplicación sigue guardando automáticamente las notas en los modales (TaskEditorModal y BaseEditorModal).
CAUSA : Los componentes TaskEditorModal.tsx y BaseEditorModal.tsx tenían implementación de scheduleAutoSave() pero no consultaban el valor de autoSaveEnabled del contexto. Solo EditorPanel.tsx verificaba correctamente este flag.
RESOLUCION : Se corrigieron ambos componentes:
1. Se agregó `autoSaveEnabled` al destructuring de `useApp()` en ambos modales
2. Se agregó la verificación `if (!autoSaveEnabled) return;` al inicio de scheduleAutoSave()
3. Se agregó `autoSaveEnabled` como dependencia del useCallback


## Issue 16: No hay confirmación al salir con cambios sin guardar en modales
ESTADO : RESUELTO
DESCRIPCION : Si hay cambios sin guardar en una nota, tarea o conexión e intento salir/cerrar el modal, se guarda automáticamente sin preguntar al usuario. Debería mostrar un modal con opciones: Cancelar, Descartar cambios, o Guardar y salir.
CAUSA : Los componentes TaskEditorModal y BaseEditorModal hacían auto-save automático al cerrar si había cambios pendientes, sin dar al usuario la opción de descartar.
RESOLUCION : Se modificaron ambos componentes:
1. Se agregó estado `showUnsavedModal` para controlar la visibilidad del modal de confirmación
2. Se cambió `handleClose()` para mostrar el modal si hay cambios sin guardar
3. Se agregaron handlers `handleDiscardAndClose()` y `handleSaveAndClose()`
4. Se agregó el componente `UnsavedChangesModal` (ya existente) al JSX de ambos modales
5. El modal ofrece 3 opciones: Descartar (cierra sin guardar), Cancelar (vuelve al editor), Guardar (guarda y cierra)

OBSERVACION: Al seleccionar otra nota desde la lista, tampoco mostraba el modal y se perdían los cambios.
RESOLUCION ADICIONAL: Se modificó NotesList.tsx para usar `confirmNavigation()` en `handleSelectNote()`:
1. Se agregó `confirmNavigation` al destructuring de `useApp()`
2. Se modificó `handleSelectNote` para verificar cambios sin guardar antes de cambiar de nota
3. Si hay cambios sin guardar, se muestra el modal existente de UnsavedChangesModal (manejado por AppContext)

OBSERVACION 2: El fix de NotesList no funciona. Se puede seleccionar otra nota sin que aparezca el modal y se pierden los cambios.
CAUSA RAÍZ: La app ya no usa EditorPanel para editar notas inline. Usa TaskEditorModal, NoteEditorModal y ConnectionEditorModal en modo `inline=true`. Estos modales tienen su propio estado `isDirty` LOCAL que nunca se sincronizaba con el `state.isDirty` GLOBAL de AppContext. Por eso `confirmNavigation` siempre veía `isDirty: false`.
RESOLUCION FINAL: Se modificaron BaseEditorModal.tsx y TaskEditorModal.tsx para sincronizar el estado `isDirty` local con el contexto global cuando están en modo inline:
1. Se renombró `setIsDirty` a `setIsDirtyLocal` para el estado local
2. Se agregó `setGlobalIsDirty` del contexto (renombrado de `setIsDirty`)
3. Se creó una nueva función `setIsDirty` wrapper que:
   - Actualiza el estado local siempre
   - Actualiza el estado global solo si `inline=true`
4. Ahora cuando el usuario edita en modo inline, el estado dirty se propaga al contexto global y `confirmNavigation` lo detecta correctamente
ESTADO: RESUELTO
