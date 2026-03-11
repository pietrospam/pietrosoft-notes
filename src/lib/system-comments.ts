/**
 * System Comments Module
 * 
 * Provides utilities for creating automatic system-generated comments
 * on tasks when certain events occur (attachments, status changes, favorites).
 * 
 * REQ-020 / SPEC-008
 */

import prisma from '@/lib/db';

/** System comment author identifier */
export const SYSTEM_AUTHOR = '🤖 Sistema';

/** Event types that generate system comments */
export type SystemEventType =
  | 'ATTACHMENT_ADDED'
  | 'ATTACHMENT_DELETED'
  | 'ATTACHMENT_RENAMED'
  | 'STATUS_CHANGED'
  | 'FAVORITE_ADDED'
  | 'FAVORITE_REMOVED';

interface SystemCommentParams {
  noteId: string;
  /** Main message text (including emoji) */
  message: string;
  /** Optional link text (will be inserted after message) */
  linkText?: string;
  /** Optional link href */
  linkHref?: string;
  /** Optional text after the link */
  afterLinkText?: string;
}

/**
 * Creates a system comment with TipTap format (italic text).
 * Only creates comments for notes of type TASK.
 */
export async function createSystemComment(params: SystemCommentParams): Promise<void> {
  const { noteId, message, linkText, linkHref, afterLinkText } = params;

  try {
    const note = await prisma.note.findUnique({ where: { id: noteId } });
    if (!note || note.type !== 'TASK') return;

    // Build content array
    const contentArray: object[] = [];

    if (linkText && linkHref) {
      // Message with link
      contentArray.push({
        type: 'text',
        marks: [{ type: 'italic' }],
        text: message,
      });
      contentArray.push({
        type: 'text',
        marks: [
          { type: 'italic' },
          {
            type: 'link',
            attrs: {
              href: linkHref,
              target: '_blank',
              rel: 'noopener noreferrer nofollow',
              class: null,
            },
          },
        ],
        text: linkText,
      });
      if (afterLinkText) {
        contentArray.push({
          type: 'text',
          marks: [{ type: 'italic' }],
          text: afterLinkText,
        });
      }
    } else {
      // Simple message without link
      contentArray.push({
        type: 'text',
        marks: [{ type: 'italic' }],
        text: message,
      });
    }

    const content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: contentArray,
        },
      ],
    };

    await prisma.taskComment.create({
      data: {
        taskId: noteId,
        author: SYSTEM_AUTHOR,
        content,
      },
    });
  } catch (error) {
    console.error('Error creating system comment:', error);
    // Don't fail the main operation if comment creation fails
  }
}

/** Format file size for display */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Format current date in Spanish Argentina locale */
export function formatDate(): string {
  return new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Status labels in Spanish */
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

/** Get human-readable status label */
export function getStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Sin estado';
  return STATUS_LABELS[status] || status;
}
