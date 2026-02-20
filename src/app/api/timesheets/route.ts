import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { NoteType as PrismaNoteType } from '@prisma/client';

// TimeSheet entry with enriched data for the grid
export interface TimeSheetGridEntry {
  id: string;
  workDate: string;
  hoursWorked: number;
  description: string;
  taskId: string;
  taskTitle: string;
  taskCode: string; // Short code for display (e.g., first 8 chars of ID)
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  state: string; // DRAFT or FINAL
  createdAt: string;
  updatedAt: string;
}

// GET /api/timesheets - List all timesheets with enriched data
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const projectId = searchParams.get('projectId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Query all timesheets with related task, project, and client
    const timesheets = await prisma.note.findMany({
      where: {
        type: PrismaNoteType.TIMESHEET,
        archived: false,
        ...(startDate && {
          timesheetDate: {
            gte: new Date(startDate),
          },
        }),
        ...(endDate && {
          timesheetDate: {
            lte: new Date(endDate),
          },
        }),
      },
      include: {
        timesheetTask: {
          include: {
            project: {
              include: {
                client: true,
              },
            },
          },
        },
      },
      orderBy: {
        timesheetDate: 'asc',
      },
    });

    // Filter by client/project if specified (through task's project)
    let filteredTimesheets = timesheets;
    if (clientId) {
      filteredTimesheets = filteredTimesheets.filter(
        ts => ts.timesheetTask?.project?.clientId === clientId
      );
    }
    if (projectId) {
      filteredTimesheets = filteredTimesheets.filter(
        ts => ts.timesheetTask?.projectId === projectId
      );
    }

    // Transform to grid entries
    const entries: TimeSheetGridEntry[] = filteredTimesheets.map(ts => ({
      id: ts.id,
      workDate: ts.timesheetDate?.toISOString().split('T')[0] || '',
      hoursWorked: ts.timesheetHours || 0,
      description: ts.content || '',
      taskId: ts.timesheetTaskId || '',
      taskTitle: ts.timesheetTask?.title || 'Sin tarea',
      taskCode: ts.timesheetTask?.id.substring(0, 8) || '',
      projectId: ts.timesheetTask?.projectId || '',
      projectName: ts.timesheetTask?.project?.name || 'Sin proyecto',
      clientId: ts.timesheetTask?.project?.clientId || '',
      clientName: ts.timesheetTask?.project?.client?.name || 'Sin cliente',
      state: ts.timesheetState || 'DRAFT',
      createdAt: ts.createdAt.toISOString(),
      updatedAt: ts.updatedAt.toISOString(),
    }));

    return NextResponse.json(entries);
  } catch (error) {
    console.error('Error listing timesheets:', error);
    return NextResponse.json(
      { error: 'Failed to list timesheets' },
      { status: 500 }
    );
  }
}

// DELETE /api/timesheets/:id is handled by /api/notes/[id]/route.ts
// The delete endpoint already exists and works for all note types
