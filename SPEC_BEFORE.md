# SPEC_BEFORE: Pasos para aplicar GitHub Copilot Specs

**Fecha:** 2026-03-10  
**Estado:** Plan de implementación

---

## Estado Actual del Proyecto

### Estructura existente

```
pietrosoft-notes/
├── docs/                           # Documentación general
│   ├── MAIN_INSTRUCTIONS.md        # Instrucciones principales
│   ├── BACKLOG.md                  # Backlog de tareas
│   ├── EXECUTION_PLAN.md           # Plan de ejecución
│   ├── PROTOTYPE_CONTEXT.md        # Contexto del prototipo
│   ├── issues.md                   # Issues activos
│   └── REQ-XXX-*.md               # Requerimientos (18 archivos)
├── specs/                          # Especificaciones técnicas
│   ├── SPEC-001-storage-docker.md
│   ├── SPEC-002-ui-skeleton.md
│   ├── SPEC-003-config-screens.md
│   ├── SPEC-004-attachments.md
│   ├── SPEC-005-search-export.md
│   └── SPEC-006-database-migration.md
└── .vscode/
    └── settings.json               # Configuración local
```

### Lo que falta

1. **No existe `.github/copilot-instructions.md`** - Archivo de instrucciones globales para Copilot
2. **No existe `specs/README.md`** - Índice centralizado de especificaciones
3. **Documentación dispersa** - Contexto distribuido en múltiples archivos

---

## Pasos a Implementar

### Paso 1: Crear directorio `.github/`

Crear el directorio estándar de GitHub para configuraciones.

### Paso 2: Crear `.github/copilot-instructions.md`

Archivo principal con:
- Descripción del proyecto
- Stack tecnológico (Next.js 15, PostgreSQL, Prisma, TipTap, Tailwind)
- Convenciones de código
- Patrones arquitectónicos
- Referencias a documentación existente

### Paso 3: Crear `specs/README.md`

Índice de especificaciones con:
- Lista de todas las specs
- Estado de cada una (Draft, Active, Completed, Superseded)
- Descripción breve
- Links directos

### Paso 4: Verificar estructura final

Confirmar que la estructura quede correcta y funcional.

---

## Beneficios Esperados

1. **Contexto automático** - Copilot leerá las instrucciones globales
2. **Navegación simplificada** - Índice centralizado de specs
3. **Consistencia** - Un solo lugar para convenciones
4. **Onboarding rápido** - Nuevos desarrolladores entienden el proyecto rápidamente

---

## Archivos a Crear

| Archivo | Propósito |
|---------|-----------|
| `.github/copilot-instructions.md` | Instrucciones globales para Copilot |
| `specs/README.md` | Índice de especificaciones |

---

*Este documento será reemplazado por SPEC_AFTER.md una vez completada la implementación.*
