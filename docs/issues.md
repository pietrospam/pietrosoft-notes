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

## Issue 16: Previsualizar archivos EML con adjuntos
ESTADO : CANCELADO
DESCRIPCION : Los anexos de notas pueden incluir archivos `.eml`. Se intentó implementar vista previa, pero resultó inestable y no aporta valor suficiente. Decidimos tratar estos ficheros como no soportados; el usuario sólo podrá descargarlos.

## Issue 15: Mostrar cliente en grid de timesheets
ESTADO : RESUELTO
DESCRIPCION : La vista de TimeSheets no mostraba el nombre del cliente asociado, lo que dificultaba la identificación cuando se trabajaba con múltiples clientes. Debe existir una columna adicional a la izquierda del proyecto con un badge coloreado según el cliente.
RESOLUCION : Se agregó columna "Cliente" en TimeSheetView con badge de color, encabezado sortable, y se ajustaron exportaciones CSV/PDF.
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


## Issue 17: Autofocus en campo nombre al crear cliente
ESTADO : RESUELTO
DESCRIPCION : Al abrir el modal de creación de cliente, el cursor no se posiciona automáticamente en el campo "name". El usuario debe hacer click manualmente para comenzar a escribir.
RESOLUCION : Se agregó useRef para el input de nombre, autoFocus={isCreating}, y setTimeout para enfocar el input cuando se abre el modal de creación en ClientsManager.tsx.


## Issue 18: Sidebar no se refresca al crear cliente
ESTADO : RESUELTO
DESCRIPCION : Cuando se crea un nuevo cliente, el panel lateral izquierdo donde se listan los clientes no se actualiza automáticamente. El usuario debe refrescar la página para ver el nuevo cliente.
RESOLUCION : Se importó useApp y se llama a refreshGlobalClients() después de crear exitosamente un cliente en ClientsManager.tsx.


## Issue 19: Error al adjuntar archivo en nota nueva (sin guardar)
ESTADO : RESUELTO
DESCRIPCION : Al crear una nota nueva, si se intenta adjuntar un archivo antes de guardarla por primera vez, se produce un error. Sin embargo, una vez la nota está guardada, adjuntar archivos o pegar desde el clipboard funciona correctamente.
CAUSA : El noteId es temporal (temp-*) hasta que la nota se persiste en la base de datos. El API de attachments verifica que la nota exista.
RESOLUCION : Se agregó la función `persistNote` en BaseEditorModal y `persistTask` en TaskEditorModal que guarda la nota y retorna el ID real. Esta función se pasa como prop `onPersistNote` al TipTapEditor, que la usa para persistir la nota automáticamente antes de subir imágenes pegadas.


## Issue 20: Preseleccionar cliente activo al crear nota/tarea/conexión
ESTADO : RESUELTO
DESCRIPCION : Cuando se tiene un cliente seleccionado en el panel izquierdo (filtrando sus notas), al crear una nueva nota, tarea o conexión no se preselecciona automáticamente ese cliente ni su proyecto "General".
RESOLUCION : Se agregó prop `defaultClientId` a NoteEditorModal, TaskEditorModal y ConnectionEditorModal. NotesList pasa el selectedClientId a estos modales. Los modales ahora inicializan selectedClientId con el valor default y auto-seleccionan el proyecto "General" del cliente.


## Issue 21: Mostrar contador de adjuntos en lugar de "sin contenido"
ESTADO : RESUELTO
DESCRIPCION : Las cards de notas, tareas y conexiones muestran un texto "sin contenido" de origen desconocido. Este texto no aporta valor y debería eliminarse. En su lugar, mostrar un icono con el número de archivos adjuntos que tiene cada nota (si tiene alguno).
RESOLUCION : Se modificó NotesList.tsx para mostrar el contador de attachments con ícono Paperclip cuando la nota no tiene contentText pero sí tiene attachments. Si no tiene ninguno, no se muestra nada.

## Issue 22: Búsqueda no abarca campos completos
ESTADO : RESUELTO
DESCRIPCION : Al usar el buscador global en la barra superior, la búsqueda solo inspecciona el título y un campo `content` que contiene el HTML. No se incluyen el cuerpo de la nota (texto plano/JSON), la descripción corta de las tareas ni el número de ticket/fase, por lo que muchos resultados relevantes no aparecen.
RESOLUCION :
1. Se amplió la función `filteredNotes` en `AppContext.tsx` para que, al haber texto de búsqueda, compare también con `contentText`, el contenido extraído del JSON, y chequeé los campos `ticketPhaseCode` y `shortDescription` cuando existan.
2. Se mejoró el repositorio (`notes-repo.ts`) y la ruta GET `/api/notes` para aceptar un parámetro `search` y filtrar en el servidor usando los mismos campos (título, content HTML, ticket y descripción corta) para futuras optimizaciones.
3. Aunque la búsqueda sigue aplicándose principalmente en el cliente, ahora los resultados capturan cuerpo, título, descripción y número de ticket como pretendido.

## Issue 23: Falta fecha/hora de creación en lista de anexos
ESTADO : RESUELTO
DESCRIPCION : Los anexos y las imágenes pegadas desde el portapapeles se muestran correctamente en la lista de adjuntos, pero no se indicaba cuándo se agregaron. El usuario necesita saber la fecha/hora de creación para auditoría y soporte.
RESOLUCION :
1. Se añadió el campo `createdAt` al tipo `AttachmentMeta` (ya existente) y se mapeó desde la base de datos/API.
2. `AttachmentsPanel.tsx` muestra ahora la marca temporal bajo el tamaño del archivo.
3. `AttachmentViewer.tsx` incluye la fecha/hora en el encabezado del visor.
4. Las rutas de upload (`/api/attachments`) ya devuelven `createdAt`, por lo que imágenes pegadas se ven con el timestamp inmediatamente.
5. Se actualizó la nueva especificación REQ-013 para reflejar el cambio.

## Issue 24: Sidebar no fija ancho en desktop
ESTADO : RESUELTO
DESCRIPCION : En modo escritorio la barra lateral izquierda se colapsa a 14px y sólo se expande a 48px cuando el cursor pasa por encima. Esto provoca un cambio de tamaño inesperado; el cliente quiere que el ancho permanezca constante en desktop.
RESOLUCION :
1. Modificado `Sidebar.tsx` para aplicar `w-14 lg:w-48` en lugar de `w-14 hover:w-48`, eliminando la expansión por hover en pantallas grandes.
2. Ajustadas las clases de opacidad para que las etiquetas, contadores y iconos se muestren siempre en `lg` sin necesidad de hover (`lg:opacity-100`).
3. La navegación mantiene el comportamiento compacto en dispositivos pequeños, pero en desktop la barra está siempre desplegada.
4. No se requieren cambios adicionales en el backend ni en otros componentes.

## Issue 25: Elementos de NotesList necesitan bordes redondeados
ESTADO : RESUELTO
DESCRIPCION : Las filas de la lista de notas se mostraban como bloques rectos sin separación visual; además, los bordes izquierdo y superior de color de cliente rompían la curvatura cuando no había selección. El usuario pidió un borde redondeado y un indicador menos intrusivo.
RESOLUCION :
1. `NotesList.tsx` fue actualizado para añadir `rounded-lg` y un pequeño `mb-1` a cada elemento de nota, generando espacios entre tarjetas.
2. Se eliminaron las franjas color cliente en los bordes y, en su lugar, se añadió un degradado sutil (izquierda a derecha) usando la tonalidad del cliente cuando la nota no está seleccionada.
3. El hover y la selección conservan el radio; el indicador en degradado no interfiere con los bordes redondeados.
4. El cambio es puramente de estilo y no afecta a la lógica del componente.

## Issue 26: Iconos de notas reorganizados en fila
ESTADO : RESUELTO
DESCRIPCION : Los iconos de tipo, timesheet y anexos estaban en una columna a la derecha, separados del badge del cliente. El requerimiento pedía una sola fila de iconos alineada a la derecha del badge, en el orden favoritos, timesheet, anexos, tipo.
RESOLUCION :
1. Se movieron todos los iconos relevantes al `div` superior de cada nota en `NotesList.tsx`.
2. Se construyó un grupo de iconos (`flex items-center gap-1`) a la derecha que aparece siempre y respeta el orden solicitado.
3. Se eliminó el icono de favorito duplicado en la fila de contenido y se mantuvo el comportamiento de toggle por doble clic.
4. La columna original con iconos fue retirada.
5. El componente aún muestra el icono de timesheet (botón), el contador de anexos y el icono de tipo.
6. No se tocaron otros componentes; el cambio es estrictamente de presentación.

## Issue 27: Copia rápida en tarjetas de conexión
ESTADO : RESUELTO
DESCRIPCION : Para las notas de tipo conexión el usuario quería iconos para URL, usuario y contraseña que copien el campo al portapapeles al hacer clic. Los iconos debían aparecer en la misma línea que el título, alineados a la derecha y ser ligeramente más grandes que la estrella de favoritos.
RESOLUCION :
1. Añadidos iconos `Link2`, `User` y `Key` a `NotesList.tsx`, con tamaño 16px y la estética solicitada.  
2. Cambiado el botón de favoritos dentro de la card para activarse con clic simple en lugar de doble clic (mejor UX).  
2. Los iconos se colocan junto al título, dentro del mismo contenedor flexible, y se empujan a la derecha (`ml-auto`).
3. Se creó un estado `copiedInfo` que guarda qué campo se copió para mostrar momentáneamente un `Check` verde en el icono correspondiente.
4. Función `handleConnCopy` implementa la copia con `navigator.clipboard.writeText` y maneja el feedback. Se evita propagación del clic para no seleccionar la nota.
5. Se actualizó el import de lucide-react y removed antigua columna derecha.
6. Documento `issues.md` se actualizó con Issue 27 describiendo cambio.

## Feature: Guardado con Ctrl+S
ESTADO : IMPLEMENTADO
DESCRIPCION : Añadir atajo de teclado global para guardar la nota en edición, mostrando un mensaje flotante al completarse.
RESOLUCION :
1. Se implementó `saveCurrentNote()` en `AppContext` que flushes any pending changes (o crea nota nueva) y actualiza el estado global.
2. En `page.tsx` se añadió un listener de `keydown` que captura `Ctrl/Cmd+S`, previene el comportamiento por defecto y ejecuta la función anterior.
3. Se agregó un `Toast` en `AppLayout` para indicar "Cambios guardados" cuando hay algo por guardar.
4. El atajo no hace nada si no existen cambios (`state.isDirty` falso).



## Issue 22: Control de cambios incorrecto en notas tipo Conexión
ESTADO : RESUELTO
DESCRIPCION : Al abrir una nota de tipo Conexión existente, sin hacer ningún cambio, el modal de "guardar cambios" aparece al intentar cerrar o cambiar de nota.
CAUSA : Cuando se cargaba una nota existente en BaseEditorModal, los datos se asignaban al estado `note` pero no se sincronizaban con los estados locales del ConnectionEditorModal (url, username, password, clientId, projectId). Estos estados quedaban vacíos, y al compararlos con la nota cargada, el sistema detectaba "cambios".
RESOLUCION : Se agregó llamada a `onFieldsChange?.(data)` al cargar la nota existente en BaseEditorModal, para sincronizar los estados locales con los datos cargados.


## Issue 23: Modal de cambios sin guardar demasiado grande
ESTADO : RESUELTO
DESCRIPCION : El modal de "Cambios sin guardar" ocupa demasiado espacio visual para su funcionalidad simple.
RESOLUCION : Se redujo el tamaño del modal de `max-w-md` a `max-w-xs`, se compactaron los paddings, tipografías y los botones.


## Issue 24: Navegador sugiere autocompletado en campos de conexión
ESTADO : RESUELTO
DESCRIPCION : En las notas tipo Conexión, el navegador intenta recordar y sugerir valores en los campos de usuario y contraseña, lo cual no es deseado ya que estos campos almacenan credenciales de diferentes servicios.
RESOLUCION : Se agregaron múltiples atributos para prevenir el autocompletado:
- `autoComplete="off"` / `autoComplete="new-password"`
- `autoCorrect="off"`, `autoCapitalize="off"`, `spellCheck={false}`
- `data-lpignore="true"` (LastPass)
- `data-form-type="other"` (otros gestores de contraseñas)


## Issue 25: Usuario no se guarda en notas tipo Conexión
ESTADO : RESUELTO
DESCRIPCION : En las notas tipo Conexión, el campo de usuario no se guardaba en la base de datos. El valor se perdía al recargar la página.
CAUSA : El esquema de la base de datos tenía `connectionUrl` y `connectionCredentials` (password), pero no existía un campo para el username. En el repositorio (notes-repo.ts), la función `toNote()` retornaba `username: undefined` hardcodeado.
RESOLUCION : 
1. Se agregó el campo `connectionUsername` al schema de Prisma
2. Se creó migración `20260226000000_add_connection_username` para agregar la columna a la base de datos
3. Se actualizó notes-repo.ts:
   - `toNote()` ahora lee de `p.connectionUsername`
   - `createNote()` escribe a `connectionUsername`
   - `updateNote()` actualiza `connectionUsername` cuando el campo 'username' está presente en el input


## Issue 26: Proyecto no se auto-selecciona al cambiar cliente
ESTADO : RESUELTO
DESCRIPCION : Al crear una nota, conexión o tarea, si se selecciona un cliente, el proyecto debería auto-seleccionarse a "General" (si existe un proyecto con ese nombre para el cliente seleccionado).
CAUSA : Los handlers `handleClientChange` en todos los componentes simplemente limpiaban el proyecto a cadena vacía al cambiar de cliente.
RESOLUCION : Se actualizaron los siguientes componentes para buscar y auto-seleccionar el proyecto "General":
- ConnectionEditorModal.tsx
- NoteEditorModal.tsx
- TaskFields.tsx
- TaskEditorModal.tsx

## Issue 27: Adjuntos requieren nota guardada
ESTADO : RESUELTO
DESCRIPCION : Al crear una nota nueva (temp ID), al intentar adjuntar un archivo o pegar una captura de pantalla el sistema mostraba un mensaje "Guarde antes" y no permitía añadir el adjunto. Una vez que la nota se guarda, la funcionalidad funcionaba correctamente. Esto ocurría en todas las notas nuevas en cualquier vista.
RESOLUCION : Se extendió `AttachmentsPanel` para aceptar un callback opcional `onPersistNote`. Antes de subir un archivo, el panel comprueba si el `noteId` es temporal; si es así llama a la función para persistir la nota y obtener su ID definitivo, y luego procede con la carga. Los componentes que usan el panel (`BaseEditorModal`, `TaskEditorModal`, `EditorPanel`) pasan sus respectivas funciones de persistencia (`persistNote`, `persistTask`, `handlePersistForUpload`). Esto elimina la necesidad de guardar manualmente antes de adjuntar o pegar imágenes. Además, se mantiene la lógica de TipTapEditor para persistir notas en el clipboard.

## Issue 28: Mostrar cliente en grid de timesheets
ESTADO : RESUELTO
DESCRIPCION : La vista de TimeSheets no mostraba el nombre del cliente asociado, lo que dificultaba la identificación cuando se trabajaba con múltiples clientes. Debía añadirse una columna adicional a la izquierda del proyecto con un badge coloreado según el cliente.
RESOLUCION : Se agregó columna "Cliente" en `TimeSheetView` con badge de color, encabezado sortable, y se ajustaron las exportaciones CSV/PDF para incluirlo.

## Issue 29: Formato de título en editor inline de tareas
ESTADO : RESUELTO
DESCRIPCION : Al editar una tarea en línea, el título mostrado siempre era el campo `title`. Cuando la tarea tenía un `ticketPhaseCode`, no coincidía con el formato usado en las tarjetas de la lista (`#<ticket> <descripción>`).
RESOLUCION : Se ajustaron los encabezados de `TaskEditorModal` (tanto inline como popup) y otros lugares de visualización (dropdowns, listas) para calcular dinámicamente el texto usando `ticketPhaseCode` y `shortDescription`. La documentación fue actualizada y el formato ahora es consistente en toda la app.

## Issue 30: Modal de creación se reinicia tras pegar adjuntos
ESTADO : RESUELTO
DESCRIPCION : Al crear una nota (task, connection o general) y pegar una imagen o archivo desde el portapapeles, el sistema persistía la nota (para generar el `noteId`) y llamaba a `refreshNotes()`. Eso ponía `isLoading=true` en el contexto, lo que provocaba que `NotesList` devolviera únicamente un spinner y desmontara el modal de creación. Cuando la carga terminaba la lista volvía a renderizarse con un nuevo modal vacío, dando la impresión de que la nota se cerró y se abrió otra, además la imagen no quedaba en el body porque el editor se había destruido.
RESOLUCION : Se modificó `NotesList` para que el indicador de carga sea un overlay y no un early-return, evitando el desmontaje. Además se eliminó el `key={...}` en los componentes `TipTapEditor` dentro de los modales (`TaskEditorModal` y `BaseEditorModal`), ya que el cambio de `note.id` al persistir provocaba el remount que destruía el contenido del editor y rompía la inserción de la imagen. Con ambas correcciones el editor permanece activo durante el guardado, la imagen se inserta correctamente y no hay cierre inesperado. La explicación y pasos para reproducir quedaron documentados.  

## Issue 31: Evitar duplicados de TimeSheet por eventos diarios
ESTADO : RESUELTO
DESCRIPCION : Algunas actividades de tarea disparan la creación automática de un placeholder Timesheet. Era crucial asegurarse de que **solo se cree uno por día por tarea**; eventos subsecuentes en la misma jornada no deben sumar otro registro. Esto se aplica a creación, actualización, cambio de estado, adjuntos, etc.
RESOLUCION : La función `createPlaceholderTimesheet` ahora consulta `hasTimesheetForDate(taskId, today)` antes de insertar y retorna inmediatamente si ya existe. La documentación de la especificación (REQ-010) fue actualizada para dejar explícito este comportamiento. El backend ya usaba esta verificación en cada punto donde se invoca la creación de placeholder; se confirmó con pruebas manuales.

## Issue 32: No mostrar nombre de cliente padre en cabecera de TimeSheets
ESTADO : RESUELTO
DESCRIPCION : Bajo el título "TimeSheets" se estaba mostrando el nombre del cliente padre cuando se estaba filtrando por él. El design requiere mantener ese filtro silencioso, sin repetir el nombre en el encabezado.
RESOLUCION : Se eliminaron todas las referencias a `selectedParentClient` en la UI: el pequeño badge junto al título y el bloque superior encima de la tabla fueron retirados. El filtrado por cliente padre sigue funcionando internamente. La documentación no requiere cambios adicionales porque se trata de una mejora visual.

## Issue 33: Indicador "cambios sin guardar" persistente en pie de modales
ESTADO : RESUELTO
DESCRIPCION : Al editar una nota (inline o en popup) y guardar con el botón o Ctrl+S, aparece un toast con la hora de guardado pero la barra inferior sigue mostrando "● Cambios sin guardar" o "Último guardado". Este pie consume espacio y confunde al usuario cuando ya se ha guardado.
RESOLUCION :
1. Se eliminó el pie simplificado presente en el modo inline (BaseEditorModal y TaskEditorModal).
2. En el footer de los modales popup se mantuvieron los botones Cancelar y Guardar y Cerrar, pero se retiró el área de estado a la izquierda; el contenedor se ajustó a `justify-end`.
3. Ya no se muestra texto de estado en la parte inferior; la confirmación de guardado se maneja exclusivamente con el toast/ícono en el encabezado.

## Issue 34: Cambiar botón inline de tarea a maximizar/colapsar lista
ESTADO : RESUELTO
DESCRIPCION : Cuando se edita una **tarea** en modo inline, el icono que aparece en el encabezado tenía la forma de un enlace externo y su tooltip decía "Abrir en popup". El cliente prefiere un control para **colapsar la lista de notas** (igual que ocurre al presionar Enter o doble clic en la lista). Además, una vez colapsada la lista, el mismo botón debe cambiar de icono para indicar cómo volver al estado anterior.
RESOLUCION :
1. En `TaskEditorModal.tsx` se reemplazó el botón que utilizaba `onExpandToPopup` por un botón que, cuando `inline=true`, alterna `isNotesListCollapsed` mediante `setNotesListCollapsed(...)` del contexto.
2. El icono se muestra como `Maximize2` cuando la lista está desplegada y cambia a `Minimize2` al estar colapsada.
3. El tooltip es dinámico: "Colapsar lista (Enter o doble clic)" o "Expandir lista (ESC)" según el estado.
4. Se agregó `isNotesListCollapsed` y `setNotesListCollapsed` a la destructuración de `useApp()` en el modal de tarea.
5. La funcionalidad de abrir en popup ya no se expone en este modal; la prop `onExpandToPopup` permanece por compatibilidad pero no se utiliza.

## Issue 35: Botón historial no mostraba modal en vista inline
ESTADO : RESUELTO
DESCRIPCION : El icono "Ver historial de actividad" aparecía al editar una tarea inline pero al pulsarlo no sucedía nada. El modal de historial solo se renderizaba en la rama de popup, por lo que en la versión panel no había componente que apareciera.
RESOLUCION :
1. Se añadió la misma condición de renderizado de `<TaskActivityLogModal>` dentro de la rama `if (inline)` del componente `TaskEditorModal`.
2. El modal ahora funciona tanto en modo inline como en popup, mostrando «No hay historial» si no hay registros.
3. Se mantuvo el estado shared `showActivityLog` para la lógica.
