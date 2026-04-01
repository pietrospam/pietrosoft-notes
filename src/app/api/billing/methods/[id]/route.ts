import { NextResponse } from 'next/server';
import {
  getBillingMethodById,
  updateBillingMethod,
  deleteBillingMethod,
} from '@/lib/repositories/billing-repo';

// GET /api/billing/methods/[id]
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const method = await getBillingMethodById(params.id);
    if (!method) {
      return NextResponse.json({ error: 'Billing method not found' }, { status: 404 });
    }
    return NextResponse.json(method);
  } catch (error) {
    console.error('Error getting billing method:', error);
    return NextResponse.json({ error: 'Failed to get billing method' }, { status: 500 });
  }
}

// PUT /api/billing/methods/[id]
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const method = await updateBillingMethod(params.id, body);
    return NextResponse.json(method);
  } catch (error) {
    console.error('Error updating billing method:', error);
    return NextResponse.json({ error: 'Failed to update billing method' }, { status: 500 });
  }
}

// DELETE /api/billing/methods/[id]
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await deleteBillingMethod(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting billing method:', error);
    return NextResponse.json({ error: 'Failed to delete billing method' }, { status: 500 });
  }
}
