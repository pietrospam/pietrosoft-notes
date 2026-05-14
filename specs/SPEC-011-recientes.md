# SPEC-011 – Recientes (Last modified)

## Objetivo
Agregar una nueva opción en el menú lateral llamada **Recientes** que muestre todas las notas y tareas que se hayan modificado dentro de un rango configurable de tiempo (por ejemplo, las últimas 8 horas). El objetivo es facilitar el acceso rápido a lo que se estuvo trabajando recientemente.

---

## Comportamiento esperado

### ✅ Opción de menú
- En el menú lateral principal debe aparecer la nueva opción **Recientes**.
- Al seleccionar **Recientes**, la vista principal debe mostrar un listado de todas las notas y tareas que cumplan con el criterio de “reciente”.
- El listado debe usar el mismo diseño / componente que el listado principal de notas/tareas (sidebar + detalle), o una vista consistente con el resto de la aplicación.

### ✅ Definición de “reciente”
- Se considera “reciente” cualquier nota o tarea cuya marca de tiempo `updatedAt` (o campo equivalente) sea posterior a **(ahora - N horas)**.
- N es un valor configurable por el usuario en la configuración global de la aplicación.

### ✅ Configuración
- Agregar una setting en la pantalla de configuración (o pantalla equivalente) con el título: **Intervalo para "Recientes"**.
- Esta configuración debe permitir ingresar un número entero de horas.
- Valor por defecto: **8**.
- Restricciones:
  - Mínimo: 1 hora.
  - Máximo: 168 horas (7 días) o similar, según lo decida el equipo.
  - El campo debe aceptar únicamente valores numéricos enteros.
- Guardar el valor en el almacenamiento de configuración de la aplicación (local storage / DB / settings table) y usarlo inmediatamente tras guardar (no requiere recarga completa).

### ✅ Lógica de filtrado
- Cada vez que se muestra la vista **Recientes**, se debe recalcular el filtro con base en el tiempo actual y el valor de configuración de horas.
- La consulta debe incluir todas las notas y tareas que:
  - Tengan `updatedAt` >= `now() - interval 'N hours'` (o lógica equivalente).
  - No importar si están archivadas o no (a menos que la aplicación tenga un concepto de "archivado"; en ese caso, se puede optar por mostrar también lo archivado si el usuario lo desea; por defecto se incluye todo).

### ✅ Ordenamiento y presentación
- Ordenar la lista por `updatedAt` descendente (más reciente primero).
- Mostrar la fecha/hora de última modificación en cada fila (formato relativo o absoluto según UI estándar).
- Indicar de forma sutil qué tan reciente es (por ejemplo “hace 2h”, “hace 15 min”) si la UI ya lo hace en otros listados.

---

## Puntos de implementación

### 📌 UI
- Agregar la opción **Recientes** en la navegación lateral (`src/app/components/…` o donde se renderiza el menú).
- Asegurarse de que tenga un ícono coherente (por ejemplo, un reloj/ráfaga) y sea accesible.
- Implementar la vista de resultados reutilizando componentes existentes de listados (NotesList/TaskList, etc.).

### 📌 Configuración
- Ubicar la nueva configuración en la pantalla de configuración global (por ejemplo `src/app/(settings)/...` o componente equivalente).
- Asegurarse de que los cambios queden persistidos en el store / contexto de configuración.

### 📌 Backend / Repositorio
- Actualizar el repositorio de notas/tareas (p.ej. `src/lib/repositories/notes.ts`) para soportar filtro por `updatedAt >= X`.
- Agregar una función/repo method `getRecentNotes(hours: number)` o similar.

---

## Criterios de aceptación

1. El menú lateral contiene el ítem **Recientes**.
2. Al abrir **Recientes**, se ven sólo notas/tareas modificadas en las últimas N horas.
3. N se puede configurar desde la pantalla de configuración.
4. El valor por defecto es 8 horas.
5. Cambiar N hace que la vista **Recientes** muestre el nuevo conjunto a partir de la próxima apertura o recálculo.

---

## Consideraciones técnicas adicionales

- Si la aplicación usa sincronización con un backend remoto, el cálculo de `updatedAt` debe ser consistente entre cliente y servidor (usar timestamps UTC).
- Si la lista de notas se maneja en memoria, asegurarse de recalcular el filtro al cambiar la configuración.
- Si existe caching o memoización de listados, invalidar el cache cuando cambie el valor de "horas recientes".

---

## Notas
- Esta especificación se puede complementar con un documento de diseño UI/UX si se considera necesario.
- Si se desea, se puede agregar una opción para excluir notas/tareas bloqueadas o completadas (no requerimiento inicial).