/**
 * POST /api/mail
 *
 * Recibe correos reenviados por el smtp-forwarder y los convierte en notas.
 * Ver docs/api-spec.md para el formato del payload.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createNote, createTaskComment, updateTaskComment } from '@/lib/repositories/notes-repo';
import type { CreateNoteInput, GeneralNote, TaskNote } from '@/lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MailEnvelope {
  sender: string;
  recipient: string;
  mailbox: string;
}

interface MailHeaders {
  from?: string | null;
  to?: string | null;
  cc?: string | null;
  subject?: string | null;
  date?: string | null;
  message_id?: string | null;
  reply_to?: string | null;
}

interface MailMeta {
  client_ip?: string | null;
  spam_score?: number | null;
  spam_flag: boolean;
  spam_status?: string | null;
  received_at: string;
}

interface MailBody {
  text_plain?: string | null;
  text_html?: string | null;
  raw_base64?: string;
}

interface MailAttachment {
  filename: string;
  content_type: string;
  size_bytes: number;
  content_base64: string;
}

interface MailPayload {
  envelope: MailEnvelope;
  headers: MailHeaders;
  meta: MailMeta;
  body: MailBody;
  attachments: MailAttachment[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 100);
}

/**
 * Converts a plain-text email body to a TipTap-compatible JSON document.
 * Each line becomes a paragraph; blank lines produce empty paragraphs.
 */
function plainTextToTipTap(text: string): object {
  const lines = text.split('\n');
  const content = lines.map((line) => {
    const trimmed = line.trimEnd();
    if (trimmed === '') {
      return { type: 'paragraph' };
    }
    return {
      type: 'paragraph',
      content: [{ type: 'text', text: trimmed }],
    };
  });

  // Remove trailing empty paragraphs
  while (content.length > 1 && content[content.length - 1].type === 'paragraph' &&
    !('content' in content[content.length - 1])) {
    content.pop();
  }

  return { type: 'doc', content };
}

// ---------------------------------------------------------------------------
// Inbox parsing (RF-02, RF-12)
// ---------------------------------------------------------------------------

const TYPE_KEYWORDS = new Set(['tasks', 'notes']);

/**
 * Parses the recipient address to infer note type and client name.
 *
 * Format: <type>.<client>@domain  or  <client>@domain
 * Examples:
 *   tasks.veolia@x  → { type: 'task',    clientName: 'veolia' }
 *   notes.acme@x    → { type: 'general', clientName: 'acme'   }
 *   veolia@x        → { type: 'general', clientName: 'veolia' }
 *   tasks@x         → { type: 'task',    clientName: null     }
 */
function parseInboxAddress(recipient: string): { type: 'task' | 'general'; clientName: string | null } {
  const localPart = (recipient.split('@')[0] ?? '').toLowerCase();
  const segments = localPart.split('.');

  if (segments.length >= 2 && TYPE_KEYWORDS.has(segments[0])) {
    return {
      type: segments[0] === 'tasks' ? 'task' : 'general',
      clientName: segments[1] || null,
    };
  }

  // Single segment
  if (segments.length >= 1) {
    const first = segments[0];
    if (first === 'tasks') return { type: 'task',    clientName: null };
    if (first === 'notes') return { type: 'general', clientName: null };
    return { type: 'general', clientName: first || null };
  }

  return { type: 'general', clientName: null };
}

/**
 * Resolves a client ID by name (case-insensitive).
 * Returns null if no matching client is found.
 */
async function resolveClientByName(name: string): Promise<string | null> {
  const client = await prisma.client.findFirst({
    where: { name: { equals: name, mode: 'insensitive' }, active: true },
    select: { id: true },
  });
  return client?.id ?? null;
}

// ---------------------------------------------------------------------------
// Ticket code detection (RF-11)
// ---------------------------------------------------------------------------

/**
 * Extracts the first occurrence of #XXXXX (# followed by exactly 5 digits)
 * from the email subject. Returns the 5-digit string or null.
 */
function extractTicketCode(subject: string): string | null {
  const match = subject.match(/#(\d{5})/);
  return match ? match[1] : null;
}

/**
 * Finds an active (non-archived) task whose taskTicketPhaseCode contains
 * the given 5-digit code.
 */
async function findTaskByTicketCode(code: string): Promise<{ id: string; title: string } | null> {
  const task = await prisma.note.findFirst({
    where: {
      type: 'TASK',
      archived: false,
      taskTicketPhaseCode: { contains: code },
    },
    select: { id: true, title: true },
  });
  return task ?? null;
}

/**
 * Checks the Authorization header against MAIL_API_TOKEN env var.
 * If the env var is not set, all requests are allowed (open mode).
 */
function isAuthorized(request: NextRequest): boolean {
  const token = process.env.MAIL_API_TOKEN;
  if (!token) return true; // token not configured → open

  const authHeader = request.headers.get('authorization') ?? '';
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return false;
  return parts[1] === token;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // 1. Auth
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse payload
  let payload: MailPayload;
  try {
    payload = (await request.json()) as MailPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { envelope, headers, meta, body, attachments = [] } = payload;

  if (!envelope?.sender || !meta?.received_at) {
    return NextResponse.json(
      { error: 'Missing required fields: envelope.sender, meta.received_at' },
      { status: 400 },
    );
  }

  // 3. Discard spam (return 204 so the forwarder treats it as accepted but no content)
  if (meta.spam_flag === true) {
    console.log(`[mail] Spam discarded from ${envelope.sender} — score: ${meta.spam_score}`);
    return new NextResponse(null, { status: 204 });
  }

  // 4. Parse inbox address → { type, clientName }
  const { type: noteType, clientName } = parseInboxAddress(envelope.recipient ?? '');
  const clientId = clientName ? await resolveClientByName(clientName) : null;

  if (clientName && !clientId) {
    console.log(`[mail] Client "${clientName}" not found — note/task will be created without client`);
  }

  // Helper: remove null bytes (0x00) and replacement characters (�) that break PostgreSQL UTF8
  const stripNulls = (value: string) => value.replace(/\u0000/g, '').replace(/\uFFFD/g, '');

  // Detect binary-like or raw MIME payloads (Gmail often sends full MIME in the body fields)
  const isLikelyBinary = (value: string) => {
    if (!value) return false;

    // Common signs of raw MIME messages (including multipart boundaries)
    const rawMimePatterns = [/^Content-Type:/mi, /^MIME-Version:/mi, /boundary=/i, /^--/m];
    if (rawMimePatterns.some((re) => re.test(value))) return true;

    // If the value contains replacement chars, it likely came from decoding binary.
    if (value.includes('\uFFFD')) return true;

    const len = value.length;
    let nonPrintable = 0;
    for (let i = 0; i < len; i += 1) {
      const code = value.charCodeAt(i);
      if (code === 9 || code === 10 || code === 13) continue; // tab/newline/carriage return
      // Treat non-control Unicode characters as printable (UTF-8)
      if (code < 32) nonPrintable += 1;
    }
    return nonPrintable / len > 0.3;
  };

  const normalizeLineEndings = (input: string) => input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const parseHeaders = (rawHeaders: string) => {
    const result: Record<string, string> = {};
    const lines = rawHeaders.split('\n');
    let currentKey = '';
    for (const line of lines) {
      if (/^\s/.test(line) && currentKey) {
        // Folded header continuation.
        result[currentKey] += ' ' + line.trim();
        continue;
      }
      const [key, ...rest] = line.split(':');
      if (!key) continue;
      currentKey = key.trim().toLowerCase();
      result[currentKey] = rest.join(':').trim();
    }
    return result;
  };

  const decodeQuotedPrintable = (input: string) =>
    input
      .replace(/=(\r\n|\n|\r)/g, '')
      .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  const decodeMimePartBody = (body: string, encoding?: string) => {
    const normalized = body.trim();
    if (!encoding) return normalized;

    const enc = encoding.trim().toLowerCase();
    if (enc === 'base64') {
      try {
        return Buffer.from(normalized, 'base64').toString('utf-8');
      } catch {
        return normalized;
      }
    }

    if (enc === 'quoted-printable') {
      return decodeQuotedPrintable(normalized);
    }

    return normalized;
  };

  type MimeNode = {
    headers: Record<string, string>;
    body: string;
    parts?: MimeNode[];
  };

  const parseMimeNode = (raw: string): MimeNode => {
    const normalized = normalizeLineEndings(raw);
    const [rawHeaders, ...rest] = normalized.split('\n\n');
    const headers = parseHeaders(rawHeaders);
    const body = rest.join('\n\n');

    const contentType = headers['content-type']?.toLowerCase() ?? '';
    const boundaryMatch = contentType.match(/boundary="?([^"\n;]+)"?/i);
    const boundary = boundaryMatch ? boundaryMatch[1] : null;

    if (boundary && contentType.startsWith('multipart/')) {
      const parts: MimeNode[] = [];
      const rawParts = body
        .split(`--${boundary}`)
        .slice(1)
        .map((p) => p.trim())
        .filter((p) => p && !p.startsWith('--'));

      for (const partRaw of rawParts) {
        parts.push(parseMimeNode(partRaw));
      }

      return { headers, body, parts };
    }

    return { headers, body };
  };

  const decodeMimeNodeBody = (node: MimeNode): string => {
    const transferEncoding = node.headers['content-transfer-encoding'];
    return decodeMimePartBody(node.body, transferEncoding);
  };

  const findMimePart = (node: MimeNode, match: (contentType: string) => boolean): MimeNode | null => {
    const contentType = node.headers['content-type']?.toLowerCase() ?? '';
    if (match(contentType)) return node;
    if (!node.parts) return null;
    for (const child of node.parts) {
      const found = findMimePart(child, match);
      if (found) return found;
    }
    return null;
  };

  const tryExtractFromRawMime = (rawBase64: string, type: 'text/plain' | 'text/html'): string => {
    try {
      const decoded = Buffer.from(rawBase64, 'base64').toString('utf-8');
      const root = parseMimeNode(decoded);

      const match = findMimePart(root, (ct) => ct.includes(type));
      if (match) {
        return decodeMimeNodeBody(match).trim();
      }

      // If we couldn't find an explicit part, fall back to raw HTML extraction
      if (type === 'text/html') {
        const htmlMatch = decoded.match(/<html[\s\S]*?<\/html>/i);
        if (htmlMatch) return htmlMatch[0];

        const bodyMatch = decoded.match(/<body[\s\S]*?<\/body>/i);
        if (bodyMatch) return bodyMatch[0];
      }

      const fallbackBody = decoded.split(/\r?\n\r?\n/).slice(1).join('\n\n').trim();
      return fallbackBody;
    } catch {
      return '';
    }
  };

  type InlineAttachment = {
    cid: string;
    filename: string;
    mimeType: string;
    contentBase64: string;
  };

  const collectInlineAttachments = (node: MimeNode, out: InlineAttachment[]) => {
    const contentType = node.headers['content-type']?.toLowerCase() ?? '';
    const contentIdRaw = node.headers['content-id'] ?? '';
    const contentId = contentIdRaw.replace(/[<>]/g, '').trim();

    if (contentId && contentType.startsWith('image/')) {
      const transferEncoding = node.headers['content-transfer-encoding'];
      let contentBase64 = node.body.trim();
      if (transferEncoding?.toLowerCase().includes('quoted-printable')) {
        const decoded = decodeQuotedPrintable(contentBase64);
        contentBase64 = Buffer.from(decoded, 'utf-8').toString('base64');
      }

      const filenameFromDisposition = (node.headers['content-disposition'] || '')
        .match(/filename="?([^";]+)"?/i)?.[1];
      const filenameFromType = contentType.match(/name="?([^";]+)"?/i)?.[1];
      const extension = contentType.split('/')[1]?.split(';')[0]?.trim();
      const filename = filenameFromDisposition || filenameFromType || `${contentId}.${extension || 'bin'}`;

      out.push({
        cid: contentId,
        filename,
        mimeType: contentType.split(';')[0].trim(),
        contentBase64,
      });
    }

    if (node.parts) {
      for (const child of node.parts) collectInlineAttachments(child, out);
    }
  };

  const extractInlineAttachmentsFromRawMime = (rawBase64: string): InlineAttachment[] => {
    try {
      const decoded = Buffer.from(rawBase64, 'base64').toString('utf-8');
      const root = parseMimeNode(decoded);
      const attachments: InlineAttachment[] = [];
      collectInlineAttachments(root, attachments);
      return attachments;
    } catch {
      return [];
    }
  };

  // 5. Build TipTap content (shared by both flows)
  const subjectRaw   = stripNulls((headers?.subject ?? '(Sin asunto)').trim());
  const subject      = isLikelyBinary(subjectRaw) ? '(Sin asunto)' : subjectRaw;

  const textPlainRaw = stripNulls((body?.text_plain ?? '').trim());
  const textHtmlRaw  = stripNulls((body?.text_html ?? '').trim());

  let textPlain = isLikelyBinary(textPlainRaw) ? '' : textPlainRaw;
  let textHtml  = isLikelyBinary(textHtmlRaw) ? '' : textHtmlRaw;

  // If body fields are empty/invalid, try extracting from raw_base64 MIME payload
  const rawBase64 = body?.raw_base64 || '';
  if (!textPlain && rawBase64) {
    textPlain = tryExtractFromRawMime(rawBase64, 'text/plain');
  }
  if (!textHtml && rawBase64) {
    textHtml = tryExtractFromRawMime(rawBase64, 'text/html');
  }

  // Extract inline attachments (e.g. embedded images with cid: in HTML)
  const inlineAttachments = rawBase64 ? extractInlineAttachmentsFromRawMime(rawBase64) : [];

  let contentJson: object;
  if (textHtml) {
    // Store raw HTML so the UI can render it more faithfully (option 1)
    contentJson = { type: 'html', html: textHtml };
  } else if (textPlain) {
    contentJson = plainTextToTipTap(textPlain);
  } else {
    contentJson = plainTextToTipTap(`Correo de ${envelope.sender}`);
  }

  // Helper: replace CID references in HTML with attachment URLs
  const renderCidImages = (
    html: string,
    attachmentMap: Record<string, string>, // filename -> attachmentId
  ) => {
    if (!html || Object.keys(attachmentMap).length === 0) return html;

    return html.replace(/cid:([^"'\s>]+)/gi, (_match, cidRaw) => {
      const cid = cidRaw.split('@')[0];
      const candidates = [cid, `${cid}.jpg`, `${cid}.png`, `${cid}.jpeg`, `${cid}.gif`];
      for (const candidate of candidates) {
        const attachmentId = attachmentMap[candidate];
        if (attachmentId) {
          return `/api/attachments/${attachmentId}`;
        }
      }
      // Try to match by filename suffix
      for (const [filename, attachmentId] of Object.entries(attachmentMap)) {
        if (cid.endsWith(filename) || filename.endsWith(cid)) {
          return `/api/attachments/${attachmentId}`;
        }
      }
      return _match;
    });
  };

  // 6. Ticket code detection — try UPDATE FLOW first
  const ticketCode = extractTicketCode(subject);
  if (ticketCode) {
    const existingTask = await findTaskByTicketCode(ticketCode);
    if (existingTask) {
      // ----------------------------------------------------------------
      // UPDATE FLOW: add system comment to existing task
      // ----------------------------------------------------------------
      let comment: { id: string };
      try {
        comment = await createTaskComment({
          taskId: existingTask.id,
          author: 'mail-ingest',
          content: contentJson as import('@prisma/client').Prisma.InputJsonValue,
        });
      } catch (err) {
        console.error('[mail] Failed to create task comment:', err);
        return NextResponse.json({ error: 'Failed to create task comment' }, { status: 500 });
      }

      // Save attachments (including inline images) linked to the task note
      const allAttachments = [...attachments];
      for (const inline of inlineAttachments) {
        if (!allAttachments.some((a) => a.filename === inline.filename)) {
          allAttachments.push({
            filename: inline.filename,
            content_type: inline.mimeType,
            size_bytes: Buffer.from(inline.contentBase64, 'base64').length,
            content_base64: inline.contentBase64,
          });
        }
      }

      const savedAttachments: string[] = [];
      const attachmentMap: Record<string, string> = {};
      for (let i = 0; i < allAttachments.length; i += 1) {
        const att = allAttachments[i];
        const filename = (typeof att.filename === 'string' && att.filename.trim()) ? att.filename : `attachment-${i}`;
        const contentBase64 = typeof att.content_base64 === 'string' ? att.content_base64 : '';
        if (!contentBase64) {
          console.warn('[mail] Skipping attachment without base64 content', filename);
          continue;
        }

        try {
          const buffer = Buffer.from(contentBase64, 'base64');
          const saved = await prisma.attachment.create({
            data: {
              noteId: existingTask.id,
              filename: sanitizeFilename(filename),
              originalName: filename,
              mimeType: att.content_type || 'application/octet-stream',
              size: att.size_bytes ?? buffer.length,
              data: buffer,
            },
          });
          savedAttachments.push(saved.id);

          const attWithCid = att as { filename: string; cid?: string };
          attachmentMap[filename] = saved.id;
          if (attWithCid.cid) {
            attachmentMap[attWithCid.cid] = saved.id;
          }
        } catch (err) {
          console.error(`[mail] Failed to save attachment "${filename}":`, err);
        }
      }

      // If the comment contains cid images, update it to use web-accessible URLs
      if (typeof contentJson === 'object' && contentJson !== null) {
        const json = contentJson as Record<string, unknown>;
        if (json.type === 'html' && typeof json.html === 'string') {
          const replaced = renderCidImages(json.html, attachmentMap);
          if (replaced !== json.html) {
            await updateTaskComment(comment.id, { content: { ...json, html: replaced } });
          }
        }
      }

      console.log(
        `[mail] Comment added to task ${existingTask.id} (ticket #${ticketCode}) | from: ${envelope.sender} | subject: "${subject}" | attachments: ${savedAttachments.length}`,
      );

      return NextResponse.json(
        {
          status: 'ok',
          flow: 'update',
          taskId: existingTask.id,
          commentId: comment.id,
          attachmentsSaved: savedAttachments.length,
        },
        { status: 201 },
      );
    }
    // Ticket code present but no matching task → fall through to CREATE FLOW
    console.log(`[mail] Ticket code #${ticketCode} from subject not matched — proceeding to create`);
  }

  // ----------------------------------------------------------------
  // CREATE FLOW: create a new note or task
  // ----------------------------------------------------------------
  const noteInput = {
    type: noteType,
    title: subject,
    contentJson,
    contentText: textPlain,
    ...(clientId ? { clientId } : {}),
  } as unknown as CreateNoteInput<GeneralNote | TaskNote>;

  let note: GeneralNote | TaskNote;
  try {
    note = await createNote(noteInput);
  } catch (err) {
    console.error('[mail] Failed to create note/task:', err);
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }

  // Save attachments (including inline images) linked to the new note/task
  const allAttachments = [...attachments];
  for (const inline of inlineAttachments) {
    if (!allAttachments.some((a) => a.filename === inline.filename)) {
      allAttachments.push({
        filename: inline.filename,
        content_type: inline.mimeType,
        size_bytes: Buffer.from(inline.contentBase64, 'base64').length,
        content_base64: inline.contentBase64,
      });
    }
  }

  const savedAttachments: string[] = [];
  const attachmentMap: Record<string, string> = {};

  for (let i = 0; i < allAttachments.length; i += 1) {
    const att = allAttachments[i];
    const filename = (typeof att.filename === 'string' && att.filename.trim()) ? att.filename : `attachment-${i}`;
    const contentBase64 = typeof att.content_base64 === 'string' ? att.content_base64 : '';
    if (!contentBase64) {
      console.warn('[mail] Skipping attachment without base64 content', filename);
      continue;
    }

    try {
      const buffer = Buffer.from(contentBase64, 'base64');
      const saved = await prisma.attachment.create({
        data: {
          noteId: note.id,
          filename: sanitizeFilename(filename),
          originalName: filename,
          mimeType: att.content_type || 'application/octet-stream',
          size: att.size_bytes ?? buffer.length,
          data: buffer,
        },
      });
      savedAttachments.push(saved.id);

      const attWithCid = att as { filename: string; cid?: string };
      attachmentMap[filename] = saved.id;
      if (attWithCid.cid) {
        attachmentMap[attWithCid.cid] = saved.id;
      }
    } catch (err) {
      console.error(`[mail] Failed to save attachment "${filename}":`, err);
    }
  }

  console.log(
    `[mail] ${noteType === 'task' ? 'Task' : 'Note'} created: ${note.id} | client: ${clientId ?? 'none'} | from: ${envelope.sender} | subject: "${subject}" | attachments: ${savedAttachments.length}`,
  );

  return NextResponse.json(
    {
      status: 'ok',
      flow: 'create',
      noteId: note.id,
      noteType,
      clientId: clientId ?? null,
      title: note.title,
      attachmentsSaved: savedAttachments.length,
    },
    { status: 201 },
  );
}
