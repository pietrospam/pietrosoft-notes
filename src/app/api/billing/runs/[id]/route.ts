import { NextResponse } from 'next/server';
import {
  getBillingRunById,
  updateBillingRun,
  deleteBillingRun,
} from '@/lib/repositories/billing-repo';

// GET /api/billing/runs/[id] - Get a single billing run
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const run = await getBillingRunById(params.id);
    if (!run) {
      return NextResponse.json({ error: 'Billing run not found' }, { status: 404 });
    }
    return NextResponse.json(run);
  } catch (error) {
    console.error('Error getting billing run:', error);
    return NextResponse.json({ error: 'Failed to get billing run' }, { status: 500 });
  }
}

// PUT /api/billing/runs/[id] - Update a billing run (e.g. edit request JSON)
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const run = await updateBillingRun(params.id, body);
    return NextResponse.json(run);
  } catch (error) {
    console.error('Error updating billing run:', error);
    return NextResponse.json({ error: 'Failed to update billing run' }, { status: 500 });
  }
}

// DELETE /api/billing/runs/[id] - Delete a billing run
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await deleteBillingRun(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting billing run:', error);
    return NextResponse.json({ error: 'Failed to delete billing run' }, { status: 500 });
  }
}
