# REQ-001: Modificaciones de UI/UX

**Estado:** IMPLEMENTADO  
**Prioridad:** Alta  
**Fecha:** 2026-02-20

---

## 1. Cambio de Branding

### 1.1 Título de la aplicación
- **Actual:** "Pietrosoft Notes"
- **Nuevo:** "Bitácora"
- **Ubicación:** TopBar (header de la aplicación)

**Criterios de aceptación:**
- [ ] El título en la barra superior muestra "Bitácora"

---

## 2. Botón "Nueva Nota" como Menú Desplegable

### 2.1 Descripción
Reemplazar el botón actual "New Note" por un botón compacto con solo el ícono "+" que despliega un menú para seleccionar el tipo de nota.

### 2.2 Comportamiento esperado
- Al hacer clic en el botón "+", se muestra un dropdown con los tipos de nota disponibles:
  - General
  - Task (Ticket)
  - Connection
  - TimeSheet
- Al seleccionar un tipo, se crea la nota de ese tipo

**Criterios de aceptación:**
- [ ] El botón muestra solo el ícono "+" (sin texto "New Note")
- [ ] Al hacer clic aparece un menú desplegable con los 4 tipos de nota
- [ ] Al seleccionar un tipo, se crea una nota nueva de ese tipo
- [ ] El menú se cierra automáticamente después de seleccionar

---

## 3. Sidebar: Organización por Cliente

### 3.1 Descripción
Cambiar la navegación del sidebar de "por tipo de nota" a "por cliente".

### 3.2 Estructura propuesta
```
[Sidebar]
├── Todos (muestra todas las notas)
├── Sin Cliente (notas sin cliente asignado)
├── Cliente A
├── Cliente B
├── Cliente C
└── ...
└── Archivados
└── Configuración
```

### 3.3 Comportamiento
- Al seleccionar un cliente, se muestran solo las notas asociadas a ese cliente
- Las notas se asocian a un cliente a través del campo `clientId` (en tasks) o relaciones indirectas

**Criterios de aceptación:**
- [ ] El sidebar lista los clientes disponibles
- [ ] Al seleccionar un cliente se filtran las notas de ese cliente
- [ ] Existe opción "Todos" para ver todas las notas
- [ ] Existe opción "Sin Cliente" para notas no asociadas
- [ ] Se mantienen las opciones "Archivados" y "Configuración" pero deben estar alineadas a la parte de abajo de la pagina.

### 3.4 Diseño visual
- **Ancho reducido:** El sidebar debe ser más angosto que el actual para maximizar el espacio del contenido
- Solo mostrar íconos o nombres cortos de clientes
- Opcionalmente: sidebar colapsable (solo íconos) con hover para expandir

---

## 4. Filtro por Tipo de Nota (dentro del cliente)

### 4.1 Descripción
Dentro de la vista de un cliente, agregar filtros tipo "toggle/switch" para mostrar/ocultar notas por tipo.

### 4.2 Ubicación
Barra horizontal encima de la lista de notas (debajo del header, antes del listado).

### 4.3 Comportamiento
- Por defecto: todos los tipos visibles (todos los toggles activos)
- Al hacer clic en un badge/toggle, se activa/desactiva ese tipo
- Múltiples tipos pueden estar activos simultáneamente
- Si ninguno está activo, no se muestra ninguna nota

### 4.4 Diseño visual sugerido
```
[General ●] [Task ●] [Connection ●] [TimeSheet ●]
```
- Badge activo: color destacado (azul/blanco)
- Badge inactivo: color tenue (gris oscuro)

**Criterios de aceptación:**
- [ ] Se muestran badges/toggles para cada tipo de nota
- [ ] Los badges indican visualmente si están activos o no
- [ ] Al hacer clic en un badge se alterna su estado (activo/inactivo)
- [ ] La lista de notas se filtra según los badges activos
- [ ] El filtro persiste mientras se navega dentro del mismo cliente

---

## 5. Navegación por Teclado

### 5.1 Descripción
Permitir navegar entre las notas de la lista usando las flechas del teclado.

### 5.2 Comportamiento
- **↑ (Flecha arriba):** Selecciona la nota anterior en la lista y muestra su contenido inmediatamente
- **↓ (Flecha abajo):** Selecciona la nota siguiente en la lista y muestra su contenido inmediatamente
- **No requiere Enter:** El contenido de la nota se carga automáticamente al navegar
- La navegación respeta los filtros activos (solo navega entre notas visibles)
- Al llegar al inicio/fin de la lista, no hace loop (se detiene)

### 5.3 Contexto de activación
- La navegación por teclado debe funcionar cuando el foco está en la lista de notas
- No debe interferir con la edición de texto en el editor (TipTap)

**Criterios de aceptación:**
- [ ] Flecha ↓ selecciona la siguiente nota y muestra su contenido automáticamente
- [ ] Flecha ↑ selecciona la nota anterior y muestra su contenido automáticamente
- [ ] La nota seleccionada se resalta visualmente
- [ ] La lista hace scroll automático si la nota seleccionada está fuera de vista
- [ ] No interfiere con la escritura en el editor

---

## 6. Previsualización y Gestión de Anexos

### 6.1 Descripción
Permitir previsualizar los archivos anexados a una nota directamente en el navegador, con opciones de gestión.

### 6.2 Tipos de previsualización

#### 6.2.1 Imágenes
- Formatos: PNG, JPG, JPEG, GIF, WEBP, SVG
- Visualizador: Lightbox/modal con zoom
- Navegación entre imágenes si hay múltiples

#### 6.2.2 Archivos de texto
- Formatos: TXT, MD, JSON, XML, CSV, LOG, HTML, CSS, JS, TS, SQL, YAML, etc.
- Visualizador: Modal con contenido formateado (monospace)
- Syntax highlighting opcional para código

#### 6.2.3 Otros formatos
- PDF: Visor embebido del navegador
- Otros: Solo opción de descarga

### 6.3 Acciones disponibles
Para cada anexo, mostrar menú contextual o botones con:
- **Previsualizar:** Abre el visor correspondiente según el tipo
- **Descargar:** Descarga el archivo al dispositivo
- **Renombrar:** Permite cambiar el nombre del archivo
- **Eliminar:** Elimina el anexo (con confirmación)

### 6.4 Diseño visual sugerido
```
[Anexos]
┌─────────────────────────────────────────┐
│ 📷 screenshot.png    [👁] [⬇] [✏] [🗑] │
│ 📄 config.json       [👁] [⬇] [✏] [🗑] │
│ 📎 documento.pdf     [👁] [⬇] [✏] [🗑] │
└─────────────────────────────────────────┘
```

**Criterios de aceptación:**
- [ ] Al hacer clic en una imagen se abre un lightbox/modal
- [ ] Al hacer clic en archivo de texto se abre modal con contenido
- [ ] Botón de descarga funciona para todos los tipos de archivo
- [ ] Se puede renombrar un anexo y el cambio persiste
- [ ] Se puede eliminar un anexo con confirmación previa
- [ ] El visor de imágenes permite zoom in/out
- [ ] El visor de texto muestra el contenido con formato monospace

---

## 7. Búsqueda Global sin Filtros

### 7.1 Descripción
Cuando el usuario escribe en el buscador, la búsqueda debe realizarse en todas las notas sin considerar los filtros aplicados (cliente, tipo de nota).

### 7.2 Comportamiento
- La búsqueda incluye título y contenido (body) de las notas
- Al buscar, se ignoran los filtros de cliente y tipo de nota
- Solo se excluyen las notas archivadas (a menos que esté en vista "Archivados")
- Al borrar el texto de búsqueda, se vuelven a aplicar los filtros normales

**Criterios de aceptación:**
- [x] La búsqueda busca en título y contentText
- [x] La búsqueda ignora el filtro de cliente seleccionado
- [x] La búsqueda ignora los toggles de tipo de nota
- [x] Las notas archivadas no aparecen en búsqueda (excepto en vista Archivados)

---

## 8. Proyecto por Defecto al Crear Cliente

### 8.1 Descripción
Cuando se crea un nuevo cliente, debe crearse automáticamente un proyecto asociado llamado "General".

### 8.2 Comportamiento
- Al crear un cliente nuevo, se crea automáticamente un proyecto con nombre "General"
- El proyecto "General" queda asociado al cliente recién creado
- Este comportamiento es automático (no requiere acción adicional del usuario)
- Al crear una Task con un cliente seleccionado, se asigna automáticamente el proyecto "General" de ese cliente

**Criterios de aceptación:**
- [x] Al crear un cliente se crea automáticamente un proyecto "General"
- [x] El proyecto "General" está correctamente asociado al cliente
- [x] El proyecto aparece inmediatamente en la lista de proyectos del cliente
- [x] Al crear una Task con cliente seleccionado, el proyecto "General" queda pre-seleccionado

---

## 9. Guardado Manual y Auto-guardado Configurable

### 9.1 Descripción
Implementar un sistema de guardado manual con botón explícito y hacer que el auto-guardado sea una funcionalidad opcional/configurable. Además, mostrar advertencias cuando hay cambios sin guardar antes de abandonar una nota.

### 9.2 Botón de Guardado
- Agregar botón "Guardar" (ícono de diskette/save) en la barra superior del editor
- El botón debe estar visible siempre que haya una nota seleccionada
- Indicador visual cuando hay cambios pendientes (botón resaltado o badge)
- El botón se deshabilita cuando no hay cambios pendientes

### 9.3 Auto-guardado Configurable
- Agregar opción en Configuración para activar/desactivar auto-guardado
- Cuando está activo: guarda automáticamente después de X segundos de inactividad (configurable)
- Cuando está desactivado: solo se guarda al presionar el botón "Guardar"
- La preferencia debe persistir (localStorage o base de datos)
- **IMPORTANTE:** El auto-guardado NO aplica a notas nuevas (primera vez). Las notas nuevas SIEMPRE requieren guardado manual con el botón

### 9.3.1 Flujo de Notas Nuevas
- Al crear una nota/task/timesheet, se crea en memoria pero NO se guarda en BD
- El usuario debe completar los campos y hacer clic en "Guardar"
- Al guardar por primera vez, mostrar toast "Nota creada exitosamente"
- A partir de la primera vez guardada, el auto-save aplica normalmente

### 9.4 Modal de Cambios sin Guardar
Mostrar modal de confirmación cuando:
- El usuario intenta seleccionar otra nota teniendo cambios sin guardar
- El usuario intenta crear una nueva nota/entidad con cambios pendientes
- El usuario intenta navegar a otra sección (Configuración, Archivados)

### 9.5 Diseño del Modal
```
┌─────────────────────────────────────────┐
│  ⚠️ Cambios sin guardar                │
│                                         │
│  Tienes cambios que no se han guardado. │
│  ¿Qué deseas hacer?                     │
│                                         │
│  [Descartar]  [Cancelar]  [Guardar]     │
└─────────────────────────────────────────┘
```

### 9.6 Estado de Cambios (Dirty State)
- Trackear si la nota actual tiene cambios sin guardar
- Comparar estado actual vs último estado guardado
- Mostrar indicador visual (punto o asterisco junto al título)

**Criterios de aceptación:**
- [x] Existe botón "Guardar" visible en el editor
- [x] El botón indica visualmente si hay cambios pendientes
- [x] Al hacer clic en "Guardar" se persisten los cambios
- [x] Existe opción en Configuración para activar/desactivar auto-guardado
- [x] La preferencia de auto-guardado persiste entre sesiones
- [x] Se muestra modal al intentar cambiar de nota con cambios pendientes
- [x] Se muestra modal al intentar crear entidad con cambios pendientes
- [x] El modal ofrece opciones: Descartar, Cancelar, Guardar
- [x] El indicador de "dirty state" se muestra junto al título

---

## 10. Botón "+" en Lista de Notas con Selección de Cliente

### 10.1 Descripción
Agregar un botón "+" en la sección donde se muestran las notas para crear nuevas notas de cualquier tipo, aprovechando el cliente ya seleccionado en el sidebar.

### 10.2 Ubicación
- En la barra de filtros/header de la lista de notas (NotesList)
- Junto a los toggles de tipo de nota

### 10.3 Comportamiento

#### 10.3.1 Con cliente seleccionado
- Al hacer clic en "+", se muestra dropdown con tipos de nota
- Al seleccionar un tipo, se crea la nota asociada al cliente seleccionado
- No se solicita cliente adicional

#### 10.3.2 Sin cliente específico ("Todos" o "Ninguno")
- Al hacer clic en "+", primero se muestra un selector de cliente
- Luego se muestra el dropdown de tipos de nota
- La nota se crea asociada al cliente seleccionado

### 10.4 Flujo detallado
```
[Con cliente seleccionado]
1. Usuario hace clic en "+"
2. Se muestra dropdown: General | Task | Connection | TimeSheet
3. Usuario selecciona tipo
4. Se crea nota local del tipo seleccionado, asociada al cliente activo
5. Se abre el editor con la nueva nota

[Sin cliente seleccionado - "Todos" o "Ninguno"]
1. Usuario hace clic en "+"
2. Se muestra modal/dropdown para seleccionar cliente
3. Usuario selecciona cliente
4. Se muestra dropdown de tipos de nota
5. Usuario selecciona tipo
6. Se crea nota local del tipo seleccionado, asociada al cliente elegido
7. Se abre el editor con la nueva nota
```

### 10.5 Diseño visual sugerido
```
┌────────────────────────────────────────────────────────────┐
│ [General ●] [Task ●] [Connection ●] [TimeSheet ●]   [+]   │
├────────────────────────────────────────────────────────────┤
│ Lista de notas...                                          │
└────────────────────────────────────────────────────────────┘
```

**Criterios de aceptación:**
- [ ] Existe botón "+" en la sección de lista de notas
- [ ] Al hacer clic se muestra dropdown con tipos de nota
- [ ] Si hay cliente seleccionado, la nota se crea para ese cliente
- [ ] Si no hay cliente seleccionado, se solicita elegir uno primero
- [ ] La nota creada queda correctamente asociada al cliente
- [ ] El editor se abre automáticamente con la nueva nota

---

## 11. Registro de TimeSheet desde una Tarea

### 11.1 Descripción
Permitir registrar horas trabajadas (TimeSheet) directamente desde la vista de una Tarea, sin necesidad de navegar fuera de ella. El sistema debe detectar si ya existe un registro para la fecha seleccionada y esa tarea, entrando en modo edición si es el caso.

### 11.2 Ubicación
- Botón "Registrar Horas" o ícono de reloj (⏱️) en la vista de Task Details
- Al hacer clic, se abre un modal/popup

### 11.3 Datos pre-cargados
El popup debe mostrar automáticamente (solo lectura o información visual):
- **Tarea:** Nombre/título de la tarea actual
- **Cliente:** Cliente asociado al proyecto de la tarea
- **Proyecto:** Proyecto al que pertenece la tarea

### 11.4 Campos editables
- **Fecha:** Por defecto la fecha de hoy, pero modificable (date picker)
- **Horas trabajadas:** Campo numérico (decimales permitidos)
- **Descripción:** Área de texto para describir el trabajo realizado

### 11.5 Comportamiento de creación vs edición

#### 11.5.1 Modo Creación
- Si NO existe un TimeSheet para la combinación (tarea + fecha seleccionada)
- Se muestra el formulario vacío (solo horas y descripción)
- Al guardar, se crea un nuevo registro de TimeSheet

#### 11.5.2 Modo Edición
- Si YA existe un TimeSheet para la combinación (tarea + fecha seleccionada)
- Se cargan los datos existentes: horas y descripción
- Al guardar, se actualiza el registro existente
- Se muestra indicador visual de que es una edición (ej: "Editando registro existente")

### 11.6 Flujo detallado
```
1. Usuario está viendo una Tarea
2. Hace clic en "Registrar Horas" (⏱️)
3. Se abre modal con:
   - Info readonly: Tarea, Cliente, Proyecto
   - Fecha (default: hoy)
   - Horas trabajadas
   - Descripción
4. Al cambiar la fecha:
   - Sistema verifica si existe TimeSheet para (tarea, fecha)
   - Si existe: carga datos y muestra "Modo edición"
   - Si no existe: limpia campos para nueva entrada
5. Usuario completa/edita los campos
6. Al hacer clic en "Guardar":
   - Crea o actualiza el TimeSheet
   - Muestra toast de confirmación
   - Cierra el modal
```

### 11.7 Diseño visual sugerido
```
┌─────────────────────────────────────────────────────────┐
│  ⏱️ Registrar Horas                              [X]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Tarea:    [Homepage Redesign]                         │
│  Cliente:  [Acme Corp]                                 │
│  Proyecto: [Website Redesign]                          │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Fecha:    [📅 2026-02-20    ▼]                        │
│                                                         │
│  Horas:    [    8.5    ]                               │
│                                                         │
│  Descripción:                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Implementación de header responsive y          │   │
│  │ ajustes de CSS para móviles...                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│          [Cancelar]            [💾 Guardar]            │
└─────────────────────────────────────────────────────────┘
```

### 11.8 Atajos de Teclado
- **Enter** (en campo descripción): Guardar y cerrar el modal
- **Escape**: Cerrar el modal sin guardar
- **Ctrl+Enter** (en campo descripción): Insertar salto de línea

**Criterios de aceptación:**
- [ ] Existe botón/ícono para registrar horas en la vista de Task
- [ ] El modal muestra información de la tarea, cliente y proyecto
- [ ] La fecha por defecto es hoy pero es modificable
- [ ] Al cambiar la fecha, se verifica si existe TimeSheet previo
- [ ] Si existe TimeSheet para (tarea, fecha), se cargan los datos para edición
- [ ] Si no existe, se muestra formulario vacío para crear
- [ ] Al guardar, se crea o actualiza el TimeSheet correctamente
- [ ] Se muestra toast de confirmación al guardar
- [ ] El modal se cierra después de guardar exitosamente
- [ ] Enter en descripción guarda y cierra
- [ ] Escape cierra el modal
- [ ] Ctrl+Enter inserta salto de línea en descripción

---

## 12. Acceso Rápido a TimeSheet desde Lista de Tareas

### 12.1 Descripción
Agregar un botón pequeño con ícono de reloj (⏱️) en cada card de tarea dentro de la lista de notas, permitiendo acceso rápido al popup de TimeSheet sin necesidad de abrir la tarea completa.

### 12.2 Ubicación
- En cada card de nota tipo "task" en el NotesList
- Botón pequeño (ícono) en la esquina de la card

### 12.3 Comportamiento
- Al hacer clic en el botón de reloj, se abre el mismo TimeSheetModal
- El modal recibe la información de la tarea correspondiente
- Funciona igual que el botón "Registrar Horas" desde dentro de la tarea

### 12.4 Diseño visual sugerido
```
┌────────────────────────────────────────┐
│ ☑️ Implementar homepage          [⏱️] │
│ Sin contenido                          │
│ hace 2 horas                           │
└────────────────────────────────────────┘
```

**Criterios de aceptación:**
- [ ] Cada card de tarea muestra un botón de reloj (⏱️)
- [ ] El botón solo aparece en notas de tipo "task"
- [ ] Al hacer clic se abre el TimeSheetModal con los datos de esa tarea
- [ ] El clic en el botón no selecciona/abre la nota (solo el modal)

---

## Componentes afectados

| Componente | Cambio |
|------------|--------|
| `TopBar.tsx` | Renombrar título, convertir botón en dropdown |
| `Sidebar.tsx` | Cambiar navegación de tipos a clientes |
| `NotesList.tsx` | Agregar barra de filtros por tipo, manejar eventos de teclado, **agregar botón "+" con selector de cliente** |
| `AppContext.tsx` | Agregar estado para filtros de tipo activos, dirty state, preferencias de auto-guardado |
| `AttachmentsPanel.tsx` | Agregar previsualización, renombrar, eliminar |
| `AttachmentViewer.tsx` | Nuevo componente para lightbox/modal de preview |
| `clients-repo.ts` | Crear proyecto "General" al crear cliente |
| `EditorPanel.tsx` | Agregar botón guardar, dirty state indicator, integrar modal de confirmación |
| `ConfigPanel.tsx` | Agregar sección de preferencias de guardado |
| `UnsavedChangesModal.tsx` | Nuevo componente para modal de cambios sin guardar |
| `QuickCreateModal.tsx` | **Modificar para soportar selección de cliente cuando no hay uno activo** |
| `TaskFields.tsx` | **Agregar botón "Registrar Horas" para abrir modal de TimeSheet** |
| `TimeSheetModal.tsx` | **Nuevo componente: modal para crear/editar TimeSheet desde Task** |
| `NotesList.tsx` | **Agregar botón de reloj en cards de tareas para acceso rápido a TimeSheet** |

---

## Notas adicionales

_Espacio para agregar aclaraciones, preguntas o cambios durante la implementación._


