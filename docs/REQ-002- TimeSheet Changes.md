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

### 2.1 Sin cambios estructurales
La tabla de notas en PostgreSQL mantiene su estructura actual. El campo `type = 'TIMESHEET'` sigue existiendo, pero el tratamiento en la aplicación cambia.

### 2.2 Validación reforzada
- Todo TimeSheet **debe** tener un `taskId` válido (referencia a una tarea existente)
- No se permitirá crear TimeSheets sin tarea asociada

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

#### 4.6.2 Campos editables
- **Horas**: Input numérico con step 0.5
- **Estado**: Selector dropdown con opciones Borrador/Imputado

#### 4.6.3 Acciones en modo edición
- El ícono de lápiz (✏️) cambia a ícono de guardar (💾)
- Al presionar guardar:
  - Se persisten los cambios via API
  - La fila vuelve a estado de solo lectura
  - Se muestra toast de confirmación

#### 4.6.4 Cancelación
- Click fuera de la fila o presionar Escape cancela la edición
- Los valores vuelven a su estado original sin guardar

### 4.7 Estilos visuales de la grilla

#### 4.7.1 Eliminación de subtotales
- Ya no se muestran filas de subtotal por fecha
- El total general se mantiene en el footer de la tabla

#### 4.7.2 Colores alternados por día
- Las filas del mismo día comparten el mismo color de fondo
- Los días se alternan entre dos colores para diferenciar visualmente
- Ejemplo: Día 1 → gris oscuro, Día 2 → gris medio, Día 3 → gris oscuro, etc.

---

## 5. Flujo de Creación de TimeSheet

### 5.1 Único punto de entrada
- Los TimeSheets **solo** se crean desde el contexto de una Tarea
- Mantener el botón "Registrar Horas" en `TaskFields`
- Mantener el botón de reloj (⏱️) en las cards de tareas en `NotesList`

### 5.2 Modal de TimeSheet
- Sin cambios en `TimeSheetModal`
- Ya requiere una tarea como parámetro obligatorio

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
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  ⏱️ TimeSheets  (25 registros)              [🔍 Filtros]  [📄 CSV]  [📑 PDF]            │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  Fecha ▲            │ Cliente    │ Proyecto     │ Tarea        │ Horas │ Estado  │ Acc  │
├─────────────────────┼────────────┼──────────────┼──────────────┼───────┼─────────┼──────┤
│  Jueves, 18/02      │ Acme Corp  │ Website      │ Homepage     │  4.5  │ Borrad. │ [✏]🗑│ ← Color A
│  Jueves, 18/02      │ Acme Corp  │ Website      │ API Backend  │  3.5  │ Borrad. │ [✏]🗑│ ← Color A
│  Viernes, 19/02     │ Acme Corp  │ Website      │ API Backend  │  8.0  │ Imputad │ [✏]🗑│ ← Color B
│  Sábado, 20/02      │ TechStart  │ Mobile App   │ Login UI     │  3.0  │ Borrad. │ [💾]🗑│ ← Color A (editando)
│  Sábado, 20/02      │ Acme Corp  │ Website      │ Homepage     │  2.5  │ Borrad. │ [✏]🗑│ ← Color A
└─────────────────────┴────────────┴──────────────┴──────────────┴───────┴─────────┴──────┘
                                                               Total: 21.5 horas
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
- [x] La grilla muestra las columnas: Fecha, Cliente, Proyecto, Tarea, Horas, Estado
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
- [x] Horas se convierte en input numérico editable
- [x] Estado se convierte en selector dropdown
- [x] Ícono de lápiz cambia a ícono de guardar
- [x] Al guardar, se persisten cambios y vuelve a modo lectura
- [x] Click fuera o Escape cancela la edición

### 7.5 Filtros de la grilla
- [x] Botón "Filtros" para mostrar/ocultar barra de filtros
- [x] Filtro por rango de fechas (desde/hasta)
- [x] Filtro por cliente (dropdown con clientes disponibles)
- [x] Filtro por proyecto (dropdown con proyectos disponibles)
- [x] Botón "Limpiar filtros" visible cuando hay filtros activos
- [x] Contador de registros muestra "X de Y" cuando hay filtros aplicados
- [x] Estado vacío específico cuando los filtros no retornan resultados

### 7.6 Exportación
- [x] Botón "CSV" genera reporte en formato CSV
- [x] Botón "PDF" abre ventana de impresión con vista formateada
- [x] Exportación respeta los filtros aplicados
- [x] Exportación usa formato de fecha configurable
- [x] PDF incluye información de filtros activos en el header
- [x] PDF incluye total general

### 7.7 Acciones en Grilla
- [x] Botón eliminar solicita confirmación y elimina el registro
- [x] Click en nombre de Tarea abre popup con detalles (título, estado, prioridad, cliente, proyecto, descripción)
- [x] Click en nombre de Proyecto abre popup con detalles (nombre, cliente, descripción)

### 7.8 Creación de TimeSheet
- [x] Solo se puede crear TimeSheet desde una Tarea (modal o botón rápido)
- [x] No existe opción para crear TimeSheet "suelto"

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

---

## 10. Notas Adicionales

_Espacio para aclaraciones durante la implementación._

- El campo `type = 'TIMESHEET'` se mantiene en BD para compatibilidad
- Los TimeSheets existentes seguirán funcionando, solo cambia cómo se visualizan
- El TimeSheetModal no requiere cambios
