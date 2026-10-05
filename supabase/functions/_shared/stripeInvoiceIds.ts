/**
 * Stripe Invoice field paths differ by API version.
 * 2023 invoices expose subscription / payment_intent on the root.
 * 2024+ (Basil) nest them under parent.subscription_details and payments[].
 */

export function idOf(field: unknown): string | null {
  if (!field) return null;
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && field && 'id' in field && (field as { id?: unknown }).id) {
    return String((field as { id: unknown }).id);
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function firstLine(invoice: Record<string, unknown>): Record<string, unknown> | null {
  const lines = asRecord(invoice.lines);
  const data = Array.isArray(lines?.data) ? lines.data : [];
  return asRecord(data[0]);
}

export function invoiceSubscriptionId(invoice: unknown): string | null {
  const inv = asRecord(invoice);
  if (!inv) return null;
  const parent = asRecord(inv.parent);
  const subDetails = asRecord(parent?.subscription_details);
  const line = firstLine(inv);
  const lineParent = asRecord(line?.parent);
  const lineSub = asRecord(lineParent?.subscription_item_details);
  return (
    idOf(inv.subscription) ||
    idOf(subDetails?.subscription) ||
    idOf(asRecord(inv.subscription_details)?.subscription) ||
    idOf(line?.subscription) ||
    idOf(lineSub?.subscription) ||
    null
  );
}

export function invoicePaymentIntentId(invoice: unknown): string | null {
  const inv = asRecord(invoice);
  if (!inv) return null;
  const payments = asRecord(inv.payments);
  const paymentRows = Array.isArray(payments?.data) ? payments.data : [];
  for (const row of paymentRows) {
    const rec = asRecord(row);
    const payment = asRecord(rec?.payment);
    const fromNested = idOf(payment?.payment_intent) || idOf(rec?.payment_intent);
    if (fromNested) return fromNested;
  }
  const charge = asRecord(inv.charge);
  return (
    idOf(inv.payment_intent) ||
    idOf(charge?.payment_intent) ||
    null
  );
}

export function invoiceCustomerId(invoice: unknown): string | null {
  const inv = asRecord(invoice);
  if (!inv) return null;
  return idOf(inv.customer);
}
