import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// REQ-008.2: Reorder favorites
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderedIds } = body as { orderedIds: string[] };

    if (!orderedIds || !Array.isArray(orderedIds)) {
      return NextResponse.json({ error: 'orderedIds array required' }, { status: 400 });
    }

    // Update each note's favoriteOrder in a transaction
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.note.update({
          where: { id },
          data: { favoriteOrder: index + 1 },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering favorites:', error);
    return NextResponse.json({ error: 'Failed to reorder favorites' }, { status: 500 });
  }
}
