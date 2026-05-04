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
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
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
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getAllBillingMethods(): Promise<BillingMethod[]> {
  const rows = await prisma.billingMethod.findMany({
    where: { active: true },
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
      active: input.active ?? true,
    },
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
  if (input.active !== undefined) data.active = input.active;

  const row = await prisma.billingMethod.update({ where: { id }, data });
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
  errorText: string | null;
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
    errorText: row.errorText ?? undefined,
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
      errorText: data.errorText ?? null,
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
  errorText?: string;
}): Promise<BillingRun> {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (data.requestJson !== undefined) updateData.requestJson = data.requestJson;
  if (data.responseStatus !== undefined) updateData.responseStatus = data.responseStatus;
  if (data.responseBody !== undefined) updateData.responseBody = data.responseBody;
  if (data.pdfData !== undefined) updateData.pdfData = data.pdfData;
  if (data.pdfFilename !== undefined) updateData.pdfFilename = data.pdfFilename;
  if (data.status !== undefined) updateData.status = data.status;
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
    select: { pdfData: true, pdfFilename: true },
  });
  if (!row?.pdfData) return null;
  return {
    data: Buffer.from(row.pdfData),
    filename: row.pdfFilename || `invoice-${id}.pdf`,
  };
}

// ============================================================================
// Billing Preview - calculate hours for a client/period
// ============================================================================

export async function getBillingPreview(
  clientParentId: string,
  year: number,
  month: number
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

  // Date range for the month in UTC, to match the TimeSheet UI month filter
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

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
    },
  });

  const totalHours = timesheets.reduce((sum, ts) => sum + ts.hoursWorked, 0);

  // Group by task
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
        projectName: ts.task?.project?.name || 'Sin proyecto',
        hours: ts.hoursWorked,
      });
    }
  }

  return {
    clientParentId,
    clientName: parentClient?.name || 'Unknown',
    year,
    month,
    totalHours,
    entryCount: timesheets.length,
    entries: Array.from(taskMap.values()).sort((a, b) => b.hours - a.hours),
  };
}

// Get next invoice number for a specific method (sequential, per-method)
export async function getNextInvoiceNumber(methodId: string): Promise<string> {
  // Atomically read + increment the counter on the method
  const method = await prisma.billingMethod.update({
    where: { id: methodId },
    data: { nextInvoiceNumber: { increment: 1 } },
    select: { nextInvoiceNumber: true, invoicePrefix: true },
  });

  // The value BEFORE increment is nextInvoiceNumber - 1
  const num = method.nextInvoiceNumber - 1;
  const padded = String(num).padStart(8, '0');
  const prefix = method.invoicePrefix || '';
  return `${prefix}${padded}`;
}
