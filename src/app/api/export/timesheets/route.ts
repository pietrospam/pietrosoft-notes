export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { listNotes } from '@/lib/repositories/notes-repo';
import type { TimeSheet, TaskNote, Client, Project } from '@/lib/types';
import { Prisma } from '@prisma/client';

// Helper to escape CSV values
function escapeCSV(value: string | undefined | null): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  // If contains comma, newline, or quotes, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const format = searchParams.get('format') || 'json';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const clientId = searchParams.get('clientId');

    // Fetch required related data
    const [clients, projects, allNotes] = await Promise.all([
      prisma.client.findMany(),
      prisma.project.findMany(),
      listNotes(),
    ]);
    const tasks = (allNotes as TaskNote[]).filter(n => n.type === 'task');

    // Fetch timesheets with optional filters
    const where: Prisma.TimesheetWhereInput = {};
    if (startDate || endDate) {
      where.workDate = {};
      if (startDate) {
        where.workDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.workDate.lte = new Date(endDate);
      }
    }
    if (clientId) where.clientId = clientId;
    const rawTimesheets = await prisma.timesheet.findMany({ where });
    const timesheets: TimeSheet[] = rawTimesheets as unknown as TimeSheet[];

    // Create lookup maps for related entities
    const clientMap = new Map(clients.map(c => [c.id, c as unknown as Client]));
    const projectMap = new Map(projects.map(p => [p.id, p as unknown as Project]));
    const taskMap = new Map(tasks.map((t: TaskNote) => [t.id, t]));

    // Build enriched timesheet data
    const enrichedTimesheets = timesheets.map(ts => {
      const task = ts.taskId ? taskMap.get(ts.taskId) : undefined;
      const project = ts.projectId ? projectMap.get(ts.projectId) : task?.projectId ? projectMap.get(task.projectId) : null;
      const client = ts.clientId ? clientMap.get(ts.clientId) : project?.clientId ? clientMap.get(project.clientId) : task?.projectId ? clientMap.get(project?.clientId || '') : null;

      return {
        id: ts.id,
        workDate: ts.workDate,
        hoursWorked: ts.hoursWorked,
        description: ts.description,
        state: ts.state,
        taskTitle: task?.title || 'Unknown Task',
        taskId: ts.taskId,
        projectName: project?.name || '',
        projectId: project?.id || '',
        clientName: client?.name || '',
        clientId: client?.id || '',
      };
    });

    // Apply filters
    // filters applied at DB level already

    // Sort by date descending
    enrichedTimesheets.sort((a, b) => b.workDate.localeCompare(a.workDate));

    // Return JSON or CSV
    if (format === 'csv') {
      const headers = ['Date', 'Client', 'Project', 'Task', 'Hours', 'Description', 'State'];
      const rows = enrichedTimesheets.map(ts => [
        escapeCSV(ts.workDate),
        escapeCSV(ts.clientName),
        escapeCSV(ts.projectName),
        escapeCSV(ts.taskTitle),
        String(ts.hoursWorked),
        escapeCSV(ts.description),
        escapeCSV(ts.state),
      ].join(','));

      const csv = [headers.join(','), ...rows].join('\n');

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="timesheets-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Return JSON by default
    return NextResponse.json({
      timesheets: enrichedTimesheets,
      totals: {
        count: enrichedTimesheets.length,
        totalHours: enrichedTimesheets.reduce((sum, ts) => sum + ts.hoursWorked, 0),
      },
    });

  } catch (error) {
    console.error('Error exporting timesheets:', error);
    return NextResponse.json({ error: 'Failed to export timesheets' }, { status: 500 });
  }
}
