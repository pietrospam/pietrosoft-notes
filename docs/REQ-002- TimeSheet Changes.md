# REQ-002: Cambios en TimeSheet - De Nota a Registro de Detalle

**Estado:** PENDIENTE  
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
| Descripción | Texto descriptivo (truncado) | - |
| Acciones | Botones editar/eliminar | - |

#### 4.2.2 Ordenamiento por defecto
- Fecha ascendente (registros más antiguos primero)
- Permitir cambiar ordenamiento haciendo clic en cabeceras

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

### 4.4 Filtros de la grilla (opcional - fase 2)
- Filtrar por rango de fechas
- Filtrar por cliente
- Filtrar por proyecto
- Filtrar por tarea

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
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⏱️ TimeSheets                                    [📄 Exportar CSV]        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Fecha ▲    │ Cliente    │ Proyecto     │ Tarea        │ Horas │ Acciones │
├─────────────┼────────────┼──────────────┼──────────────┼───────┼──────────┤
│  2026-02-18 │ Acme Corp  │ Website      │ Homepage     │  4.5  │ [✏][🗑] │
│  2026-02-19 │ Acme Corp  │ Website      │ API Backend  │  8.0  │ [✏][🗑] │
│  2026-02-20 │ TechStart  │ Mobile App   │ Login UI     │  3.0  │ [✏][🗑] │
│  2026-02-20 │ Acme Corp  │ Website      │ Homepage     │  2.5  │ [✏][🗑] │
└─────────────┴────────────┴──────────────┴──────────────┴───────┴──────────┘
                                                          Total: 18.0 horas
```

---

## 7. Criterios de Aceptación

### 7.1 Lista de Notas
- [ ] El toggle/filtro "TimeSheet" ya no aparece en la barra de filtros
- [ ] Los registros de TimeSheet no aparecen en la lista de notas
- [ ] La búsqueda global no incluye TimeSheets

### 7.2 Nueva Vista TimeSheets
- [ ] Existe opción "TimeSheets" en el Sidebar
- [ ] Al seleccionar, se muestra una grilla con todos los registros
- [ ] La grilla muestra las columnas: Fecha, Cliente, Proyecto, Tarea, Horas
- [ ] El ordenamiento por defecto es por fecha ascendente
- [ ] Se puede cambiar el ordenamiento haciendo clic en las cabeceras

### 7.3 Acciones en Grilla
- [ ] Botón editar abre TimeSheetModal con datos pre-cargados
- [ ] Botón eliminar solicita confirmación y elimina el registro
- [ ] Botón "Exportar PDF" genera el reporte

### 7.4 Creación de TimeSheet
- [ ] Solo se puede crear TimeSheet desde una Tarea (modal o botón rápido)
- [ ] No existe opción para crear TimeSheet "suelto"

---

## 8. Componentes Afectados

| Componente | Cambio |
|------------|--------|
| `NotesList.tsx` | Remover filtro TimeSheet, excluir de lista |
| `Sidebar.tsx` | Agregar opción "TimeSheets" |
| `AppContext.tsx` | Excluir TimeSheets de `filteredNotes` |
| `TimeSheetView.tsx` | **Nuevo:** Vista con grilla de TimeSheets |
| `TimeSheetGrid.tsx` | **Nuevo:** Componente de grilla |
| `notes-repo.ts` | Agregar query específica para listar TimeSheets con joins |
| `/api/notes/route.ts` | Excluir TimeSheets de listado general |
| `/api/timesheets/route.ts` | **Nuevo:** Endpoint específico para TimeSheets |

---

## 9. Fases de Implementación

### Fase 1 - Cambios básicos
1. Remover filtro TimeSheet de NotesList
2. Excluir TimeSheets del listado de notas
3. Crear vista básica de TimeSheets con grilla
4. Implementar edición y eliminación desde grilla

### Fase 2 - Mejoras
1. Agregar filtros a la grilla (fechas, cliente, proyecto)
2. Implementar exportación a PDF
3. Agregar totalización de horas

---

## 10. Notas Adicionales

_Espacio para aclaraciones durante la implementación._

- El campo `type = 'TIMESHEET'` se mantiene en BD para compatibilidad
- Los TimeSheets existentes seguirán funcionando, solo cambia cómo se visualizan
- El TimeSheetModal no requiere cambios
