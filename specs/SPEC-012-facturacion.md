# SPEC-012: Facturación de TimeSheets a Cliente Padre

## Overview

Agregar funcionalidad de facturación por Cliente Padre para horas `inputado`, con integración a API de facturación externa y almacenamiento de documentos generados.

## Acceptance Criteria

### AC-1: UI de Facturación
- [ ] Nueva pantalla `Facturación` en el módulo de TimeSheets.
- [ ] Select de `Cliente Padre`, `Período de Facturación` y `Mes/Año`.
- [ ] `Período de Facturación` inicializa desde el primer día hasta el último día del mes de factura.
- [ ] Vista previa de horas y total estimado antes de facturar.

### AC-2: Lógica de cálculo de horas
- [ ] Filtrar TimeSheet a estado `inputado` y cliente padre seleccionado.
- [ ] Sumar horas dentro del `Período de Facturación` seleccionado.
- [ ] El `Mes/Año` de factura define la fecha de factura como el último día del mes seleccionado.
- [ ] Incluir sub-clientes si la jerarquía aplica.

### AC-3: Billing Methods CRUD
- [ ] Endpoints para crear/leer/actualizar/eliminar métodos: `/api/billing/methods`.
- [ ] Campos mínimos: `name`, `endpointUrl`, `authType`, `authConfig`, `payloadTemplate`.
- [ ] AuthType: `bearer`, `basic`, `apiKeyHeader`, `apiKeyQuery`, `none`.

### AC-4: Facturación
- [ ] Endpoint POST `/api/billing/invoice` que ejecuta facturación.
- [ ] Construye payload a partir de `BillingMethod` y datos de horas.
- [ ] Llama al endpoint externo y obtiene PDF.
- [ ] Guarda `BillingRun` con request/response/PDF/status.

### AC-5: Resultados y reenvío
- [ ] Listado en UI de ejecuciones de facturación.
- [ ] Botones: `Ver PDF`, `Descargar PDF`, `Editar Request`, `Reenviar`, `Eliminar`.
- [ ] Editable JSON request incluido.

### AC-6: Seguridad y audit
- [ ] Solo usuarios autorizados ejecutan facturación.
- [ ] Registro de `userId` y `timestamp`.
- [ ] Manejo de errores en la UI.

## Technical Notes

- Reutilizar modelo de clientes y TimeSheet existente.
- Evitar bloquear la UI; usar indicadores de carga.
- En caso de respuestas no-PDF, mostrar error y mantener `BillingRun.status=failed`.
- Conservar historial de ejecuciones para trazabilidad.
