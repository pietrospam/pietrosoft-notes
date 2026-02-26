import { NextRequest, NextResponse } from 'next/server';
import { getActivityLogsForTask, createActivityLog } from '@/lib/repositories/activity-log-repo';
import type { TaskActivityEventType } from '@/lib/types';

// ============================================================================
// REQ-010: GET /api/notes/[id]/activity - Get activity logs for a task
// ============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const logs = await getActivityLogsForTask(id);
    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Failed to get activity logs:', error);
    return NextResponse.json(
      { error: 'Failed to get activity logs' },
      { status: 500 }
    );
  }
}

// ============================================================================
// REQ-010: POST /api/notes/[id]/activity - Create activity log (internal use)
// ============================================================================

interface CreateActivityLogBody {
  eventType: TaskActivityEventType;
  description?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: CreateActivityLogBody = await request.json();
    
    if (!body.eventType) {
      return NextResponse.json(
        { error: 'eventType is required' },
        { status: 400 }
      );
    }
    
    const log = await createActivityLog(id, body.eventType, body.description);
    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error('Failed to create activity log:', error);
    return NextResponse.json(
      { error: 'Failed to create activity log' },
      { status: 500 }
    );
  }
}
