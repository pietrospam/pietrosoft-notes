/**
 * API: POST /api/telegram/test
 * SPEC-007: Telegram Backup Notifications
 * 
 * Send a test message to verify Telegram configuration
 */

import { NextResponse } from 'next/server';
import { getTelegramConfig, TelegramService } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const config = await getTelegramConfig();
    
    // Validate configuration
    if (!config.botToken) {
      return NextResponse.json({ 
        success: false, 
        error: 'Bot Token no configurado' 
      });
    }
    
    if (!config.chatId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Chat ID no configurado' 
      });
    }
    
    const telegram = new TelegramService(config.botToken, config.chatId);
    
    // First test the connection
    const testResult = await telegram.testConnection();
    
    if (!testResult.ok) {
      return NextResponse.json({ 
        success: false, 
        error: testResult.error || 'Error de conexión con Telegram' 
      });
    }
    
    // Send test message
    const dateStr = new Date().toLocaleString('es-AR', { hour12: false });
    const message = 
      `🔔 <b>Prueba de Conexión</b>\n\n` +
      `✅ Conexión exitosa con Bitacora\n` +
      `🤖 Bot: @${testResult.botName}\n` +
      `📅 Fecha: ${dateStr}\n\n` +
      `Las notificaciones de backup están funcionando correctamente.`;
    
    const sent = await telegram.sendMessage(message);
    
    if (sent) {
      return NextResponse.json({ 
        success: true, 
        message: 'Mensaje de prueba enviado',
        botName: testResult.botName,
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: 'No se pudo enviar el mensaje. Verifica el Chat ID.' 
      });
    }
  } catch (error) {
    console.error('Error testing Telegram:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}
