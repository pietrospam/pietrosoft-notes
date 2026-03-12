/**
 * Telegram Bot API Service
 * SPEC-007: Telegram Backup Notifications
 */

import { promises as fs } from 'fs';
import path from 'path';

const CONFIG_PATH = process.env.WORKSPACE_PATH 
  ? path.join(process.env.WORKSPACE_PATH, 'telegram-config.json')
  : './data/telegram-config.json';

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
  notifyAuto: boolean;
  notifyManual: boolean;
  notifyErrors: boolean;
  sendFile: boolean;
  // REQ-021: TODO notifications
  todoNotifications?: {
    enabled: boolean;
    dailySummaryTime?: string; // HH:mm format
    reminderMinutes?: number[]; // Minutes before deadline
  };
}

const DEFAULT_CONFIG: TelegramConfig = {
  enabled: false,
  botToken: '',
  chatId: '',
  notifyAuto: true,
  notifyManual: true,
  notifyErrors: true,
  sendFile: true,
  todoNotifications: {
    enabled: false,
    dailySummaryTime: '08:00',
    reminderMinutes: [60, 15],
  },
};

/**
 * Read Telegram configuration from file
 */
export async function getTelegramConfig(): Promise<TelegramConfig> {
  try {
    const content = await fs.readFile(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(content);
    return { ...DEFAULT_CONFIG, ...config };
  } catch {
    // File doesn't exist or is invalid - return defaults
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save Telegram configuration to file
 */
export async function saveTelegramConfig(config: Partial<TelegramConfig>): Promise<TelegramConfig> {
  const currentConfig = await getTelegramConfig();
  const newConfig = { ...currentConfig, ...config };
  
  // Ensure directory exists
  const dir = path.dirname(CONFIG_PATH);
  await fs.mkdir(dir, { recursive: true });
  
  await fs.writeFile(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
  return newConfig;
}

/**
 * Obfuscate token for safe display (show only last 4 chars)
 */
export function obfuscateToken(token: string): string {
  if (!token || token.length < 8) return '••••••••';
  return '••••' + token.slice(-4);
}

/**
 * Telegram API client
 */
export class TelegramService {
  private baseUrl: string;
  private chatId: string;

  constructor(botToken: string, chatId: string) {
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
    this.chatId = chatId;
  }

  /**
   * Test connection by calling getMe
   */
  async testConnection(): Promise<{ ok: boolean; botName?: string; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/getMe`, {
        method: 'GET',
      });
      
      const data = await response.json();
      
      if (data.ok) {
        return { ok: true, botName: data.result?.username };
      }
      
      return { ok: false, error: data.description || 'Unknown error' };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  }

  /**
   * Send a text message
   */
  async sendMessage(text: string, parseMode: 'HTML' | 'Markdown' = 'HTML'): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
          parse_mode: parseMode,
        }),
      });
      
      const data = await response.json();
      return data.ok === true;
    } catch (error) {
      console.error('Telegram sendMessage error:', error);
      return false;
    }
  }

  /**
   * Send a document (file) with optional caption
   */
  async sendDocument(
    fileBuffer: Buffer, 
    filename: string, 
    caption?: string
  ): Promise<boolean> {
    try {
      // Create form data manually for Node.js
      const boundary = '----TelegramBoundary' + Date.now().toString(16);
      
      // Build multipart form data
      const parts: Buffer[] = [];
      
      // Add chat_id
      parts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="chat_id"\r\n\r\n` +
        `${this.chatId}\r\n`
      ));
      
      // Add caption if provided
      if (caption) {
        parts.push(Buffer.from(
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="caption"\r\n\r\n` +
          `${caption}\r\n`
        ));
        
        parts.push(Buffer.from(
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="parse_mode"\r\n\r\n` +
          `HTML\r\n`
        ));
      }
      
      // Add file
      parts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="document"; filename="${filename}"\r\n` +
        `Content-Type: application/zip\r\n\r\n`
      ));
      parts.push(fileBuffer);
      parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
      
      const body = Buffer.concat(parts);
      
      const response = await fetch(`${this.baseUrl}/sendDocument`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length.toString(),
        },
        body,
      });
      
      const data = await response.json();
      return data.ok === true;
    } catch (error) {
      console.error('Telegram sendDocument error:', error);
      return false;
    }
  }
}

// Maximum file size for Telegram (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Format file size for display
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format date for display
 */
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleString('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Send backup success notification to Telegram
 */
export async function notifyBackupSuccess(
  backupInfo: {
    filename: string;
    sizeBytes: number;
    type: 'auto' | 'manual';
    filePath: string;
  }
): Promise<void> {
  const config = await getTelegramConfig();
  
  // Check if notifications are enabled
  if (!config.enabled) return;
  if (backupInfo.type === 'auto' && !config.notifyAuto) return;
  if (backupInfo.type === 'manual' && !config.notifyManual) return;
  
  const telegram = new TelegramService(config.botToken, config.chatId);
  
  const typeLabel = backupInfo.type === 'auto' ? 'Automático' : 'Manual';
  const sizeFormatted = formatSize(backupInfo.sizeBytes);
  const dateFormatted = formatDate(new Date());
  
  // Check if file is too large for Telegram
  if (config.sendFile && backupInfo.sizeBytes <= MAX_FILE_SIZE) {
    // Send with file attached
    const { promises: fs } = await import('fs');
    
    try {
      const fileBuffer = await fs.readFile(backupInfo.filePath);
      
      const caption = 
        `✅ <b>Backup Completado</b>\n\n` +
        `📅 Fecha: ${dateFormatted}\n` +
        `📦 Tipo: ${typeLabel}\n` +
        `💾 Tamaño: ${sizeFormatted}`;
      
      await telegram.sendDocument(fileBuffer, backupInfo.filename, caption);
    } catch (error) {
      console.error('Failed to send backup file to Telegram:', error);
      // Fall back to text-only notification
      await sendTextOnlyNotification(telegram, backupInfo, typeLabel, sizeFormatted, dateFormatted);
    }
  } else {
    // File too large or sendFile disabled - send text only
    await sendTextOnlyNotification(telegram, backupInfo, typeLabel, sizeFormatted, dateFormatted, 
      config.sendFile && backupInfo.sizeBytes > MAX_FILE_SIZE);
  }
}

async function sendTextOnlyNotification(
  telegram: TelegramService,
  backupInfo: { filename: string; sizeBytes: number },
  typeLabel: string,
  sizeFormatted: string,
  dateFormatted: string,
  fileTooLarge = false
): Promise<void> {
  let message = 
    `✅ <b>Backup Completado</b>\n\n` +
    `📅 Fecha: ${dateFormatted}\n` +
    `📦 Tipo: ${typeLabel}\n` +
    `💾 Tamaño: ${sizeFormatted}\n` +
    `📁 Archivo: ${backupInfo.filename}`;
  
  if (fileTooLarge) {
    message += `\n\n⚠️ Archivo muy grande para adjuntar (>50MB).\nDescárgalo desde la aplicación.`;
  }
  
  await telegram.sendMessage(message);
}

/**
 * Send backup error notification to Telegram
 */
export async function notifyBackupError(
  errorInfo: {
    type: 'auto' | 'manual';
    error: string;
  }
): Promise<void> {
  const config = await getTelegramConfig();
  
  // Check if error notifications are enabled
  if (!config.enabled || !config.notifyErrors) return;
  
  const telegram = new TelegramService(config.botToken, config.chatId);
  
  const typeLabel = errorInfo.type === 'auto' ? 'Automático' : 'Manual';
  const dateFormatted = formatDate(new Date());
  
  const message = 
    `❌ <b>Error en Backup</b>\n\n` +
    `📅 Fecha: ${dateFormatted}\n` +
    `📦 Tipo: ${typeLabel}\n` +
    `🚫 Error: ${errorInfo.error}\n\n` +
    `Revisa el sistema lo antes posible.`;
  
  await telegram.sendMessage(message);
}

// ============================================================================
// REQ-021: TODO Notifications
// ============================================================================

export interface TodoSummary {
  id: string;
  content: string;
  deadline?: string;
  taskTitle: string;
  ticketCode?: string;
  isOverdue: boolean;
}

/**
 * Send daily TODO summary to Telegram
 */
export async function sendTodoDailySummary(todos: TodoSummary[]): Promise<boolean> {
  const config = await getTelegramConfig();
  
  if (!config.enabled || !config.todoNotifications?.enabled) {
    return false;
  }
  
  const telegram = new TelegramService(config.botToken, config.chatId);
  
  const dateFormatted = formatDate(new Date());
  const overdueTodos = todos.filter(t => t.isOverdue);
  const todayTodos = todos.filter(t => !t.isOverdue && t.deadline);
  const noDueDate = todos.filter(t => !t.deadline);
  
  let message = `📋 <b>Resumen Diario de TODOs</b>\n📅 ${dateFormatted}\n\n`;
  
  if (todos.length === 0) {
    message += `✅ No tienes TODOs pendientes. ¡Buen trabajo!`;
  } else {
    if (overdueTodos.length > 0) {
      message += `🔴 <b>Vencidos (${overdueTodos.length})</b>\n`;
      overdueTodos.slice(0, 5).forEach(todo => {
        const code = todo.ticketCode ? `[${todo.ticketCode}] ` : '';
        message += `• ${code}${escapeHtml(todo.content.substring(0, 50))}\n`;
      });
      if (overdueTodos.length > 5) {
        message += `  <i>...y ${overdueTodos.length - 5} más</i>\n`;
      }
      message += '\n';
    }
    
    if (todayTodos.length > 0) {
      message += `🟡 <b>Para Hoy (${todayTodos.length})</b>\n`;
      todayTodos.slice(0, 5).forEach(todo => {
        const code = todo.ticketCode ? `[${todo.ticketCode}] ` : '';
        const time = todo.deadline ? new Date(todo.deadline).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '';
        message += `• ${time} ${code}${escapeHtml(todo.content.substring(0, 40))}\n`;
      });
      if (todayTodos.length > 5) {
        message += `  <i>...y ${todayTodos.length - 5} más</i>\n`;
      }
      message += '\n';
    }
    
    if (noDueDate.length > 0) {
      message += `⚪ <b>Sin fecha límite (${noDueDate.length})</b>\n`;
      noDueDate.slice(0, 3).forEach(todo => {
        const code = todo.ticketCode ? `[${todo.ticketCode}] ` : '';
        message += `• ${code}${escapeHtml(todo.content.substring(0, 40))}\n`;
      });
      if (noDueDate.length > 3) {
        message += `  <i>...y ${noDueDate.length - 3} más</i>\n`;
      }
    }
    
    message += `\n📊 Total pendientes: ${todos.length}`;
  }
  
  return telegram.sendMessage(message);
}

/**
 * Send TODO reminder notification to Telegram
 */
export async function sendTodoReminder(todo: TodoSummary, minutesRemaining: number): Promise<boolean> {
  const config = await getTelegramConfig();
  
  if (!config.enabled || !config.todoNotifications?.enabled) {
    return false;
  }
  
  const telegram = new TelegramService(config.botToken, config.chatId);
  
  const code = todo.ticketCode ? `[${todo.ticketCode}] ` : '';
  const time = todo.deadline ? new Date(todo.deadline).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '';
  
  let timeText: string;
  if (minutesRemaining <= 0) {
    timeText = '¡AHORA!';
  } else if (minutesRemaining < 60) {
    timeText = `en ${minutesRemaining} minutos`;
  } else {
    timeText = `en ${Math.round(minutesRemaining / 60)} hora(s)`;
  }
  
  const emoji = minutesRemaining <= 15 ? '🚨' : '⏰';
  
  const message = 
    `${emoji} <b>Recordatorio TODO</b>\n\n` +
    `📌 ${code}${escapeHtml(todo.content)}\n` +
    `🗂 Tarea: ${escapeHtml(todo.taskTitle)}\n` +
    `⏰ Vence: ${time} (${timeText})\n`;
  
  return telegram.sendMessage(message);
}

/**
 * Send TODO overdue notification to Telegram
 */
export async function sendTodoOverdue(todo: TodoSummary): Promise<boolean> {
  const config = await getTelegramConfig();
  
  if (!config.enabled || !config.todoNotifications?.enabled) {
    return false;
  }
  
  const telegram = new TelegramService(config.botToken, config.chatId);
  
  const code = todo.ticketCode ? `[${todo.ticketCode}] ` : '';
  const deadline = todo.deadline ? new Date(todo.deadline) : null;
  const time = deadline ? deadline.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '';
  const date = deadline ? deadline.toLocaleDateString('es', { day: '2-digit', month: '2-digit' }) : '';
  
  // Calculate how overdue it is
  const now = new Date();
  const overdueMs = deadline ? now.getTime() - deadline.getTime() : 0;
  const overdueMinutes = Math.floor(overdueMs / 60000);
  
  let overdueText: string;
  if (overdueMinutes < 60) {
    overdueText = `hace ${overdueMinutes} minuto(s)`;
  } else if (overdueMinutes < 1440) {
    overdueText = `hace ${Math.floor(overdueMinutes / 60)} hora(s)`;
  } else {
    overdueText = `hace ${Math.floor(overdueMinutes / 1440)} día(s)`;
  }
  
  const message = 
    `🔴 <b>TODO VENCIDO</b>\n\n` +
    `📌 ${code}${escapeHtml(todo.content)}\n` +
    `🗂 Tarea: ${escapeHtml(todo.taskTitle)}\n` +
    `❌ Venció: ${date} ${time} (${overdueText})\n`;
  
  return telegram.sendMessage(message);
}

/**
 * Helper to escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
