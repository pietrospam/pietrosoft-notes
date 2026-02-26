import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST /api/workspace/wipe - delete all persisted data (database + data directory)
export async function POST() {
  try {
    // wipe database tables in order of dependencies
    await prisma.$transaction([
      prisma.taskActivityLog.deleteMany(),
      prisma.attachment.deleteMany(),
      prisma.note.deleteMany(),
      prisma.project.deleteMany(),
      prisma.client.deleteMany(),
    ]);
  } catch (err) {
    console.error('Error wiping database:', err);
    return NextResponse.json({ error: 'Database wipe failed' }, { status: 500 });
  }

  // also remove data directory if present
  const fs = await import('fs');
  const path = await import('path');
  const DATA_DIR = process.env.DATA_DIR || './data';
  try {
    const resolved = path.resolve(DATA_DIR);
    await fs.promises.rm(resolved, { recursive: true, force: true });
  } catch (err) {
    // non-fatal, log and continue
    console.warn('Failed to clear data directory:', err);
  }

  return NextResponse.json({ success: true });
}