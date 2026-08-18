# Specifications Index

Este directorio contiene las especificaciones técnicas del proyecto Bitacora.

## Specs Activas

| Spec | Título | Estado | Descripción |
|------|--------|--------|-------------|
| [SPEC-001](SPEC-001-storage-docker.md) | Storage Engine & Docker Setup | ⛔ Superseded | Infraestructura original file-based (reemplazado por SPEC-006) |
| [SPEC-002](SPEC-002-ui-skeleton.md) | UI Skeleton & Navigation | ✅ Completed | Layout 3 paneles, navegación, lista de notas |
| [SPEC-003](SPEC-003-config-screens.md) | Config Screens | 🔄 In Progress | CRUD de Clientes y Proyectos |
| [SPEC-004](SPEC-004-attachments.md) | Attachments & Image Paste | ✅ Completed | Upload de archivos y pegado de imágenes |
| [SPEC-005](SPEC-005-search-export.md) | Search Filters & CSV Export | 🔄 In Progress | Búsqueda mejorada y exportación CSV |
| [SPEC-006](SPEC-006-database-migration.md) | PostgreSQL Database Migration | ✅ Completed | Migración a PostgreSQL con Prisma |
| [SPEC-007](SPEC-007-telegram-notifications.md) | Telegram Backup Notifications | 🔄 In Progress | Notificaciones de backup vía Telegram |
| [SPEC-008](SPEC-008-system-comments.md) | System Comments | ✅ Completed | Comentarios automáticos del sistema en tareas |
| [SPEC-009](SPEC-009-todos.md) | Sistema de TODOs | 📝 Draft | Recordatorios con deadline, notificaciones in-app y Telegram |
| [SPEC-010](SPEC-010-attachment-ux.md) | Mejoras UX de Anexos | ✅ Completed | Multi-upload, iconos por tipo, preview condicional |
| [SPEC-011](SPEC-011-recientes.md) | Recientes | ✅ Completed | Vista de notas recientes |
| [SPEC-012](SPEC-012-facturacion.md) | Facturación | 📝 Draft | Facturación de TimeSheets por Cliente Padre con API externa |
## Estados

- ✅ **Completed** - Implementación finalizada
- 🔄 **In Progress** - En desarrollo activo
- 📝 **Draft** - En diseño/planificación
- ⛔ **Superseded** - Reemplazado por otra spec

## Convenciones

### Nomenclatura
- `SPEC-XXX-nombre-descriptivo.md`
- Numeración secuencial (001, 002, ...)

### Estructura de cada Spec

```markdown
# SPEC-XXX: Título

**Status:** Draft | In Progress | Completed | Superseded
**Epic:** [letra/nombre del epic]
**Priority:** Critical | High | Medium | Low
**Depends on:** [otras specs]

---

## 1. Overview
[Descripción breve del alcance]

## 2. Goals
[Objetivos a lograr]

## 3. Non-Goals
[Explícitamente fuera de alcance]

## 4. Technical Design
[Diseño técnico detallado]

## 5. Acceptance Criteria
[Lista de criterios verificables]
```

## Documentación Relacionada

- [docs/PROTOTYPE_CONTEXT.md](../docs/PROTOTYPE_CONTEXT.md) - Contexto funcional
- [docs/BACKLOG.md](../docs/BACKLOG.md) - Backlog de tareas
- [docs/REQ-*.md](../docs/) - Requerimientos de negocio
- [.github/copilot-instructions.md](../.github/copilot-instructions.md) - Instrucciones para Copilot
