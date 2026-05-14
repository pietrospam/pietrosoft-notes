# SPEC-009: Sistema de TODOs

**Requerimiento:** [REQ-021-TODOs](../docs/REQ-021-TODOs.md)  
**Estado:** PENDIENTE  
**Fecha:** 2026-03-11  
**Prioridad:** Media-Alta

---

## 1. Resumen

Sistema de recordatorios (TODOs) asociados a tareas con:
- Deadline opcional y estados (pending/completed/deleted)
- Visualización en sidebar y flujo de comentarios
- Notificaciones in-app (banner + sonido) y Telegram
- Recurrencia (diario/semanal/mensual)
- Snooze (posponer)

---

## 2. Modelo de Datos

### 2.1 Migración Prisma - Tabla `task_todos`

```prisma
model TaskTodo {
  id                  String    @id @default(uuid())
  taskId              String    @map("task_id")
  author              String
  content             Json
  deadline            DateTime?
  status              String    @default("pending") // pending, completed, deleted
  completedAt         DateTime? @map("completed_at")
  deletedAt           DateTime? @map("deleted_at")
  snoozedUntil        DateTime? @map("snoozed_until")
  recurrenceRule      String?   @map("recurrence_rule")
  recurrenceParentId  String?   @map("recurrence_parent_id")
  createdAt           DateTime  @default(now()) @map("created_at")
  
  task                Note      @relation("TaskTodos", fields: [taskId], references: [id], onDelete: Cascade)
  recurrenceParent    TaskTodo? @relation("RecurrenceTodos", fields: [recurrenceParentId], references: [id])
  recurrenceChildren  TaskTodo[] @relation("RecurrenceTodos")
  notificationsSent   TodoNotificationSent[]

  @@index([taskId, status])
  @@index([deadline, status])
  @@index([snoozedUntil])
  @@map("task_todos")
}

model TodoNotificationSent {
  id               String   @id @default(uuid())
  todoId           String   @map("todo_id")
  notificationType String   @map("notification_type") // daily_summary, reminder, overdue
  reminderMinutes  Int?     @map("reminder_minutes")
  sentAt           DateTime @default(now()) @map("sent_at")
  
  todo             TaskTodo @relation(fields: [todoId], references: [id], onDelete: Cascade)

  @@index([todoId, notificationType])
  @@map("todo_notifications_sent")
}
```

### 2.2 Actualizar modelo Note

```prisma
model Note {
  // ... campos existentes ...
  todos TaskTodo[] @relation("TaskTodos")
}
```

### 2.3 Valores de `recurrenceRule`

| Valor | Descripción |
|-------|-------------|
| `null` | No recurrente |
| `DAILY` | Todos los días |
| `WEEKLY:1` | Semanal, día 1 (Lunes) |
| `WEEKLY:5` | Semanal, día 5 (Viernes) |
| `MONTHLY:15` | Mensual, día 15 |

---

## 3. API

### 3.1 Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/todos` | Lista TODOs pendientes (todos) |
| `GET` | `/api/todos/overdue` | TODOs vencidos |
| `GET` | `/api/tasks/[id]/todos` | TODOs de una tarea |
| `POST` | `/api/tasks/[id]/todos` | Crear TODO |
| `PATCH` | `/api/todos/[id]` | Actualizar (completar/editar) |
| `PATCH` | `/api/todos/[id]/snooze` | Posponer TODO |
| `DELETE` | `/api/todos/[id]` | Eliminar (soft delete) |
| `GET` | `/api/telegram/todo-config` | Config notificaciones |
| `PUT` | `/api/telegram/todo-config` | Actualizar config |

### 3.2 Tipos TypeScript

```typescript
// src/lib/types/todo.ts

export type TodoStatus = 'pending' | 'completed' | 'deleted';

export interface TaskTodo {
  id: string;
  taskId: string;
  author: string;
  content: object; // TipTap JSON
  deadline: string | null;
  status: TodoStatus;
  completedAt: string | null;
  deletedAt: string | null;
  snoozedUntil: string | null;
  recurrenceRule: string | null;
  recurrenceParentId: string | null;
  createdAt: string;
}

export interface TaskTodoWithTask extends TaskTodo {
  taskTitle: string;
  isOverdue: boolean;
  timeRemaining: string; // "Vence en 2h" o "Vencido hace 1h"
}

export interface CreateTodoInput {
  content: object;
  deadline?: string;
  recurrenceRule?: string;
}

export interface TodoNotificationConfig {
  dailySummary: {
    enabled: boolean;
    time: string; // "08:00"
    days: number[]; // [1,2,3,4,5] = Lun-Vie
  };
  reminders: {
    enabled: boolean;
    beforeMinutes: number[]; // [1440, 60, 30]
  };
  overdueNotification: {
    enabled: boolean;
  };
}
```

### 3.3 GET /api/todos

```typescript
// Respuesta
{
  todos: TaskTodoWithTask[];
  overdue: number;  // count
  today: number;    // count
  upcoming: number; // count
}
```

### 3.4 POST /api/tasks/[id]/todos

```typescript
// Request body
{
  content: { type: 'doc', content: [...] },
  deadline: '2026-03-15T14:00:00Z', // opcional
  recurrenceRule: 'WEEKLY:1'        // opcional
}

// Response: TaskTodo
```

### 3.5 PATCH /api/todos/[id]

```typescript
// Request body - completar
{ status: 'completed' }

// Request body - editar
{ 
  content: {...},
  deadline: '...'
}
```

### 3.6 PATCH /api/todos/[id]/snooze

```typescript
// Request body
{ until: '2026-03-11T16:00:00Z' }
// o preset
{ preset: '15min' | '1h' | '3h' | 'tomorrow' }
```

---

## 4. Repositorio

### 4.1 Archivo: `src/lib/repositories/todo-repo.ts`

```typescript
import prisma from '@/lib/db';
import type { TaskTodo, TaskTodoWithTask, CreateTodoInput } from '@/lib/types';

export async function listPendingTodos(): Promise<TaskTodoWithTask[]> {
  const todos = await prisma.taskTodo.findMany({
    where: { 
      status: 'pending',
      OR: [
        { snoozedUntil: null },
        { snoozedUntil: { lt: new Date() } }
      ]
    },
    include: {
      task: { select: { title: true } }
    },
    orderBy: [
      { deadline: { sort: 'asc', nulls: 'last' } },
      { createdAt: 'asc' }
    ]
  });
  
  return todos.map(t => ({
    ...mapTodo(t),
    taskTitle: t.task.title,
    isOverdue: t.deadline ? new Date(t.deadline) < new Date() : false,
    timeRemaining: formatTimeRemaining(t.deadline)
  }));
}

export async function listTaskTodos(taskId: string): Promise<TaskTodo[]> {
  // Incluye completados y eliminados para historial
  const todos = await prisma.taskTodo.findMany({
    where: { taskId },
    orderBy: { createdAt: 'asc' }
  });
  return todos.map(mapTodo);
}

export async function createTodo(
  taskId: string, 
  author: string, 
  input: CreateTodoInput
): Promise<TaskTodo> {
  const todo = await prisma.taskTodo.create({
    data: {
      taskId,
      author,
      content: input.content,
      deadline: input.deadline ? new Date(input.deadline) : null,
      recurrenceRule: input.recurrenceRule || null,
      status: 'pending'
    }
  });
  return mapTodo(todo);
}

export async function completeTodo(id: string): Promise<TaskTodo> {
  const todo = await prisma.taskTodo.update({
    where: { id },
    data: { 
      status: 'completed',
      completedAt: new Date()
    }
  });
  
  // Si es recurrente, crear el siguiente
  if (todo.recurrenceRule) {
    await createNextRecurrence(todo);
  }
  
  return mapTodo(todo);
}

export async function deleteTodo(id: string): Promise<TaskTodo> {
  const todo = await prisma.taskTodo.update({
    where: { id },
    data: { 
      status: 'deleted',
      deletedAt: new Date()
    }
  });
  return mapTodo(todo);
}

export async function snoozeTodo(id: string, until: Date): Promise<TaskTodo> {
  const todo = await prisma.taskTodo.update({
    where: { id },
    data: { snoozedUntil: until }
  });
  return mapTodo(todo);
}

export async function getOverdueTodos(): Promise<TaskTodoWithTask[]> {
  const now = new Date();
  const todos = await prisma.taskTodo.findMany({
    where: {
      status: 'pending',
      deadline: { lt: now },
      OR: [
        { snoozedUntil: null },
        { snoozedUntil: { lt: now } }
      ]
    },
    include: {
      task: { select: { title: true } }
    }
  });
  
  return todos.map(t => ({
    ...mapTodo(t),
    taskTitle: t.task.title,
    isOverdue: true,
    timeRemaining: formatTimeRemaining(t.deadline)
  }));
}

export async function getTodosForTask(taskId: string): Promise<{
  hasPendingTodos: boolean;
  pendingCount: number;
}> {
  const count = await prisma.taskTodo.count({
    where: { taskId, status: 'pending' }
  });
  return { hasPendingTodos: count > 0, pendingCount: count };
}

// Helper: crear siguiente TODO recurrente
async function createNextRecurrence(completedTodo: TaskTodo & { recurrenceRule: string }) {
  const nextDeadline = calculateNextDeadline(
    completedTodo.deadline!,
    completedTodo.recurrenceRule
  );
  
  await prisma.taskTodo.create({
    data: {
      taskId: completedTodo.taskId,
      author: completedTodo.author,
      content: completedTodo.content,
      deadline: nextDeadline,
      recurrenceRule: completedTodo.recurrenceRule,
      recurrenceParentId: completedTodo.recurrenceParentId || completedTodo.id,
      status: 'pending'
    }
  });
}

function calculateNextDeadline(current: Date, rule: string): Date {
  const date = new Date(current);
  
  if (rule === 'DAILY') {
    date.setDate(date.getDate() + 1);
  } else if (rule.startsWith('WEEKLY:')) {
    date.setDate(date.getDate() + 7);
  } else if (rule.startsWith('MONTHLY:')) {
    date.setMonth(date.getMonth() + 1);
  }
  
  return date;
}

function formatTimeRemaining(deadline: Date | null): string {
  if (!deadline) return 'Sin fecha';
  
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  const hours = Math.abs(diff) / (1000 * 60 * 60);
  
  if (diff < 0) {
    if (hours < 1) return `Vencido hace ${Math.round(hours * 60)} min`;
    if (hours < 24) return `Vencido hace ${Math.round(hours)}h`;
    return `Vencido hace ${Math.round(hours / 24)} días`;
  } else {
    if (hours < 1) return `Vence en ${Math.round(hours * 60)} min`;
    if (hours < 24) return `Vence en ${Math.round(hours)}h`;
    return `Vence en ${Math.round(hours / 24)} días`;
  }
}

function mapTodo(t: any): TaskTodo {
  return {
    id: t.id,
    taskId: t.taskId,
    author: t.author,
    content: t.content,
    deadline: t.deadline?.toISOString() || null,
    status: t.status,
    completedAt: t.completedAt?.toISOString() || null,
    deletedAt: t.deletedAt?.toISOString() || null,
    snoozedUntil: t.snoozedUntil?.toISOString() || null,
    recurrenceRule: t.recurrenceRule,
    recurrenceParentId: t.recurrenceParentId,
    createdAt: t.createdAt.toISOString()
  };
}
```

---

## 5. Componentes Frontend

### 5.1 Nuevos Componentes

| Componente | Descripción |
|------------|-------------|
| `TodosSidebar` | Sección en sidebar con lista de TODOs |
| `TodoItem` | Item individual en sidebar |
| `TodoBanner` | Banner fijo para TODOs vencidos |
| `TodoCreateModal` | Modal para crear TODO |
| `TodoInComment` | TODO renderizado en flujo de comentarios |
| `TodoSnoozeDropdown` | Dropdown con opciones de snooze |

### 5.2 TodosSidebar

```tsx
// src/app/components/TodosSidebar.tsx

interface TodosSidebarProps {
  todos: TaskTodoWithTask[];
  onTodoClick: (todo: TaskTodoWithTask) => void;
}

export function TodosSidebar({ todos, onTodoClick }: TodosSidebarProps) {
  const overdue = todos.filter(t => t.isOverdue);
  const upcoming = todos.filter(t => !t.isOverdue);
  
  return (
    <div className="border-t border-gray-700 pt-2">
      <h3 className="text-sm font-semibold text-gray-400 px-2 flex items-center gap-1">
        🚩 TODOs <span className="text-xs">({todos.length})</span>
      </h3>
      
      {overdue.length > 0 && (
        <div className="mt-1">
          <div className="text-xs text-red-400 px-2">Vencidos ({overdue.length})</div>
          {overdue.map(todo => (
            <TodoItem key={todo.id} todo={todo} onClick={onTodoClick} />
          ))}
        </div>
      )}
      
      {upcoming.length > 0 && (
        <div className="mt-1">
          <div className="text-xs text-gray-500 px-2">Próximos</div>
          {upcoming.map(todo => (
            <TodoItem key={todo.id} todo={todo} onClick={onTodoClick} />
          ))}
        </div>
      )}
      
      {todos.length === 0 && (
        <p className="text-xs text-gray-500 px-2 py-1">Sin TODOs pendientes</p>
      )}
    </div>
  );
}
```

### 5.3 TodoBanner

```tsx
// src/app/components/TodoBanner.tsx

interface TodoBannerProps {
  todos: TaskTodoWithTask[];  // TODOs vencidos
  onComplete: (id: string) => void;
  onSnooze: (id: string, until: Date) => void;
  onDismiss: (id: string) => void;
  onNavigate: (taskId: string) => void;
}

export function TodoBanner({ todos, onComplete, onSnooze, onDismiss, onNavigate }: TodoBannerProps) {
  if (todos.length === 0) return null;
  
  const [current, setCurrent] = useState(0);
  const todo = todos[current];
  
  return (
    <div className="fixed top-0 left-0 right-0 bg-red-900/90 text-white p-2 z-50 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span>🔔</span>
        <span className="font-medium">TODO vencido:</span>
        <span 
          className="cursor-pointer hover:underline"
          onClick={() => onNavigate(todo.taskId)}
        >
          "{getExcerpt(todo.content)}"
        </span>
        <span className="text-gray-300">- {todo.taskTitle}</span>
        {todos.length > 1 && (
          <span className="text-xs bg-red-700 px-1 rounded">
            +{todos.length - 1} más
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <TodoSnoozeDropdown onSnooze={(until) => onSnooze(todo.id, until)} />
        <button 
          onClick={() => onComplete(todo.id)}
          className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
        >
          ✓ Completar
        </button>
        <button 
          onClick={() => onDismiss(todo.id)}
          className="px-2 py-1 hover:bg-red-800 rounded text-sm"
        >
          ✗
        </button>
      </div>
    </div>
  );
}
```

### 5.4 TodoCreateModal

```tsx
// src/app/components/TodoCreateModal.tsx

interface TodoCreateModalProps {
  taskId: string;
  onClose: () => void;
  onCreated: (todo: TaskTodo) => void;
}

export function TodoCreateModal({ taskId, onClose, onCreated }: TodoCreateModalProps) {
  const [content, setContent] = useState({ type: 'doc', content: [] });
  const [deadline, setDeadline] = useState<string>('');
  const [deadlineTime, setDeadlineTime] = useState<string>('');
  const [noDeadline, setNoDeadline] = useState(false);
  const [recurrence, setRecurrence] = useState<string>('');
  const [saving, setSaving] = useState(false);
  
  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          deadline: noDeadline ? undefined : `${deadline}T${deadlineTime || '00:00'}:00Z`,
          recurrenceRule: recurrence || undefined
        })
      });
      if (res.ok) {
        const todo = await res.json();
        onCreated(todo);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-4 w-full max-w-md border border-gray-600">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">🚩 Nuevo TODO</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✗</button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Descripción</label>
            <div className="border border-gray-600 rounded">
              <TipTapEditor
                content={content}
                onChange={setContent}
                placeholder="¿Qué necesitas recordar?"
                compact
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">⏰ Deadline</label>
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                disabled={noDeadline}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1"
              />
              <input
                type="time"
                value={deadlineTime}
                onChange={e => setDeadlineTime(e.target.value)}
                disabled={noDeadline}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1"
              />
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={noDeadline}
                  onChange={e => setNoDeadline(e.target.checked)}
                />
                Sin fecha
              </label>
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">🔄 Repetir</label>
            <select
              value={recurrence}
              onChange={e => setRecurrence(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 w-full"
            >
              <option value="">No repetir</option>
              <option value="DAILY">Diario</option>
              <option value="WEEKLY:1">Semanal (Lunes)</option>
              <option value="WEEKLY:5">Semanal (Viernes)</option>
              <option value="MONTHLY:1">Mensual (día 1)</option>
              <option value="MONTHLY:15">Mensual (día 15)</option>
            </select>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded"
          >
            {saving ? 'Creando...' : 'Crear TODO'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 5.5 Indicador en NotesList

```tsx
// En NotesList.tsx, agregar al render de cada tarea:

{note.type === 'task' && note.hasPendingTodos && (
  <span className="text-red-400" title={`${note.pendingTodosCount} TODOs pendientes`}>
    🚩
  </span>
)}
```

### 5.6 TodosCardsView - Vista Principal de TODOs

Nueva vista que se muestra en el área principal cuando se hace click en TODOs de la sidebar.

```tsx
// src/app/components/TodosCardsView.tsx

interface TodosCardsViewProps {
  filterTaskId?: string;  // null = todos, string = solo de una tarea
  onNavigateToTask: (taskId: string) => void;
  onCreateTodo?: () => void;  // Solo si filterTaskId está definido
}

export function TodosCardsView({ filterTaskId, onNavigateToTask, onCreateTodo }: TodosCardsViewProps) {
  const [todos, setTodos] = useState<TodoWithTask[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch TODOs (all o filtered por task)
  useEffect(() => {
    const url = filterTaskId 
      ? `/api/tasks/${filterTaskId}/todos`
      : '/api/todos';
    fetch(url).then(r => r.json()).then(setTodos);
  }, [filterTaskId]);

  return (
    <div className="flex-1 bg-gray-900 p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Flag className="text-orange-500" />
            {filterTaskId ? 'TODOs de esta tarea' : 'Todos los TODOs'}
          </h1>
          {filterTaskId && onCreateTodo && (
            <button onClick={onCreateTodo} className="btn-primary">
              + Nuevo TODO
            </button>
          )}
        </div>

        {/* Cards Grid */}
        <div className="space-y-4">
          {todos.map(todo => (
            <TodoCard 
              key={todo.id} 
              todo={todo}
              onComplete={() => handleComplete(todo.id)}
              onSnooze={(until) => handleSnooze(todo.id, until)}
              onNavigate={() => onNavigateToTask(todo.taskId)}
            />
          ))}
        </div>

        {todos.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            <Flag size={48} className="mx-auto mb-4 opacity-50" />
            <p>No hay TODOs pendientes</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

### 5.7 TodoCard - Card Individual

```tsx
// src/app/components/TodoCard.tsx

interface TodoCardProps {
  todo: TodoWithTask;
  onComplete: () => void;
  onSnooze: (until: string) => void;
  onNavigate: () => void;
}

export function TodoCard({ todo, onComplete, onSnooze, onNavigate }: TodoCardProps) {
  const isOverdue = todo.deadline && new Date(todo.deadline) < new Date();
  
  return (
    <div className={`bg-gray-800 rounded-lg p-4 border ${
      isOverdue ? 'border-red-500/50' : 'border-gray-700'
    }`}>
      {/* Header: Task link + Time */}
      <div className="flex items-center justify-between mb-3">
        <button 
          onClick={onNavigate}
          className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
        >
          <ExternalLink size={14} />
          {todo.taskTitle}
        </button>
        <span className={`text-xs px-2 py-1 rounded ${
          isOverdue 
            ? 'bg-red-500/20 text-red-400' 
            : 'bg-gray-700 text-gray-400'
        }`}>
          {isOverdue ? `Vencido hace ${formatTimeAgo(todo.deadline)}` : `Vence ${formatDeadline(todo.deadline)}`}
        </span>
      </div>

      {/* Content */}
      <div className="prose prose-invert prose-sm max-w-none mb-4">
        <TipTapReadOnly content={todo.content} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-700">
        <button 
          onClick={onComplete}
          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm"
        >
          <Check size={14} /> Completar
        </button>
        <TodoSnoozeDropdown onSnooze={onSnooze} />
      </div>
    </div>
  );
}
```

### 5.8 TaskTodosHeader - Icono en Cabecera de Task

En el TaskEditorModal, agregar icono de TODO en la cabecera.

```tsx
// En TaskEditorModal.tsx - agregar en la cabecera

interface TaskTodosHeaderProps {
  taskId: string;
  onShowTodos: () => void;
}

function TaskTodosHeaderIcon({ taskId, onShowTodos }: TaskTodosHeaderProps) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    fetch(`/api/tasks/${taskId}/todos?count=true`)
      .then(r => r.json())
      .then(data => setCount(data.pending));
  }, [taskId]);

  return (
    <button
      onClick={onShowTodos}
      className="relative p-1.5 hover:bg-gray-700 rounded"
      title={`${count} TODOs pendientes`}
    >
      <Flag size={16} className={count > 0 ? 'text-orange-500' : 'text-gray-500'} />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
          {count}
        </span>
      )}
    </button>
  );
}
```

### 5.9 Cambios en AppContext

Agregar nuevo ViewType y estado para filtrar TODOs.

```tsx
// En AppContext.tsx

export type ViewType = 'all' | 'general' | 'task' | 'connection' | 'timesheets' | 'archived' | 'config' | 'favorites' | 'todos';

interface AppState {
  // ... existing ...
  todosFilterTaskId: string | null; // null = all, string = specific task
}

// Nuevo action
setCurrentView: (view: ViewType) => void;
showTodosView: (taskId?: string) => void; // Muestra vista TODOs, opcionalmente filtrada
```

---

## 6. Integración con Comentarios

### 6.1 Modificar TaskComments

El componente `TaskComments` debe mostrar TODOs intercalados con comentarios.

```tsx
// En TaskComments.tsx

interface CommentOrTodo {
  type: 'comment' | 'todo';
  id: string;
  createdAt: string;
  data: TaskComment | TaskTodo;
}

// Ordenar comentarios y TODOs por fecha
const items: CommentOrTodo[] = [
  ...comments.map(c => ({ type: 'comment', id: c.id, createdAt: c.createdAt, data: c })),
  ...todos.map(t => ({ type: 'todo', id: t.id, createdAt: t.createdAt, data: t }))
].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

// En el render:
{items.map(item => (
  item.type === 'comment' 
    ? <CommentItem key={item.id} comment={item.data as TaskComment} />
    : <TodoInComment key={item.id} todo={item.data as TaskTodo} onComplete={...} onDelete={...} />
))}
```

### 6.2 TodoInComment

```tsx
// src/app/components/TodoInComment.tsx

interface TodoInCommentProps {
  todo: TaskTodo;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TodoInComment({ todo, onComplete, onDelete }: TodoInCommentProps) {
  const isCompleted = todo.status === 'completed';
  const isDeleted = todo.status === 'deleted';
  const isOverdue = todo.deadline && new Date(todo.deadline) < new Date();
  
  return (
    <div className={`
      py-2 px-3 my-1 rounded-lg border-l-4
      ${isCompleted ? 'border-green-500 bg-green-900/20' : ''}
      ${isDeleted ? 'border-gray-500 bg-gray-900/20 opacity-50' : ''}
      ${!isCompleted && !isDeleted && isOverdue ? 'border-red-500 bg-red-900/20' : ''}
      ${!isCompleted && !isDeleted && !isOverdue ? 'border-yellow-500 bg-yellow-900/20' : ''}
    `}>
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>🚩 TODO</span>
          <span>{todo.author}</span>
          <span>{formatDate(todo.createdAt)}</span>
        </div>
        
        {todo.status === 'pending' && (
          <div className="flex gap-1">
            <button
              onClick={() => onComplete(todo.id)}
              className="p-1 text-green-400 hover:text-green-300"
              title="Completar"
            >
              ✓
            </button>
            <button
              onClick={() => onDelete(todo.id)}
              className="p-1 text-gray-400 hover:text-red-400"
              title="Eliminar"
            >
              ✗
            </button>
          </div>
        )}
      </div>
      
      {todo.deadline && (
        <div className={`text-xs mt-1 ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
          ⏰ {isCompleted ? 'Venció' : isOverdue ? 'Vencido' : 'Vence'}: {formatDeadline(todo.deadline)}
        </div>
      )}
      
      <div className={`mt-1 ${isCompleted || isDeleted ? 'line-through opacity-70' : ''}`}>
        <TipTapEditor content={todo.content} readOnly />
      </div>
      
      {isCompleted && todo.completedAt && (
        <div className="text-xs text-green-400 mt-1">
          ✓ Completado: {formatDate(todo.completedAt)}
        </div>
      )}
    </div>
  );
}
```

---

## 7. Notificaciones In-App

### 7.1 Polling en AppContext

```tsx
// En AppContext.tsx

// Estado para TODOs vencidos
const [overdueTodos, setOverdueTodos] = useState<TaskTodoWithTask[]>([]);

// Polling cada 60 segundos
useEffect(() => {
  const checkOverdue = async () => {
    const res = await fetch('/api/todos/overdue');
    if (res.ok) {
      const data = await res.json();
      const newOverdue = data.todos.filter(
        (t: TaskTodoWithTask) => !overdueTodos.find(o => o.id === t.id)
      );
      
      // Reproducir sonido si hay nuevos
      if (newOverdue.length > 0) {
        playNotificationSound();
      }
      
      setOverdueTodos(data.todos);
    }
  };
  
  checkOverdue();
  const interval = setInterval(checkOverdue, 60000);
  return () => clearInterval(interval);
}, []);
```

### 7.2 Sonido de Notificación

```tsx
// src/lib/notification-sound.ts

let audioContext: AudioContext | null = null;

export function playNotificationSound() {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    console.warn('Could not play notification sound:', e);
  }
}
```

---

## 8. Notificaciones Telegram

### 8.1 Configuración Extendida

```typescript
// Agregar a telegram-config.json
{
  // ... config existente ...
  "todoNotifications": {
    "dailySummary": {
      "enabled": true,
      "time": "08:00",
      "days": [1, 2, 3, 4, 5]
    },
    "reminders": {
      "enabled": true,
      "beforeMinutes": [1440, 60, 30]
    },
    "overdueNotification": {
      "enabled": true
    }
  }
}
```

### 8.2 Servicio de Notificaciones

```typescript
// src/lib/todo-notifications.ts

import { sendTelegramMessage } from './telegram';
import prisma from './db';

export async function sendDailySummary(): Promise<void> {
  const todos = await prisma.taskTodo.findMany({
    where: { status: 'pending' },
    include: { task: { select: { title: true } } },
    orderBy: { deadline: 'asc' }
  });
  
  if (todos.length === 0) return;
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  
  const overdue = todos.filter(t => t.deadline && t.deadline < now);
  const todayTodos = todos.filter(t => t.deadline && t.deadline >= today && t.deadline < tomorrow);
  const upcoming = todos.filter(t => t.deadline && t.deadline >= tomorrow);
  const noDeadline = todos.filter(t => !t.deadline);
  
  let message = '📋 Buenos días! Tus TODOs:\n\n';
  
  if (overdue.length > 0) {
    message += `🚩 VENCIDOS (${overdue.length}):\n`;
    overdue.forEach(t => {
      message += `  ⚠️ ${getExcerpt(t.content)}\n`;
      message += `     Task: ${t.task.title}\n`;
    });
    message += '\n';
  }
  
  if (todayTodos.length > 0) {
    message += `📌 HOY (${todayTodos.length}):\n`;
    todayTodos.forEach(t => {
      message += `  • ${getExcerpt(t.content)}\n`;
      message += `    Task: ${t.task.title} | ${formatTime(t.deadline!)}\n`;
    });
    message += '\n';
  }
  
  if (upcoming.length > 0) {
    message += `📅 PRÓXIMOS (${upcoming.length}):\n`;
    upcoming.slice(0, 5).forEach(t => {
      message += `  • ${getExcerpt(t.content)}\n`;
      message += `    Task: ${t.task.title} | ${formatDate(t.deadline!)}\n`;
    });
    message += '\n';
  }
  
  message += `Total: ${todos.length} TODOs pendientes`;
  
  await sendTelegramMessage(message);
}

export async function sendReminderNotification(todo: TaskTodo, minutesBefore: number): Promise<void> {
  // Verificar si ya se envió este reminder
  const sent = await prisma.todoNotificationSent.findFirst({
    where: {
      todoId: todo.id,
      notificationType: 'reminder',
      reminderMinutes: minutesBefore
    }
  });
  
  if (sent) return;
  
  const message = `⏰ Recordatorio TODO\n\n🚩 ${getExcerpt(todo.content)}\n   Task: ${todo.taskTitle}\n   Vence en: ${minutesBefore} minutos`;
  
  await sendTelegramMessage(message);
  
  // Registrar que se envió
  await prisma.todoNotificationSent.create({
    data: {
      todoId: todo.id,
      notificationType: 'reminder',
      reminderMinutes: minutesBefore
    }
  });
}

export async function sendOverdueNotification(todo: TaskTodo): Promise<void> {
  // Verificar si ya se envió
  const sent = await prisma.todoNotificationSent.findFirst({
    where: {
      todoId: todo.id,
      notificationType: 'overdue'
    }
  });
  
  if (sent) return;
  
  const message = `🔴 TODO VENCIDO\n\n🚩 ${getExcerpt(todo.content)}\n   Task: ${todo.taskTitle}`;
  
  await sendTelegramMessage(message);
  
  await prisma.todoNotificationSent.create({
    data: {
      todoId: todo.id,
      notificationType: 'overdue'
    }
  });
}
```

### 8.3 Scheduler (node-cron)

```typescript
// src/lib/todo-scheduler.ts

import cron from 'node-cron';
import { getTelegramConfig } from './telegram';
import { sendDailySummary, sendReminderNotification, sendOverdueNotification } from './todo-notifications';
import prisma from './db';

let cronJob: cron.ScheduledTask | null = null;

export function startTodoScheduler() {
  // Verificar cada minuto
  cronJob = cron.schedule('* * * * *', async () => {
    const config = await getTelegramConfig();
    if (!config?.enabled || !config.todoNotifications) return;
    
    const now = new Date();
    const currentHour = now.getHours().toString().padStart(2, '0');
    const currentMinute = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${currentHour}:${currentMinute}`;
    const currentDay = now.getDay() || 7; // 1=Lunes, 7=Domingo
    
    // Resumen diario
    const { dailySummary } = config.todoNotifications;
    if (dailySummary.enabled && 
        dailySummary.time === currentTime && 
        dailySummary.days.includes(currentDay)) {
      await sendDailySummary();
    }
    
    // Recordatorios
    const { reminders } = config.todoNotifications;
    if (reminders.enabled) {
      for (const minutes of reminders.beforeMinutes) {
        const checkTime = new Date(now.getTime() + minutes * 60 * 1000);
        const todos = await prisma.taskTodo.findMany({
          where: {
            status: 'pending',
            deadline: {
              gte: checkTime,
              lt: new Date(checkTime.getTime() + 60 * 1000)
            }
          },
          include: { task: { select: { title: true } } }
        });
        
        for (const todo of todos) {
          await sendReminderNotification({
            ...todo,
            taskTitle: todo.task.title
          }, minutes);
        }
      }
    }
    
    // Vencidos
    if (config.todoNotifications.overdueNotification.enabled) {
      const overdue = await prisma.taskTodo.findMany({
        where: {
          status: 'pending',
          deadline: {
            gte: new Date(now.getTime() - 60 * 1000),
            lt: now
          }
        },
        include: { task: { select: { title: true } } }
      });
      
      for (const todo of overdue) {
        await sendOverdueNotification({
          ...todo,
          taskTitle: todo.task.title
        });
      }
    }
  });
}

export function stopTodoScheduler() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }
}
```

---

## 9. UI de Configuración

### 9.1 Componente TelegramTodoConfig

```tsx
// src/app/components/TelegramTodoConfig.tsx

interface TelegramTodoConfigProps {
  config: TodoNotificationConfig;
  onChange: (config: TodoNotificationConfig) => void;
}

export function TelegramTodoConfig({ config, onChange }: TelegramTodoConfigProps) {
  const dayLabels = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];
  const reminderOptions = [
    { value: 15, label: '15 minutos antes' },
    { value: 30, label: '30 minutos antes' },
    { value: 60, label: '1 hora antes' },
    { value: 120, label: '2 horas antes' },
    { value: 1440, label: '1 día antes' },
  ];
  
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">🚩 Notificaciones de TODOs</h3>
      
      {/* Resumen diario */}
      <div className="border border-gray-700 rounded p-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.dailySummary.enabled}
            onChange={e => onChange({
              ...config,
              dailySummary: { ...config.dailySummary, enabled: e.target.checked }
            })}
          />
          📋 Enviar resumen diario de TODOs
        </label>
        
        {config.dailySummary.enabled && (
          <div className="mt-2 ml-6 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">Horario:</span>
              <input
                type="time"
                value={config.dailySummary.time}
                onChange={e => onChange({
                  ...config,
                  dailySummary: { ...config.dailySummary, time: e.target.value }
                })}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm">Días:</span>
              {dayLabels.map((label, i) => {
                const day = i + 1;
                return (
                  <label key={day} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={config.dailySummary.days.includes(day)}
                      onChange={e => {
                        const days = e.target.checked
                          ? [...config.dailySummary.days, day]
                          : config.dailySummary.days.filter(d => d !== day);
                        onChange({
                          ...config,
                          dailySummary: { ...config.dailySummary, days }
                        });
                      }}
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
      
      {/* Recordatorios */}
      <div className="border border-gray-700 rounded p-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.reminders.enabled}
            onChange={e => onChange({
              ...config,
              reminders: { ...config.reminders, enabled: e.target.checked }
            })}
          />
          ⏰ Enviar recordatorios antes del deadline
        </label>
        
        {config.reminders.enabled && (
          <div className="mt-2 ml-6 space-y-1">
            {reminderOptions.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.reminders.beforeMinutes.includes(opt.value)}
                  onChange={e => {
                    const beforeMinutes = e.target.checked
                      ? [...config.reminders.beforeMinutes, opt.value]
                      : config.reminders.beforeMinutes.filter(m => m !== opt.value);
                    onChange({
                      ...config,
                      reminders: { ...config.reminders, beforeMinutes }
                    });
                  }}
                />
                {opt.label}
              </label>
            ))}
          </div>
        )}
      </div>
      
      {/* Vencimiento */}
      <div className="border border-gray-700 rounded p-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.overdueNotification.enabled}
            onChange={e => onChange({
              ...config,
              overdueNotification: { enabled: e.target.checked }
            })}
          />
          🔴 Notificar cuando un TODO vence
        </label>
      </div>
    </div>
  );
}
```

---

## 10. Fases de Implementación

### Fase 1: Base de Datos y API (Día 1)
- [ ] Migración Prisma (task_todos, todo_notifications_sent)
- [ ] Tipos TypeScript
- [ ] Repositorio todo-repo.ts
- [ ] API endpoints básicos (CRUD)

### Fase 2: Frontend Core (Día 2)
- [ ] TodosSidebar + TodoItem
- [ ] TodoCreateModal
- [ ] Botón [+TODO] en TaskComments
- [ ] Indicador 🚩 en NotesList

### Fase 3: Integración Comentarios (Día 2-3)
- [ ] TodoInComment
- [ ] Merge comentarios + TODOs en TaskComments
- [ ] Acciones completar/eliminar inline

### Fase 4: Notificaciones In-App (Día 3)
- [ ] TodoBanner
- [ ] Polling en AppContext
- [ ] TodoSnoozeDropdown
- [ ] Sonido de notificación

### Fase 5: Recurrencia (Día 4)
- [ ] Lógica de recurrencia en completeTodo
- [ ] UI selector de recurrencia
- [ ] Cálculo de siguiente deadline

### Fase 6: Telegram (Día 5)
- [ ] Extender telegram-config.json
- [ ] TelegramTodoConfig component
- [ ] Funciones de envío de mensajes
- [ ] Scheduler con node-cron

### Fase 7: Pruebas y Ajustes (Día 6)
- [ ] Pruebas manuales end-to-end
- [ ] Ajustes de UX
- [ ] Documentación

---

## 11. Archivos a Crear/Modificar

### Nuevos archivos

| Archivo | Descripción |
|---------|-------------|
| `prisma/migrations/.../add_todos` | Migración |
| `src/lib/types/todo.ts` | Tipos TypeScript |
| `src/lib/repositories/todo-repo.ts` | Repositorio |
| `src/lib/todo-notifications.ts` | Notificaciones Telegram |
| `src/lib/todo-scheduler.ts` | Cron job |
| `src/lib/notification-sound.ts` | Sonido in-app |
| `src/app/api/todos/route.ts` | API lista todos |
| `src/app/api/todos/overdue/route.ts` | API vencidos |
| `src/app/api/todos/[id]/route.ts` | API CRUD individual |
| `src/app/api/todos/[id]/snooze/route.ts` | API snooze |
| `src/app/api/tasks/[id]/todos/route.ts` | API TODOs por tarea |
| `src/app/api/telegram/todo-config/route.ts` | API config |
| `src/app/components/TodosSidebar.tsx` | Sidebar TODOs |
| `src/app/components/TodoItem.tsx` | Item en sidebar |
| `src/app/components/TodoBanner.tsx` | Banner vencidos |
| `src/app/components/TodoCreateModal.tsx` | Modal crear |
| `src/app/components/TodoInComment.tsx` | TODO en comentarios |
| `src/app/components/TodoSnoozeDropdown.tsx` | Dropdown snooze |
| `src/app/components/TelegramTodoConfig.tsx` | Config Telegram |

### Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `prisma/schema.prisma` | Agregar modelos |
| `src/lib/types/index.ts` | Export tipos |
| `src/app/components/index.ts` | Export componentes |
| `src/app/components/Sidebar.tsx` | Agregar TodosSidebar |
| `src/app/components/NotesList.tsx` | Indicador 🚩 |
| `src/app/components/TaskComments.tsx` | Integrar TODOs |
| `src/app/components/TelegramConfig.tsx` | Sección TODOs |
| `src/app/context/AppContext.tsx` | Estado + polling |
| `src/app/layout.tsx` | TodoBanner global |
| `data/telegram-config.json` | Config TODOs |

---

## 12. Pruebas

### Pruebas Manuales

#### Creación
- [ ] Crear TODO con deadline desde comentarios
- [ ] Crear TODO sin deadline (checklist)
- [ ] Crear TODO recurrente

#### Visualización
- [ ] TODO aparece en sidebar
- [ ] TODO aparece en flujo de comentarios
- [ ] Tarea muestra 🚩 si tiene TODOs

#### Acciones
- [ ] Completar TODO (desde sidebar, comentarios, banner)
- [ ] Eliminar TODO
- [ ] Snooze TODO con diferentes opciones

#### Recurrencia
- [ ] Al completar TODO recurrente se crea el siguiente
- [ ] Deadline calculado correctamente

#### Notificaciones In-App
- [ ] Banner aparece al vencer TODO
- [ ] Sonido se reproduce
- [ ] Banner persiste entre navegaciones

#### Notificaciones Telegram
- [ ] Resumen diario se envía a la hora configurada
- [ ] Recordatorio se envía según configuración
- [ ] Notificación de vencido se envía
- [ ] No se duplican notificaciones

---
