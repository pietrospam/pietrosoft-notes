# REQ-025: TODOs sin Task/Client (Standalone)

**Estado:** NUEVO
**Spec:** (por crear) 
**Prioridad:** Media
**Fecha:** 2026-03-16

## Descripción

Los TODOs deben poder crearse de forma independiente, sin necesidad de estar ligados a una tarea ni a un cliente. Esto permite que los usuarios registren recordatorios globales (por ejemplo, "Revisar contrato" o "Llamar a proveedor") sin tener que inventar una tarea para ello.

Los TODOs seguirán soportando:
- Deadline (fecha y hora)
- Contenido enriquecido (TipTap)
- Estado (pendiente / completado)
- Notificaciones y banner de vencimiento


## Requerimientos

### 1. Creación de TODO independiente

- Debe existir una UI que permita crear un TODO sin estar dentro de una tarea.
- El TODO puede opcionalmente asociarse a:
  - una tarea (task)
  - un cliente (client)
- Si no se asocia nada, el TODO queda "libre" (standalone).

### 2. Interfaz de creación

- La creación se hace desde el área de TODOs (debajo del calendario que ya existe).
- El formulario debe permitir:
  - Contenido (TipTap editor)
  - Deadline (selector de fecha/hora)
  - Asociar a Task (autocomplete / select)
  - Asociar a Client (autocomplete / select)
  - Botón de guardar

### 3. Almacenamiento

- El modelo de TODO debe permitir tener `taskId` y `clientId` opcionales (nullables).
- Un TODO sin `taskId` ni `clientId` se considera "standalone".

### 4. Visualización

- En la vista de TODOs se deben mostrar:
  - Todos los TODOs standalone y aquellos con asociación.
  - Un filtro rápido para ver:
    - Solo standalone
    - Solo asociados a Task
    - Solo asociados a Client

### 5. Integración con el calendario

- Los TODOs standalone deben aparecer en el calendario igual que los TODOs asociados.
- El filtro por día debe mostrar TODOs de ese día independientemente de si están ligados.

### 6. Notificaciones y banners

- Los TODOs standalone deben generar las mismas notificaciones y banners que los TODOs ligados cuando vencen.

### 7. UX/Accesibilidad

- El usuario debe entender claramente si un TODO es standalone o pertenece a algo.
- En la lista de TODOs se debe mostrar, cuando exista, la tarea y/o cliente asociado (p.ej. "[Task: XYZ]" o "[Cliente: Acme]").

---

## Open points

- ¿Queremos permitir múltiples TODOs en la misma tarea/cliente desde una sola acción? (ej. crear varios en lote)
- ¿Se debe poder filtrar los TODOs standalone desde la sidebar principal?
