# REQ-011: Import/Export Mejorado

**Estado:** PENDIENTE  
**Prioridad:** Alta  
**Fecha:** 2026-02-26

Este requerimiento surge de la observación de que la funcionalidad actual de
backup/restore sólo actúa sobre el contenido del directorio `data` y *no*
exporta ni importa nada de la base de datos. Con la migración de anexos a la
tabla `attachments` el archivo ZIP generado e importado deja las tablas vacías
y sólo conserva los archivos en disco, por lo que la restauración falla,
devolviendo "0 notes, 0 clients, 0 projects...".

### Objetivo
Rehacer completamente la exportación e importación para que cubran todos los
datos de la aplicación, incluyendo las tablas de la base de datos (clientes,
proyectos, notas, timesheets, anexos, activity logs, etc.) además de los
archivos físicos.

### Requisitos detallados

1. **Exportación**
   - Generar un ZIP que contenga:
     * Una carpeta `data/` con los archivos actuales (como hoy).
     * Un archivo JSON/NDJSON por cada tabla relevante (`clients.json`,
       `projects.json`, `notes.json`, `attachments.json`, `task_activity_logs.json`,
       etc.).
     * En `attachments.json` cada registro deberá incluir los datos BLOB codificados en
       base64.
   - El formato debe ser lo suficientemente sencillo para poder importarlo
en otros entornos o con herramientas de línea de comandos.

2. **Importación**
   - Al recibir el ZIP:
     * Verificar que contiene los JSON de tablas esperadas y/o la carpeta `data`.
     * Descomprimir en un directorio temporal para inspección.
   - Antes de insertar datos, vaciar las tablas actuales (o recrear la base de
     datos) para evitar duplicados o inconsistencias.
   - Insertar los registros en el siguiente orden de dependencia:
     `clients` → `projects` → `notes` → `notes` (timesheets) → `attachments` →
     `task_activity_logs`.
   - Los blobs base64 de `attachments` se decodifican y guardan en la columna
     correspondiente.
   - Finalmente, sobrescribir la carpeta `DATA_DIR` con el contenido del ZIP.
   - Reportar en la respuesta cuántos registros de cada tipo fueron importados.

3. **API/UI**
   - Mantener las rutas existentes `/api/workspace/export` y
     `/api/workspace/import`, extendiendo su comportamiento según lo descrito.
   - La pestaña "Backup" en la configuración debe documentar claramente el
     alcance (base de datos + ficheros) y advertir sobre la sustitución total
en la importación.

4. **Seguridad y comportamiento**
   - Requiere confirmación del usuario antes de ejecutar la importación.
   - La operación tendrá `dynamic = 'force-dynamic'` como ahora para evitar
     cacheo estático.
   - Debe dejar una copia de seguridad previa (como el código actual renombraba
     `data`); opcionalmente, también volcados temporales de la base de datos.

5. **Compatibilidad**
   - La exportación debe ser retrocompatible con el formato antiguo siempre que
     sea posible: si no hay archivos JSON, el sistema seguirá exportando la
     carpeta `data` y la importación migrará sólo los archivos del directorio.

6. **Documentación y pruebas**
   - Actualizar documentación (README, docs/REQ-011-ImportExportReview.md).
   - Añadir pruebas (unitarias o e2e) que simulen la exportación e importación
     de datos con anexos, y verifiquen que después de restaurar se recupera el
     mismo estado.

Este requerimiento quedará como REQ‑011 y podrá implementarse tras finalizar
los cambios relacionados con la navegación, actividad y jerarquía de clientes.