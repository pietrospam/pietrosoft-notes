import { NextResponse } from 'next/server';
import {
  getBillingRuns,
  getBillingMethodById,
  getBillingPreview,
  peekNextInvoiceNumber,
  createBillingRun,
  getBillingRunById,
  updateBillingRun,
} from '@/lib/repositories/billing-repo';
import type { BillingAuthConfig, BillingAuthType } from '@/lib/types';
import { buildExternalPayload, normalizeBillingItems, stripExchangeRateUsd } from '@/lib/billing-utils';
import { prisma } from '@/lib/db';

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
    const {
      runId,
      clientParentId: clientParentIdOverride,
      year: yearOverride,
      month: monthOverride,
      methodId: methodIdOverride,
      requestJsonOverride,
      periodStart: periodStartOverride,
      periodEnd: periodEndOverride,
      items,
      saveAsDraft,
      invoiceTitle: invoiceTitleOverride,
      invoiceNumber: invoiceNumberOverride,
      currency: currencyOverride,
      exchangeRateUsd,
    } = body;

    let existingRun = runId ? await getBillingRunById(runId) : null;
    let resolvedRunId = runId as string | undefined;
    if (runId && !existingRun) {
      return NextResponse.json({ error: 'Billing run not found' }, { status: 404 });
    }

    // Keep older grid clients idempotent while they transition to sending runId.
    // The saved request JSON contains the invoice number, which lets us recover
    // the original run instead of creating a second one.
    if (!existingRun && requestJsonOverride && typeof requestJsonOverride === 'object') {
      const json = requestJsonOverride as Record<string, unknown>;
      const candidateInvoiceNumber = invoiceNumberOverride?.trim()
        || (typeof json.invoiceNumber === 'string' ? json.invoiceNumber.trim() : '')
        || (typeof json.number === 'string' ? json.number.trim() : '');
      if (candidateInvoiceNumber && clientParentIdOverride && yearOverride && monthOverride && methodIdOverride) {
        const recoveredRun = await prisma.billingRun.findFirst({
          where: {
            clientParentId: clientParentIdOverride,
            year: yearOverride,
            month: monthOverride,
            methodId: methodIdOverride,
            invoiceNumber: candidateInvoiceNumber,
          },
          orderBy: { createdAt: 'asc' },
        });
        if (recoveredRun) {
          resolvedRunId = recoveredRun.id;
          existingRun = await getBillingRunById(recoveredRun.id);
        }
      }
    }

    const clientParentId = clientParentIdOverride ?? existingRun?.clientParentId;
    const year = yearOverride ?? existingRun?.year;
    const month = monthOverride ?? existingRun?.month;
    const methodId = methodIdOverride ?? existingRun?.methodId;
    const invoiceTitle = invoiceTitleOverride ?? existingRun?.invoiceTitle;
    if (!clientParentId || !year || !month || !methodId) {
      return NextResponse.json(
        { error: 'clientParentId, year, month, and methodId are required' },
        { status: 400 }
      );
    }

    // Older billing runs may not have persisted period dates. Use the billing
    // month as a safe fallback when sending an existing invoice.
    const periodStart = periodStartOverride
      ?? existingRun?.periodStart
      ?? new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const periodEnd = periodEndOverride
      ?? existingRun?.periodEnd
      ?? new Date(Date.UTC(year, month, 0)).toISOString();

    const billingItems = normalizeBillingItems(items || existingRun?.items?.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit_cost: item.unitCost,
      total: item.total,
    })));

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: 'periodStart and periodEnd are required' },
        { status: 400 }
      );
    }

    const parsedPeriodStart = new Date(periodStart);
    const parsedPeriodEnd = new Date(periodEnd);
    if (Number.isNaN(parsedPeriodStart.getTime()) || Number.isNaN(parsedPeriodEnd.getTime())) {
      return NextResponse.json({ error: 'Invalid periodStart or periodEnd' }, { status: 400 });
    }
    if (parsedPeriodStart > parsedPeriodEnd) {
      return NextResponse.json({ error: 'periodStart must be before or equal to periodEnd' }, { status: 400 });
    }

    // Load the billing method
    const method = await getBillingMethodById(methodId);
    if (!method) {
      return NextResponse.json({ error: 'Billing method not found' }, { status: 404 });
    }

    // Get preview data (hours summary)
    const preview = await getBillingPreview(clientParentId, year, month, parsedPeriodStart, parsedPeriodEnd);

    // Get current invoice number for this billing method (do not increment counter yet)
    const invoiceNumber = invoiceNumberOverride?.trim()
      || existingRun?.invoiceNumber
      || await peekNextInvoiceNumber(methodId);
    const invoiceDate = new Date(Date.UTC(year, month, 0, 0, 0, 0, 0));
    const payloadInvoiceNumber = invoiceNumber;

    // Build request payload from method configuration + preview data
    let requestPayload: Record<string, unknown>;

    if (requestJsonOverride) {
      requestPayload = stripExchangeRateUsd(requestJsonOverride) as Record<string, unknown>;
    } else {
      requestPayload = buildExternalPayload(method.payloadTemplate ?? undefined, preview, payloadInvoiceNumber, invoiceDate, billingItems);
      requestPayload = stripExchangeRateUsd(requestPayload) as Record<string, unknown>;
    }

    if (currencyOverride) {
      requestPayload.currency = currencyOverride;
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

    // Execute the external API call unless this is a draft save
    let responseStatus: number | undefined;
    let responseBody: string | undefined;
    let pdfData: Buffer | undefined;
    let pdfFilename: string | undefined;
    let status: 'success' | 'failed' | 'pending' = 'pending';
    let errorText: string | undefined;

    if (!saveAsDraft) {
      status = 'failed';
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
    } else {
      status = 'pending';
    }

    // Calculate total amount if rate info is available in template
    const totalAmount = calculateTotalAmount(requestPayload);
    const invoiceState = saveAsDraft
      ? (body.invoiceState as string) ?? 'borrador'
      : (status === 'success' ? 'enviada' : 'validada');

    const billingData = {
      clientParentId,
      year,
      month,
      methodId,
      invoiceTitle,
      invoiceNumber,
      totalHours: preview.totalHours,
      totalAmount,
      currency: (requestPayload.currency as string) || undefined,
      exchangeRateUsd: exchangeRateUsd !== undefined ? Number(exchangeRateUsd) : undefined,
      requestJson: requestPayload,
      responseStatus,
      responseBody,
      pdfData,
      pdfFilename,
      status,
      invoiceState,
      errorText,
      items: billingItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitCost: item.unit_cost,
        total: item.quantity * item.unit_cost,
      })),
      periodStart: parsedPeriodStart,
      periodEnd: parsedPeriodEnd,
    };

    if (resolvedRunId) {
      const billingRun = await updateBillingRun(resolvedRunId, {
        invoiceTitle: billingData.invoiceTitle,
        invoiceNumber: billingData.invoiceNumber,
        totalAmount: billingData.totalAmount,
        currency: billingData.currency,
        exchangeRateUsd: billingData.exchangeRateUsd,
        requestJson: billingData.requestJson,
        responseStatus: billingData.responseStatus,
        responseBody: billingData.responseBody,
        pdfData: billingData.pdfData,
        pdfFilename: billingData.pdfFilename,
        status: billingData.status,
        invoiceState: billingData.invoiceState,
        errorText: billingData.errorText ?? null,
        items: billingData.items,
        periodStart: billingData.periodStart,
        periodEnd: billingData.periodEnd,
      });
      return NextResponse.json(billingRun, { status: 200 });
    }

    const billingRun = await createBillingRun(billingData);

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
