# REQ-006: Sistema de Favoritos

## Descripción General

Permitir a los usuarios marcar notas, tareas y conexiones como favoritos para un acceso rápido. Los favoritos se mostrarán en una sección dedicada en el menú lateral del sidebar.

## Requisitos Funcionales

### 1. Marcar/Desmarcar Favoritos

- **Acción**: El usuario puede marcar o desmarcar cualquier nota (general, task, connection) como favorita
- **UI Toggle**: Icono de estrella (☆ vacía / ★ llena) en:
  - Header del editor (inline y popup)
  - Lista de notas (hover o siempre visible)
- **Persistencia**: El estado `isFavorite: boolean` se guarda en la base de datos

### 2. Sección Favoritos en Sidebar

```
┌─────────────────────────────┐
│  🔍 Buscar...               │
├─────────────────────────────┤
│  ★ Favoritos           (5)  │  ← Primera posición
│  📁 Todas                   │  ← Segunda posición
├─────────────────────────────┤
│  🏢 Cliente A               │  ← Clientes configurados
│  🏢 Cliente B               │
│  ...                        │
├─────────────────────────────┤
│  ○ Sin cliente              │  ← Última posición
└─────────────────────────────┘
```

**Orden del menú:**
1. **Favoritos** - Notas marcadas como favoritas (cualquier cliente)
2. **Todas** - Todas las notas sin filtro de cliente
3. **Clientes** - Lista de clientes configurados
4. **Sin cliente** - Notas sin cliente asignado (al final)

- **Icono Favoritos**: Estrella (★) - lucide-react: `Star`
- **Badge**: Contador de favoritos (opcional)
- **Comportamiento**: Al seleccionar, filtra la lista para mostrar solo favoritos

### 3. Vista de Favoritos

- Cuando se selecciona "Favoritos" en el sidebar:
  - `currentView` cambia a `'favorites'`
  - La lista de notas muestra solo las notas con `isFavorite: true`
  - Aplica los mismos filtros de tipo (general/task/connection)

## Modelo de Datos

### Cambio en Schema Prisma

```prisma
model Note {
  // ... campos existentes
  isFavorite  Boolean  @default(false)  // NUEVO
}
```

### Migración SQL

```sql
ALTER TABLE "Note" ADD COLUMN "isFavorite" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Note_isFavorite_idx" ON "Note"("isFavorite");
```

## API Endpoints

### Toggle Favorito

**PUT** `/api/notes/:id`
```json
{
  "isFavorite": true
}
```

No se requiere endpoint nuevo, se usa el existente de actualización.

## Cambios en UI

### 1. Sidebar.tsx

```tsx
// Orden del menú:
// 1. Favoritos (primera posición)
// 2. Todas (segunda posición)
// 3. Clientes configurados (dinámico)
// 4. Sin cliente (última posición)

{/* Favoritos */}
<button onClick={() => setView('favorites')}>
  <Star /> Favoritos
  {favoritesCount > 0 && <span>({favoritesCount})</span>}
</button>

{/* Todas */}
<button onClick={() => selectClient(null)}>
  <FileText /> Todas
</button>

{/* Clientes */}
{clients.map(client => (
  <button key={client.id} onClick={() => selectClient(client.id)}>
    <Icon name={client.icon} /> {client.name}
  </button>
))}

{/* Sin cliente (al final) */}
<button onClick={() => selectClient('none')}>
  <Circle /> Sin cliente
</button>
```

### 2. BaseEditorModal.tsx / TaskEditorModal.tsx

Agregar botón de favorito en el header:

```tsx
<button
  onClick={() => toggleFavorite()}
  className={`p-2 rounded transition-colors ${
    isFavorite 
      ? 'text-yellow-400 hover:text-yellow-300' 
      : 'text-gray-400 hover:text-yellow-400'
  }`}
  title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
>
  <Star size={20} fill={isFavorite ? 'currentColor' : 'none'} />
</button>
```

### 3. NotesList.tsx

Indicador visual de favorito en cada item de la lista:

```tsx
{note.isFavorite && (
  <Star size={12} className="text-yellow-400" fill="currentColor" />
)}
```

## Contexto y Estado (AppContext)

### Nuevos Estados

```typescript
interface AppState {
  // ... existentes
  favoritesCount: number;  // Contador para badge
}

type ViewType = 'all' | 'general' | 'task' | 'connection' | 'timesheets' | 'archived' | 'config' | 'favorites';
```

### Nueva Función

```typescript
toggleFavorite: (noteId: string) => Promise<void>;
```

### Lógica de Filtrado

```typescript
// En filteredNotes computed
if (currentView === 'favorites') {
  filtered = filtered.filter(n => n.isFavorite);
}
```

## Rehidratación y Refresco

### Escenarios de Actualización

| Acción | Rehidratación |
|--------|---------------|
| Toggle favorito desde editor | `refreshNotes()` + actualizar `favoritesCount` |
| Toggle favorito desde lista | `refreshNotes()` + actualizar `favoritesCount` |
| Eliminar nota favorita | `refreshNotes()` + actualizar `favoritesCount` |

### Optimización

Para evitar llamadas innecesarias al API:
1. Actualización optimista: Cambiar UI inmediatamente
2. Llamar API en background
3. Revertir si hay error

```typescript
const toggleFavorite = async (noteId: string) => {
  // Optimistic update
  const note = notes.find(n => n.id === noteId);
  if (!note) return;
  
  const newValue = !note.isFavorite;
  
  // Update local state immediately
  setState(s => ({
    ...s,
    notes: s.notes.map(n => 
      n.id === noteId ? { ...n, isFavorite: newValue } : n
    ),
    favoritesCount: s.favoritesCount + (newValue ? 1 : -1),
  }));
  
  // Persist to server
  try {
    await fetch(`/api/notes/${noteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFavorite: newValue }),
    });
  } catch (error) {
    // Revert on error
    setState(s => ({
      ...s,
      notes: s.notes.map(n => 
        n.id === noteId ? { ...n, isFavorite: !newValue } : n
      ),
      favoritesCount: s.favoritesCount + (newValue ? -1 : 1),
    }));
  }
};
```

## Tipos (domain.ts)

```typescript
interface Note {
  // ... existentes
  isFavorite: boolean;
}
```

## Criterios de Aceptación

- [ ] Usuario puede marcar/desmarcar una nota como favorita desde el editor
- [ ] Usuario puede ver el indicador de favorito en la lista de notas
- [ ] Usuario puede filtrar notas por favoritos desde el sidebar
- [ ] El contador de favoritos se actualiza en tiempo real
- [ ] El estado de favorito persiste después de recargar la página
- [ ] La UI se actualiza inmediatamente (optimistic update)
- [ ] Los favoritos funcionan para los 3 tipos: general, task, connection

## Prioridad

Media - Mejora de UX para acceso rápido a notas frecuentes

## Estimación

- Backend (schema + migración): 0.5h
- Frontend (UI + contexto): 2h
- Testing: 0.5h
- **Total**: ~3h
