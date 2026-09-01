/**
 * Published Together Forge LLC expenses for Transparency Hub.
 * Table: public.studio_published_expenses
 * (supabase/sql/supabase_studio_published_expenses.sql)
 *
 * Staff-entered Relay Operating spend only. Not a bank feed.
 * Do not import Stripe payouts, tax withholding, refunds, or Runway/Ko-fi.
 */

import { supabase } from '../lib/supabase';
import { asUserError } from '../utils/abuseErrors';
import {
  STUDIO_EXPENSE_CATEGORIES,
  STUDIO_EXPENSE_CATEGORY_LABELS,
  STUDIO_EXPENSE_DESC_MAX,
  STUDIO_EXPENSE_VENDOR_MAX,
} from '../constants/studioExpenses';

export {
  STUDIO_EXPENSE_CATEGORIES,
  STUDIO_EXPENSE_CATEGORY_LABELS,
  STUDIO_EXPENSE_DESC_MAX,
  STUDIO_EXPENSE_VENDOR_MAX,
};

function isMissingTable(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || error.details || '');
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    /does not exist|schema cache|could not find the table/i.test(msg)
  );
}

export function parseUsdToCents(raw) {
  const s = String(raw ?? '')
    .trim()
    .replace(/[$,\s]/g, '');
  if (!s) throw new Error('Enter an amount.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    throw new Error('Amount must be a positive dollar value, like 12.50.');
  }
  const cents = Math.round(Number(s) * 100);
  if (!Number.isFinite(cents) || cents <= 0) {
    throw new Error('Amount must be greater than $0.');
  }
  return cents;
}

export function centsToUsdInput(cents) {
  const n = Number(cents);
  if (!Number.isFinite(n) || n <= 0) return '';
  return (n / 100).toFixed(2);
}

/**
 * Sums listed published rows. Empty list is $0 — no placeholder spend.
 * @param {Array<{ category?: string, amountCents?: number }>} rows
 */
export function sumStudioExpenses(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const byCategory = Object.fromEntries(
    STUDIO_EXPENSE_CATEGORIES.map((c) => [c.key, 0])
  );
  let totalCents = 0;
  for (let i = 0; i < list.length; i += 1) {
    const row = list[i];
    if (!row || row.archived) continue;
    const cents = Number(row.amountCents);
    if (!Number.isFinite(cents) || cents <= 0) continue;
    totalCents += cents;
    const cat = STUDIO_EXPENSE_CATEGORIES.find((c) => c.label === row.category);
    if (cat) byCategory[cat.key] += cents;
  }
  return { totalCents, byCategory };
}

function mapRow(row) {
  if (!row) return null;
  const spentOn = row.spent_on || row.date || '';
  const category = STUDIO_EXPENSE_CATEGORY_LABELS.includes(row.category)
    ? row.category
    : STUDIO_EXPENSE_CATEGORY_LABELS[0];
  return {
    id: row.id,
    date: String(spentOn).slice(0, 10),
    category,
    vendor: String(row.vendor || '').trim(),
    amountCents: Number(row.amount_cents) || 0,
    description: String(row.description || '').trim(),
    archived: Boolean(row.archived_at),
    archivedAt: row.archived_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function cleanPayload(input) {
  const vendor = String(input.vendor || '').trim();
  const description = String(input.description || '').trim();
  const category = STUDIO_EXPENSE_CATEGORY_LABELS.includes(input.category)
    ? input.category
    : '';
  const date = String(input.date || '').slice(0, 10);
  const amountCents =
    input.amountCents != null
      ? Number(input.amountCents)
      : parseUsdToCents(input.amount);

  if (!category) throw new Error('Pick a category.');
  if (vendor.length < 2) throw new Error('Vendor name is too short.');
  if (vendor.length > STUDIO_EXPENSE_VENDOR_MAX) {
    throw new Error(
      `Vendor must be ${STUDIO_EXPENSE_VENDOR_MAX} characters or less.`
    );
  }
  if (description.length < 8) {
    throw new Error('Public description is too short.');
  }
  if (description.length > STUDIO_EXPENSE_DESC_MAX) {
    throw new Error(
      `Description must be ${STUDIO_EXPENSE_DESC_MAX} characters or less.`
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Pick a valid date.');
  }
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error('Amount must be greater than $0.');
  }

  return {
    spent_on: date,
    category,
    vendor,
    amount_cents: Math.round(amountCents),
    description,
  };
}

const PUBLIC_COLUMNS =
  'id, spent_on, category, vendor, amount_cents, description, created_at';
const STAFF_COLUMNS = `${PUBLIC_COLUMNS}, archived_at, updated_at`;

export async function listPublicStudioExpenses() {
  const { data, error } = await supabase
    .from('studio_published_expenses')
    .select(PUBLIC_COLUMNS)
    .is('archived_at', null)
    .order('spent_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingTable(error)) {
      return { items: [], source: 'empty' };
    }
    console.warn('[studioExpenses] public list', error);
    return { items: [], source: 'empty' };
  }
  const items = (data || []).map(mapRow).filter(Boolean);
  return { items, source: items.length ? 'supabase' : 'empty' };
}

export async function listStaffStudioExpenses() {
  const { data, error } = await supabase
    .from('studio_published_expenses')
    .select(STAFF_COLUMNS)
    .order('archived_at', { ascending: true, nullsFirst: true })
    .order('spent_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingTable(error)) {
      const err = new Error(
        'Studio expenses are not set up yet. Apply supabase/sql/supabase_studio_published_expenses.sql.'
      );
      err.code = 'TABLE_MISSING';
      throw err;
    }
    throw asUserError(error, 'Could not load studio expenses.');
  }
  return (data || []).map(mapRow).filter(Boolean);
}

export async function createStudioExpense(input, userId) {
  const payload = {
    ...cleanPayload(input),
    created_by: userId || null,
    updated_by: userId || null,
  };
  const { data, error } = await supabase
    .from('studio_published_expenses')
    .insert(payload)
    .select(STAFF_COLUMNS)
    .maybeSingle();
  if (error) throw asUserError(error, 'Could not publish expense.');
  return mapRow(data);
}

export async function updateStudioExpense(id, input, userId) {
  if (!id) throw new Error('Missing expense id.');
  const payload = {
    ...cleanPayload(input),
    updated_by: userId || null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('studio_published_expenses')
    .update(payload)
    .eq('id', id)
    .select(STAFF_COLUMNS)
    .maybeSingle();
  if (error) throw asUserError(error, 'Could not update expense.');
  return mapRow(data);
}

export async function setStudioExpenseArchived(id, archived, userId) {
  if (!id) throw new Error('Missing expense id.');
  const { data, error } = await supabase
    .from('studio_published_expenses')
    .update({
      archived_at: archived ? new Date().toISOString() : null,
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(STAFF_COLUMNS)
    .maybeSingle();
  if (error) throw asUserError(error, 'Could not update expense.');
  return mapRow(data);
}

export const studioExpensesService = {
  listPublicStudioExpenses,
  listStaffStudioExpenses,
  createStudioExpense,
  updateStudioExpense,
  setStudioExpenseArchived,
  sumStudioExpenses,
  parseUsdToCents,
};

export default studioExpensesService;
