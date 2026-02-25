# REQ-008: Requerimientos Misceláneos

## REQ-008.1: Drag & Drop de Archivos en Notas

### Descripción
Las notas deben soportar drag & drop de archivos desde el explorador de archivos del sistema operativo directamente al editor de la nota.

### Comportamiento Esperado
- El usuario puede arrastrar uno o varios archivos desde el explorador de archivos y soltarlos sobre el área del editor
- Al soltar, los archivos se suben automáticamente como attachments de la nota
- Se debe mostrar un indicador visual (overlay/highlight) cuando el usuario está arrastrando archivos sobre el área de drop
- Si la nota es nueva (no guardada), primero se debe persistir antes de subir los archivos

### Criterios de Aceptación
- [ ] Zona de drop visible con feedback visual al arrastrar
- [ ] Soporte para múltiples archivos simultáneos
- [ ] Validación de tamaño máximo (10MB por archivo)
- [ ] Mensajes de error claros si falla la subida
- [ ] Los archivos aparecen en el panel de attachments inmediatamente

---

## REQ-008.2: Ordenamiento de Favoritos con Drag & Drop

### Descripción
En la vista de favoritos, el usuario debe poder reordenar las notas/tareas mediante drag & drop. Cada card debe mostrar su posición numérica (#1, #2, ... #N) dentro de los favoritos.

### Comportamiento Esperado
- Cada card en favoritos muestra un badge con su posición: #1, #2, #3, etc.
- El usuario puede arrastrar una card y soltarla en otra posición
- Al soltar, el orden se actualiza y persiste en la base de datos
- Las posiciones se recalculan automáticamente al agregar/quitar favoritos

### Modelo de Datos
Agregar campo `favoriteOrder` (integer, nullable) a la tabla `notes`:
- NULL = no es favorito
- 1, 2, 3, ... = posición en favoritos (menor número = más arriba)

### Criterios de Aceptación
- [ ] Badge visible con número de posición en cada card favorita
- [ ] Drag & drop funcional para reordenar
- [ ] El orden se persiste y recupera correctamente
- [ ] Al marcar como favorito, se asigna la última posición
- [ ] Al quitar de favoritos, se reordenan los restantes

### Notas Técnicas
- Considerar usar una librería como `@dnd-kit/core` o `react-beautiful-dnd` para el drag & drop
- El reorden debe ser optimista (actualizar UI inmediatamente)
- Batch updates cuando se reordena para evitar múltiples llamadas al API

---

## REQ-008.3: Colores de Cliente

### Descripción
Cada cliente debe tener un color distintivo asignado que se mostrará en diferentes partes de la interfaz para facilitar la identificación visual rápida del cliente asociado a cada nota/tarea.

### Comportamiento Esperado

#### Asignación de Color
- Al crear un nuevo cliente, se le asigna automáticamente un color de una paleta predefinida de 32 colores
- El color asignado por defecto será uno que aún no esté en uso por otro cliente
- Si todos los colores están en uso, se reutilizan empezando por los menos usados
- El usuario puede cambiar manualmente el color del cliente desde el formulario de edición

#### Paleta de Colores
Definir 32 colores acordes al diseño oscuro de la aplicación:
- Colores saturados pero no demasiado brillantes
- Buen contraste con fondo oscuro (gray-900/gray-800)
- Variedad de tonos: rojos, naranjas, amarillos, verdes, azules, púrpuras, rosas
- Ejemplos: `#EF4444` (red), `#F97316` (orange), `#84CC16` (lime), `#06B6D4` (cyan), etc.

#### Sidebar (Barra Izquierda)
- Cada cliente en la lista debe mostrar su color configurado
- Opciones de visualización:
  - Borde izquierdo con el color del cliente
  - Punto/círculo de color junto al nombre
  - Fondo sutil con el color del cliente (opacity baja)

#### Cards en Vistas "Todas" y "Favoritos"
- Cada card debe mostrar un badge con:
  - Nombre del cliente (abreviado si es muy largo)
  - Color de fondo del badge = color del cliente
  - Texto en contraste (blanco o negro según el color)
- El badge debe ser visible pero no dominante en el diseño

### Modelo de Datos
Agregar campo `color` (string, nullable) a la tabla `clients`:
```sql
ALTER TABLE clients ADD COLUMN color VARCHAR(7);
```
- Formato: código hexadecimal (#RRGGBB)
- Nullable para clientes existentes (se asigna en migración)

### Criterios de Aceptación
- [ ] Campo `color` agregado al modelo Client
- [ ] Paleta de 32 colores definida como constante
- [ ] Asignación automática de color al crear cliente
- [ ] Selector de color en formulario de edición de cliente
- [ ] Sidebar muestra indicador visual con color del cliente
- [ ] Cards muestran badge de cliente con color
- [ ] Colores deben tener buen contraste en tema oscuro

### Notas Técnicas
- Crear helper function para determinar si texto debe ser blanco o negro según el color de fondo
- La paleta debe estar centralizada en un archivo de constantes
- Considerar usar un color picker simple o una grilla de colores predefinidos
- Migración debe asignar colores a clientes existentes
