# REQ-009: Parsing Automático del Título de Tareas

## Descripción
Al crear o editar una TASK, el sistema debe analizar automáticamente el texto ingresado en el campo de título para extraer información estructurada como Ticket/Fase y Descripción corta (campo INC).

## Comportamiento Esperado

### Detección de Ticket/Fase
- Si el texto contiene `#` seguido de **5 dígitos**, esos dígitos se extraen como **Ticket/Fase**
- El patrón a buscar es: `#\d{5}#?` (incluye opcionalmente un `#` al final)
- Solo se toma el primer match encontrado
- El `#` al final (si existe) también se elimina del título/descripción

### Detección de INC (Descripción corta)
- Si el texto contiene `INC` seguido de **7 dígitos**, se extrae como **Descripción corta**
- El patrón a buscar es: `INC\d{7}`
- Solo se toma el primer match encontrado
- **Si NO se encuentra INC**, la **Descripción corta** se completa con el **texto limpio** (título sin los patrones detectados)

### Limpieza del Título
- El título final debe ser el texto original **quitando**:
  - El patrón `#XXXXX` (ticket detectado)
  - El patrón `INCXXXXXXX` (INC detectado)
- Se deben limpiar espacios duplicados y trim al inicio/final

### Trigger del Parsing
El parsing y asignación de datos se ejecuta cuando:
- El usuario presiona **TAB** en el campo de título
- El usuario sale del campo de título (**onBlur**)

## Ejemplos

| Input | Ticket/Fase | Descripción corta | Título resultante |
|-------|-------------|-------------------|-------------------|
| `#35505 Errores en la interfaz de Ortems al crear OFs` | `35505` | `Errores en la interfaz de Ortems al crear OFs` | `Errores en la interfaz de Ortems al crear OFs` |
| `#34814 INC0056877` | `34814` | `INC0056877` | (vacío) |
| `#35243 Actualizar el campo de motivo de cambio` | `35243` | `Actualizar el campo de motivo de cambio` | `Actualizar el campo de motivo de cambio` |
| `INC0056877 - Falla la integración #34814` | `34814` | `INC0056877` | `- Falla la integración` |
| `Tarea sin ticket ni INC` | (vacío) | `Tarea sin ticket ni INC` | `Tarea sin ticket ni INC` |

## Criterios de Aceptación

- [ ] Detectar y extraer `#XXXXX` (5 dígitos) como Ticket/Fase
- [ ] Detectar y extraer `INCXXXXXXX` (INC + 7 dígitos) como Descripción corta
- [ ] Si no hay INC, usar el texto limpio como Descripción corta
- [ ] Limpiar el título removiendo los patrones detectados
- [ ] Parsing se ejecuta en TAB y onBlur del input de título
- [ ] No sobrescribir campos si ya tienen valor (opcional - a definir)
- [ ] Funciona tanto en creación como en edición de tareas

## Componentes Afectados

- `TaskEditorModal.tsx` - Modal/panel de edición de tareas
- Campo de título del task

## Notas Técnicas

```typescript
// Regex patterns
const TICKET_PATTERN = /#(\d{5})#?/;  // Captura 5 dígitos después de # y opcionalmente otro # al final
const INC_PATTERN = /(INC\d{7})/;   // Captura INC + 7 dígitos

// Función de parsing
function parseTaskTitle(input: string): {
  ticket: string | null;
  shortDescription: string;
  cleanTitle: string;
} {
  const ticketMatch = input.match(TICKET_PATTERN);
  const incMatch = input.match(INC_PATTERN);
  
  let cleanTitle = input;
  
  if (ticketMatch) {
    cleanTitle = cleanTitle.replace(TICKET_PATTERN, '');
  }
  if (incMatch) {
    cleanTitle = cleanTitle.replace(INC_PATTERN, '');
  }
  
  // Limpiar espacios duplicados y trim
  cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();
  
  // Si hay INC, usar INC. Si no, usar el título limpio como descripción corta
  const shortDescription = incMatch ? incMatch[1] : cleanTitle;
  
  return {
    ticket: ticketMatch ? ticketMatch[1] : null,
    shortDescription,
    cleanTitle
  };
}
```

## Flujo de Usuario

### Ejemplo 1: Con INC
1. Usuario crea nueva tarea
2. En el campo título escribe: `#35505 INC0056877 Corregir error en pantalla`
3. Usuario presiona TAB o sale del campo
4. Sistema detecta y asigna:
   - **Ticket/Fase**: `35505`
   - **Descripción corta**: `INC0056877`
   - **Título**: `Corregir error en pantalla`

### Ejemplo 2: Sin INC
1. Usuario crea nueva tarea
2. En el campo título escribe: `#35505 Errores en la interfaz de Ortems`
3. Usuario presiona TAB o sale del campo
4. Sistema detecta y asigna:
   - **Ticket/Fase**: `35505`
   - **Descripción corta**: `Errores en la interfaz de Ortems` (texto limpio)
   - **Título**: `Errores en la interfaz de Ortems`
