# REQ-022: Endpoint Centralizado de Automatizaciones

## Resumen

Crear un endpoint único `/api/automations` que centralice la ejecución de todas las tareas automáticas del sistema. Un contenedor de cron ejecutará este endpoint cada minuto, y el endpoint se encargará internamente de llamar a las APIs correspondientes.

## Motivación

1. **Simplicidad**: Un único punto de entrada para todas las automatizaciones
2. **Mantenibilidad**: Agregar nuevas automatizaciones no requiere modificar el cron
3. **Visibilidad**: Un solo lugar para ver el estado de todas las automatizaciones
4. **Flexibilidad**: Cada automatización interna decide si debe ejecutarse según su propia lógica

## Arquitectura

```
┌─────────────────┐     cada 1 min      ┌─────────────────────┐
│  Cron Container │ ─────────────────► │ POST /api/automations│
└─────────────────┘                     └──────────┬──────────┘
                                                   │
                                    ┌──────────────┼──────────────┐
                                    ▼              ▼              ▼
                           ┌────────────┐  ┌────────────┐  ┌────────────┐
                           │ /backups/  │  │ /todos/    │  │ (futuras)  │
                           │   auto     │  │  notify    │  │            │
                           └────────────┘  └────────────┘  └────────────┘
```

## Requerimientos Funcionales

| ID | Descripción |
|----|-------------|
| RF-01 | Endpoint `POST /api/automations` que ejecuta todas las automatizaciones |
| RF-02 | Llamar internamente a `/api/backups/auto` para backups automáticos |
| RF-03 | Llamar internamente a `/api/todos/notify` para notificaciones de TODOs |
| RF-04 | Retornar resumen con el resultado de cada automatización |
| RF-05 | Contenedor de cron que ejecute el endpoint cada 1 minuto |
| RF-06 | Las automatizaciones se ejecutan en paralelo para mayor eficiencia |

## Requerimientos No Funcionales

| ID | Descripción |
|----|-------------|
| RNF-01 | Timeout máximo de 30 segundos por automatización individual |
| RNF-02 | El endpoint debe ser idempotente (seguro de llamar múltiples veces) |
| RNF-03 | Logging mínimo para no saturar logs |

## Endpoint

### POST /api/automations

Ejecuta todas las automatizaciones registradas.

**Response:**
```json
{
  "timestamp": "2026-03-12T10:00:00.000Z",
  "results": {
    "backups": {
      "success": true,
      "skipped": true,
      "reason": "Not time for backup"
    },
    "todoNotifications": {
      "success": true,
      "dailySummary": false,
      "reminders": [],
      "overdueNotifications": []
    }
  }
}
```

## Docker Compose

```yaml
# Cron container for automations
automations-cron:
  image: alpine:latest
  command: >
    sh -c "apk add --no-cache curl &&
           echo '* * * * * curl -s -X POST http://app:3000/api/automations' | crontab - &&
           crond -f -l 2"
  depends_on:
    - app
  restart: unless-stopped
```

## Automatizaciones Incluidas

| Automatización | Endpoint Interno | Frecuencia Real |
|----------------|------------------|-----------------|
| Backups | `/api/backups/auto` | Según configuración (daily/weekly/monthly) |
| TODO Notifications | `/api/todos/notify` | Cada minuto (si hay TODOs pendientes) |

## Consideraciones

1. **Llamadas internas**: El endpoint no hace HTTP requests a sí mismo, importa directamente las funciones de los handlers para evitar overhead de red.

2. **Frontend polling**: El frontend ya hace polling de `/api/todos/notify`. El cron sirve como backup para cuando no hay navegadores abiertos.

3. **Extensibilidad**: Para agregar nuevas automatizaciones, solo hay que:
   - Crear el endpoint específico (ej: `/api/reports/auto`)
   - Agregarlo al array de automatizaciones en `/api/automations`

## Criterios de Aceptación

- [ ] AC-01: `POST /api/automations` ejecuta backups y notificaciones de TODOs
- [ ] AC-02: Contenedor de cron ejecuta el endpoint cada minuto
- [ ] AC-03: Response incluye resultados de cada automatización
- [ ] AC-04: Sistema funciona sin navegador abierto
- [ ] AC-05: Los servicios arrancan correctamente con `docker compose up`
