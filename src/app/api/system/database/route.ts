import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [databaseInfo] = await prisma.$queryRaw<Array<{ database_name: string; database_size_bytes: number }>>`
      SELECT current_database()::text AS database_name,
             pg_database_size(current_database())::bigint AS database_size_bytes
    `;

    const tables = await prisma.$queryRaw<Array<{ table_name: string; row_count: number; size_bytes: number }>>`
      SELECT c.relname::text AS table_name,
             COALESCE(s.n_live_tup, 0)::bigint AS row_count,
             COALESCE(pg_total_relation_size(c.oid), 0)::bigint AS size_bytes
      FROM pg_class c
      LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
      WHERE c.relkind = 'r'
        AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ORDER BY c.relname ASC
    `;

    const totalRows = tables.reduce((sum, row) => sum + Number(row.row_count ?? 0), 0);
    const totalDiskBytes = tables.reduce((sum, row) => sum + Number(row.size_bytes ?? 0), 0);

    return NextResponse.json({
      databaseName: databaseInfo?.database_name ?? 'postgres',
      databaseSizeBytes: Number(databaseInfo?.database_size_bytes ?? 0),
      totalRows,
      totalDiskBytes,
      tableCount: tables.length,
      tables: tables.map((table) => ({
        tableName: table.table_name,
        rowCount: Number(table.row_count ?? 0),
        sizeBytes: Number(table.size_bytes ?? 0),
      })),
    });
  } catch (error) {
    console.error('Database metrics error:', error);
    return NextResponse.json(
      {
        error: 'No se pudo cargar la información de la base de datos.',
      },
      { status: 500 }
    );
  }
}
