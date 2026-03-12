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

// Key for today's summary (to avoid sending multiple times per day)
function getDailySummaryKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const dailySummaryKey = getDailySummaryKey();
    
    // 1. Check if it's time for daily summary
    const summaryTime = config.todoNotifications.dailySummaryTime || '08:00';
    if (currentTime === summaryTime && !sentSummaries.has(dailySummaryKey)) {
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
    
    return NextResponse.json({
      enabled: config.enabled && config.todoNotifications?.enabled,
      dailySummaryTime: config.todoNotifications?.dailySummaryTime,
      reminderMinutes: config.todoNotifications?.reminderMinutes,
      todaySummarySent: sentSummaries.has(getDailySummaryKey()),
    });
  } catch (error) {
    console.error('Error getting notification status:', error);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}
