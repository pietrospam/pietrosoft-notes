# REQ-026: Facturación

## Resumen

Implementar proceso de facturación basado en horas inputadas (estado "inputado") por Cliente Padre y período calendario (mes). Incluye pantalla de facturación, integración con API externa de generación de facturas (PDF), y almacenamiento histórico de requests y respuestas.

## Motivación

- Automatizar la generación de facturas a partir de la data de TimeSheet.
- Reducir el trabajo manual de consolidar horas y enviar a sistemas externos.
- Registrar trazabilidad de cada intento de facturación con JSON request + PDF.

## Alcance

1. Facturación mensual de un Cliente Padre.
2. Selección del método de facturación (configurable).
3. Envío de request a API externa y descarga/guardado de PDF.
4. CRUD de métodos de facturación (URL, autenticación, payload template y metadatos).
5. Gestión de documentos facturados: ver, editar, reenviar, eliminar.

## Definiciones

- `Inputado`: Estado de `TimeSheet` que indica horas listas para facturar.
- `Cliente Padre`: Cliente jerárquico usado como destinatario de facturación.
- `Método de Facturación`: Conexión externa con endpoint, auth y mapeo de datos.

## Requerimientos Funcionales

| ID | Descripción |
|----|-------------|
| RF-01 | Mostrar pantalla `Facturación` bajo módulo `TimeSheets/Billing`.
| RF-02 | Selector de Cliente Padre (lista de padres disponibles en TimeSheets).
| RF-03 | Selector de período (mes calendario: enero..diciembre y año).
| RF-04 | Selector de Método de Facturación (CRUD en configuración aparte).
| RF-05 | Botón `Facturar` que ejecuta proceso de facturación.
| RF-06 | API local POST `/api/billing/invoice` que recibe `{ clientId, year, month, methodId }`.
| RF-07 | Sumatoria de horas `inputado` del cliente padre con decisión de incluir subclientes (si aplica).
| RF-08 | Generar request JSON hacia API de método y recibir PDF en respuesta.
| RF-09 | Guardar en DB registrado: `billingRuns` con `requestJson`, `responseJson`, `pdfBlob`/ruta, `status`, `timestamps`.
| RF-10 | UI post-facturación muestra listado de ejecuciones y opciones: `editar request`, `reenviar`, `eliminar`.
| RF-11 | CRUD `BillingMethods` con campos `name`, `endpointUrl`, `authenticationType`, `authConfig`, `payloadTemplate`.
| RF-12 | Tipo de autenticación: `None`, `Bearer Token`, `Basic Auth`, `API Key Header`, `API Key Query`.

## Requerimientos No Funcionales

| ID | Descripción |
|----|-------------|
| RNF-01 | Autenticación segura para credenciales (encriptado en DB si es sensible).
| RNF-02 | Auditoría: guardar quién ejecutó la factura y cuándo.
| RNF-03 | Timeouts y retries configurables en llamadas externas (reintento 3 veces con backoff).
| RNF-04 | Manejo de errores visibles al usuario: `400`, `401`, `500` con mensaje claro.
| RNF-05 | PDF y JSON accesibles en UI y descargables.
| RNF-06 | Acceso solo a usuarios autorizados (rol admin/finanzas).

## Flujo de Facturación (UI)

1. Usuario ingresa a `TimeSheets -> Facturación`.
2. Selecciona `Cliente Padre`.
3. Selecciona `Mes/Año` (ej: Marzo 2026).
4. Selecciona `Método de Facturación`.
5. Visualiza resumen: horas a facturar, total monto estimado, cantidad de entries.
6. Clic en `Facturar`.
7. Solicitud al back-end.
8. Back-end crea payload con datos:
   - número de factura (secuencia alterna, configurable),
   - fecha actual,
   - cliente (from/to),
   - items (descripcion, cantidad h, precio unitario),
   - moneda, créditos, notas.
9. Back-end llama al método en `endpointUrl` con headers/auth.
10. Recibe respuesta y guarda `pdf` + `responseJson`.
11. UI muestra resultado y permite:
    - Ver PDF en visor embebido.
    - Descargar PDF.
    - Editar JSON request (y guardar override) para reenvío.
    - Reenviar factura con datos guardados.
    - Eliminar registro de ejecución.

## Ejemplo de Payload (Invoice Generator)

```json
{
  "number": "00000006",
  "date": "Feb 27, 2026",
  "header": "INVOICE",
  "from": "PABLO DANIEL PIETROPAOLO\n20-32010630-4\n\n Ing. Inform\u00e1tica\n\nArist\u00f3telo del valle 1092 \nCastelar (1712), Buenos Aires \nArgentina",
  "to": "Qualita Solutions & Consulting \n CIF: B-63.870.729 \n Av. de les Corts Catalanes, 9-11 Oficina 11 C - Edif. SC Trade III 08173 Sant Cugat del Valle`s",
  "currency": "EUR",
  "balance_title":"Amount to Pay",
  "items": [
      {
          "name": "Desarrollo de Software ERP",
          "quantity": 156.5,
          "unit_cost": 35
      }
  ],
  "notes_title":"Bank Information",
  "notes":"BANK: Banking Circle S.A.  \n IBAN: LU594080000045714584 \n BIC: BCIRLULL \n Address: 2, Boulevard de la Foire L-1528 LUXEMBOURG .\n Account holder: Pablo Daniel Pietropaolo "
}
```

## Criterios de Aceptación

- [ ] AC-01: Hay pantalla de Facturación con selección cliente padre, mes/año y método.
- [ ] AC-02: `Facturar` envía el request con las horas inputadas al proveedor.
- [ ] AC-03: Se guarda JSON request y PDF responsivo en DB/archivo.
- [ ] AC-04: Se puede editar y reenviar una ejecución grabada.
- [ ] AC-05: Se pueden gestionar métodos de facturación (CRUD).
- [ ] AC-06: Errores se muestran claramente y no derriban el sistema.

## Datos a diseñar en modelo

- `BillingMethod { id, name, endpointUrl, authType, authConfig, template, createAt, updateAt }`
- `BillingRun { id, clientParentId, year, month, methodId, userId, requestJson, responseJson, pdfPath, status, errorText, createdAt, updatedAt }`
- `BillingItem` (opcional: lineas desglosadas) ` { id, billingRunId, description, quantity, unitCost, subtotal } `
