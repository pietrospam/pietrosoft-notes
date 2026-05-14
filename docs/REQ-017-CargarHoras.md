# REQ-017: Modal Cargar Horas

**Estado:** COMPLETADO  
**Prioridad:** Media  
**Fecha:** 2026-03-05

Modal popup para visualizar y gestionar los datos de la grilla de TimeSheets con
funcionalidad de copiado al portapapeles y cambio rápido de estado.

## Objetivo

Facilitar la carga de horas en sistemas externos permitiendo al usuario copiar
rápidamente valores individuales de cada entrada de timesheet al portapapeles,
además de poder cambiar el estado de cada entrada entre Borrador e Imputado
directamente desde el modal.

## Especificaciones

1. **Botón de acceso**
   - Nombre: "Cargar Horas"
   - Ubicación: TopBar, visible únicamente cuando la pestaña activa es TimeSheets
   - Icono: Upload (lucide-react)
   - Color: Verde (bg-green-600)

2. **Columnas mostradas en el modal**
   - Proyecto (de la task asociada)
     - Si el proyecto es distinto de "General" y tiene un **código de proyecto** configurado,
       se muestra como `CODIGO (Nombre del Proyecto)` (ej. `PRJ-001 (Website Redesign)`)
     - En caso contrario se muestra sólo el nombre del proyecto
   - Ticket/Fase (campo `taskCode` del timesheet, corresponde a `ticketPhaseCode` de la tarea)
   - Cantidad de horas (campo `hoursWorked`, formato con 1 decimal)
   - Fecha (campo `workDate`, formato DD/MM/YY)
   - Descripción (campo `description` del timesheet)
   - Estado (DRAFT/FINAL con toggle)

3. **Funcionalidad de copiado**
   - Cada celda de datos (excepto Estado) es clickeable
   - Al hacer click se copia el valor como texto plano al portapapeles
   - Para la celda Proyecto: si el proyecto tiene código, se copia **sólo el código** (no el texto completo `CODIGO (Nombre)`)
   - Feedback visual: icono de Check verde y toast de confirmación
   - Icono de Copy aparece en hover sobre la celda

4. **Filtros del modal**
   - Checkbox "Solo horas > 0": filtra entradas con hoursWorked <= 0 (habilitado por defecto)
   - Toggles de estado: "Todos", "Borrador", "Imputado" (por defecto: Borrador)
   - Contador en header muestra "X de Y entradas" cuando hay filtros activos
   - Total en footer muestra horas filtradas y total original entre paréntesis

5. **Cambio de estado**
   - Columna Estado muestra badge clickeable
   - Toggle entre "Borrador" (amarillo) y "Imputado" (verde)
   - Actualización inmediata vía API PUT `/api/timesheets/[id]`
   - Toast de confirmación al cambiar estado
   - Indicador de carga mientras se guarda

6. **Subtotales diarios**
   - Después de cada grupo de fecha se muestra una fila de subtotal
   - Formato diferente (fondo más oscuro, texto italic, no clickeable)
   - Muestra el total de horas del día y cantidad de entradas
   - Indicador de color según regla:
     - >= 8 horas: verde (círculo + texto)
     - < 8 horas: amarillo (círculo + texto)

7. **Interfaz del modal**
   - Backdrop oscuro clickeable para cerrar
   - Header con título, contador de entradas y botón cerrar
   - Instrucciones de uso visibles
   - Barra de filtros debajo de instrucciones
   - Tabla con scroll para contenido largo
   - Footer con totales detallados y botón Cerrar
   - Diseño responsivo con insets adaptativos

8. **Footer con totales del mes**
   - Total horas (Mes Año): total general del mes seleccionado
   - Imputadas: total de horas con estado FINAL (verde)
   - Pendientes: total de horas con estado DRAFT (amarillo)
   - Mismos totales mostrados en TimeSheetView y CargarHorasModal

9. **Integración**
   - Estado global en AppContext: `showCargarHorasModal`, `openCargarHorasModal()`, `closeCargarHorasModal()`
   - Los datos mostrados respetan los filtros actuales de TimeSheetView (mes, cliente, proyecto, etc.)
   - Al cambiar estado, se refresca la lista de timesheets en la vista principal

## Componentes creados/modificados

- `src/app/components/CargarHorasModal.tsx` - Nuevo componente del modal
- `src/app/components/TopBar.tsx` - Agregado botón "Cargar Horas"
- `src/app/components/TimeSheetView.tsx` - Integración del modal
- `src/app/context/AppContext.tsx` - Estado y funciones para el modal
- `src/app/components/index.ts` - Export del nuevo componente

## Criterios de aceptación

- [ ] **AC1:** Botón "Cargar Horas" visible solo en pestaña TimeSheets
- [ ] **AC2:** Modal muestra las 6 columnas especificadas con datos correctos
- [ ] **AC3:** Click en cualquier celda de datos copia el valor al portapapeles
- [ ] **AC4:** Fecha se muestra en formato DD/MM/YY
- [ ] **AC5:** Click en badge de estado cambia entre Borrador/Imputado
- [ ] **AC6:** Cambio de estado se persiste correctamente en la base de datos
- [ ] **AC7:** Toast de feedback al copiar y al cambiar estado
- [ ] **AC8:** Total de horas visible en el footer
- [ ] **AC9:** Modal respeta los filtros activos de la vista de TimeSheets
- [ ] **AC10:** Checkbox "Solo horas > 0" filtra correctamente y está habilitado por defecto
- [ ] **AC11:** Toggles de estado filtran por Todos/Borrador/Imputado, con Borrador seleccionado por defecto
- [ ] **AC12:** Columna Proyecto muestra `CODIGO (Nombre)` cuando el proyecto no es General y tiene código configurado
- [ ] **AC13:** Al copiar la celda Proyecto con código, se copia sólo el código (no el texto completo de display)
- [ ] **AC12:** Contador en header refleja "X de Y entradas" cuando hay filtros
- [ ] **AC13:** Subtotales diarios se muestran después de cada grupo de fecha
- [ ] **AC14:** Indicador de color en subtotal: verde >= 8h, amarillo < 8h
- [ ] **AC15:** Footer muestra "Total horas (Mes Año)" con el mes/año seleccionado
- [ ] **AC16:** Footer muestra total Imputadas en verde
- [ ] **AC17:** Footer muestra total Pendientes en amarillo
- [ ] **AC18:** TimeSheetView muestra los mismos totales en su footer
