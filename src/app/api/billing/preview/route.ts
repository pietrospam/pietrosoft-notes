import { NextResponse } from 'next/server';
import { getBillingPreview } from '@/lib/repositories/billing-repo';

// GET /api/billing/preview?clientParentId=X&year=Y&month=M
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientParentId = searchParams.get('clientParentId');
    const year = parseInt(searchParams.get('year') || '', 10);
    const month = parseInt(searchParams.get('month') || '', 10);

    if (!clientParentId || isNaN(year) || isNaN(month)) {
      return NextResponse.json(
        { error: 'clientParentId, year, and month are required' },
        { status: 400 }
      );
    }

    const preview = await getBillingPreview(clientParentId, year, month);
    return NextResponse.json(preview);
  } catch (error) {
    console.error('Error getting billing preview:', error);
    return NextResponse.json({ error: 'Failed to get billing preview' }, { status: 500 });
  }
}
