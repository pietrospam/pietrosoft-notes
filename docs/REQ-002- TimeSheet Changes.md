# REQ-002: Cambios en TimeSheet - De Nota a Registro de Detalle

**Estado:** COMPLETADO  
**Prioridad:** Alta  
**Fecha:** 2026-02-20

---

## 1. Resumen del Cambio

### 1.1 Situación Actual
- El TimeSheet se trata como un tipo de "Nota" más (junto con General, Task, Connection)
- Los registros de TimeSheet aparecen mezclados en la lista de notas
- Existe un filtro/toggle "TimeSheet" en la barra de filtros de tipo
- La navegación entre notas incluye los TimeSheets

### 1.2 Nueva Visión
- El TimeSheet deja de ser una "nota independiente" conceptualmente
- Pasa a ser un **registro de detalle** que depende obligatoriamente de una Tarea
- Los TimeSheets no se mostrarán más en la lista de notas
- Se creará una vista/pestaña dedicada exclusivamente para gestión de TimeSheets

---

## 2. Cambios en Base de Datos

### 2.1 Nueva tabla dedicada
Los registros de TimeSheet dejan de almacenarse en la tabla `notes`. Se ha
agregado un modelo independiente `timesheets` con su propia migración y
relaciones. **Recuerda ejecutar `npx prisma migrate deploy` o `npx prisma migrate dev` después de actualizar el schema**.

```prisma
model Timesheet {
  id          String   @id @default(uuid())
  workDate    DateTime @map("work_date")
  hoursWorked Float    @map("hours_worked")
  description String?
  taskId      String?  @map("task_id")
  projectId   String?  @map("project_id")
  clientId    String?  @map("client_id")
  rate        Float?   @map("timesheet_rate")
  state       TimesheetState @default(DRAFT) @map("timesheet_state")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  task        Note?    @relation("TimesheetTask", fields: [taskId], references: [id])
  project     Project? @relation(fields: [projectId], references: [id])
  client      Client?  @relation(fields: [clientId], references: [id])
}
```

Los campos específicos de TimeSheet han sido removidos de `notes` y la
aplicación ya no escribe ni lee `type=TIMESHEET`.

### 2.2 Validación reforzada
- Cada fila en `timesheets` **debe** apuntar a un `taskId` válido si está
  presente; en la API se obliga a registrar al menos la fecha y horas.
- El antiguo campo `type` sobre `notes` ahora se ignora o se mapea a
  `general` si aparece en importaciones heredadas.

---

## 3. Cambios en la UI - Lista de Notas

### 3.1 Remover filtro de TimeSheet
- Eliminar el toggle/badge "TimeSheet" de la barra de filtros en `NotesList`
- Los filtros disponibles serán únicamente: General, Task, Connection

### 3.2 Excluir TimeSheets de la lista
- La consulta de notas debe excluir `type = 'timesheet'`
- Los TimeSheets no aparecerán al navegar por clientes o usar búsqueda global

---

## 4. Nueva Vista: Gestión de TimeSheets

### 4.1 Ubicación
- Nueva opción en el Sidebar: "TimeSheets" (con ícono de reloj)
- Al seleccionar, se muestra una vista dedicada en el área principal

### 4.2 Componente Principal: Grilla de TimeSheets

#### 4.2.1 Columnas de la grilla
| Columna | Descripción | Ordenable |
|---------|-------------|-----------|
| Fecha | Fecha del registro (workDate) | ✓ (default ASC) |
| Cliente | Nombre del cliente (vía proyecto→cliente) | ✓ |
| Proyecto | Nombre del proyecto | ✓ |
| Tarea | Código/título de la tarea | ✓ |
| Horas | Cantidad de horas trabajadas | ✓ |
| Estado | Badge de imputación (Borrador/Imputado) | - |
| Descripción | Texto descriptivo (truncado) | - |
| Acciones | Botones editar/eliminar | - |

#### 4.2.2 Ordenamiento por defecto
- Fecha ascendente (registros más antiguos primero)
- Permitir cambiar ordenamiento haciendo clic en cabeceras

#### 4.2.3 Subtotales por fecha
- Después de los registros de cada fecha, se muestra una fila de subtotal
- El subtotal muestra la suma de horas de ese día
- Si el subtotal es menor a 8 horas:
  - Se muestra un ícono de warning (triángulo amarillo)
  - Se indica cuántas horas faltan para completar las 8
  - El texto de horas se muestra en amarillo
- Si el subtotal es >= 8 horas, el texto se muestra en verde

#### 4.2.4 Badges de estado de imputación
- Cada registro muestra un badge indicando su estado:
  - **Borrador** (amarillo): El registro está pendiente de imputación
  - **Imputado** (verde): El registro ya fue imputado/finalizado

### 4.3 Acciones disponibles

#### 4.3.1 Editar registro
- Al hacer clic en editar, se abre el mismo `TimeSheetModal` existente
- Pre-carga los datos del registro seleccionado
- Permite modificar: fecha, horas, descripción (tarea es readonly)

#### 4.3.2 Eliminar registro
- Confirmación antes de eliminar
- Toast de confirmación post-eliminación

#### 4.3.3 Exportar a CSV
- Botón "Exportar CSV" en la cabeceta de la grilla
- Genera un reporte con todos los registros visibles (respetando filtros activos)
- Formato del CSV: (a definir en detalle posteriormente)

#### 4.3.4 Ver detalle de Tarea (popup)
- Al hacer clic en el nombre de la tarea en la grilla, se abre un popup
- El popup muestra información relevante de la tarea:
  - Título
  - Estado
  - Prioridad
  - Cliente y Proyecto asociados
  - Contenido/descripción
- Botón para cerrar el popup

#### 4.3.5 Ver detalle de Proyecto (popup)
- Al hacer clic en el nombre del proyecto en la grilla, se abre un popup
- El popup muestra información del proyecto:
  - Nombre
  - Cliente asociado
  - Descripción (si tiene)
- Botón para cerrar el popup

### 4.5 Configuración de la Vista

#### 4.5.1 Formato de fecha en grilla (fijo)
- La grilla de TimeSheets usa formato fijo: **"Lunes, 20/06"** (día de semana + fecha corta)
- Este formato es exclusivo para visualización en pantalla
- No es configurable por el usuario

#### 4.5.2 Formato de fecha para exportación (configurable)
- Se configura desde **Configuración → Preferencias**
- Valor por defecto: DD/MM/YYYY
- Opciones disponibles:
  | Valor | Ejemplo |
  |-------|---------|
  | DD/MM/YYYY | 20/02/2026 |
  | YYYY-MM-DD | 2026-02-20 |
  | DD-MM-YYYY | 20-02-2026 |
- Aplica a exportación CSV y PDF
- La preferencia se guarda en localStorage (`timesheet-export-date-format`)

#### 4.5.3 Horas diarias objetivo (configurable)
- Se configura desde **Configuración → Preferencias**
- Input numérico, valores permitidos: 1 a 24 en incrementos de 0.5
- Valor por defecto: 8
- La preferencia se guarda en localStorage (`timesheet-daily-hours`)

### 4.6 Edición Inline en Grilla

#### 4.6.1 Activación
- Doble click sobre una fila activa el modo de edición inline
- Solo las columnas de **Horas** y **Estado** se vuelven editables
- Múltiples filas pueden estar en modo edición simultáneamente
- Una fila permanece editable hasta que el usuario guarde o descarte explícitamente
- Al hacer doble click, el campo de horas se selecciona automáticamente para facilitar la edición

#### 4.6.2 Campos editables
- **Horas**: Input de texto simple (sin flechas de incremento/decremento)
- **Estado**: Badge clickeable que alterna entre Borrador → Imputado → Borrador (click simple, sin necesidad de doble click)

#### 4.6.3 Atajos de teclado en edición
- **ENTER**: Guarda los cambios de la fila
- **ESC**: Cancela la edición sin guardar

#### 4.6.4 Acciones en modo edición
- El ícono de lápiz (✏️) cambia a ícono de guardar (💾) y cancelar (X)
- Al presionar guardar:
  - Se persisten los cambios via API
  - La fila vuelve a estado de solo lectura
  - Se muestra toast de confirmación
- Al presionar cancelar:
  - Los valores vuelven a su estado original sin guardar
  - La fila vuelve a estado de solo lectura

### 4.7 Estilos visuales de la grilla

#### 4.7.1 Filas compactas
- Reducir padding vertical entre filas para mostrar más información
- Espaciado optimizado para visualización de muchos registros

#### 4.7.2 Colores alternados por día
- Las filas del mismo día comparten el mismo color de fondo
- Los días se alternan entre dos colores para diferenciar visualmente
- Ejemplo: Día 1 → gris oscuro, Día 2 → gris medio, Día 3 → gris oscuro, etc.

### 4.8 Filtros permanentes y Calendario

#### 4.8.1 Selectores de período (siempre visibles)
- **Selector de año**: Dropdown con años (actual ±2 años)
- **Selector de mes**: Dropdown con los 12 meses del año (Enero a Diciembre)
- **Orden en pantalla**: Año → Mes → Calendario (centrados horizontalmente)
- Por defecto selecciona el mes y año actuales
- Al cambiar mes o año, se filtran los registros de ese período
- El calendario también se actualiza automáticamente

#### 4.8.2 Calendario visual de horas (horizontal)
- **Layout horizontal**: Todos los días del mes en una sola línea
- Los días se muestran uno al lado del otro (1, 2, 3, ... 31)
- **Separador visual**: Línea vertical gris entre cada semana
- **Headers de días**: Fila superior con L, M, X, J, V, S, D repetido para cada semana
  - Días de semana (L-V): Color **azul**
  - Fin de semana (S, D): Color **naranja**
- **Fondo de fines de semana**: Sábado y domingo con fondo gris oscuro (`bg-gray-800`)
- La semana comienza en **Lunes**
- **Indicador visual**: Círculo alrededor del número del día
  | Horas del día | Color del círculo |
  |---------------|-------------------|
  | >= 8 (configurable) | Verde |
  | > 0 y < 8 | Amarillo |
  | 0 | Sin círculo (solo número) |
- Permite visualizar rápidamente el estado de imputación del mes

### 4.9 Orden de columnas en la grilla

Las columnas se muestran en el siguiente orden:
| # | Columna | Descripción |
|---|---------|-------------|
| 1 | Fecha | Día de la imputación (formato: "Lun, 20/02") |
| 2 | Proyecto | Nombre del proyecto |
| 3 | Ticket/Fase | Código del ticket o fase de la tarea |
| 4 | Horas | Horas imputadas (editable inline) |
| 5 | Descripción | Descripción del registro timesheet (editable inline) |
| 6 | Estado | Badge clickeable (Borrador/Imputado) |
| 7 | Acciones | Botones guardar/cancelar/eliminar |

### 4.10 Edición Inline en Grilla

#### 4.10.1 Activación
- Doble click sobre una fila activa el modo de edición inline
- Al activar, el campo de horas se selecciona automáticamente

#### 4.10.2 Campos editables
- **Fecha**: Input tipo date para cambiar la fecha del registro
- **Horas**: Input de texto (sin flechas increment/decrement)
- **Descripción**: Input de texto para la descripción del registro
- **Estado**: Badge clickeable que alterna Borrador ↔ Imputado (funciona tanto en modo edición como en modo normal)

#### 4.10.3 Atajos de teclado
- **ENTER**: Guarda los cambios de la fila
- **ESC**: Cancela la edición sin guardar

---

## 5. Flujo de Creación de TimeSheet

### 5.1 Puntos de entrada
- **Desde una Tarea**: Botón "Registrar Horas" en `TaskFields` o ícono reloj (⏱️) en cards
- **Desde la vista TimeSheets**: Botón "+" en la barra de acciones (esquina derecha)

### 5.2 Creación desde vista TimeSheets (búsqueda rápida)

#### 5.2.1 Modal de búsqueda
- Click en botón "+" abre modal con buscador
- Input de búsqueda que filtra por: cliente, proyecto, código de ticket/fase, título de tarea
- Debajo del input se muestran las coincidencias como "cards"

#### 5.2.2 Cards de resultados
Cada card muestra:
- **Principal (destacado)**: Código ticket/fase + título de la tarea
- **Secundario (más pequeño)**: Cliente → Proyecto
- Máximo 8-10 resultados visibles (scroll si hay más)

#### 5.2.3 Navegación por teclado
- **↑ / ↓**: Navegar entre cards de resultados
- **ENTER**: Seleccionar la tarea resaltada
- **ESC**: Cerrar el modal sin crear

#### 5.2.4 Creación directa
Al presionar ENTER sobre una tarea:
1. Se cierra el modal
2. Se crea un registro de TimeSheet con fecha de hoy
3. El nuevo registro aparece en la grilla en modo edición
4. El cursor se posiciona en el input de horas (auto-seleccionado)
5. La descripción se pre-llena con el título de la tarea
5. Completar fecha, horas y descripción
6. Guardar

### 5.3 Modal de TimeSheet
- Requiere una tarea como parámetro obligatorio
- Permite seleccionar fecha, horas y descripción

---

## 6. Diseño Visual Sugerido

### 6.1 Sidebar actualizado
```
[Sidebar]
├── Todos
├── Sin Cliente
├── Cliente A
├── Cliente B
├── ...
├── ─────────────
├── ⏱️ TimeSheets    ← Nueva opción
├── 📁 Archivados
└── ⚙️ Configuración
```

### 6.2 Vista de TimeSheets (grilla)
```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│  ⏱️ TimeSheets (25)  [📅 Lu Ma Mi Ju Vi Sa Do]  Mes:[Febrero▼] Año:[2026▼]  [📄CSV] [📑PDF]     │
│                       1  2 ③ ④ ⑤  6  7                                                          │
│                      ⑧ ⑨ ⑩ ⑪ ⑫ 13 14        ③=verde(>=8h) ⑤=amarillo(<8h)                    │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  [Más filtros ▼]  Desde: [____]  Hasta: [____]  Cliente: [Todos ▼]  Proyecto: [Todos ▼]        │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  Fecha     │ Cód.Proy │ Proyecto   │ Ticket/Fase │ Horas │ Descripción + Estado + Acciones      │
├────────────┼──────────┼────────────┼─────────────┼───────┼──────────────────────────────────────┤
│ Jue, 18/02 │ WEB-001  │ Website    │ TICK-123    │  4.5  │ Desarrollo homepage [Borrad.] 💾 X 🗑│
│ Jue, 18/02 │ WEB-001  │ Website    │ TICK-124    │  3.5  │ API Backend         [Imputad] 💾 X 🗑│
│ Vie, 19/02 │ WEB-001  │ Website    │ TICK-124    │  8.0  │ API Backend          Imputad      🗑│
│ Sáb, 20/02 │ MOB-002  │ Mobile App │ TICK-200    │  3.0  │ Login UI             Borrad.      🗑│
└────────────┴──────────┴────────────┴─────────────┴───────┴──────────────────────────────────────┘
                                                     Total: 19.0 horas
```

---

## 7. Criterios de Aceptación

### 7.1 Lista de Notas
- [x] El toggle/filtro "TimeSheet" ya no aparece en la barra de filtros
- [x] Los registros de TimeSheet no aparecen en la lista de notas
- [x] La búsqueda global no incluye TimeSheets

### 7.2 Nueva Vista TimeSheets
- [x] Existe opción "TimeSheets" en el Sidebar
- [x] Al seleccionar, se muestra una grilla con todos los registros
- [x] La grilla muestra las columnas: Fecha, Proyecto, Ticket/Fase, Horas, Descripción, Estado, Acciones
- [x] El ordenamiento por defecto es por fecha ascendente
- [x] Se puede cambiar el ordenamiento haciendo clic en las cabeceras
- [x] Colores alternados por día para distinguir registros del mismo día
- [x] Cada registro muestra badge de estado (Borrador/Imputado)

### 7.3 Configuración (en Preferencias)
- [x] Formato de fecha para exportación configurable (default: DD/MM/YYYY)
- [x] Input numérico para configurar horas diarias objetivo (default: 8)
- [x] Las preferencias se guardan en localStorage y persisten entre sesiones
- [x] El formato de fecha en grilla es fijo: "Lunes, 20/06"

### 7.4 Edición Inline
- [x] Doble click en fila activa modo edición
- [x] Múltiples filas pueden estar en modo edición simultáneamente
- [x] **Fecha** editable inline (input tipo date)
- [x] Horas se convierte en input de texto (sin flechas increment/decrement)
- [x] **Descripción** editable inline (campo del registro timesheet)
- [x] Badge de estado actúa como **toggle** (click cambia Borrador ↔ Imputado)
- [x] Se muestran íconos de guardar y cancelar en modo edición
- [x] Al guardar, se persisten cambios (fecha, horas, descripción, estado) y vuelve a modo lectura
- [x] Click en otra fila NO cancela la edición de filas previas
- [x] ENTER guarda los cambios
- [x] ESC cancela la edición de la fila activa
- [x] Campo de horas se auto-selecciona al activar edición

### 7.5 Filtros de la grilla
- [x] Botón "Filtros" para mostrar/ocultar barra de filtros adicionales
- [x] Selector de año siempre visible (default: año actual)
- [x] Selector de mes siempre visible (default: mes actual)
- [x] Filtro por rango de fechas (desde/hasta)
- [x] Filtro por cliente (dropdown con clientes disponibles)
- [x] Filtro por proyecto (dropdown con proyectos disponibles)
- [x] Botón "Limpiar filtros" visible cuando hay filtros activos
- [x] Contador de registros muestra "X de Y" cuando hay filtros aplicados
- [x] Estado vacío específico cuando los filtros no retornan resultados

### 7.6 Calendario Visual (horizontal)
- [x] Calendario se muestra en la parte superior de la vista (centrado)
- [x] Todos los días en una sola línea horizontal
- [x] Separador vertical entre semanas
- [x] Headers de días (L M X J V S D) en fila superior
- [x] Headers L-V en azul, S-D en naranja
- [x] Fondo oscuro para sábado y domingo
- [x] La semana comienza en **Lunes**
- [x] Días con >= 8 horas (configurable) se muestran en **verde** (círculo)
- [x] Días con > 0 y < 8 horas se muestran en **amarillo** (círculo)
- [x] Días sin imputaciones muestran solo el número
- [x] El calendario se actualiza al cambiar el mes/año seleccionado

### 7.7 Exportación
- [x] Botón "CSV" genera reporte en formato CSV
- [x] Botón "PDF" abre ventana de impresión con vista formateada
- [x] Exportación respeta los filtros aplicados
- [x] Exportación usa formato de fecha configurable
- [x] PDF incluye información de filtros activos en el header
- [x] PDF incluye total general

### 7.8 Acciones en Grilla
- [x] Botón eliminar solicita confirmación y elimina el registro
- [x] Click en nombre de Tarea abre popup con detalles (título, estado, prioridad, cliente, proyecto, descripción)
- [x] Click en nombre de Proyecto abre popup con detalles (nombre, cliente, descripción)

### 7.9 Creación de TimeSheet (búsqueda rápida)
- [x] Botón "+" en la barra de acciones (junto a exportación)
- [x] Modal con buscador que filtra por cliente/proyecto/ticket/tarea
- [x] Resultados mostrados como cards con:
  - Código ticket/fase destacado + título de tarea
  - Cliente → Proyecto en tamaño reducido
- [x] Navegación por teclado: ↑↓ para moverse, Enter para seleccionar, Esc para cerrar
- [x] Al seleccionar tarea:
  - Se crea registro con fecha de hoy
  - Se agrega a la grilla en modo edición
  - Cursor posicionado en input de horas
  - Descripción pre-llenada con título de tarea
- [x] También se puede crear desde una Tarea (modal o botón rápido existente)

### 7.10 Estilos de la Grilla
- [x] Filas compactas con padding reducido (información más densa)
- [x] Colores alternados por día para agrupar visualmente registros del mismo día

---

## 8. Componentes Afectados

| Componente | Cambio |
|------------|--------|
| `NotesList.tsx` | Remover filtro TimeSheet, excluir de lista |
| `Sidebar.tsx` | Agregar opción "TimeSheets" |
| `AppContext.tsx` | Excluir TimeSheets de `filteredNotes` |
| `TimeSheetView.tsx` | Vista con grilla, edición inline, colores por día |
| `ConfigPanel.tsx` | Agregar configuración de TimeSheets en Preferencias |
| `notes-repo.ts` | Agregar query específica para listar TimeSheets con joins |
| `/api/notes/route.ts` | Excluir TimeSheets de listado general |
| `/api/timesheets/route.ts` | Endpoint específico para TimeSheets |

---

## 9. Fases de Implementación

### Fase 1 - Cambios básicos ✅
1. ✅ Remover filtro TimeSheet de NotesList
2. ✅ Excluir TimeSheets del listado de notas
3. ✅ Crear vista básica de TimeSheets con grilla
4. ✅ Implementar edición y eliminación desde grilla

### Fase 2 - Mejoras ✅
1. ✅ Agregar filtros a la grilla (fechas, cliente, proyecto)
2. ✅ Implementar exportación a PDF (via print dialog)
3. ✅ Agregar totalización de horas

### Fase 3 - Refinamientos ✅
1. ✅ Mover configuración a sección Preferencias
2. ✅ Formato fijo "Lunes, 20/06" para grilla
3. ✅ Formato configurable para exportación (default DD/MM/YYYY)
4. ✅ Edición inline con doble click (horas + estado)
5. ✅ Eliminar subtotales
6. ✅ Colores alternados por día

### Fase 4 - UX Avanzada ✅
1. ✅ Calendario horizontal con todos los días en una línea
2. ✅ Separadores verticales entre semanas
3. ✅ Headers de días (L M X J V S D) con colores diferenciados
4. ✅ Fondo oscuro para fines de semana (S, D)
5. ✅ Selectores de año/mes/calendario centrados horizontalmente
6. ✅ Campo descripción editable inline
7. ✅ Toggle de estado (Borrador ↔ Imputado) funcional
8. ✅ Botón "+" para crear TimeSheet desde la vista
9. ✅ Modal de selección proyecto → tarea antes de crear

---

## 10. Popup de Ticket/Fase mejorado

### 10.1 Comportamiento de Hover
- Al posicionar el puntero del mouse sobre el valor de Ticket/Fase y mantenerlo por 1 segundo, se muestra el tooltip de información
- El tooltip muestra la información de forma compacta y horizontal (título + badges de estado/prioridad + cliente/proyecto)
- Si el mouse sale antes del segundo, no se muestra el tooltip
- Si el tooltip está visible y el mouse sale, el tooltip se cierra inmediatamente
- NO hay botón "Cerrar" - se cierra automáticamente al salir el mouse

### 10.2 Comportamiento de Click
- Al hacer click en Ticket/Fase, se abre la nota/tarea en un modal de edición completa
- El modal permite editar todos los campos de la tarea (título, contenido, estado, prioridad, etc.)
- El modal NO cierra la vista de TimeSheet, permitiendo continuar la gestión
- Al cerrar el modal, los cambios se persisten automáticamente

### 10.3 Modal de Edición - Funcionalidades
- **Maximizar**: Botón para expandir el modal a pantalla completa
- **Orden de campos**: Título → Detalles de tarea (campos) → Descripción (body) → Anexos
- **Anexos**: Panel completo de attachments integrado

### 10.4 Criterios de Aceptación
- [x] Hover 1 segundo muestra tooltip de información (estilo horizontal compacto)
- [x] Tooltip se cierra al salir el mouse (sin botón cerrar)
- [x] Click abre modal de edición completa
- [x] Modal de edición incluye todos los campos de tarea
- [x] Modal de edición guarda cambios al cerrar
- [x] La vista de TimeSheet permanece abierta durante la edición
- [x] Botón maximizar/restaurar en el modal
- [x] Orden correcto: Título → Campos → Body → Anexos
- [x] Panel de anexos funcional en el modal

---

## 11. Notas Adicionales

_Espacio para aclaraciones durante la implementación._

- El campo `type = 'TIMESHEET'` se mantiene en BD para compatibilidad
- Los TimeSheets existentes seguirán funcionando, solo cambia cómo se visualizan
- El TimeSheetModal no requiere cambios

