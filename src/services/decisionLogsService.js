/**
 * Public + staff decision logs for Transparency Hub.
 * Table: public.decision_logs (supabase/sql/supabase_decision_logs.sql)
 */

import { supabase } from '../lib/supabase';
import { asUserError } from '../utils/abuseErrors';

export const DECISION_LOG_CATEGORIES = [
  'Governance',
  'Process',
  'Legal',
  'Community',
];

export const DECISION_LOG_BODY_MAX = 1200;

export const FALLBACK_DECISION_LOGS = [
  {
    id: 'd1',
    date: '2026-07-15',
    title: 'Studio support builds projects, not founder pay',
    category: 'Governance',
    body: 'Together Forge project support funds development and operations only. Founder living wage comes from profits once the studio can pay all employees a family-supporting wage, or from a separate personal runway path that is not project funds.',
    archived: false,
  },
  {
    id: 'd2',
    date: '2026-07-15',
    title: 'Public workspaces over private silos',
    category: 'Process',
    body: 'Every active project gets a public workspace with kanban, updates, and shoutouts so progress does not require insider access.',
    archived: false,
  },
  {
    id: 'd3',
    date: '2026-07-15',
    title: 'Support is not a charitable donation',
    category: 'Legal',
    body: 'Together Forge is a community-supported for-profit studio. Contributions are not tax-deductible. That is stated clearly on Support and here.',
    archived: false,
  },
  {
    id: 'd4',
    date: '2026-07-15',
    title: 'Five active task claims per volunteer',
    category: 'Community',
    body: 'A cap of five active claims keeps boards fair. Completing or releasing a task frees a slot.',
    archived: false,
  },
];

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

function mapRow(row) {
  if (!row) return null;
  const logged = row.logged_on || row.date || '';
  return {
    id: row.id,
    title: String(row.title || '').trim(),
    category: DECISION_LOG_CATEGORIES.includes(row.category)
      ? row.category
      : 'Governance',
    date: String(logged).slice(0, 10),
    body: String(row.body || row.summary || '').trim(),
    archived: Boolean(row.archived_at),
    archivedAt: row.archived_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function cleanPayload(input) {
  const title = String(input.title || '').trim();
  const body = String(input.body || '').trim();
  const category = DECISION_LOG_CATEGORIES.includes(input.category)
    ? input.category
    : 'Governance';
  const date = String(input.date || '').slice(0, 10);
  if (title.length < 3) throw new Error('Title is too short.');
  if (body.length < 10) throw new Error('Body text is too short.');
  if (body.length > DECISION_LOG_BODY_MAX) {
    throw new Error(`Body text must be ${DECISION_LOG_BODY_MAX} characters or less.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Pick a valid date.');
  }
  return { title, body, category, logged_on: date };
}

export async function listPublicDecisionLogs() {
  const { data, error } = await supabase
    .from('decision_logs')
    .select('id, title, category, logged_on, body, created_at')
    .is('archived_at', null)
    .order('logged_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingTable(error)) {
      return { items: FALLBACK_DECISION_LOGS, source: 'fallback' };
    }
    console.warn('[decisionLogs] public list', error);
    return { items: FALLBACK_DECISION_LOGS, source: 'fallback' };
  }
  const items = (data || []).map(mapRow).filter(Boolean);
  return {
    items: items.length ? items : FALLBACK_DECISION_LOGS,
    source: items.length ? 'supabase' : 'fallback',
  };
}

export async function listStaffDecisionLogs() {
  const { data, error } = await supabase
    .from('decision_logs')
    .select(
      'id, title, category, logged_on, body, archived_at, created_at, updated_at'
    )
    .order('archived_at', { ascending: true, nullsFirst: true })
    .order('logged_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingTable(error)) {
      const err = new Error(
        'Decision logs are not set up yet. Apply supabase/sql/supabase_decision_logs.sql.'
      );
      err.code = 'TABLE_MISSING';
      throw err;
    }
    throw asUserError(error, 'Could not load decision logs.');
  }
  return (data || []).map(mapRow).filter(Boolean);
}

export async function createDecisionLog(input, userId) {
  const payload = {
    ...cleanPayload(input),
    created_by: userId || null,
    updated_by: userId || null,
  };
  const { data, error } = await supabase
    .from('decision_logs')
    .insert(payload)
    .select(
      'id, title, category, logged_on, body, archived_at, created_at, updated_at'
    )
    .maybeSingle();
  if (error) throw asUserError(error, 'Could not save decision log.');
  return mapRow(data);
}

export async function updateDecisionLog(id, input, userId) {
  if (!id) throw new Error('Missing log id.');
  const payload = {
    ...cleanPayload(input),
    updated_by: userId || null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('decision_logs')
    .update(payload)
    .eq('id', id)
    .select(
      'id, title, category, logged_on, body, archived_at, created_at, updated_at'
    )
    .maybeSingle();
  if (error) throw asUserError(error, 'Could not update decision log.');
  return mapRow(data);
}

export async function setDecisionLogArchived(id, archived, userId) {
  if (!id) throw new Error('Missing log id.');
  const { data, error } = await supabase
    .from('decision_logs')
    .update({
      archived_at: archived ? new Date().toISOString() : null,
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(
      'id, title, category, logged_on, body, archived_at, created_at, updated_at'
    )
    .maybeSingle();
  if (error) throw asUserError(error, 'Could not update decision log.');
  return mapRow(data);
}

export const decisionLogsService = {
  listPublicDecisionLogs,
  listStaffDecisionLogs,
  createDecisionLog,
  updateDecisionLog,
  setDecisionLogArchived,
};

export default decisionLogsService;
