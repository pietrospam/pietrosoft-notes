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
