import { Prisma } from '@prisma/client';
import prisma from '../db';
import type {
  BillingMethod,
  BillingRun,
  BillingPreview,
  BillingAuthType,
  CreateBillingMethodInput,
  UpdateBillingMethodInput,
} from '../types';

// ============================================================================
// Billing Methods Repository
// ============================================================================

type BillingMethodDbRow = {
  id: string;
  name: string;
  endpointUrl: string;
  authType: string;
  authConfig: Prisma.JsonValue | null;
  payloadTemplate: Prisma.JsonValue | null;
  nextInvoiceNumber: number;
  invoicePrefix: string | null;
  currency: string;
  paymentTermDays: number;
  clientParentId: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  client_name?: string | null;
};

function toBillingMethod(row: BillingMethodDbRow): BillingMethod {
  return {
    id: row.id,
    name: row.name,
    endpointUrl: row.endpointUrl,
    authType: row.authType as BillingAuthType,
    authConfig: (row.authConfig as BillingMethod['authConfig']) ?? undefined,
    payloadTemplate: (row.payloadTemplate as BillingMethod['payloadTemplate']) ?? undefined,
    nextInvoiceNumber: row.nextInvoiceNumber,
    invoicePrefix: row.invoicePrefix ?? undefined,
    currency: row.currency,
    paymentTermDays: row.paymentTermDays,
    clientParentId: row.clientParentId ?? '',
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    clientName: row.client_name ?? undefined,
  };
}

export async function getAllBillingMethods(filters?: { clientParentId?: string }): Promise<BillingMethod[]> {
  const rows = await prisma.$queryRaw<BillingMethodDbRow[]>(Prisma.sql`
    SELECT
      bm.id,
      bm.name,
      bm.endpoint_url AS "endpointUrl",
      bm.auth_type AS "authType",
      bm.auth_config AS "authConfig",
      bm.payload_template AS "payloadTemplate",
      bm.next_invoice_number AS "nextInvoiceNumber",
      bm.invoice_prefix AS "invoicePrefix",
      bm.currency,
      bm.payment_term_days AS "paymentTermDays",
      bm.client_parent_id AS "clientParentId",
      bm.active,
      bm.created_at AS "createdAt",
      bm.updated_at AS "updatedAt",
      c.name AS client_name
    FROM billing_methods bm
    LEFT JOIN clients c ON c.id = bm.client_parent_id
    WHERE bm.active = true
    ${filters?.clientParentId ? Prisma.sql`AND bm.client_parent_id = ${filters.clientParentId}` : Prisma.empty}
    ORDER BY bm.name ASC
  `);
  return rows.map(toBillingMethod);
}

export async function getBillingMethodById(id: string): Promise<BillingMethod | null> {
  const rows = await prisma.$queryRaw<BillingMethodDbRow[]>(Prisma.sql`
    SELECT
      bm.id,
      bm.name,
      bm.endpoint_url AS "endpointUrl",
      bm.auth_type AS "authType",
      bm.auth_config AS "authConfig",
      bm.payload_template AS "payloadTemplate",
      bm.next_invoice_number AS "nextInvoiceNumber",
      bm.invoice_prefix AS "invoicePrefix",
      bm.currency,
      bm.payment_term_days AS "paymentTermDays",
      bm.client_parent_id AS "clientParentId",
      bm.active,
      bm.created_at AS "createdAt",
      bm.updated_at AS "updatedAt",
      c.name AS client_name
    FROM billing_methods bm
    LEFT JOIN clients c ON c.id = bm.client_parent_id
    WHERE bm.id = ${id}
    LIMIT 1
  `);
  return rows[0] ? toBillingMethod(rows[0]) : null;
}

export async function createBillingMethod(input: CreateBillingMethodInput): Promise<BillingMethod> {
  const [row] = await prisma.$queryRaw<BillingMethodDbRow[]>(Prisma.sql`
    INSERT INTO billing_methods (
      name,
      endpoint_url,
      auth_type,
      auth_config,
      payload_template,
      next_invoice_number,
      invoice_prefix,
      currency,
      payment_term_days,
      client_parent_id,
      active,
      created_at,
      updated_at
    ) VALUES (
      ${input.name},
      ${input.endpointUrl},
      ${input.authType || 'none'},
      ${input.authConfig ? JSON.stringify(input.authConfig) : null}::jsonb,
      ${input.payloadTemplate ? JSON.stringify(input.payloadTemplate) : null}::jsonb,
      ${input.nextInvoiceNumber ?? 1},
      ${input.invoicePrefix ?? null},
      ${input.currency ?? 'EUR'},
      ${input.paymentTermDays ?? 0},
      ${input.clientParentId},
      ${input.active ?? true},
      now(),
      now()
    )
    RETURNING
      id,
      name,
      endpoint_url AS "endpointUrl",
      auth_type AS "authType",
      auth_config AS "authConfig",
      payload_template AS "payloadTemplate",
      next_invoice_number AS "nextInvoiceNumber",
      invoice_prefix AS "invoicePrefix",
      currency,
      payment_term_days AS "paymentTermDays",
      client_parent_id AS "clientParentId",
      active,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `);
  const created = row ? await getBillingMethodById(row.id) : null;
  if (!created) {
    throw new Error('Failed to create billing method');
  }
  return created;
}

export async function updateBillingMethod(id: string, input: UpdateBillingMethodInput): Promise<BillingMethod> {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE billing_methods
    SET
      name = COALESCE(${input.name}, name),
      endpoint_url = COALESCE(${input.endpointUrl}, endpoint_url),
      auth_type = COALESCE(${input.authType}, auth_type),
      auth_config = COALESCE(${input.authConfig !== undefined ? JSON.stringify(input.authConfig) : null}::jsonb, auth_config),
      payload_template = COALESCE(${input.payloadTemplate !== undefined ? JSON.stringify(input.payloadTemplate) : null}::jsonb, payload_template),
      next_invoice_number = COALESCE(${input.nextInvoiceNumber ?? null}, next_invoice_number),
      invoice_prefix = COALESCE(${input.invoicePrefix ?? null}, invoice_prefix),
      currency = COALESCE(${input.currency ?? null}, currency),
      payment_term_days = COALESCE(${input.paymentTermDays ?? null}, payment_term_days),
      client_parent_id = COALESCE(${input.clientParentId ?? null}, client_parent_id),
      active = COALESCE(${input.active ?? null}, active),
      updated_at = now()
    WHERE id = ${id}
  `);
  const updated = await getBillingMethodById(id);
  if (!updated) {
    throw new Error('Failed to update billing method');
  }
  return updated;
}

export async function deleteBillingMethod(id: string): Promise<void> {
  // Soft-delete: mark inactive
  await prisma.$executeRaw(Prisma.sql`
    UPDATE billing_methods
    SET active = false, updated_at = now()
    WHERE id = ${id}
  `);
}

// ============================================================================
// Billing Runs Repository
// ============================================================================

function toBillingRun(row: {
  id: string;
  clientParentId: string;
  year: number;
  month: number;
  methodId: string;
  invoiceTitle?: string | null;
  invoiceNumber?: string | null;
  totalHours: number;
  totalAmount?: number | null;
  currency?: string | null;
  exchangeRateUsd?: number | null;
  requestJson: unknown;
  responseStatus: number | null;
  responseBody: string | null;
  pdfData?: Buffer | null;
  pdfFilename: string | null;
  status: string;
  invoiceState: string;
  validated: boolean;
  sentToClient: boolean;
  locked: boolean;
  errorText: string | null;
  noteId: string | null;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
  method?: { name: string } | null;
  items?: Array<{
    id: string;
    billingRunId: string;
    name: string;
    quantity: number;
    unitCost: number;
    total: number;
    description?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
}): BillingRun {
  return {
    id: row.id,
    clientParentId: row.clientParentId,
    year: row.year,
    month: row.month,
    methodId: row.methodId,
    invoiceTitle: row.invoiceTitle ?? undefined,
    invoiceNumber: row.invoiceNumber ?? undefined,
    totalHours: row.totalHours,
    totalAmount: row.totalAmount ?? undefined,
    currency: row.currency ?? undefined,
    exchangeRateUsd: row.exchangeRateUsd ?? undefined,
    requestJson: row.requestJson as Record<string, unknown>,
    responseStatus: row.responseStatus ?? undefined,
    responseBody: row.responseBody ?? undefined,
    pdfFilename: row.pdfFilename ?? undefined,
    status: row.status as BillingRun['status'],
    invoiceState: row.invoiceState as BillingRun['invoiceState'],
    validated: row.validated,
    sentToClient: row.sentToClient,
    locked: row.locked,
    errorText: row.errorText ?? undefined,
    noteId: row.noteId ?? undefined,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    methodName: row.method?.name,
    items: row.items?.map((item) => ({
      id: item.id,
      billingRunId: item.billingRunId,
      name: item.name,
      quantity: item.quantity,
      unitCost: item.unitCost,
      total: item.total,
      description: item.description ?? undefined,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  };
}

export async function getBillingRuns(filters?: {
  clientParentId?: string;
  year?: number;
  month?: number;
}): Promise<BillingRun[]> {
  const where: Record<string, unknown> = {};
  if (filters?.clientParentId) where.clientParentId = filters.clientParentId;
  if (filters?.year) where.year = filters.year;
  if (filters?.month) where.month = filters.month;

  const rows = await prisma.billingRun.findMany({
    where,
    include: { method: { select: { name: true } }, items: true },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toBillingRun);
}

export async function getBillingRunById(id: string): Promise<BillingRun | null> {
  const row = await prisma.billingRun.findUnique({
    where: { id },
    include: { method: { select: { name: true } }, items: true },
  });
  return row ? toBillingRun(row) : null;
}

export async function createBillingRun(data: {
  clientParentId: string;
  year: number;
  month: number;
  methodId: string;
  invoiceTitle?: string;
  invoiceNumber?: string;
  totalHours: number;
  totalAmount?: number;
  currency?: string;
  exchangeRateUsd?: number;
  requestJson: object;
  responseStatus?: number;
  responseBody?: string;
  pdfData?: Buffer;
  pdfFilename?: string;
  status: string;
  invoiceState?: string;
  errorText?: string | null;
  noteId?: string;
  locked?: boolean;
  items?: Array<{ name: string; quantity: number; unitCost: number; total: number; description?: string }>;
  periodStart: Date;
  periodEnd: Date;
}): Promise<BillingRun> {
  const row = await prisma.billingRun.create({
    data: {
      clientParentId: data.clientParentId,
      year: data.year,
      month: data.month,
      methodId: data.methodId,
      invoiceTitle: data.invoiceTitle ?? null,
      invoiceNumber: data.invoiceNumber ?? null,
      totalHours: data.totalHours,
      totalAmount: data.totalAmount ?? null,
      currency: data.currency ?? null,
      exchangeRateUsd: data.exchangeRateUsd ?? null,
      requestJson: data.requestJson,
      responseStatus: data.responseStatus ?? null,
      responseBody: data.responseBody ?? null,
      pdfData: data.pdfData ?? null,
      pdfFilename: data.pdfFilename ?? null,
      status: data.status,
      invoiceState: data.invoiceState ?? 'borrador',
      validated: false,
      sentToClient: false,
      locked: data.locked ?? false,
      errorText: data.errorText ?? null,
      noteId: data.noteId ?? null,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      items: data.items ? {
        create: data.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitCost: item.unitCost,
          total: item.total,
          description: item.description ?? null,
        })),
      } : undefined,
    },
    include: { method: { select: { name: true } }, items: true },
  });
  return toBillingRun(row);
}

export async function updateBillingRun(id: string, data: {
  requestJson?: object;
  responseStatus?: number;
  responseBody?: string;
  pdfData?: Buffer;
  pdfFilename?: string;
  status?: string;
  invoiceState?: string;
  validated?: boolean;
  sentToClient?: boolean;
  invoiceTitle?: string;
  invoiceNumber?: string;
  currency?: string | null;
  totalAmount?: number | null;
  exchangeRateUsd?: number | null;
  items?: Array<{ name: string; quantity: number; unitCost: number; total: number; description?: string }>;
  noteId?: string | null;
  locked?: boolean;
  periodStart?: Date;
  periodEnd?: Date;
  errorText?: string | null;
}): Promise<BillingRun> {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (data.requestJson !== undefined) updateData.requestJson = data.requestJson;
  if (data.responseStatus !== undefined) updateData.responseStatus = data.responseStatus;
  if (data.responseBody !== undefined) updateData.responseBody = data.responseBody;
  if (data.pdfData !== undefined) updateData.pdfData = data.pdfData;
  if (data.pdfFilename !== undefined) updateData.pdfFilename = data.pdfFilename;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.validated !== undefined) updateData.validated = data.validated;
  if (data.sentToClient !== undefined) updateData.sentToClient = data.sentToClient;
  if (data.invoiceTitle !== undefined) updateData.invoiceTitle = data.invoiceTitle;
  if (data.invoiceNumber !== undefined) updateData.invoiceNumber = data.invoiceNumber;
  if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount;
  if (data.currency !== undefined) updateData.currency = data.currency;
  if (data.exchangeRateUsd !== undefined) updateData.exchangeRateUsd = data.exchangeRateUsd;
  if (data.noteId !== undefined) updateData.noteId = data.noteId;
  if (data.invoiceState !== undefined) updateData.invoiceState = data.invoiceState;
  if (data.locked !== undefined) updateData.locked = data.locked;
  if (data.periodStart !== undefined) updateData.periodStart = data.periodStart;
  if (data.periodEnd !== undefined) updateData.periodEnd = data.periodEnd;
  if (data.errorText !== undefined) updateData.errorText = data.errorText;

  const row = await prisma.billingRun.update({
    where: { id },
    data: {
      ...updateData,
      items: data.items
        ? {
            deleteMany: {},
            create: data.items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unitCost: item.unitCost,
              total: item.total,
              description: item.description ?? null,
            })),
          }
        : undefined,
    },
    include: { method: { select: { name: true } }, items: true },
  });
  return toBillingRun(row);
}

export async function deleteBillingRun(id: string): Promise<void> {
  await prisma.billingRun.delete({ where: { id } });
}

export async function getBillingRunPdf(id: string): Promise<{ data: Buffer; filename: string } | null> {
  const row = await prisma.billingRun.findUnique({
    where: { id },
    select: {
      pdfData: true,
      invoiceNumber: true,
      year: true,
      month: true,
      invoiceState: true,
      validated: true,
      sentToClient: true,
      clientParentId: true,
      pdfFilename: true,
    },
  });
  if (!row?.pdfData) return null;

  const client = await prisma.client.findUnique({
    where: { id: row.clientParentId },
    select: { name: true },
  });

  const clientName = client?.name || 'client';
  const filename = buildBillingPdfFilename(
    clientName,
    row.year,
    row.month,
    row.invoiceNumber ?? '00000000',
    row.invoiceState,
    row.validated,
    row.sentToClient
  );
  return {
    data: Buffer.from(row.pdfData),
    filename,
  };
}

function buildBillingPdfFilename(
  clientName: string,
  year: number,
  month: number,
  invoiceNumber: string,
  invoiceState?: string | null,
  validated?: boolean,
  sentToClient?: boolean
): string {
  const cleanClient = clientName
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_-]/g, '');
  const monthStr = String(month).padStart(2, '0');
  const finalizedStates = new Set(['validada', 'enviada', 'pagada']);
  const isFinal = finalizedStates.has(invoiceState || '') || validated || sentToClient;
  const prefix = isFinal ? '' : 'TEST_';
  return `${prefix}${cleanClient}_${year}_${monthStr}_${invoiceNumber}.pdf`;
}

// ============================================================================
// Billing Preview - calculate hours for a client/period
// ============================================================================

export async function getBillingPreview(
  clientParentId: string,
  year: number,
  month: number,
  periodStart?: Date,
  periodEnd?: Date
): Promise<BillingPreview> {
  // Get parent client name
  const parentClient = await prisma.client.findUnique({
    where: { id: clientParentId },
    select: { name: true },
  });

  // Get direct sub-client IDs following the TimeSheet filter semantics.
  // If the selected client has children, the TimeSheet view counts only those sub-clients.
  const directChildren = await prisma.client.findMany({
    where: { parentClientId: clientParentId },
    select: { id: true },
  });
  const clientIds = directChildren.length > 0
    ? directChildren.map(c => c.id)
    : [clientParentId];

  // Date range for the month in UTC, to match the TimeSheet UI month filter or use custom period
  const startDate = periodStart
    ? new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), periodStart.getUTCDate(), 0, 0, 0, 0))
    : new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endDate = periodEnd
    ? new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), periodEnd.getUTCDate(), 23, 59, 59, 999))
    : new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  // Find all FINAL positive timesheets for these clients in this period
  const timesheets = await prisma.timesheet.findMany({
    where: {
      state: 'FINAL',
      hoursWorked: { gt: 0 },
      workDate: { gte: startDate, lte: endDate },
      OR: [
        { clientId: { in: clientIds } },
        { project: { clientId: { in: clientIds } } },
        { task: { project: { clientId: { in: clientIds } } } },
      ],
    },
    include: {
      task: {
        select: {
          title: true,
          taskTicketPhaseCode: true,
          projectId: true,
          project: { select: { name: true } },
        },
      },
      project: {
        select: { name: true },
      },
    },
  });

  const totalHours = timesheets.reduce((sum, ts) => sum + ts.hoursWorked, 0);

  // Group by task for the existing preview entries
  const taskMap = new Map<string, { taskCode: string; taskTitle: string; projectName: string; hours: number }>();
  for (const ts of timesheets) {
    const key = ts.taskId || 'no-task';
    const existing = taskMap.get(key);
    if (existing) {
      existing.hours += ts.hoursWorked;
    } else {
      taskMap.set(key, {
        taskCode: ts.task?.taskTicketPhaseCode || '',
        taskTitle: ts.task?.title || 'Sin tarea',
        projectName: ts.project?.name || ts.task?.project?.name || 'Sin proyecto',
        hours: ts.hoursWorked,
      });
    }
  }

  // Group by day for the new daily preview
  const dailyMap = new Map<string, {
    date: string;
    totalHours: number;
    entries: Array<{ taskCode: string; taskTitle: string; projectName: string; description: string; hours: number }>;
  }>();
  for (const ts of timesheets) {
    const date = ts.workDate.toISOString().slice(0, 10);
    const existing = dailyMap.get(date);
    const entry = {
      taskCode: ts.task?.taskTicketPhaseCode || '',
      taskTitle: ts.task?.title || 'Sin tarea',
      projectName: ts.project?.name || ts.task?.project?.name || 'Sin proyecto',
      description: ts.description || '',
      hours: ts.hoursWorked,
    };
    if (existing) {
      existing.totalHours += ts.hoursWorked;
      existing.entries.push(entry);
    } else {
      dailyMap.set(date, {
        date,
        totalHours: ts.hoursWorked,
        entries: [entry],
      });
    }
  }

  return {
    clientParentId,
    clientName: parentClient?.name || 'Unknown',
    year,
    month,
    periodStart: startDate.toISOString().slice(0, 10),
    periodEnd: endDate.toISOString().slice(0, 10),
    totalHours,
    entryCount: timesheets.length,
    entries: Array.from(taskMap.values()).sort((a, b) => b.hours - a.hours),
    dailyEntries: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

// Get next invoice number for a specific method (sequential, per-method)
export async function getNextInvoiceNumber(methodId: string): Promise<string> {
  // Atomically read + increment the counter on the method
  const method = await prisma.billingMethod.update({
    where: { id: methodId },
    data: { nextInvoiceNumber: { increment: 1 } },
    select: { nextInvoiceNumber: true },
  });

  // The value BEFORE increment is nextInvoiceNumber - 1
  const num = method.nextInvoiceNumber - 1;
  return String(num).padStart(8, '0');
}

export async function getNextInvoiceNumberFromRuns(methodId: string): Promise<string> {
  const method = await prisma.billingMethod.findUnique({
    where: { id: methodId },
    select: { invoicePrefix: true },
  });
  if (!method) {
    throw new Error('Billing method not found');
  }

  const rows = await prisma.$queryRaw<{ maxNumber: number }[]>(Prisma.sql`
    SELECT
      COALESCE(MAX(NULLIF(regexp_replace(invoice_number, '\\D', '', 'g'), '')::int), 0) AS "maxNumber"
    FROM billing_runs
    WHERE method_id = ${methodId}
  `);

  const maxNumber = rows[0]?.maxNumber ?? 0;
  const nextNumber = maxNumber + 1;
  return `${method.invoicePrefix || ''}${String(nextNumber).padStart(8, '0')}`;
}

export async function peekNextInvoiceNumber(methodId: string): Promise<string> {
  const method = await prisma.billingMethod.findUnique({
    where: { id: methodId },
    select: { nextInvoiceNumber: true },
  });
  if (!method) {
    throw new Error('Billing method not found');
  }
  return String(method.nextInvoiceNumber).padStart(8, '0');
}

export async function bumpBillingMethodInvoiceNumber(methodId: string): Promise<void> {
  await prisma.billingMethod.update({
    where: { id: methodId },
    data: { nextInvoiceNumber: { increment: 1 } },
  });
}
