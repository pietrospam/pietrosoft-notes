# REQ-007: Attachments en Base de Datos

## Descripción
Migrar el almacenamiento de archivos adjuntos (attachments) desde el filesystem local hacia la base de datos PostgreSQL usando campos `bytea` (BLOB).

## Motivación
- **Backup unificado**: Todo en un solo `pg_dump`
- **Portabilidad Docker**: No requiere volúmenes separados para archivos
- **Transaccionalidad**: Nota + attachments en una sola transacción
- **Migración simplificada**: Sin sincronización de carpetas

## Consideraciones Técnicas

### PostgreSQL bytea
- PostgreSQL soporta hasta 1GB por campo `bytea`
- Usa TOAST automáticamente para comprimir datos >2KB
- Performance aceptable para archivos <5MB (típico para screenshots/imágenes)

### Límites
- Tamaño máximo por archivo: 10MB (configurable)
- Tipos permitidos: imágenes, PDFs, documentos comunes

## Modelo de Datos

### Nueva tabla `attachments`
```sql
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size INTEGER NOT NULL,
  data BYTEA NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_attachments_note_id ON attachments(note_id);
```

### Cambios en `notes`
- Eliminar campo `attachments Json?` (metadata se mueve a tabla)

## API Endpoints

### POST /api/attachments
- Recibe `multipart/form-data` con `file` y `noteId`
- Guarda el archivo en tabla `attachments`
- Retorna metadata del attachment

### GET /api/attachments/[id]
- Retorna el archivo binario con headers correctos
- `Content-Type`: según mime_type
- `Content-Disposition`: inline para imágenes, attachment para otros

### DELETE /api/attachments/[id]
- Elimina el attachment de la DB

## Migración de Datos Existentes

Script para migrar archivos de `data/attachments/` a la DB:
1. Leer todos los archivos en la carpeta
2. Buscar notas que referencien cada archivo
3. Insertar en tabla `attachments`
4. Actualizar referencias en notas

## UI
Sin cambios en UI - el editor ya soporta drag & drop y clipboard.

## Implementación

### Fases
1. ✅ Crear modelo Prisma `Attachment`
2. ✅ Migración SQL
3. ✅ Actualizar API routes
4. ✅ Script de migración de datos
5. ✅ Remover campo `attachments` de `Note` (opcional, en fase posterior)

## Fecha
2026-02-24
