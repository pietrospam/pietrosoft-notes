import { NextRequest, NextResponse } from 'next/server';
import { listNotes } from '@/lib/repositories/notes-repo';
import { listClients } from '@/lib/repositories/clients-repo';
import { listProjects } from '@/lib/repositories/projects-repo';
import type { TimeSheetNote, TaskNote, Client, Project } from '@/lib/types';

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

    // Fetch all required data
    const [allNotes, clients, projects] = await Promise.all([
      listNotes(),
      listClients(),
      listProjects(),
    ]);

    // Get all timesheets and tasks
    const timesheets = allNotes.filter((n): n is TimeSheetNote => n.type === 'timesheet');
    const tasks = allNotes.filter((n): n is TaskNote => n.type === 'task');

    // Create lookup maps
    const clientMap = new Map(clients.map((c: Client) => [c.id, c]));
    const projectMap = new Map(projects.map((p: Project) => [p.id, p]));
    const taskMap = new Map(tasks.map((t: TaskNote) => [t.id, t]));

    // Build enriched timesheet data
    let enrichedTimesheets = timesheets.map(ts => {
      const task = taskMap.get(ts.taskId);
      const project = task?.projectId ? projectMap.get(task.projectId) : null;
      const client = project?.clientId ? clientMap.get(project.clientId) : null;

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
    if (startDate) {
      enrichedTimesheets = enrichedTimesheets.filter(ts => ts.workDate >= startDate);
    }
    if (endDate) {
      enrichedTimesheets = enrichedTimesheets.filter(ts => ts.workDate <= endDate);
    }
    if (clientId) {
      enrichedTimesheets = enrichedTimesheets.filter(ts => ts.clientId === clientId);
    }

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
