/**
 * API: GET/PUT /api/telegram/todo-config
 * REQ-021: TODO Telegram Notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTelegramConfig, saveTelegramConfig } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

// GET - Retrieve TODO notification settings
export async function GET() {
  try {
    const config = await getTelegramConfig();
    
    return NextResponse.json({
      enabled: config.todoNotifications?.enabled ?? false,
      dailySummaryTime: config.todoNotifications?.dailySummaryTime ?? '08:00',
      reminderMinutes: config.todoNotifications?.reminderMinutes ?? [60, 15],
    });
  } catch (error) {
    console.error('Error getting TODO notification config:', error);
    return NextResponse.json({ error: 'Failed to get config' }, { status: 500 });
  }
}

// PUT - Update TODO notification settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const currentConfig = await getTelegramConfig();
    
    // Ensure we have a complete todoNotifications object with required enabled field
    const todoNotifications: { enabled: boolean; dailySummaryTime?: string; reminderMinutes?: number[] } = {
      enabled: currentConfig.todoNotifications?.enabled ?? false,
      dailySummaryTime: currentConfig.todoNotifications?.dailySummaryTime,
      reminderMinutes: currentConfig.todoNotifications?.reminderMinutes,
    };
    
    if (typeof body.enabled === 'boolean') {
      todoNotifications.enabled = body.enabled;
    }
    if (typeof body.dailySummaryTime === 'string') {
      todoNotifications.dailySummaryTime = body.dailySummaryTime;
    }
    if (Array.isArray(body.reminderMinutes)) {
      todoNotifications.reminderMinutes = body.reminderMinutes;
    }
    
    await saveTelegramConfig({ todoNotifications });
    
    return NextResponse.json({
      success: true,
      enabled: todoNotifications.enabled,
      dailySummaryTime: todoNotifications.dailySummaryTime,
      reminderMinutes: todoNotifications.reminderMinutes,
    });
  } catch (error) {
    console.error('Error updating TODO notification config:', error);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
