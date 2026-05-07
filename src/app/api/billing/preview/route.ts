import { NextRequest, NextResponse } from 'next/server';
import { getBillingPreview } from '@/lib/repositories/billing-repo';

// GET /api/billing/preview?clientParentId=X&year=Y&month=M&periodStart=YYYY-MM-DD&periodEnd=YYYY-MM-DD
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientParentId = searchParams.get('clientParentId');
    const year = parseInt(searchParams.get('year') || '', 10);
    const month = parseInt(searchParams.get('month') || '', 10);
    const periodStartParam = searchParams.get('periodStart');
    const periodEndParam = searchParams.get('periodEnd');

    if (!clientParentId || isNaN(year) || isNaN(month)) {
      return NextResponse.json(
        { error: 'clientParentId, year, and month are required' },
        { status: 400 }
      );
    }

    let periodStart: Date | undefined;
    let periodEnd: Date | undefined;
    if (periodStartParam) {
      periodStart = new Date(periodStartParam);
      if (Number.isNaN(periodStart.getTime())) {
        return NextResponse.json({ error: 'periodStart is invalid' }, { status: 400 });
      }
    }
    if (periodEndParam) {
      periodEnd = new Date(periodEndParam);
      if (Number.isNaN(periodEnd.getTime())) {
        return NextResponse.json({ error: 'periodEnd is invalid' }, { status: 400 });
      }
    }

    const preview = await getBillingPreview(clientParentId, year, month, periodStart, periodEnd);
    return NextResponse.json(preview);
  } catch (error) {
    console.error('Error getting billing preview:', error);
    return NextResponse.json({ error: 'Failed to get billing preview' }, { status: 500 });
  }
}
