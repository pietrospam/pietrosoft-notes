import { NextResponse } from 'next/server';
import {
  getBillingRuns,
  getBillingMethodById,
  getBillingPreview,
  getNextInvoiceNumber,
  createBillingRun,
} from '@/lib/repositories/billing-repo';
import type { BillingAuthConfig, BillingAuthType } from '@/lib/types';

// GET /api/billing/runs - List billing runs (optionally filtered)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters: { clientParentId?: string; year?: number; month?: number } = {};
    const clientParentId = searchParams.get('clientParentId');
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    if (clientParentId) filters.clientParentId = clientParentId;
    if (year) filters.year = parseInt(year, 10);
    if (month) filters.month = parseInt(month, 10);

    const runs = await getBillingRuns(filters);
    return NextResponse.json(runs);
  } catch (error) {
    console.error('Error listing billing runs:', error);
    return NextResponse.json({ error: 'Failed to list billing runs' }, { status: 500 });
  }
}

// POST /api/billing/runs - Execute a billing run (generate invoice)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientParentId, year, month, methodId, requestJsonOverride } = body;

    if (!clientParentId || !year || !month || !methodId) {
      return NextResponse.json(
        { error: 'clientParentId, year, month, and methodId are required' },
        { status: 400 }
      );
    }

    // Load the billing method
    const method = await getBillingMethodById(methodId);
    if (!method) {
      return NextResponse.json({ error: 'Billing method not found' }, { status: 404 });
    }

    // Get preview data (hours summary)
    const preview = await getBillingPreview(clientParentId, year, month);
    if (preview.totalHours === 0) {
      return NextResponse.json(
        { error: 'No hay horas en estado FINAL para el período seleccionado' },
        { status: 400 }
      );
    }

    // Get next invoice number (per billing method)
    const invoiceNumber = await getNextInvoiceNumber(methodId);
    const invoiceDate = new Date(Date.UTC(year, month, 0, 0, 0, 0, 0));
    const payloadInvoiceNumber = stripInvoicePrefix(invoiceNumber, method.invoicePrefix);

    // Build request payload from template + preview data
    let requestPayload: Record<string, unknown>;

    if (requestJsonOverride) {
      // Use override payload (for re-sends with edits)
      requestPayload = requestJsonOverride;
    } else if (method.payloadTemplate) {
      // Use template and fill in dynamic fields
      requestPayload = buildPayloadFromTemplate(method.payloadTemplate, preview, payloadInvoiceNumber, invoiceDate);
    } else {
      // Default: invoice-generator.com format
      requestPayload = buildDefaultPayload(preview, payloadInvoiceNumber, invoiceDate);
    }

    // Build auth headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    applyAuth(headers, method.authType as BillingAuthType, method.authConfig as BillingAuthConfig | undefined);

    // Build URL (with query auth if needed)
    let url = method.endpointUrl;
    if (method.authType === 'apiKeyQuery' && method.authConfig) {
      const config = method.authConfig as BillingAuthConfig;
      if (config.queryParam && config.queryValue) {
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}${encodeURIComponent(config.queryParam)}=${encodeURIComponent(config.queryValue)}`;
      }
    }

    // Execute the external API call
    let responseStatus: number | undefined;
    let responseBody: string | undefined;
    let pdfData: Buffer | undefined;
    let pdfFilename: string | undefined;
    let status: 'success' | 'failed' = 'failed';
    let errorText: string | undefined;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      responseStatus = res.status;

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/pdf')) {
          const arrayBuffer = await res.arrayBuffer();
          pdfData = Buffer.from(arrayBuffer);
          pdfFilename = `invoice-${invoiceNumber}.pdf`;
          status = 'success';
        } else {
          // Some APIs return JSON with a PDF URL or other formats
          responseBody = await res.text();
          status = 'success';
        }
      } else {
        responseBody = await res.text();
        errorText = `HTTP ${res.status}: ${responseBody.substring(0, 500)}`;
      }
    } catch (fetchError) {
      errorText = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
    }

    // Calculate total amount if rate info is available in template
    const totalAmount = calculateTotalAmount(requestPayload);

    // Save the billing run
    const billingRun = await createBillingRun({
      clientParentId,
      year,
      month,
      methodId,
      invoiceNumber,
      totalHours: preview.totalHours,
      totalAmount,
      currency: (requestPayload.currency as string) || undefined,
      requestJson: requestPayload,
      responseStatus,
      responseBody,
      pdfData,
      pdfFilename,
      status,
      errorText,
    });

    return NextResponse.json(billingRun, { status: status === 'success' ? 201 : 200 });
  } catch (error) {
    console.error('Error executing billing run:', error);
    const msg = error instanceof Error ? error.message : 'Failed to execute billing run';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ============================================================================
// Helper functions
// ============================================================================

function applyAuth(
  headers: Record<string, string>,
  authType: BillingAuthType,
  authConfig?: BillingAuthConfig
) {
  if (!authConfig) return;

  switch (authType) {
    case 'bearer':
      if (authConfig.token) {
        headers['Authorization'] = `Bearer ${authConfig.token}`;
      }
      break;
    case 'basic':
      if (authConfig.username) {
        const encoded = Buffer.from(`${authConfig.username}:${authConfig.password || ''}`).toString('base64');
        headers['Authorization'] = `Basic ${encoded}`;
      }
      break;
    case 'apiKeyHeader':
      if (authConfig.headerName && authConfig.headerValue) {
        headers[authConfig.headerName] = authConfig.headerValue;
      }
      break;
    // apiKeyQuery is handled in URL construction
  }
}

function buildPayloadFromTemplate(
  template: Record<string, unknown>,
  preview: Awaited<ReturnType<typeof getBillingPreview>>,
  invoiceNumber: string,
  invoiceDate: Date
): Record<string, unknown> {
  // Deep clone the template
  const payload = JSON.parse(JSON.stringify(template));

  // Replace placeholders in string values
  const replacements: Record<string, string> = {
    '{{invoiceNumber}}': invoiceNumber,
    '{{date}}': formatDate(invoiceDate),
    '{{month}}': String(preview.month),
    '{{year}}': String(preview.year),
    '{{clientName}}': preview.clientName,
    '{{totalHours}}': String(preview.totalHours),
  };

  replaceInObject(payload, replacements);

  // Single line item with total hours (not per-task breakdown)
  if (Array.isArray(payload.items) && payload.items.length > 0) {
    const itemTemplate = payload.items[0];
    const item = JSON.parse(JSON.stringify(itemTemplate));
    const itemReplacements: Record<string, string> = {
      '{{taskCode}}': '',
      '{{taskTitle}}': '',
      '{{projectName}}': '',
      '{{hours}}': String(preview.totalHours),
    };
    replaceInObject(item, itemReplacements);
    // Set quantity to totalHours
    if (typeof item.quantity === 'string') {
      item.quantity = preview.totalHours;
    } else if (item.quantity === 0 || item.quantity === '{{hours}}') {
      item.quantity = preview.totalHours;
    }
    payload.items = [item];
  }

  return payload;
}

function buildDefaultPayload(
  preview: Awaited<ReturnType<typeof getBillingPreview>>,
  invoiceNumber: string,
  invoiceDate: Date
): Record<string, unknown> {
  // Default invoice-generator.com format
  return {
    number: invoiceNumber,
    date: formatDate(invoiceDate),
    header: 'INVOICE',
    from: '', // To be filled from template/config
    to: preview.clientName,
    currency: 'EUR',
    balance_title: 'Amount to Pay',
    items: [
      {
        name: 'Desarrollo de Software',
        quantity: preview.totalHours,
        unit_cost: 0, // Rate from template
      },
    ],
    notes_title: 'Notes',
    notes: '',
  };
}

function formatDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function stripInvoicePrefix(invoiceNumber: string, prefix?: string): string {
  if (!prefix) return invoiceNumber;
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return invoiceNumber.replace(new RegExp(`^${escapedPrefix}`), '');
}

function replaceInObject(obj: Record<string, unknown>, replacements: Record<string, string>) {
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string') {
      let result = val;
      for (const [placeholder, value] of Object.entries(replacements)) {
        result = result.replace(new RegExp(escapeRegExp(placeholder), 'g'), value);
      }
      obj[key] = result;
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      replaceInObject(val as Record<string, unknown>, replacements);
    } else if (Array.isArray(val)) {
      for (const item of val) {
        if (item && typeof item === 'object') {
          replaceInObject(item as Record<string, unknown>, replacements);
        }
      }
    }
  }
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function calculateTotalAmount(payload: Record<string, unknown>): number | undefined {
  if (!Array.isArray(payload.items)) return undefined;
  let total = 0;
  for (const item of payload.items) {
    const qty = typeof item === 'object' && item ? (item as Record<string, unknown>).quantity : 0;
    const cost = typeof item === 'object' && item ? (item as Record<string, unknown>).unit_cost : 0;
    if (typeof qty === 'number' && typeof cost === 'number') {
      total += qty * cost;
    }
  }
  return total > 0 ? total : undefined;
}
