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

function toBillingMethod(row: {
  id: string;
  name: string;
  endpointUrl: string;
  authType: string;
  authConfig: unknown;
  payloadTemplate: unknown;
  nextInvoiceNumber: number;
  invoicePrefix: string | null;
  clientParentId: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  client?: { name: string } | null;
}): BillingMethod {
  return {
    id: row.id,
    name: row.name,
    endpointUrl: row.endpointUrl,
    authType: row.authType as BillingAuthType,
    authConfig: (row.authConfig as BillingMethod['authConfig']) ?? undefined,
    payloadTemplate: (row.payloadTemplate as BillingMethod['payloadTemplate']) ?? undefined,
    nextInvoiceNumber: row.nextInvoiceNumber,
    invoicePrefix: row.invoicePrefix ?? undefined,
    clientParentId: row.clientParentId ?? '',
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    clientName: row.client?.name ?? undefined,
  };
}

export async function getAllBillingMethods(filters?: { clientParentId?: string }): Promise<BillingMethod[]> {
  const where: Record<string, unknown> = { active: true };
  if (filters?.clientParentId) where.clientParentId = filters.clientParentId;

  const rows = await prisma.billingMethod.findMany({
    where,
    include: { client: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });
  return rows.map(toBillingMethod);
}

export async function getBillingMethodById(id: string): Promise<BillingMethod | null> {
  const row = await prisma.billingMethod.findUnique({ where: { id } });
  return row ? toBillingMethod(row) : null;
}

export async function createBillingMethod(input: CreateBillingMethodInput): Promise<BillingMethod> {
  const row = await prisma.billingMethod.create({
    data: {
      name: input.name,
      endpointUrl: input.endpointUrl,
      authType: input.authType || 'none',
      authConfig: input.authConfig ? (input.authConfig as object) : undefined,
      payloadTemplate: input.payloadTemplate ? (input.payloadTemplate as object) : undefined,
      nextInvoiceNumber: input.nextInvoiceNumber ?? 1,
      invoicePrefix: input.invoicePrefix ?? null,
      clientParentId: input.clientParentId,
      active: input.active ?? true,
    },
    include: { client: { select: { name: true } } },
  });
  return toBillingMethod(row);
}

export async function updateBillingMethod(id: string, input: UpdateBillingMethodInput): Promise<BillingMethod> {
  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) data.name = input.name;
  if (input.endpointUrl !== undefined) data.endpointUrl = input.endpointUrl;
  if (input.authType !== undefined) data.authType = input.authType;
  if (input.authConfig !== undefined) data.authConfig = input.authConfig as object;
  if (input.payloadTemplate !== undefined) data.payloadTemplate = input.payloadTemplate as object;
  if (input.nextInvoiceNumber !== undefined) data.nextInvoiceNumber = input.nextInvoiceNumber;
  if (input.invoicePrefix !== undefined) data.invoicePrefix = input.invoicePrefix;
  if (input.clientParentId !== undefined) data.clientParentId = input.clientParentId;
  if (input.active !== undefined) data.active = input.active;

  const row = await prisma.billingMethod.update({ where: { id }, data, include: { client: { select: { name: true } } } });
  return toBillingMethod(row);
}

export async function deleteBillingMethod(id: string): Promise<void> {
  // Soft-delete: mark inactive
  await prisma.billingMethod.update({
    where: { id },
    data: { active: false, updatedAt: new Date() },
  });
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
  invoiceNumber: string | null;
  totalHours: number;
  totalAmount: number | null;
  currency: string | null;
  requestJson: unknown;
  responseStatus: number | null;
  responseBody: string | null;
  pdfData?: Buffer | null;
  pdfFilename: string | null;
  status: string;
  validated: boolean;
  sentToClient: boolean;
  errorText: string | null;
  noteId: string | null;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
  method?: { name: string } | null;
}): BillingRun {
  return {
    id: row.id,
    clientParentId: row.clientParentId,
    year: row.year,
    month: row.month,
    methodId: row.methodId,
    invoiceNumber: row.invoiceNumber ?? undefined,
    totalHours: row.totalHours,
    totalAmount: row.totalAmount ?? undefined,
    currency: row.currency ?? undefined,
    requestJson: row.requestJson as Record<string, unknown>,
    responseStatus: row.responseStatus ?? undefined,
    responseBody: row.responseBody ?? undefined,
    pdfFilename: row.pdfFilename ?? undefined,
    status: row.status as BillingRun['status'],
    validated: row.validated,
    sentToClient: row.sentToClient,
    errorText: row.errorText ?? undefined,
    noteId: row.noteId ?? undefined,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    methodName: row.method?.name,
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
    include: { method: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toBillingRun);
}

export async function getBillingRunById(id: string): Promise<BillingRun | null> {
  const row = await prisma.billingRun.findUnique({
    where: { id },
    include: { method: { select: { name: true } } },
  });
  return row ? toBillingRun(row) : null;
}

export async function createBillingRun(data: {
  clientParentId: string;
  year: number;
  month: number;
  methodId: string;
  invoiceNumber?: string;
  totalHours: number;
  totalAmount?: number;
  currency?: string;
  requestJson: object;
  responseStatus?: number;
  responseBody?: string;
  pdfData?: Buffer;
  pdfFilename?: string;
  status: string;
  errorText?: string;
  noteId?: string;
  periodStart: Date;
  periodEnd: Date;
}): Promise<BillingRun> {
  const row = await prisma.billingRun.create({
    data: {
      clientParentId: data.clientParentId,
      year: data.year,
      month: data.month,
      methodId: data.methodId,
      invoiceNumber: data.invoiceNumber ?? null,
      totalHours: data.totalHours,
      totalAmount: data.totalAmount ?? null,
      currency: data.currency ?? null,
      requestJson: data.requestJson,
      responseStatus: data.responseStatus ?? null,
      responseBody: data.responseBody ?? null,
      pdfData: data.pdfData ?? null,
      pdfFilename: data.pdfFilename ?? null,
      status: data.status,
      validated: false,
      sentToClient: false,
      errorText: data.errorText ?? null,
      noteId: data.noteId ?? null,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
    },
    include: { method: { select: { name: true } } },
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
  validated?: boolean;
  sentToClient?: boolean;
  invoiceNumber?: string;
  noteId?: string | null;
  periodStart?: Date;
  periodEnd?: Date;
  errorText?: string;
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
  if (data.invoiceNumber !== undefined) updateData.invoiceNumber = data.invoiceNumber;
  if (data.noteId !== undefined) updateData.noteId = data.noteId;
  if (data.periodStart !== undefined) updateData.periodStart = data.periodStart;
  if (data.periodEnd !== undefined) updateData.periodEnd = data.periodEnd;
  if (data.errorText !== undefined) updateData.errorText = data.errorText;

  const row = await prisma.billingRun.update({
    where: { id },
    data: updateData,
    include: { method: { select: { name: true } } },
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
      validated: true,
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
    row.validated
  );
  return {
    data: Buffer.from(row.pdfData),
    filename,
  };
}

function buildBillingPdfFilename(clientName: string, year: number, month: number, invoiceNumber: string, validated: boolean): string {
  const cleanClient = clientName
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_-]/g, '');
  const monthStr = String(month).padStart(2, '0');
  const prefix = validated ? '' : 'TEST_';
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
