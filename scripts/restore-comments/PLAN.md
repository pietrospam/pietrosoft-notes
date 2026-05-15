# Plan: Script de Restauración de Comentarios

## Problema

Se perdieron comentarios de tareas en la base de datos. Se cuenta con archivos
`taskComments.json` provenientes de backups anteriores. El objetivo es restaurar
solo los comentarios faltantes sin duplicar los que ya existen.

## Uso esperado

```bash
npx tsx scripts/restore-comments/restore-comments.ts ./ruta/al/directorio
```

El script acepta un directorio como argumento. Dentro puede haber uno o varios
archivos `.json`, cada uno conteniendo un array de comentarios.

## Estructura de un comentario en el JSON

```json
{
  "id": "uuid",
  "taskId": "uuid-de-la-nota",
  "author": "nombre",
  "content": { "type": "doc", "content": [...] },
  "createdAt": "2026-01-15T10:30:00.000Z"
}
```

## Pasos del script

### 1. Leer archivos del directorio
- Listar todos los archivos `.json` en el directorio recibido como argumento
- Parsear cada archivo como un array de comentarios
- Si un archivo no es un array, reportarlo como inválido y saltar al siguiente

### 2. Deduplicar por `id`
- Juntar todos los comentarios de todos los archivos en una sola lista
- Si hay comentarios con el mismo `id` en distintos archivos, usar el primero
  encontrado y loguear un aviso

### 3. Para cada comentario, verificar y crear
Para cada comentario de la lista:

**a) ¿Ya existe en la BD?**
- Buscar por `id` en la tabla `task_comments`
- Si existe → contar como "ya existía", continuar con el siguiente

**b) ¿Existe la tarea referenciada?**
- Buscar `taskId` en la tabla `notes`
- Si NO existe → contar como "huérfano", loguear el id y el taskId, continuar

**c) Crear el comentario**
- Insertar con los campos: `id`, `taskId`, `author`, `content`, `createdAt`
- Preservar el `id` y `createdAt` originales del backup
- Si falla la inserción → loguear el error y continuar (no abortar el proceso)

### 4. Mostrar resumen al final

```
=== Resumen ===
Total en archivos:    45
Ya existían en BD:    30
Creados:              12
Huérfanos (sin tarea):  2
Errores de inserción:   1
```

Para los huérfanos y errores, mostrar el detalle completo (id, taskId, error).

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `PLAN.md` | Este archivo |
| `restore-comments.ts` | Script principal (a crear) |

## Dependencias

- `@prisma/client` — ya disponible en el proyecto
- `dotenv` — para cargar `DATABASE_URL` desde `.env` local
- `fs`, `path` — módulos nativos de Node.js

## Ejecución

Requiere que `DATABASE_URL` en `.env` apunte a la base de datos objetivo
(local o remota). Ver `.env.example` para referencia.

```bash
# Ejemplo apuntando a PROD remoto (cambiar DATABASE_URL en .env antes)
npx tsx scripts/restore-comments/restore-comments.ts ./mis-backups/
```
