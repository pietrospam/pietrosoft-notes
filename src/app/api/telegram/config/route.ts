/**
 * API: GET/PUT /api/telegram/config
 * SPEC-007: Telegram Backup Notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTelegramConfig, saveTelegramConfig, obfuscateToken } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

// GET - Retrieve current configuration (token obfuscated)
export async function GET() {
  try {
    const config = await getTelegramConfig();
    
    return NextResponse.json({
      enabled: config.enabled,
      botToken: obfuscateToken(config.botToken),
      hasToken: !!config.botToken,
      chatId: config.chatId,
      notifyAuto: config.notifyAuto,
      notifyManual: config.notifyManual,
      notifyErrors: config.notifyErrors,
      sendFile: config.sendFile,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error getting Telegram config:', error);
    return NextResponse.json({ error: `Failed to get config: ${message}` }, { status: 500 });
  }
}

// PUT - Update configuration
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    
    // Only update provided fields
    const updates: Record<string, unknown> = {};
    
    if (typeof body.enabled === 'boolean') updates.enabled = body.enabled;
    if (typeof body.botToken === 'string' && body.botToken) updates.botToken = body.botToken;
    if (typeof body.chatId === 'string') updates.chatId = body.chatId;
    if (typeof body.notifyAuto === 'boolean') updates.notifyAuto = body.notifyAuto;
    if (typeof body.notifyManual === 'boolean') updates.notifyManual = body.notifyManual;
    if (typeof body.notifyErrors === 'boolean') updates.notifyErrors = body.notifyErrors;
    if (typeof body.sendFile === 'boolean') updates.sendFile = body.sendFile;
    
    const newConfig = await saveTelegramConfig(updates);
    
    return NextResponse.json({
      success: true,
      enabled: newConfig.enabled,
      botToken: obfuscateToken(newConfig.botToken),
      hasToken: !!newConfig.botToken,
      chatId: newConfig.chatId,
      notifyAuto: newConfig.notifyAuto,
      notifyManual: newConfig.notifyManual,
      notifyErrors: newConfig.notifyErrors,
      sendFile: newConfig.sendFile,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error updating Telegram config:', error);
    return NextResponse.json({ error: `Failed to update config: ${message}` }, { status: 500 });
  }
}
