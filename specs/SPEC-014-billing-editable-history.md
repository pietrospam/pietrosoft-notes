# SPEC-014: Billing Editable History and Invoice Data Persistence

## Resumen

Definir un flujo de facturación donde cada envío de factura guarda toda la información usada para emitirla, incluyendo los items. El objetivo es permitir editar esos datos desde una ventana de facturación estructurada, reenviar la factura con cambios y conservar el historial completo para visualización y auditoría.

## Requerimientos

- REQ-026: Facturación
- REQ-021: TODOs / Comentarios (información relacionada)
- REQ-008: UX / historial

## Objetivo

Crear una estructura de datos y una interfaz que almacene los detalles de cada emisión de factura (incluidos items) y permita modificar esa información en una vista dedicada antes de reenviar. El historial debe permanecer accesible como registro inalterable de los envíos y cualquier acción posterior.

## Historias de usuario

- Como usuario quiero que cada factura enviada tenga un registro propio con los datos completos usados para emitirla, para no depender solo del JSON.
- Como usuario quiero poder editar los items de facturación en una ventana estructurada, para ajustar los valores sin tocar el JSON directamente.
- Como usuario quiero poder reenviar una factura anterior luego de modificarla, para corregir errores o actualizar datos sin perder el historial.
- Como usuario quiero ver el historial de envíos y poder abrir cualquiera para visualizar todos los datos usados en esa emisión.

## Comportamiento esperado

1. Al emitir una factura, se crea un registro persistente que guarda:
   - el nombre del método de facturación usado en ese envío, porque el resto de datos se guardan con la propia emisión (JSON enviado, título de factura, número de factura, totales, items, etc.)
   - número de factura
   - título de factura
   - periodo de facturación
   - items de la factura (nombre, cantidad, precio unitario, total)
   - totales y moneda
   - tipo de cambio a USD cuando la moneda no es USD, para que ese valor informativo quede incluido en el JSON
   - request JSON / payload generado
   - estado de la factura: `borrador`, `validada` o `enviada`
   - PDF generado
   - respuesta del servicio
   - metadatos de envío (fecha, hora, notas asociadas)

2. El registro debe incluir una tabla de items, no solo un campo JSON libre.

3. Desde la interfaz de historial debe existir una acción para abrir y editar ese registro en una ventana/modal estructurado.

4. La ventana de edición debe exponer:
   - campos de encabezado: cliente, datos de facturación (nombre del método aplicado), número de factura, título de factura, periodo, moneda
   - campos editables para todos los datos relevantes de la factura: título de factura, número de factura, moneda (EUR, USD, ARS), tipo de cambio a USD cuando la moneda es EUR, totales, items, datos del servicio y payload
   - lista de items editables con columnas para nombre, cantidad, costo unitario y subtotal
   - botones para agregar/quitar items
   - resumen de totales y moneda
   - botón para guardar cambios y botón para reenviar
   - botón `Facturar`/`Enviar` dentro de esta ventana, no en la pantalla principal
   - la moneda puede venir por defecto definida en el método, pero puede cambiarse en esta pantalla (solo EUR, USD, ARS)
   - el tipo de cambio a USD se muestra solo cuando la moneda es EUR; para USD/ARS ese valor se fija en 1

5. En la pantalla principal de facturación, el botón que hoy dice `Facturar` se renombra a `Nueva factura` y abre esta ventana de edición completa.
6. La pantalla principal debe mostrar solo la opción `Nueva factura` y el historial de facturación.
   - El drill-down de horas ya no debe mostrarse en la pantalla principal.
   - Todos los campos de configuración pasados (cliente padre, método, número de factura, título de factura, periodo, moneda, tipo de cambio) deben moverse al editor de factura.
   - Todos los datos que hoy se definen en la pantalla principal (cliente padre, método, número de factura, periodo, moneda, tipo de cambio) deben moverse a la nueva pantalla de factura.
   - El nuevo editor de factura debe ser la única interfaz donde el usuario configure y confirme la emisión.
7. El drill-down de horas en la nueva pantalla de factura debe ser:
   - primero resumido por total de horas,
   - segundo agrupado por día,
   - con cada día desplegable para ver los detalles de entries,
   - y con una sección scrollable para que el contenido no desborde la pantalla.
8. La pantalla principal no ejecutará facturación directa.
8. Dentro de la ventana de edición, el usuario podrá revisar y corregir toda la información antes de hacer clic en `Facturar`.
8. Si el usuario modifica datos y guarda sin enviar, el registro actualizado se mantiene editable y accesible para nuevas modificaciones.
9. El historial debe mostrar claramente qué envíos fueron solo guardados y cuáles ya fueron emitidos.

10. Las facturas deben tener un flujo de estado claro:
    - `borrador`: recién creada o editada, se puede modificar libremente.
    - `validada`: ya revisada y aprobada, puede seguir permitiendo ediciones parciales si la UI lo autoriza, pero la acción principal es enviar.
    - `enviada`: factura finalizada, solo se pueden ver datos y reemitir si se permite una nueva versión histórica.

11. El botón `Nueva factura` abre una factura en estado `borrador`.
12. El reenviado debe usar los datos actuales de ese registro y volver a crear un registro de historial si es necesario o actualizar el mismo registro conservando el trace.

7. La historia existente debe seguir siendo visible y consultable, con opciones de:
   - ver datos
   - ver/descargar PDF
   - abrir la nota asociada
   - ver request JSON en modo lectura

8. Las acciones no permitidas en un registro histórico bloqueado deben permanecer así, pero la vista debe seguir mostrando los datos.

## Reglas de negocio

- Cada `BillingRun` debe guardar los items usados en la emisión.
- Los items deben estar normalizados en una subtabla (`BillingRunItem` o equivalente).
- El registro debe conservar el request JSON original y el payload editable.
- Cada factura debe tener un estado: `borrador`, `validada` o `enviada`.
- El botón `Nueva factura` crea una factura en estado `borrador`.
- El método de facturación asociado se guarda solo por nombre, no por payload.
- La moneda puede venir por defecto del método, pero debe poder cambiarse al generar la factura. Las opciones deben ser EUR, USD y ARS.
- El título de la factura debe ser editable y guardarse junto a la emisión.
- El tipo de cambio a USD debe definirse por factura solo cuando la moneda es EUR; para USD y ARS el valor se guarda como 1.
- El reenvío puede crear un nuevo envío asociado al mismo número de factura o actualizar el envío existente, según la política definida.
- El historial debe ser inmutable para fines de auditoría cuando una factura está marcada como bloqueada.

## Criterios de aceptación

- [ ] Existe un modelo de datos que guarda los items de cada factura emitida.
- [ ] La interfaz de facturación permite editar la factura completa en una ventana estructurada.
- [ ] Los items pueden añadirse, modificarse y eliminarse desde esa ventana.
- [ ] El usuario puede guardar cambios sin editar manualmente el JSON.
- [ ] El usuario puede editar el título de la factura y guardarlo como parte del registro.
- [ ] El usuario puede reenviar desde esa ventana con los datos actualizados.
- [ ] El historial mantiene el acceso a cada envío previo y sus datos originales.
- [ ] El JSON sólo se usa como representación técnica y no como la única forma de edición.

## Consideraciones técnicas

- Se debe extender el modelo de `BillingRun` con una tabla de items relacionada:
  - `BillingRunItem`: `billingRunId`, `name`, `quantity`, `unit_cost`, `subtotal`, `description?`

- La ventana de edición puede ser una nueva UI dentro de `BillingScreen.tsx` o un modal independiente.
- El payload request JSON debe construirse a partir de los datos guardados en el registro, no al revés.
- El usuario debe poder cambiar la moneda de la factura en esa pantalla y definir el tipo de cambio a USD solo cuando la moneda seleccionada es EUR.
- Debe mantenerse compatibilidad con la generación automática de items actuales, pero el usuario debe poder redefinirlos.
- El flujo de reenvío debe actualizar `sentToClient` y opcionalmente `locked` cuando se confirme un envío final.
- El registro de historial debe seguir permitiendo visualizar PDF, nota y JSON en modo lectura.

## Notas

- Este spec es un punto de partida para trabajar el modelo de datos y la UX de edición de facturas.
- Una implementación futura debería clarificar si el reenvío crea una nueva entrada histórica o actualiza la existente y cómo se muestran ambas versiones.
