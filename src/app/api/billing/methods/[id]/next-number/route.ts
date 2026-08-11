import { NextResponse } from 'next/server';
import { getNextInvoiceNumberFromRuns } from '@/lib/repositories/billing-repo';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const invoiceNumber = await getNextInvoiceNumberFromRuns(params.id);
    return NextResponse.json({ nextInvoiceNumber: invoiceNumber });
  } catch (error) {
    console.error('Error getting next invoice number:', error);
    return NextResponse.json({ error: 'Failed to get next invoice number' }, { status: 500 });
  }
}
