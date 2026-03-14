import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const BACKUP_DIR = process.env.BACKUP_DIR || './backups';

interface BackupSettings {
  retentionCount: number;        // Max number of backups to keep (0 = unlimited)
  autoBackupEnabled: boolean;    // Whether auto-backup is enabled
  autoBackupFrequency: 'daily' | 'weekly' | 'monthly';  // Frequency of auto-backups
  autoBackupTime: string;        // Time of day for auto-backup (HH:MM format)
  lastAutoBackup?: string;       // ISO date of last auto-backup
}

const DEFAULT_SETTINGS: BackupSettings = {
  retentionCount: 10,
  autoBackupEnabled: false,
  autoBackupFrequency: 'daily',
  autoBackupTime: '03:00',
};

async function getSettingsPath(): Promise<string> {
  const resolvedDir = path.resolve(BACKUP_DIR);
  await fs.mkdir(resolvedDir, { recursive: true });
  return path.join(resolvedDir, 'backup-settings.json');
}

async function readSettings(): Promise<BackupSettings> {
  const settingsPath = await getSettingsPath();
  try {
    const content = await fs.readFile(settingsPath, 'utf-8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(content) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function writeSettings(settings: BackupSettings): Promise<void> {
  const settingsPath = await getSettingsPath();
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
}

// GET /api/backups/settings - Get backup settings
export async function GET() {
  try {
    const settings = await readSettings();
    const resolvedPath = path.resolve(BACKUP_DIR);
    
    return NextResponse.json({
      ...settings,
      backupDirectory: resolvedPath,
    });
  } catch (error) {
    console.error('Error reading backup settings:', error);
    return NextResponse.json({ error: 'Failed to read settings' }, { status: 500 });
  }
}

// PUT /api/backups/settings - Update backup settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const currentSettings = await readSettings();
    
    const newSettings: BackupSettings = {
      retentionCount: typeof body.retentionCount === 'number' 
        ? Math.max(0, Math.floor(body.retentionCount)) 
        : currentSettings.retentionCount,
      autoBackupEnabled: typeof body.autoBackupEnabled === 'boolean'
        ? body.autoBackupEnabled
        : currentSettings.autoBackupEnabled,
      autoBackupFrequency: ['daily', 'weekly', 'monthly'].includes(body.autoBackupFrequency)
        ? body.autoBackupFrequency
        : currentSettings.autoBackupFrequency,
      autoBackupTime: typeof body.autoBackupTime === 'string' && /^\d{2}:\d{2}$/.test(body.autoBackupTime)
        ? body.autoBackupTime
        : currentSettings.autoBackupTime,
      // Preserve lastAutoBackup - only updated when a real backup is created
      lastAutoBackup: currentSettings.lastAutoBackup,
    };
    
    await writeSettings(newSettings);
    
    const resolvedPath = path.resolve(BACKUP_DIR);
    
    return NextResponse.json({
      success: true,
      settings: {
        ...newSettings,
        backupDirectory: resolvedPath,
      },
    });
  } catch (error) {
    console.error('Error updating backup settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
