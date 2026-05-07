import { NextResponse } from 'next/server';
import { getBillingRunPdf } from '@/lib/repositories/billing-repo';

// GET /api/billing/runs/[id]/pdf - Download the PDF for a billing run
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const asAttachment = searchParams.get('download') === 'true';

    const result = await getBillingRunPdf(params.id);
    if (!result) {
      return NextResponse.json({ error: 'PDF not found for this billing run' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(result.data), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${asAttachment ? 'attachment' : 'inline'}; filename="${result.filename}"`,
        'Content-Length': String(result.data.length),
      },
    });
  } catch (error) {
    console.error('Error downloading billing PDF:', error);
    return NextResponse.json({ error: 'Failed to download PDF' }, { status: 500 });
  }
}
