/**
 * API: POST /api/automations
 * REQ-022: Centralized automations endpoint
 * 
 * This endpoint is called every minute by the cron container.
 * It executes all registered automations and returns their results.
 */

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// Internal base URL for calling other API routes
const INTERNAL_BASE_URL = process.env.INTERNAL_API_URL || 'http://localhost:3000';
const STATUS_FILE = path.join(process.env.WORKSPACE_PATH || './data', 'automations-status.json');

interface AutomationResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
  data?: unknown;
}

interface AutomationsStatus {
  lastExecution: string;
  executionCount: number;
  results: {
    backups: AutomationResult;
    todoNotifications: AutomationResult;
  };
}

interface AutomationsResponse {
  timestamp: string;
  results: {
    backups: AutomationResult;
    todoNotifications: AutomationResult;
  };
}

/**
 * Read the current status file
 */
async function readStatus(): Promise<AutomationsStatus | null> {
  try {
    const content = await fs.readFile(STATUS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Write status to file
 */
async function writeStatus(status: AutomationsStatus): Promise<void> {
  await fs.writeFile(STATUS_FILE, JSON.stringify(status, null, 2));
}

/**
 * Execute a single automation by calling its API endpoint
 */
async function executeAutomation(endpoint: string, timeout = 30000): Promise<AutomationResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${INTERNAL_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const data = await response.json();

    return {
      success: response.ok,
      skipped: data.skipped,
      reason: data.reason,
      data,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: 'Timeout exceeded',
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * POST /api/automations
 * Execute all registered automations
 */
export async function POST(): Promise<NextResponse<AutomationsResponse>> {
  const timestamp = new Date().toISOString();

  // Execute automations in parallel
  const [backupsResult, todoNotificationsResult] = await Promise.all([
    executeAutomation('/api/backups/auto'),
    executeAutomation('/api/todos/notify'),
  ]);

  const response: AutomationsResponse = {
    timestamp,
    results: {
      backups: backupsResult,
      todoNotifications: todoNotificationsResult,
    },
  };

  // Save status to file for monitoring
  try {
    const currentStatus = await readStatus();
    const newStatus: AutomationsStatus = {
      lastExecution: timestamp,
      executionCount: (currentStatus?.executionCount || 0) + 1,
      results: response.results,
    };
    await writeStatus(newStatus);
  } catch (error) {
    console.error('Failed to save automation status:', error);
  }

  return NextResponse.json(response);
}

/**
 * GET /api/automations
 * Return list of registered automations and their status
 */
export async function GET() {
  const status = await readStatus();
  
  return NextResponse.json({
    automations: [
      {
        name: 'backups',
        endpoint: '/api/backups/auto',
        description: 'Automatic backups based on configured schedule',
      },
      {
        name: 'todoNotifications',
        endpoint: '/api/todos/notify',
        description: 'TODO deadline reminders and daily summaries',
      },
    ],
    cronSchedule: '* * * * *',
    note: 'Automations run every minute. Each automation decides internally if it should execute.',
    lastExecution: status?.lastExecution || null,
    executionCount: status?.executionCount || 0,
    lastResults: status?.results || null,
  });
}
