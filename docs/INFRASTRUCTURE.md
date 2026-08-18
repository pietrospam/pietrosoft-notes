# Infraestructura de Pietrosoft Notes

## Resumen general

La aplicación se despliega como un servicio Docker Compose en dos servidores distintos:

- **Producción:** `192.168.100.113` (URL pública: `bitacora.pietrosoft.ddnsfree.com`)
- **Pruebas / test:** `192.168.100.114` (URL pública: `test.bitacora.pietrosoft.ddnsfree.com`)

La aplicación usa PostgreSQL como base de datos y está diseñada para ejecutarse con contenedores Docker.

## Comandos principales

### Producción

```bash
npm run web
# o equivalentes:
npm run prod
npm run PROD
```

Esto ejecuta `scripts/redeploy.sh` con `DEPLOY_HOST=root@192.168.100.113`.

### Test

```bash
npm run test
npm run TEST
```

Esto ejecuta `scripts/redeploy.sh` con `DEPLOY_HOST=root@192.168.100.114`.

### Desarrollo local

```bash
npm run dev
```

Para desarrollo local se usa el servidor de Next.js. El entorno local debe configurarse con un archivo `.env.local` y, si es necesario, puede apuntar a la base de datos de pruebas o a un PostgreSQL local.

## Flujo de despliegue

El script `scripts/redeploy.sh` realiza los siguientes pasos:

1. Validación de entorno y confirmación adicional cuando el destino es producción (`192.168.100.113`).
2. Establece una sesión SSH reusable usando ControlMaster y ControlPersist.
3. Limpia recursos Docker remotos (`docker system prune` y `docker builder prune`).
4. Sincroniza el proyecto al servidor remoto con `rsync`, excluyendo `node_modules`, `.next`, `.git`, `data/attachments/*` y archivos de log.
5. Reinicia los contenedores remotos con `docker compose down`, `docker compose build --no-cache` y `docker compose up -d`.
6. Muestra logs recientes de la app y el estado de los contenedores.

## Servidores y rutas

- Ruta remota del proyecto en el servidor: `/opt/pietrosoft-notes`
- URL de la aplicación: `http://192.168.100.113:3001` para producción
- URL de la aplicación: `http://192.168.100.114:3001` para test

## Arquitectura Docker Compose

El `docker-compose.yml` define los siguientes servicios:

- `app`
  - Construye la aplicación desde `Dockerfile`
  - Expone `3001:3000`
  - Monta `./data` y un directorio persistente de backups del host
  - Usa variables de entorno:
    - `DATABASE_URL=postgresql://postgres:postgres@postgres:5432/pietrosoft_notes`
    - `WORKSPACE_PATH=/data`
    - `BACKUP_DIR=/backups`
    - `BACKUP_HOST_DIR=/opt/bitacora-backups` en servidor
    - `NODE_ENV=production`
- `postgres`
  - Imagen `postgres:16-alpine`
  - Expone `5432:5432`
  - Usa `POSTGRES_USER=postgres`, `POSTGRES_PASSWORD=postgres`, `POSTGRES_DB=pietrosoft_notes`
  - Volumen persistente `postgres_data`
- `adminer`
  - Imagen `adminer:latest`
  - Expone `8080:8080`
  - Adminer se conecta al servicio `postgres`
- `automations-cron`
  - Contenedor Alpine opcional que ejecuta llamadas periódicas a la API de automations.

## Credenciales de la base de datos

Para acceder a PostgreSQL desde Adminer en los servidores:

- System: `PostgreSQL`
- Server: `postgres`
- Username: `postgres`
- Password: `postgres`
- Database: `pietrosoft_notes`

## Manejo de variables de entorno

- El repositorio actual no debe versionar `.env`.
- Se recomienda usar `.env.local` para configuración de desarrollo local.
- Existe un archivo de ejemplo (`.env.example`) para copiar valores de plantilla.

## Backup y restauración

La aplicación tiene endpoints para exportar backups y restaurarlos.

- Backups se almacenan en `/opt/bitacora-backups` en el host del servidor y se montan dentro del contenedor como `/backups`.
- El proceso de restore debe incluir la tabla `taskComments` junto con el resto de la base de datos.

## Observaciones importantes

- La diferencia entre `npm run web` y `npm run test` es la IP objetivo de despliegue.
- `npm run dev` es para desarrollo local y no dispara el despliegue Docker remoto.
- `scripts/redeploy.sh` pide confirmación doble en producción para evitar despliegues accidentales.
- La app remota corre en el puerto `3001` exterior y dentro del contenedor en `3000`.

## Referencias

- Script de despliegue: `scripts/redeploy.sh`
- Archivo Docker Compose: `docker-compose.yml`
- README principal: `README.md`
