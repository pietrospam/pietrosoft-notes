# API de recepción de correos — Especificación

El forwarder SMTP envía cada correo entrante a esta API via **HTTP POST** con un payload JSON.

---

## Endpoint

```
POST {API_URL}
```

El valor de `API_URL` se configura en el `.env` del smtp-forwarder.  
Ejemplo: `http://192.168.1.10:8080/api/mail`

---

## Headers de la request

| Header | Valor | Obligatorio |
|--------|-------|-------------|
| `Content-Type` | `application/json` | Sí |
| `X-Forwarder-Version` | `1.0` | Sí |
| `Authorization` | `Bearer {API_TOKEN}` | Solo si `API_TOKEN` está configurado |
| `X-Message-ID` | valor del header `Message-ID` del correo | No |

---

## Body — Payload JSON

```json
{
  "envelope": {
    "sender":    "remitente@ejemplo.com",
    "recipient": "destino@bitacora.ddnsfree.com",
    "mailbox":   "destino"
  },
  "headers": {
    "from":       "Nombre Remitente <remitente@ejemplo.com>",
    "to":         "destino@bitacora.ddnsfree.com",
    "cc":         null,
    "subject":    "Asunto del correo",
    "date":       "Sat, 14 Mar 2026 19:37:21 +0000",
    "message_id": "<CAL58q6K...@mail.gmail.com>",
    "reply_to":   null
  },
  "meta": {
    "client_ip":   "74.125.224.44",
    "spam_score":  -0.2,
    "spam_flag":   false,
    "spam_status": "No, score=-0.2 required=5.0",
    "received_at": "2026-03-14T19:37:28Z"
  },
  "body": {
    "text_plain": "Contenido en texto plano...",
    "text_html":  "<html>...</html>",
    "raw_base64": "UmVjZWl2ZWQ6IGZyb20..."
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

### Descripción de campos

#### `envelope`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `sender` | string | Dirección SMTP del remitente (MAIL FROM) |
| `recipient` | string | Dirección SMTP completa del destinatario (RCPT TO) |
| `mailbox` | string | Parte local del destinatario (antes del `@`). Ejemplo: si el correo es a `ventas@bitacora.ddnsfree.com`, el valor es `ventas`. Usarlo para enrutar el correo a distintos destinos según el buzón. |

#### `headers`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `from` | string \| null | Header `From` del correo, decodificado (MIME) |
| `to` | string \| null | Header `To` del correo |
| `cc` | string \| null | Header `Cc`, o `null` si no existe |
| `subject` | string \| null | Asunto, decodificado |
| `date` | string \| null | Fecha según el correo original |
| `message_id` | string \| null | Header `Message-ID` |
| `reply_to` | string \| null | Header `Reply-To`, o `null` si no existe |

#### `meta`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `client_ip` | string \| null | IP del servidor que entregó el correo a Postfix |
| `spam_score` | number \| null | Puntuación de SpamAssassin (positivo = más spam) |
| `spam_flag` | boolean | `true` si SpamAssassin considera el correo spam (score ≥ threshold) |
| `spam_status` | string \| null | Resumen textual de SpamAssassin |
| `received_at` | string | Timestamp ISO 8601 UTC del momento de recepción |

#### `body`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `text_plain` | string \| null | Cuerpo en texto plano (extraído del MIME) |
| `text_html` | string \| null | Cuerpo en HTML (extraído del MIME) |
| `raw_base64` | string | Correo completo en formato RFC 822, codificado en Base64. Incluye headers de SpamAssassin. |

#### `attachments`
Array de objetos, vacío `[]` si no hay adjuntos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `filename` | string | Nombre del archivo adjunto |
| `content_type` | string | MIME type (ej: `application/pdf`, `image/png`) |
| `size_bytes` | number | Tamaño en bytes del archivo |
| `content_base64` | string | Contenido del archivo codificado en Base64 |

---

## Respuestas esperadas

| Código HTTP | Comportamiento del forwarder |
|-------------|------------------------------|
| `2xx` (200, 201, 204) | ✅ Éxito — correo marcado como entregado |
| `4xx` (400, 401, 403, etc.) | ⚠️ Error permanente — correo **descartado silenciosamente** (no hay reintentos, no hay bounce al remitente) |
| `5xx` o timeout o error de red | 🔄 Error temporal — el forwarder reintenta hasta `API_RETRY_COUNT` veces (default: 3). Si todos fallan, el correo se **guarda en Mailpit** como fallback |

---

## Variables de configuración relacionadas

Estas variables se configuran en el `.env` del smtp-forwarder:

| Variable | Default | Descripción |
|----------|---------|-------------|
| `API_URL` | — | URL completa del endpoint (obligatoria) |
| `API_TOKEN` | — | Token Bearer para el header `Authorization` (opcional) |
| `API_TIMEOUT` | `10` | Timeout por intento en segundos |
| `API_RETRY_COUNT` | `3` | Cantidad de reintentos ante error temporal |
| `API_RETRY_DELAY` | `5` | Segundos de espera entre reintentos |

---

## Ejemplo mínimo de implementación (Python/Flask)

```python
from flask import Flask, request, jsonify
import base64

app = Flask(__name__)

@app.route("/api/mail", methods=["POST"])
def receive_mail():
    data = request.get_json()

    sender    = data["envelope"]["sender"]
    recipient = data["envelope"]["recipient"]
    subject   = data["headers"]["subject"]
    body      = data["body"]["text_plain"] or ""
    spam_flag = data["meta"]["spam_flag"]

    if spam_flag:
        return jsonify({"status": "rejected", "reason": "spam"}), 200

    # Procesar el correo...
    print(f"Correo de {sender} → {recipient}: {subject}")

    return jsonify({"status": "ok"}), 200
```

## Ejemplo mínimo (Node.js/Express)

```javascript
app.post("/api/mail", express.json({ limit: "10mb" }), (req, res) => {
  const { envelope, headers, meta, body, attachments } = req.body;

  console.log(`De: ${envelope.sender} → ${envelope.recipient}`);
  console.log(`Asunto: ${headers.subject}`);
  console.log(`Spam: ${meta.spam_flag} (score: ${meta.spam_score})`);

  // Si hay adjuntos:
  for (const att of attachments) {
    const buf = Buffer.from(att.content_base64, "base64");
    console.log(`Adjunto: ${att.filename} (${att.size_bytes} bytes)`);
  }

  res.status(200).json({ status: "ok" });
});
```
