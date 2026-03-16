# REQ-024: Ingesta de Notas por Correo Electrónico

## Resumen

Implementar un endpoint `POST /api/mail` que recibe correos reenviados por un smtp-forwarder externo y los convierte automáticamente en notas dentro del sistema.

## Motivación

Permite crear notas desde cualquier cliente de correo electrónico, reenviando o enviando un correo a una dirección configurada. Sin necesidad de abrir la app, un correo llega y queda registrado como nota con su contenido y anexos.

## Arquitectura

```
┌────────────────┐   HTTP POST JSON   ┌─────────────────────┐   createNote()   ┌──────────────┐
│ smtp-forwarder │ ─────────────────► │  POST /api/mail     │ ───────────────► │  PostgreSQL  │
│  (externo)     │                    │  (Next.js API route) │                  │   (Prisma)   │
└────────────────┘                    └──────────┬──────────┘                  └──────────────┘
                                                 │  saveAttachment()
                                                 └────────────────► tabla Attachment (BLOB)
```

## Requerimientos Funcionales

| ID | Descripción |
|----|-------------|
| RF-01 | Endpoint `POST /api/mail` que acepta el payload JSON del smtp-forwarder |
| RF-02 | Crear una nota o tarea según las reglas de categorización del inbox (ver sección **Parsing del inbox**) |
| RF-03 | Convertir el cuerpo HTML del correo a TipTap JSON usando un parser interno |
| RF-04 | Si no hay HTML disponible, convertir el texto plano como fallback (un párrafo por línea) |
| RF-05 | Guardar los adjuntos del correo en la tabla `Attachment` (blob en base64) |
| RF-06 | Rechazar correos marcados como spam (`meta.spam_flag === true`) con HTTP 200 (sin reintentos) |
| RF-07 | Validar autenticación via `Authorization: Bearer <token>` usando env var `MAIL_API_TOKEN` |
| RF-08 | Si `MAIL_API_TOKEN` no está configurado, el endpoint funciona sin autenticación (modo abierto) |
| RF-09 | Retornar `201` con `{ noteId, title, attachmentsSaved }` en caso de éxito |
| RF-10 | Los errores de guardado de adjuntos individuales son no-fatales (se loguean, no interrumpen) |
| RF-11 | Antes de crear, buscar en el asunto del correo un código de ticket existente (ver sección **Detección de tarea existente**); si se encuentra, agregar un comentario de sistema en lugar de crear una nota nueva |
| RF-12 | El cliente inferido del inbox se resuelve por nombre (case-insensitive) contra los clientes existentes; si no existe se crea la nota/tarea sin cliente asociado |

## Requerimientos No Funcionales

| ID | Descripción |
|----|-------------|
| RNF-01 | El endpoint debe responder en menos de 10 segundos |
| RNF-02 | Errores `4xx` → el forwarder descarta el correo silenciosamente |
| RNF-03 | Errores `5xx` o timeout → el forwarder reintenta (hasta `API_RETRY_COUNT` veces, default 3) |
| RNF-04 | Tamaño máximo del payload: `10mb` (configurar en Next.js si es necesario) |

## Payload de entrada

El smtp-forwarder envía un JSON con la siguiente estructura:

```json
{
  "envelope": {
    "sender":    "remitente@ejemplo.com",
    "recipient": "notas@bitacora.ddnsfree.com",
    "mailbox":   "notas"
  },
  "headers": {
    "from":       "Nombre <remitente@ejemplo.com>",
    "subject":    "Asunto del correo",
    "date":       "Sat, 14 Mar 2026 19:37:21 +0000",
    "message_id": "<CAL...@mail.gmail.com>"
  },
  "meta": {
    "spam_flag":   false,
    "spam_score":  -0.2,
    "received_at": "2026-03-14T19:37:28Z"
  },
  "body": {
    "text_plain": "Contenido en texto plano...",
    "text_html":  "<html>...</html>"
  },
  "attachments": [
    {
      "filename":       "archivo.pdf",
      "content_type":   "application/pdf",
      "size_bytes":     24310,
      "content_base64": "JVBERi0xLjQK..."
    }
  ]
}
```

## Parsing del inbox (RF-02, RF-12)

La dirección del campo `envelope.recipient` codifica el **tipo de nota** y el **cliente** a asociar.
Se parsea la parte local del email (todo lo que está antes del `@`).

### Formato

```
<tipo>.<cliente>@dominio
```

O sin especificar tipo:

```
<cliente>@dominio
```

### Reglas de parsing

| Parte local | Tipo resultante | Cliente |
|-------------|-----------------|---------|
| `tasks.veolia` | `task` | `veolia` |
| `notes.veolia` | `general` (nota) | `veolia` |
| `veolia` *(un solo segmento)* | `general` (nota, default) | `veolia` |
| `tasks` *(un solo segmento igual a tipo)* | `task` | *(sin cliente)* |
| `notes` *(un solo segmento igual a tipo)* | `general` (nota) | *(sin cliente)* |

- Los segmentos son **case-insensitive** (`TASKS.Veolia` = `tasks.veolia`).
- Solo se reconocen dos tipos: `tasks` y `notes`. Cualquier otro valor no reconocido como tipo se trata como nombre de cliente.
- Si el nombre de cliente inferido no coincide con ningún cliente existente (comparación case-insensitive por nombre), la nota/tarea se crea **sin cliente**.
- Si la parte local contiene más de 2 segmentos (ej. `tasks.veolia.extra`) se toma el primero como tipo y el segundo como cliente; el resto se ignora.

### Ejemplos

| Dirección de inbox | Tipo | Cliente resuelto |
|--------------------|------|-----------------|
| `tasks.veolia@bitacora.local` | task | cliente cuyo nombre es "veolia" |
| `notes.acme@bitacora.local` | general | cliente cuyo nombre es "acme" |
| `veolia@bitacora.local` | general | cliente cuyo nombre es "veolia" |
| `tareas@bitacora.local` | general | sin cliente (no se reconoce como tipo ni como cliente existente según datos reales) |
| `tasks@bitacora.local` | task | sin cliente |

---

## Detección de tarea existente por asunto (RF-11)

Antes de crear un registro nuevo, se inspecciona el asunto del correo (`headers.subject`) con la misma lógica de parsing que usa la app al crear tareas: búsqueda de `#` seguido de exactamente **5 dígitos** (`#\d{5}`).

### Flujo de decisión

```
subject contiene #XXXXX?
│
├── SÍ → buscar tarea cuyo ticketPhaseCode termina con / es igual a XXXXX
│         │
│         ├── ENCONTRADA → agregar comentario de sistema (UPDATE FLOW)
│         │     - Autor: "mail-ingest"
│         │     - Contenido: body del correo convertido a TipTap JSON
│         │     - Adjuntos: vinculados a la tarea encontrada
│         │     - Respuesta: 201 { taskId, commentId, attachmentsSaved }
│         │
│         └── NO ENCONTRADA → continuar al CREATE FLOW (con tipo/cliente del inbox)
│
└── NO → continuar al CREATE FLOW (con tipo/cliente del inbox)

CREATE FLOW → crear nota o tarea según parsing del inbox (RF-02 / RF-12)
```

### Regla de matching del ticket

- Se extrae el primer match de `#\d{5}` en el asunto (ej. `Re: Bug fix #00123 - revisión` → `00123`).
- Se compara contra el campo `taskTicketPhaseCode` de las tareas activas (no archivadas).
- La comparación es exacta sobre los 5 dígitos (el campo puede tener un prefijo, ej. `TASK-00123`; en ese caso se busca si el campo **termina en** esos 5 dígitos o si el campo **contiene** esos 5 dígitos).
- Si hay más de un match (poco probable), se toma el primero.

### Comentario de sistema generado (UPDATE FLOW)

El comentario se crea en la tabla `TaskComment` con:

| Campo | Valor |
|-------|-------|
| `taskId` | ID de la tarea encontrada |
| `author` | `"mail-ingest"` |
| `content` | TipTap JSON del body del correo (misma conversión que RF-03/RF-04) |
| `createdAt` | timestamp del servidor |

Los adjuntos se guardan en la tabla `Attachment` vinculados a la tarea encontrada (no a la nota creadora, ya que no se crea nota nueva).

---

## Conversión HTML → TipTap JSON / HTML raw (RF-03)

El forwarder puede enviar el cuerpo del correo en HTML. Para que la vista en la app sea lo más fiel posible al correo original:

- Si `body.text_html` está presente, se **guarda el HTML tal cual** dentro de `contentJson` como un nodo `type: 'html'`.
- En el UI se renderiza ese HTML con `dangerouslySetInnerHTML` mediante **DOMPurify** (para evitar XSS).
- Si no hay HTML, se hace la conversión a TipTap JSON (igual que antes) para que se pueda editar con el editor.

Esto permite que los correos se vean casi idénticos a como se ven en Gmail, mientras que mantenemos la conversión a TipTap cuando no hay HTML disponible.

### Cuando no hay HTML (fallback)

Si `body.text_html` está vacío o no existe, se aplica la conversión normal a TipTap JSON usando `plainTextToTipTap`.

| HTML | TipTap node |
|------|-------------|
| `<p>` | `paragraph` |
| `<h1>` – `<h6>` | `heading` (level 1–6) |
| `<ul>` / `<li>` | `bulletList` / `listItem` |
| `<ol>` / `<li>` | `orderedList` / `listItem` |
| `<blockquote>` | `blockquote` |
| `<br>` | `hardBreak` |
| `<strong>`, `<b>` | mark `bold` |
| `<em>`, `<i>` | mark `italic` |
| `<u>` | mark `underline` |
| `<s>`, `<del>`, `<strike>` | mark `strike` |
| `<a href="...">` | mark `link` |
| `<code>` (inline) | mark `code` |
| `<pre>` / `<code>` | `codeBlock` |
| `<hr>` | `horizontalRule` |
| texto puro | nodo `text` |

### Estrategia de contenido vacío / degradación
1. Si `body.text_html` está disponible → usar conversor HTML→TipTap
2. Si solo hay `body.text_plain` → usar conversor de texto plano (párrafo por línea)
3. Si ambos están vacíos → crear nota con título solamente

### Notas del parser
- Ignorar tags `<html>`, `<head>`, `<meta>`, `<style>`, `<script>` — procesar solo el `<body>`
- Ignorar nodos de texto que sean solo whitespace
- Nodes vacíos (sin hijos con contenido) se omiten

## Respuestas del endpoint

| Código | Situación |
|--------|-----------|
| `201` | Nota/tarea creada correctamente, o comentario de sistema agregado a tarea existente |
| `200` | Correo rechazado por spam (`status: "rejected"`) |
| `400` | Payload inválido o campos requeridos faltantes |
| `401` | Token inválido o ausente (cuando `MAIL_API_TOKEN` está configurado) |
| `500` | Error interno al guardar la nota |

## Configuración

Variables de entorno relevantes en el servidor:

| Variable | Default | Descripción |
|----------|---------|-------------|
| `MAIL_API_TOKEN` | *(vacío)* | Token Bearer para autenticar al forwarder. Si no se configura, el endpoint es abierto |

Variables en el smtp-forwarder (`.env` externo):

| Variable | Default | Descripción |
|----------|---------|-------------|
| `API_URL` | — | URL del endpoint (ej: `http://192.168.100.113:3001/api/mail`) |
| `API_TOKEN` | — | Token Bearer (debe coincidir con `MAIL_API_TOKEN`) |
| `API_TIMEOUT` | `10` | Timeout por intento en segundos |
| `API_RETRY_COUNT` | `3` | Reintentos ante error `5xx` o timeout |
| `API_RETRY_DELAY` | `5` | Segundos entre reintentos |

## Implementación

- **Archivo:** `src/app/api/mail/route.ts`
- **Dependencia:** `node-html-parser` (server-side only, sin impacto en bundle del cliente)
- **Función auxiliar:** `htmlToTipTap(html: string): object` — conversor HTML→TipTap JSON
- **Función auxiliar:** `plainTextToTipTap(text: string): object` — fallback texto plano
- **Función auxiliar:** `parseInboxAddress(recipient: string): { type: 'task' | 'general'; clientName: string | null }` — parsea la parte local del email destinatario
- **Función auxiliar:** `resolveClientByName(name: string): Promise<string | null>` — busca un cliente por nombre (case-insensitive), retorna su `id` o `null`
- **Función auxiliar:** `extractTicketCode(subject: string): string | null` — extrae los 5 dígitos del primer `#XXXXX` encontrado en el asunto
- **Función auxiliar:** `findTaskByTicketCode(code: string): Promise<TaskNote | null>` — busca tarea activa cuyo `ticketPhaseCode` contiene los 5 dígitos

## Criterios de aceptación

- [ ] **AC1:** Correos con spam_flag=true devuelven HTTP 200 y no crean nota
- [ ] **AC2:** Sin `MAIL_API_TOKEN`, el endpoint acepta cualquier request; con token configurado, rechaza con 401 si no coincide
- [ ] **AC3:** `tasks.clientX@...` crea una **tarea** asociada al cliente cuyo nombre es "clientX"
- [ ] **AC4:** `notes.clientX@...` crea una **nota general** asociada al cliente cuyo nombre es "clientX"
- [ ] **AC5:** `clientX@...` (un segmento) crea una **nota general** asociada al cliente "clientX"
- [ ] **AC6:** Si el nombre de cliente del inbox no existe, la nota/tarea se crea sin cliente
- [ ] **AC7:** Si el asunto contiene `#XXXXX` y existe una tarea con ese código de ticket, se crea un comentario de sistema y **no** se crea nota nueva
- [ ] **AC8:** El comentario de sistema creado tiene `author = "mail-ingest"` y el cuerpo del correo como contenido (HTML o TipTap según disponibilidad)
- [ ] **AC9:** El body de la nota/tarea usa HTML original si existe (`body.text_html`), renderizado con sanitización
- [ ] **AC10:** Los adjuntos se vinculan correctamente tanto en el flujo de creación como en el flujo de actualización
- [ ] **AC11:** Si el asunto contiene `#XXXXX` pero no existe tarea con ese código, se continúa el flujo de creación normal

## Estado

**Pendiente de implementación**
