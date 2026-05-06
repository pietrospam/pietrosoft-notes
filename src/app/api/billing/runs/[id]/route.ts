import { NextResponse } from 'next/server';
import {
  getBillingRunById,
  updateBillingRun,
  deleteBillingRun,
  bumpBillingMethodInvoiceNumber,
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
    const existingRun = await getBillingRunById(params.id);
    if (!existingRun) {
      return NextResponse.json({ error: 'Billing run not found' }, { status: 404 });
    }

    if (body.sentToClient === true && !existingRun.sentToClient) {
      await bumpBillingMethodInvoiceNumber(existingRun.methodId);
    }

    const payload: {
      requestJson?: object;
      validated?: boolean;
      sentToClient?: boolean;
      invoiceNumber?: string;
      noteId?: string | null;
    } = {};

    if (body.requestJson !== undefined) payload.requestJson = body.requestJson;
    if (body.validated !== undefined) payload.validated = body.validated;
    if (body.sentToClient !== undefined) payload.sentToClient = body.sentToClient;
    if (body.invoiceNumber !== undefined) payload.invoiceNumber = body.invoiceNumber;
    if (body.noteId !== undefined) payload.noteId = body.noteId;

    const run = await updateBillingRun(params.id, payload);
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
