/**
 * API: POST /api/todos/notify
 * REQ-021: Process TODO notifications
 * 
 * This endpoint should be called periodically (every minute) to:
 * 1. Check if it's time for daily summary
 * 2. Check for upcoming deadlines and send reminders
 */

import { NextResponse } from 'next/server';
import { 
  getTelegramConfig, 
  sendTodoDailySummary, 
  sendTodoReminder,
  sendTodoOverdue,
  TodoSummary 
} from '@/lib/telegram';
import {
  listAllPendingTodos,
  listTodosWithUpcomingDeadlines,
  listOverdueTodos,
  hasNotificationBeenSent,
  recordNotificationSent,
} from '@/lib/repositories/todo-repo';

export const dynamic = 'force-dynamic';

// Timezone for Argentina
const TIMEZONE = 'America/Buenos_Aires';

/**
 * Get current time in Argentina timezone
 */
function getArgentinaTime(): { hours: number; minutes: number; timeString: string } {
  const now = new Date();
  const argentinaTime = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));
  const hours = argentinaTime.getHours();
  const minutes = argentinaTime.getMinutes();
  const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  return { hours, minutes, timeString };
}

/**
 * Get today's date key in Argentina timezone
 */
function getArgentinaDailyKey(): string {
  const now = new Date();
  const argentinaTime = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));
  return `${argentinaTime.getFullYear()}-${String(argentinaTime.getMonth() + 1).padStart(2, '0')}-${String(argentinaTime.getDate()).padStart(2, '0')}`;
}

// Helper to extract text from TipTap content
function extractText(content: unknown): string {
  if (!content) return '';
  const doc = content as { type: string; content?: Array<{ type: string; content?: Array<{ text?: string }> }> };
  if (doc.type === 'doc' && doc.content) {
    return doc.content
      .flatMap(block => block.content || [])
      .map(item => item.text || '')
      .join(' ')
      .trim();
  }
  return String(content);
}

// Track daily summary sent (in-memory for simplicity, could use file/db)
const sentSummaries = new Set<string>();

export async function POST() {
  try {
    const config = await getTelegramConfig();
    
    if (!config.enabled || !config.todoNotifications?.enabled) {
      return NextResponse.json({ 
        skipped: true, 
        reason: 'TODO notifications disabled' 
      });
    }
    
    const results = {
      dailySummary: false,
      reminders: [] as string[],
      overdueNotifications: [] as string[],
    };
    
    const now = new Date();
    const argentinaTime = getArgentinaTime();
    const dailySummaryKey = getArgentinaDailyKey();
    
    // 1. Check if it's time for daily summary (using Argentina timezone)
    const summaryTime = config.todoNotifications.dailySummaryTime || '08:00';
    if (argentinaTime.timeString === summaryTime && !sentSummaries.has(dailySummaryKey)) {
      const pendingTodos = await listAllPendingTodos();
      const summaries: TodoSummary[] = pendingTodos.map(todo => ({
        id: todo.id,
        content: extractText(todo.content),
        deadline: todo.deadline,
        taskTitle: todo.task.title,
        ticketCode: todo.task.ticketPhaseCode,
        isOverdue: todo.deadline ? new Date(todo.deadline) < now : false,
      }));
      
      const sent = await sendTodoDailySummary(summaries);
      if (sent) {
        sentSummaries.add(dailySummaryKey);
        results.dailySummary = true;
      }
    }
    
    // 2. Check for upcoming deadlines
    const reminderMinutes = config.todoNotifications.reminderMinutes || [60, 15];
    const maxMinutes = Math.max(...reminderMinutes);
    
    const upcomingTodos = await listTodosWithUpcomingDeadlines(maxMinutes + 5);
    
    for (const todo of upcomingTodos) {
      if (!todo.deadline) continue;
      
      const deadline = new Date(todo.deadline);
      const minutesRemaining = Math.floor((deadline.getTime() - now.getTime()) / 60000);
      
      // Check each reminder threshold
      for (const threshold of reminderMinutes) {
        if (minutesRemaining <= threshold && minutesRemaining > threshold - 5) {
          // Check if already sent for this threshold
          const alreadySent = await hasNotificationBeenSent(todo.id, 'reminder', threshold);
          
          if (!alreadySent) {
            const summary: TodoSummary = {
              id: todo.id,
              content: extractText(todo.content),
              deadline: todo.deadline,
              taskTitle: todo.task.title,
              ticketCode: todo.task.ticketPhaseCode,
              isOverdue: false,
            };
            
            const sent = await sendTodoReminder(summary, minutesRemaining);
            if (sent) {
              await recordNotificationSent(todo.id, 'reminder', threshold);
              results.reminders.push(`${todo.id}:${threshold}min`);
            }
          }
        }
      }
    }
    
    // 3. Check for overdue TODOs (notify once when they become overdue)
    const overdueTodos = await listOverdueTodos();
    
    for (const todo of overdueTodos) {
      // Check if we already sent overdue notification for this todo
      const alreadySent = await hasNotificationBeenSent(todo.id, 'overdue', 0);
      
      if (!alreadySent) {
        const summary: TodoSummary = {
          id: todo.id,
          content: extractText(todo.content),
          deadline: todo.deadline,
          taskTitle: todo.task.title,
          ticketCode: todo.task.ticketPhaseCode,
          isOverdue: true,
        };
        
        const sent = await sendTodoOverdue(summary);
        if (sent) {
          await recordNotificationSent(todo.id, 'overdue', 0);
          results.overdueNotifications.push(todo.id);
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      processed: true,
      results,
      timestamp: now.toISOString(),
      argentinaTime: argentinaTime.timeString,
    });
    
  } catch (error) {
    console.error('Error processing TODO notifications:', error);
    return NextResponse.json({ 
      error: 'Failed to process notifications',
      details: String(error),
    }, { status: 500 });
  }
}

// GET - Check notification status (for debugging)
export async function GET() {
  try {
    const config = await getTelegramConfig();
    const argentinaTime = getArgentinaTime();
    const dailySummaryKey = getArgentinaDailyKey();
    
    return NextResponse.json({
      enabled: config.enabled && config.todoNotifications?.enabled,
      dailySummaryTime: config.todoNotifications?.dailySummaryTime,
      reminderMinutes: config.todoNotifications?.reminderMinutes,
      todaySummarySent: sentSummaries.has(dailySummaryKey),
      currentArgentinaTime: argentinaTime.timeString,
      timezone: TIMEZONE,
    });
  } catch (error) {
    console.error('Error getting notification status:', error);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}
