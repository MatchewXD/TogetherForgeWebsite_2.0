/**
 * Private claim fields (notes, submission evidence, review feedback).
 *
 * task_claims only exposes safe columns through the table API
 * (supabase/sql/supabase_claims_activity_lockdown.sql). The claimant and staff
 * read the private fields through the get_task_claim_private_details RPC,
 * which only returns rows the caller owns (or every row, for staff).
 * Part of the tasks service.
 */

import { supabase } from '../../lib/supabase';

/** Claim ids from task rows that embed task_claims. */
export function collectClaimIds(taskRows) {
  const ids = new Set();
  for (const row of taskRows || []) {
    for (const claim of row?.task_claims || []) {
      if (claim?.id) ids.add(claim.id);
    }
  }
  return [...ids];
}

/**
 * Copy private fields from RPC rows onto the matching embedded claims.
 * Returns new task rows; claims without details are left as they are.
 */
export function mergeClaimPrivateDetails(taskRows, detailRows) {
  const byId = new Map(
    (detailRows || []).filter((d) => d?.id).map((d) => [d.id, d])
  );
  if (!byId.size) return taskRows || [];
  return (taskRows || []).map((row) => {
    if (!row || !Array.isArray(row.task_claims)) return row;
    return {
      ...row,
      task_claims: row.task_claims.map((claim) => {
        const d = claim?.id ? byId.get(claim.id) : null;
        if (!d) return claim;
        return {
          ...claim,
          notes: d.notes ?? null,
          submission_evidence: d.submission_evidence ?? null,
          review_feedback: d.review_feedback ?? null,
        };
      }),
    };
  });
}

/**
 * Fetch private fields for the given claim ids. Signed-out visitors and
 * failures (e.g. the RPC is not deployed yet) return [] so boards still load.
 */
export async function fetchClaimPrivateDetails(claimIds) {
  const ids = [...new Set((claimIds || []).filter(Boolean))];
  if (!ids.length) return [];
  try {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess?.session) return [];
    const { data, error } = await supabase.rpc(
      'get_task_claim_private_details',
      { p_claim_ids: ids }
    );
    if (error) {
      console.warn('[tasksService] claim details', error.message || error);
      return [];
    }
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('[tasksService] claim details', err);
    return [];
  }
}

/** Fetch and merge private claim fields into task rows (claimant / staff only). */
export async function attachClaimPrivateDetails(taskRows) {
  const rows = taskRows || [];
  const details = await fetchClaimPrivateDetails(collectClaimIds(rows));
  return mergeClaimPrivateDetails(rows, details);
}
