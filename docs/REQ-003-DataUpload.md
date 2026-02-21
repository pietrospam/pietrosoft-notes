# REQ-003: Importación Masiva de Datos y Reset de Base de Datos

**Estado:** PENDIENTE  
**Prioridad:** Media  
**Fecha:** 2026-02-20

---

## 1. Resumen del Requerimiento

### 1.1 Objetivo
Proveer una funcionalidad de importación masiva de datos que permita a los usuarios cargar registros de Clientes, Proyectos y Tareas de forma eficiente mediante archivos CSV.

### 1.2 Alcance
- Pantalla dedicada para importación de datos
- Soporte para importación de múltiples entidades
- Validación y reporte de resultados por registro
- Funcionalidad de reset completo de base de datos

---

## 2. Funcionalidad de Importación

### 2.1 Interfaz de Usuario

#### 2.1.1 Componentes de la Pantalla
| Componente | Descripción |
|------------|-------------|
| Selector de entidad | Dropdown para elegir la tabla destino (Clients, Projects, Tasks) |
| Área de ejemplo | Muestra el formato CSV esperado con columnas requeridas |
| Área de entrada | TextArea para pegar el contenido CSV a importar |
| Botón "Importar" | Inicia el proceso de importación |
| Área de resultados | Muestra el resultado de cada línea procesada |

#### 2.1.2 Flujo de Importación
1. Usuario selecciona la entidad destino
2. Sistema muestra el formato CSV ejemplo para esa entidad
3. Usuario pega el contenido CSV en el área de entrada
4. Usuario presiona "Importar"
5. Sistema procesa cada línea y muestra resultados

### 2.2 Formato CSV

#### 2.2.1 Especificaciones Generales
- **Delimitador:** Punto y coma (`;`)
- **Codificación:** UTF-8
- **Primera línea:** Opcional (headers)

#### 2.2.2 Estructura por Entidad

**Clients (Clientes)**
| Columna | Tipo | Key | Descripción |
|---------|------|-----|-------------|
| `name` | String | ✅ PK Natural | Nombre único del cliente |
| `description` | String | | Descripción del cliente |

**Projects (Proyectos)**
| Columna | Tipo | Key | Descripción |
|---------|------|-----|-------------|
| `clientName` | String | FK | Nombre del cliente (debe existir) |
| `name` | String | ✅ PK Natural | Nombre único del proyecto |
| `code` | String | | Código del proyecto |
| `description` | String | | Descripción del proyecto |

**Tasks (Tareas)**
| Columna | Tipo | Key | Descripción |
|---------|------|-----|-------------|
| `projectCode` | String | FK | Código del proyecto (debe existir) |
| `ticketCode` | String | ✅ PK Natural | Código único del ticket/fase |
| `description` | String | | Descripción de la tarea |

### 2.3 Lógica de Procesamiento

#### 2.3.1 Comportamiento Upsert
- Si el registro **no existe** (según key natural): Se **crea** nuevo registro
- Si el registro **existe**: Se **actualiza** con los nuevos valores

#### 2.3.2 Validaciones
| Validación | Acción si falla |
|------------|-----------------|
| Campos requeridos vacíos | Error en registro |
| FK no encontrada (ej: cliente inexistente) | Error en registro |
| Formato de datos inválido | Error en registro |

### 2.4 Reporte de Resultados

#### 2.4.1 Formato de Salida
El sistema devolverá el CSV original con dos columnas adicionales:

| Columna | Valores posibles |
|---------|------------------|
| `status` | `OK` / `ERROR` |
| `message` | Descripción del resultado o error |

#### 2.4.2 Ejemplo de Salida
```csv
name;description;status;message
Acme Corp;Empresa de tecnología;OK;Registro creado exitosamente
TechStart;Startup innovadora;OK;Registro actualizado
;Cliente sin nombre;ERROR;El campo 'name' es requerido
```

---

## 3. Funcionalidad de Reset de Base de Datos

### 3.1 Descripción
Nueva opción en el panel de Configuración que permite eliminar todos los datos de la aplicación para comenzar desde cero.

### 3.2 Ubicación
- Panel de Configuración (⚙️)
- Sección: "Zona de Peligro" o similar

### 3.3 Comportamiento
1. Usuario hace clic en "Limpiar Base de Datos"
2. Sistema muestra modal de confirmación con advertencia
3. Usuario debe escribir "CONFIRMAR" para habilitar el botón
4. Al confirmar, se eliminan todos los registros de:
   - Notes (incluye Tasks y TimeSheets)
   - Projects
   - Clients
   - Attachments

### 3.4 Consideraciones de Seguridad
- Confirmación obligatoria con texto explícito
- Advertencia clara sobre la irreversibilidad
- Logging de la acción (opcional)

---

## 4. Diseño Visual Sugerido

### 4.1 Pantalla de Importación
```
┌──────────────────────────────────────────────────────────────────────────────┐
│  📥 Importación de Datos                                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Entidad a importar:  [Clients ▼]                                           │
│                                                                              │
│  ┌─ Formato esperado ──────────────────────────────────────────────────────┐│
│  │ name;description                                                         ││
│  │ Acme Corp;Empresa de tecnología                                          ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─ Datos CSV a importar ──────────────────────────────────────────────────┐│
│  │                                                                          ││
│  │  (Pegar aquí el contenido CSV)                                           ││
│  │                                                                          ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│                                                      [ Importar ]           │
│                                                                              │
│  ┌─ Resultados ────────────────────────────────────────────────────────────┐│
│  │ ✅ Acme Corp - Registro creado exitosamente                              ││
│  │ ✅ TechStart - Registro actualizado                                      ││
│  │ ❌ Línea 3 - El campo 'name' es requerido                                ││
│  └──────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Sección de Reset en Configuración
```
┌─ Zona de Peligro ───────────────────────────────────────────────────────────┐
│                                                                              │
│  🗑️ Limpiar Base de Datos                                                   │
│                                                                              │
│  Esta acción eliminará permanentemente todos los datos de la aplicación:    │
│  clientes, proyectos, tareas, notas y archivos adjuntos.                    │
│                                                                              │
│                                              [ Limpiar Base de Datos ]      │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Criterios de Aceptación

### 5.1 Importación de Datos
- [ ] Existe pantalla accesible desde Configuración o Sidebar
- [ ] Selector permite elegir entre Clients, Projects y Tasks
- [ ] Se muestra ejemplo de formato CSV según entidad seleccionada
- [ ] TextArea permite pegar contenido CSV
- [ ] Botón "Importar" procesa los datos
- [ ] Cada línea muestra resultado (OK/ERROR) con mensaje descriptivo
- [ ] Registros existentes se actualizan (upsert)
- [ ] Registros nuevos se crean correctamente
- [ ] Errores de validación no detienen el proceso completo

### 5.2 Reset de Base de Datos
- [ ] Opción visible en panel de Configuración
- [ ] Modal de confirmación requiere escribir "CONFIRMAR"
- [ ] Al confirmar, se eliminan todos los datos
- [ ] La aplicación queda funcional después del reset

---

## 6. Componentes Afectados

| Componente | Cambio |
|------------|--------|
| `Sidebar.tsx` | Agregar opción "Importar Datos" (opcional) |
| `ConfigPanel.tsx` | Agregar sección de importación y reset |
| `DataImport.tsx` | **Nuevo** - Componente de importación |
| `/api/import/[entity]/route.ts` | **Nuevo** - Endpoint de importación |
| `/api/wipe/route.ts` | **Nuevo** - Endpoint de reset |

---

## 7. Notas Técnicas

### 7.1 Parsing CSV
- Usar split por `;` para separar columnas
- Manejar casos con `;` dentro de valores (escapados con comillas)
- Trim de espacios en blanco

### 7.2 Transacciones
- Cada línea se procesa individualmente
- Un error en una línea no afecta las demás
- Considerar procesamiento en lote para mejor performance

### 7.3 Relaciones FK
- Para Projects: buscar Client por `name`
- Para Tasks: buscar Project por `code`, obtener Client del proyecto
