# REQ-005: Unificación de Pantallas de Edición mediante Modales

## Resumen

Unificar las pantallas de creación y edición de notas utilizando exclusivamente modales, eliminando el panel lateral de edición (EditorPanel) como interfaz principal de edición.

## Situación Actual

### Componentes Existentes

| Componente | Descripción | Uso Actual |
|------------|-------------|------------|
| `EditorPanel.tsx` | Panel lateral con formulario completo | Creación y edición de todas las notas |
| `TaskEditorModal.tsx` | Modal de edición para tareas | Edición desde TimeSheetView |

### Problemas Identificados

1. **Duplicación de lógica**: TaskEditorModal y EditorPanel tienen código similar
2. **Inconsistencia UX**: Tareas se editan de dos formas diferentes
3. **Espacio desperdiciado**: El panel lateral ocupa espacio fijo permanente
4. **Navegación confusa**: El usuario no sabe cuándo usar cada interfaz

## Solución Propuesta

### Crear Modales Unificados por Tipo de Nota

```
┌─────────────────────────────────────────────────────────────┐
│  NoteEditorModal.tsx     - Para notas generales             │
│  TaskEditorModal.tsx     - Para tareas (existente, adaptar) │
│  ConnectionEditorModal.tsx - Para conexiones                │
│  TimeSheetEditorModal.tsx  - Para timesheets (si aplica; estos ahora se almacenan en tabla separada y se editan desde TimeSheetView)    │
└─────────────────────────────────────────────────────────────┘
```

### Nuevo Flujo de Usuario

1. **Crear nota**: Click en botón "+" → Seleccionar tipo → Abre modal correspondiente
2. **Editar nota**: Click en nota de la lista → Abre modal correspondiente
3. **Vista rápida**: El panel lateral se convierte en vista de solo lectura (opcional)

### Mockup del Modal Unificado

```
┌────────────────────────────────────────────────────────────────┐
│ ✏️ [Título editable]                              [🕐] [✕]     │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Campos específicos del tipo (2 filas x 4 columnas)     │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │   │
│  │  │ Campo 1  │ │ Campo 2  │ │ Campo 3  │ │ Campo 4  │    │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │   │
│  │  │ Campo 5  │ │ Campo 6  │ │ Campo 7  │ │ Campo 8  │    │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │              Editor TipTap (contenido rico)             │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  📎 Adjuntos: [archivo1.pdf] [imagen.png] [+ Agregar]   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│  [✓ Guardado] [Guardando...]            [Cancelar] [💾 Guardar]│
└────────────────────────────────────────────────────────────────┘
```

## Especificación por Tipo de Nota

### 1. TaskEditorModal (Tareas)

**Campos específicos (2 filas x 4 columnas):**
| Fila | Col 1 | Col 2 | Col 3 | Col 4 |
|------|-------|-------|-------|-------|
| 1 | Ticket/Fase | Descripción Corta | Fecha Límite | Horas Presupuesto |
| 2 | Cliente | Proyecto | Estado | Prioridad |

**Acciones adicionales:**
- 🕐 Botón para registrar horas (abre TimeSheetModal)

### 2. NoteEditorModal (Notas Generales)

**Campos específicos (1 fila):**
| Col 1 | Col 2 |
|-------|-------|
| Cliente | Proyecto |

### 3. ConnectionEditorModal (Conexiones)

**Campos específicos (2 filas):**
| Fila | Col 1 | Col 2 |
|------|-------|-------|
| 1 | Cliente | Proyecto |
| 2 | URL | Credenciales |

### 4. TimeSheets

**Decisión:** El concepto de timesheet se mantiene, pero ya no es un tipo de nota.
El flujo de edición ocurre exclusivamente desde la vista de TimeSheets y la
información persiste en la nueva tabla `timesheets`. No se muestran en la
lista de notas.

## Cambios Requeridos

### Archivos a Crear
- `src/app/components/NoteEditorModal.tsx`
- `src/app/components/ConnectionEditorModal.tsx`
- `src/app/components/BaseEditorModal.tsx` (componente base compartido)

### Archivos a Modificar
- `src/app/components/TaskEditorModal.tsx` - Adaptar para creación además de edición
- `src/app/components/NotesList.tsx` - Abrir modal al clickear nota
- `src/app/components/Sidebar.tsx` - Cambiar botón "+" para abrir modal
- `src/app/components/TopBar.tsx` - Actualizar flujo de creación rápida
- `src/app/context/AppContext.tsx` - Agregar estado para modales

### Archivos a Eliminar
- `src/app/components/EditorPanel.tsx` - Reemplazado por modales
- `src/app/components/TaskFields.tsx` - Lógica movida a TaskEditorModal
- `src/app/components/ConnectionFields.tsx` - Lógica movida a ConnectionEditorModal

## Plan de Implementación

### Fase 1: Crear Componente Base
1. Crear `BaseEditorModal.tsx` con estructura común:
   - Header con título editable
   - Área de campos configurables
   - Editor TipTap
   - Panel de adjuntos
   - Footer con botones

### Fase 2: Migrar TaskEditorModal
1. Refactorizar `TaskEditorModal` para usar `BaseEditorModal`
2. Soportar modo creación además de edición
3. Probar desde NotesList y TimeSheetView

### Fase 3: Crear NoteEditorModal
1. Implementar modal para notas generales
2. Integrar con NotesList

### Fase 4: Crear ConnectionEditorModal
1. Implementar modal para conexiones
2. Migrar campos desde ConnectionFields

### Fase 5: Actualizar Flujo de Navegación
1. Modificar NotesList para abrir modal al seleccionar
2. Actualizar Sidebar para crear via modal
3. Integrar QuickCreateModal

### Fase 6: Eliminar EditorPanel
1. Eliminar EditorPanel.tsx completamente
2. Eliminar TaskFields.tsx (lógica ya en TaskEditorModal)
3. Eliminar ConnectionFields.tsx (lógica movida a ConnectionEditorModal)
4. Limpiar imports y referencias no utilizadas

## Consideraciones Técnicas

### Estado Global
```typescript
interface AppContext {
  // ... estado existente
  
  // Nuevo estado para modales
  editorModal: {
    isOpen: boolean;
    mode: 'create' | 'edit';
    noteType: NoteType | null;
    noteId: string | null;
  };
  
  openEditorModal: (type: NoteType, noteId?: string) => void;
  closeEditorModal: () => void;
}
```

### Manejo de Cambios No Guardados
- Detectar cambios pendientes antes de cerrar modal
- Mostrar confirmación si hay cambios sin guardar
- Usar `UnsavedChangesModal` existente

### Persistencia
- **Auto-guardado**: Cambios se guardan automáticamente con debounce (como actualmente)
- **Botón Guardar**: Adicionalmente, botón explícito para guardar inmediatamente
- El botón "Guardar" fuerza guardado inmediato y cierra el modal
- Auto-guardado mantiene datos seguros mientras el usuario edita

## Decisiones Tomadas

1. **EditorPanel**: ✅ Eliminar completamente - toda edición será mediante modales
2. **Guardado**: ✅ Ambos - auto-guardado + botón explícito "Guardar"
3. **TimeSheets**: ✅ Sin cambios - se mantienen como están (edición desde TimeSheetView)
4. **Móvil**: Pendiente - ¿El modal debe ser full-screen en móvil?

### Modo de Visualización (Actualización 2026-02-24)

Los modales soportan dos modos de visualización:

| Contexto | Modo | Descripción |
|----------|------|-------------|
| **Lista de notas** | `inline` | Se muestra en panel derecho, permite navegación con teclado |
| **TimeSheet** | `popup` | Modal flotante sobre la pantalla |
| **Crear nota** | `popup` | Modal flotante para nueva nota |

**Beneficios del modo dual:**
- Navegación fluida con ↑↓ entre notas sin perder foco
- Panel derecho muestra la nota seleccionada (como antes)
- Popup disponible para edición enfocada o desde otras vistas
- Código unificado: mismo componente, diferente presentación

```
┌─────────────────────────────────────────────────────────────────┐
│                         Layout Principal                         │
├──────────┬────────────────────────────────────────────────────────┤
│          │                                                        │
│  Lista   │   Panel Derecho (EditorModal inline)                   │
│  Notas   │   ┌──────────────────────────────────────────────────┐ │
│          │   │ ✏️ Título           [🕐] [⬜ Expandir a popup]   │ │
│  ↑↓      │   │ Campos específicos...                            │ │
│  navegar │   │ Editor TipTap                                    │ │
│          │   │ Adjuntos                                         │ │
│          │   └──────────────────────────────────────────────────┘ │
└──────────┴────────────────────────────────────────────────────────┘
```

### Rehidratación de Datos (Bug Fix)

**Problema identificado:** Cuando se crea una nota, cliente o proyecto, los datos no se refrescan inmediatamente en la UI.

**Solución:** Después de crear cualquier entidad (nota, cliente, proyecto), llamar a las funciones de refresh correspondientes:
- `refreshNotes()` - al crear/editar notas
- `refreshClients()` - al crear clientes
- `refreshProjects()` - al crear proyectos (via refreshClients que carga ambos)

## Criterios de Aceptación

- [ ] Notas generales se crean/editan mediante NoteEditorModal
- [ ] Tareas se crean/editan mediante TaskEditorModal
- [ ] Conexiones se crean/editan mediante ConnectionEditorModal
- [ ] Click en nota de la lista abre modal de edición correspondiente
- [ ] Botón "+" abre selector de tipo y luego modal
- [ ] Adjuntos funcionan correctamente en modales
- [ ] Editor TipTap con todas las funciones (imágenes, formato)
- [ ] Auto-guardado funciona mientras se edita
- [ ] Botón "Guardar" guarda y cierra el modal
- [ ] Cambios no guardados muestran confirmación al cerrar
- [ ] Campos específicos por tipo de nota funcionan
- [ ] Registrar horas desde TaskEditorModal funciona
- [ ] EditorPanel eliminado del código
