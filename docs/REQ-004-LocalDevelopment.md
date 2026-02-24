# REQ-004: Configuración de Desarrollo Local

**Estado:** COMPLETADO  
**Prioridad:** Media  
**Fecha:** 2026-02-24

---

## 1. Resumen del Cambio

### 1.1 Situación Actual
- El desarrollo requiere hacer deploy completo al servidor Docker (192.168.100.113)
- Cada cambio implica: build → rsync → docker compose up
- No hay hot reload durante el desarrollo
- Debugging es más difícil

### 1.2 Nueva Visión
- Desarrollo local con Next.js usando `npm run dev`
- Base de datos PostgreSQL permanece en el servidor Docker remoto
- Hot reload habilitado para desarrollo ágil
- Deploy al servidor solo cuando se necesite probar en producción

---

## 2. Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────────────┐
│                    MÁQUINA LOCAL (desarrollo)                    │
├─────────────────────────────────────────────────────────────────┤
│  Next.js App (npm run dev)                                      │
│  - Puerto: 3000                                                 │
│  - Hot reload activo                                            │
│  - DATABASE_URL apunta al servidor remoto                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ TCP/5432
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              SERVIDOR DOCKER (192.168.100.113)                   │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL (Docker)                                            │
│  - Puerto expuesto: 5432                                        │
│  - Datos persistentes en volume                                 │
├─────────────────────────────────────────────────────────────────┤
│  Next.js App (Docker) - PRODUCCIÓN                              │
│  - Puerto: 3001                                                 │
│  - Activo para pruebas de producción                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Cambios Requeridos

### 3.1 docker-compose.yml
Exponer el puerto de PostgreSQL para acceso externo:

```yaml
postgres:
  image: postgres:16-alpine
  ports:
    - "5432:5432"   # <-- Agregar esta línea
  environment:
    - POSTGRES_USER=postgres
    - POSTGRES_PASSWORD=postgres
    - POSTGRES_DB=pietrosoft_notes
  ...
```

### 3.2 Archivo .env (actualizado)
El archivo `.env` ahora apunta a la base de datos remota para desarrollo local:

```bash
# Para desarrollo local - conecta a PostgreSQL en servidor Docker remoto
# Los contenedores Docker usan su propia DATABASE_URL en docker-compose.yml
DATABASE_URL="postgresql://postgres:postgres@192.168.100.113:5432/pietrosoft_notes"
```

**Nota:** Los contenedores Docker no se ven afectados porque docker-compose.yml define su propia `DATABASE_URL` que apunta a `postgres:5432` (nombre del servicio interno).

### 3.3 Actualizar .gitignore
No se requieren cambios adicionales.

---

## 4. Flujo de Trabajo

### 4.1 Desarrollo (día a día)
```bash
npm run dev          # Inicia servidor local con hot reload
                     # Conecta a PostgreSQL en servidor remoto
                     # Disponible en http://localhost:3000
```

### 4.2 Deploy a producción (cuando sea necesario)
```bash
npm run web          # Deploy completo al servidor Docker
                     # Disponible en http://192.168.100.113:3001
```

### 4.3 Migraciones de base de datos
```bash
# Local (genera migración)
npx prisma migrate dev

# O ejecutar en servidor
npm run web          # El script ya ejecuta migrate deploy
```

---

## 4.5 Sincronización de Adjuntos (Bidireccional)

Los **archivos adjuntos** se almacenan en el sistema de archivos, NO en la base de datos. Por lo tanto, es necesario sincronizarlos entre local y servidor.

### Comportamiento automático
El comando `npm run dev` **sincroniza automáticamente** los adjuntos en ambas direcciones antes de iniciar:

```bash
npm run dev          # Sincroniza adjuntos + inicia servidor
```

### Sincronización manual
```bash
npm run sync         # Solo sincronizar adjuntos (sin iniciar servidor)
```

### Sin sincronización
```bash
npm run dev:nosync   # Iniciar servidor sin sincronizar
```

### Script de sincronización
El script `scripts/sync-attachments.sh` usa rsync para:
1. Descargar archivos nuevos del servidor → local
2. Subir archivos nuevos de local → servidor

```
LOCAL                          SERVIDOR
./data/attachments/    <--->   /home/pietro/web/pietrosoft-notes/data/attachments/
```

**Nota:** Se usa `rsync --update` que solo copia archivos más nuevos.

---

## 5. Consideraciones de Seguridad

### 5.1 Exposición del puerto PostgreSQL
- El puerto 5432 estará expuesto en la red local
- Solo usar en redes de confianza (LAN)
- NO exponer en servidores públicos

### 5.2 Credenciales
- Las credenciales de desarrollo están hardcodeadas (postgres/postgres)
- Aceptable para desarrollo local
- En producción usar secrets/variables de entorno seguras

---

## 6. Criterios de Aceptación

- [x] Puerto 5432 de PostgreSQL accesible desde máquina local
- [x] Archivo `.env` actualizado con configuración de desarrollo (DB remota)
- [x] `npm run dev` funciona conectando a DB remota
- [x] Hot reload funciona correctamente
- [x] `npm run web` sigue funcionando para deploys de producción
- [x] Sincronización bidireccional de adjuntos en `npm run dev`
- [ ] Documentación actualizada en README

---

## 7. Scripts Disponibles (post-implementación)

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | **Sincroniza adjuntos** + desarrollo local con hot reload (DB remota) |
| `npm run dev:nosync` | Desarrollo local sin sincronizar adjuntos |
| `npm run sync` | Solo sincronizar adjuntos (bidireccional) |
| `npm run build` | Build de producción |
| `npm run web` | Deploy completo a servidor Docker |
| `npm run start` | Inicia app en modo producción (local) |

---

## 8. Notas Adicionales

- El servidor Docker sigue corriendo la versión de producción en puerto 3001
- Ambos entornos (local y Docker) comparten la misma base de datos
- Cuidado con migraciones: aplicar primero en desarrollo, luego deploy
