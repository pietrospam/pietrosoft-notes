import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@/lib/db';

// TimeSheet entry with enriched data for the grid
export interface TimeSheetGridEntry {
  id: string;
  workDate: string;
  hoursWorked: number;
  description: string;
  taskId: string;
  taskTitle: string;
  taskCode: string; // Ticket/Phase code from the task (taskTicketPhaseCode)
  taskShortDescription: string; // Short description from the task
  projectId: string;
  projectName: string;
  projectCode: string; // Optional project code (e.g. PRJ-001)
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
    const taskId = searchParams.get('taskId');
    const workDate = searchParams.get('workDate');

    // Build query filters
    const where: import('@prisma/client').Prisma.TimesheetWhereInput = {};
    if (startDate || endDate) {
      where.workDate = {};
      if (startDate) {
        where.workDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.workDate.lte = new Date(endDate);
      }
    }
    if (taskId) {
      where.taskId = taskId;
    }
    if (workDate) {
      where.workDate = new Date(workDate);
    }

    // Query timesheets with related task, project, and client
    const timesheets = await prisma.timesheet.findMany({
      where,
      include: {
        task: {
          include: {
            project: {
              include: {
                client: true,
              },
            },
          },
        },
        project: true,
        client: true,
      },
      orderBy: {
        workDate: 'asc',
      },
    });

    // Additional filtering by client/project using task association
    let filteredTimesheets = timesheets;
    if (clientId) {
      filteredTimesheets = filteredTimesheets.filter(
        ts => ts.task?.project?.clientId === clientId
      );
    }
    if (projectId) {
      filteredTimesheets = filteredTimesheets.filter(
        ts => ts.task?.projectId === projectId
      );
    }

    // Transform to grid entries
    const entries: TimeSheetGridEntry[] = filteredTimesheets.map(ts => ({
      id: ts.id,
      workDate: ts.workDate.toISOString().split('T')[0],
      hoursWorked: ts.hoursWorked,
      description: ts.description || '',
      taskId: ts.taskId || '',
      taskTitle: ts.task?.title || 'Sin tarea',
      taskCode: ts.task?.taskTicketPhaseCode || '',
      taskShortDescription: ts.task?.taskShortDescription || '',
      projectId: ts.projectId || ts.task?.projectId || '',
      projectName: ts.project?.name || ts.task?.project?.name || 'Sin proyecto',
      projectCode: ts.project?.code || ts.task?.project?.code || '',
      clientId: ts.clientId || ts.task?.project?.clientId || '',
      clientName: ts.client?.name || ts.task?.project?.client?.name || 'Sin cliente',
      state: ts.state || 'DRAFT',
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

// POST /api/timesheets - create new entry
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Basic validation
    if (!body.workDate) {
      return NextResponse.json({ error: 'workDate is required' }, { status: 400 });
    }
    if (body.hoursWorked === undefined || body.hoursWorked === null || isNaN(body.hoursWorked)) {
      return NextResponse.json({ error: 'hoursWorked must be a number' }, { status: 400 });
    }

    const created = await prisma.timesheet.create({
      data: {
        id: randomUUID(),
        workDate: new Date(body.workDate),
        hoursWorked: body.hoursWorked,
        description: body.description || null,
        taskId: body.taskId || null,
        projectId: body.projectId || null,
        clientId: body.clientId || null,
        rate: body.rate || null,
        state: body.state || undefined,
      },
    });
    return NextResponse.json(created);
  } catch (error) {
    console.error('Error creating timesheet:', error);
    // forward message if available
    const msg = (error instanceof Error ? error.message : 'Failed to create timesheet');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE/PUT for individual items moved to /api/timesheets/[id] routes
