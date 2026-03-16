/**
 * POST /api/mail
 *
 * Recibe correos reenviados por el smtp-forwarder y los convierte en notas.
 * Ver docs/api-spec.md para el formato del payload.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createNote, createTaskComment } from '@/lib/repositories/notes-repo';
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

  // 3. Discard spam (return 200 so the forwarder does not retry)
  if (meta.spam_flag === true) {
    console.log(`[mail] Spam discarded from ${envelope.sender} — score: ${meta.spam_score}`);
    return NextResponse.json({ status: 'rejected', reason: 'spam' }, { status: 200 });
  }

  // 4. Parse inbox address → { type, clientName }
  const { type: noteType, clientName } = parseInboxAddress(envelope.recipient ?? '');
  const clientId = clientName ? await resolveClientByName(clientName) : null;

  if (clientName && !clientId) {
    console.log(`[mail] Client "${clientName}" not found — note/task will be created without client`);
  }

  // Helper: remove null bytes (0x00) that break Postgres UTF8 encoding
  const stripNulls = (value: string) => value.replace(/\u0000/g, '');

  // 5. Build TipTap content (shared by both flows)
  const subject   = stripNulls((headers?.subject ?? '(Sin asunto)').trim());
  const textHtml  = stripNulls((body?.text_html ?? '').trim());
  const textPlain = stripNulls((body?.text_plain ?? '').trim());

  let contentJson: object;
  if (textHtml) {
    // Store raw HTML so the UI can render it more faithfully (option 1)
    contentJson = { type: 'html', html: textHtml };
  } else if (textPlain) {
    contentJson = plainTextToTipTap(textPlain);
  } else {
    contentJson = plainTextToTipTap(`Correo de ${envelope.sender}`);
  }

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

      // Save attachments linked to the task note
      const savedAttachments: string[] = [];
      for (const att of attachments) {
        try {
          const buffer = Buffer.from(att.content_base64, 'base64');
          const saved = await prisma.attachment.create({
            data: {
              noteId: existingTask.id,
              filename: sanitizeFilename(att.filename),
              originalName: att.filename,
              mimeType: att.content_type || 'application/octet-stream',
              size: att.size_bytes ?? buffer.length,
              data: buffer,
            },
          });
          savedAttachments.push(saved.id);
        } catch (err) {
          console.error(`[mail] Failed to save attachment "${att.filename}":`, err);
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

  // Save attachments linked to the new note/task
  const savedAttachments: string[] = [];
  for (const att of attachments) {
    try {
      const buffer = Buffer.from(att.content_base64, 'base64');
      const saved = await prisma.attachment.create({
        data: {
          noteId: note.id,
          filename: sanitizeFilename(att.filename),
          originalName: att.filename,
          mimeType: att.content_type || 'application/octet-stream',
          size: att.size_bytes ?? buffer.length,
          data: buffer,
        },
      });
      savedAttachments.push(saved.id);
    } catch (err) {
      console.error(`[mail] Failed to save attachment "${att.filename}":`, err);
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
