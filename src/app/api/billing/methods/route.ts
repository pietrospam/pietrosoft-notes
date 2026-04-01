import { NextResponse } from 'next/server';
import {
  getAllBillingMethods,
  createBillingMethod,
} from '@/lib/repositories/billing-repo';

// GET /api/billing/methods - List all active billing methods
export async function GET() {
  try {
    const methods = await getAllBillingMethods();
    return NextResponse.json(methods);
  } catch (error) {
    console.error('Error listing billing methods:', error);
    return NextResponse.json({ error: 'Failed to list billing methods' }, { status: 500 });
  }
}

// POST /api/billing/methods - Create a new billing method
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.name || !body.endpointUrl) {
      return NextResponse.json(
        { error: 'name and endpointUrl are required' },
        { status: 400 }
      );
    }

    const method = await createBillingMethod({
      name: body.name,
      endpointUrl: body.endpointUrl,
      authType: body.authType || 'none',
      authConfig: body.authConfig,
      payloadTemplate: body.payloadTemplate,
      nextInvoiceNumber: body.nextInvoiceNumber ?? 1,
      invoicePrefix: body.invoicePrefix,
      active: body.active ?? true,
    });

    return NextResponse.json(method, { status: 201 });
  } catch (error) {
    console.error('Error creating billing method:', error);
    return NextResponse.json({ error: 'Failed to create billing method' }, { status: 500 });
  }
}
