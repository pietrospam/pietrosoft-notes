import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET, PUT, DELETE for individual timesheet
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const ts = await prisma.timesheet.findUnique({ where: { id } });
    if (!ts) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(ts);
  } catch (error) {
    console.error('Error fetching timesheet:', error);
    return NextResponse.json({ error: 'Failed to fetch timesheet' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await request.json();
    const updated = await prisma.timesheet.update({
      where: { id },
      data: {
        ...(body.workDate ? { workDate: new Date(body.workDate) } : {}),
        ...(typeof body.hoursWorked === 'number' ? { hoursWorked: body.hoursWorked } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.taskId !== undefined ? { taskId: body.taskId } : {}),
        ...(body.projectId !== undefined ? { projectId: body.projectId } : {}),
        ...(body.clientId !== undefined ? { clientId: body.clientId } : {}),
        ...(body.rate !== undefined ? { rate: body.rate } : {}),
        ...(body.state !== undefined ? { state: body.state } : {}),
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating timesheet:', error);
    return NextResponse.json({ error: 'Failed to update timesheet' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    await prisma.timesheet.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting timesheet:', error);
    return NextResponse.json({ error: 'Failed to delete timesheet' }, { status: 500 });
  }
}
