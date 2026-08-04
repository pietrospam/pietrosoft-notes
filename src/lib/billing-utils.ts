import type { BillingPreview } from './types';

export function formatDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    } else if (typeof val === 'object' && val !== null) {
      if (Array.isArray(val)) {
        val.forEach((item) => {
          if (typeof item === 'object' && item !== null) {
            replaceInObject(item as Record<string, unknown>, replacements);
          }
        });
      } else {
        replaceInObject(val as Record<string, unknown>, replacements);
      }
    }
  }
}

export function normalizeBillingItems(items: unknown) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name.trim() : '';
      const quantity = typeof record.quantity === 'number'
        ? record.quantity
        : typeof record.quantity === 'string'
          ? Number(record.quantity)
          : 0;
      // Accept both the API format and the database/domain format.
      const rawUnitCost = record.unit_cost ?? record.unitCost;
      const unit_cost = typeof rawUnitCost === 'number'
        ? rawUnitCost
        : typeof rawUnitCost === 'string'
          ? Number(rawUnitCost)
          : 0;
      const cleanedQuantity = Number.isNaN(quantity) ? 0 : quantity;
      const cleanedUnitCost = Number.isNaN(unit_cost) ? 0 : unit_cost;

      return {
        name,
        quantity: cleanedQuantity,
        unit_cost: cleanedUnitCost,
        total: cleanedQuantity * cleanedUnitCost,
      };
    })
    .filter((item): item is { name: string; quantity: number; unit_cost: number; total: number } =>
      item !== null && (item.name !== '' || item.quantity > 0 || item.unit_cost > 0)
    );
}

export function stripExchangeRateUsd(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripExchangeRateUsd);
  }
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== 'exchangeRateUsd')
      .map(([key, entry]) => [key, stripExchangeRateUsd(entry)])
  );
}

export function buildPayloadFromTemplate(
  template: Record<string, unknown>,
  preview: BillingPreview,
  invoiceNumber: string,
  invoiceDate: Date
): Record<string, unknown> {
  const payload = JSON.parse(JSON.stringify(template));

  const replacements: Record<string, string> = {
    '{{invoiceNumber}}': invoiceNumber,
    '{{date}}': formatDate(invoiceDate),
    '{{month}}': String(preview.month),
    '{{year}}': String(preview.year),
    '{{clientName}}': preview.clientName,
    '{{totalHours}}': String(preview.totalHours),
    '{{periodStart}}': preview.periodStart,
    '{{periodEnd}}': preview.periodEnd,
  };

  replaceInObject(payload, replacements);

  if (Array.isArray(payload.items) && payload.items.length > 0) {
    const itemTemplate = payload.items[0];
    const item = JSON.parse(JSON.stringify(itemTemplate));
    const itemReplacements: Record<string, string> = {
      '{{taskCode}}': '',
      '{{taskTitle}}': '',
      '{{projectName}}': '',
      '{{hours}}': String(preview.totalHours),
    };
    replaceInObject(item as Record<string, unknown>, itemReplacements);
    if (typeof item === 'object' && item !== null) {
      if (typeof (item as Record<string, unknown>).quantity === 'string') {
        (item as Record<string, unknown>).quantity = preview.totalHours;
      } else if ((item as Record<string, unknown>).quantity === 0 || (item as Record<string, unknown>).quantity === '{{hours}}') {
        (item as Record<string, unknown>).quantity = preview.totalHours;
      }
    }
    payload.items = [item];
  }

  return payload;
}

export function buildDefaultPayload(
  preview: BillingPreview,
  invoiceNumber: string,
  invoiceDate: Date
): Record<string, unknown> {
  return {
    number: invoiceNumber,
    date: formatDate(invoiceDate),
    header: 'INVOICE',
    from: '',
    to: preview.clientName,
    currency: 'EUR',
    balance_title: 'Amount to Pay',
    items: [
      {
        name: 'Desarrollo de Software',
        quantity: preview.totalHours,
        unit_cost: 0,
      },
    ],
    notes_title: 'Notes',
    notes: '',
  };
}

export function buildExternalPayload(
  methodPayloadTemplate: Record<string, unknown> | undefined,
  preview: BillingPreview,
  invoiceNumber: string,
  invoiceDate: Date,
  billingItems: Array<{ name: string; quantity: number; unit_cost: number; total: number; description?: string }> = []
): Record<string, unknown> {
  const payload = methodPayloadTemplate
    ? buildPayloadFromTemplate(methodPayloadTemplate, preview, invoiceNumber, invoiceDate)
    : buildDefaultPayload(preview, invoiceNumber, invoiceDate);

  if (billingItems.length > 0) {
    payload.items = billingItems.map((item) => {
      const payloadItem: Record<string, unknown> = {
        name: item.name,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
      };
      if (item.description) {
        payloadItem.description = item.description;
      }
      return payloadItem;
    });
  }

  return payload;
}
