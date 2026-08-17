/**
 * Forge Marks + Community Awards — client reads.
 * Writes go through SQL RPCs (donation trigger / place_forge_award).
 */

import { supabase } from '../lib/supabase';
import {
  FORGE_AWARD_TIERS,
  formatForgeMarks,
  forgeMarkLedgerLabel,
  sortAwardTotalsByTier,
} from '../utils/forgeMarks';

function isMissingRpc(error) {
  const msg = String(error?.message || error?.code || '');
  return /function|does not exist|PGRST202|schema cache/i.test(msg);
}

function mapBalance(data) {
  if (!data || typeof data !== 'object') {
    return {
      balance: 0,
      lifetimeEarned: 0,
      lifetimeSpent: 0,
      updatedAt: null,
    };
  }
  return {
    balance: Number(data.balance) || 0,
    lifetimeEarned: Number(data.lifetime_earned) || 0,
    lifetimeSpent: Number(data.lifetime_spent) || 0,
    updatedAt: data.updated_at || null,
  };
}

function mapLedgerRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    entryType: row.entry_type,
    label: forgeMarkLedgerLabel(row.entry_type),
    marks: Number(row.marks) || 0,
    marksDelta: Number(row.marks_delta) || 0,
    donationId: row.donation_id ?? null,
    awardId: row.award_id || null,
    note: row.note || null,
    createdAt: row.created_at || null,
  };
}

function mapAward(row) {
  if (!row) return null;
  return {
    id: row.id,
    awardTier: row.award_tier,
    awardName: row.award_name,
    marksSpent: Number(row.marks_spent) || 0,
    targetType: row.target_type || 'other',
    targetId: row.target_id || null,
    targetUrl: row.target_url || null,
    message: row.message || null,
    createdAt: row.created_at || null,
    giverId: row.giver_id || null,
    receiverId: row.receiver_id || null,
    giverUsername: row.giver_username || null,
    giverAvatarUrl: row.giver_avatar_url || null,
    giverPinnedBadgeKey: row.giver_pinned_badge_key || null,
  };
}

export function groupAwardsByTarget(rows = []) {
  const byTarget = {};
  for (const row of rows || []) {
    const key = String(row.targetId || '');
    if (!key) continue;
    if (!byTarget[key]) byTarget[key] = [];
    byTarget[key].push(row);
  }
  return byTarget;
}

export async function listForgeAwardsForTargets(targetType, targetIds = []) {
  const ids = [
    ...new Set((targetIds || []).map((id) => String(id || '').trim()).filter(Boolean)),
  ];
  if (!ids.length) return {};
  const { data, error } = await supabase.rpc('list_forge_awards_for_targets', {
    p_target_type: targetType,
    p_target_ids: ids,
  });
  if (error) {
    if (isMissingRpc(error)) return {};
    console.warn('[forgeMarks] list awards', error);
    return {};
  }
  return groupAwardsByTarget(asAwardRows(data).map(mapAward).filter(Boolean));
}

function asAwardRows(data) {
  if (Array.isArray(data)) return data;
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function placeForgeAward({
  tierId,
  targetType,
  targetId,
  message = null,
} = {}) {
  const { data, error } = await supabase.rpc('place_forge_award', {
    p_tier_id: tierId,
    p_target_type: targetType,
    p_target_id: String(targetId || ''),
    p_message: message || null,
  });
  if (error) {
    const msg = String(error.message || 'Could not place award');
    const err = new Error(msg);
    err.code = error.code;
    throw err;
  }
  return {
    ok: data?.ok !== false,
    id: data?.award_id || null,
    awardTier: data?.tier || tierId,
    awardName: data?.tier_name || null,
    marksSpent: Number(data?.marks_spent) || 0,
    targetType: data?.target_type || targetType,
    targetId: data?.target_id || String(targetId || ''),
    targetUrl: data?.target_url || null,
    message: data?.message || null,
    createdAt: data?.created_at || new Date().toISOString(),
    receiverId: data?.receiver_id || null,
  };
}

export async function fetchMyForgeMarks() {
  const { data, error } = await supabase.rpc('get_my_forge_marks');
  if (error) {
    if (isMissingRpc(error)) {
      return { ...mapBalance(null), missing: true };
    }
    throw error;
  }
  return { ...mapBalance(data), missing: false };
}

export async function fetchMyForgeMarkLedger(limit = 40) {
  const { data, error } = await supabase.rpc('get_my_forge_mark_ledger', {
    p_limit: limit,
  });
  if (error) {
    if (isMissingRpc(error)) return [];
    throw error;
  }
  const rows = Array.isArray(data) ? data : [];
  return rows.map(mapLedgerRow).filter(Boolean);
}

export async function fetchPublicForgeMarksProfile(userId) {
  if (!userId) {
    return {
      ...mapBalance(null),
      awards: [],
      totalsByTier: [],
      missing: false,
    };
  }
  const { data, error } = await supabase.rpc('get_public_forge_marks_profile', {
    p_user_id: userId,
  });
  if (error) {
    if (isMissingRpc(error)) {
      return {
        ...mapBalance(null),
        awards: [],
        totalsByTier: [],
        missing: true,
      };
    }
    throw error;
  }
  let awards = Array.isArray(data?.awards)
    ? data.awards.map(mapAward).filter(Boolean)
    : [];
  const totalsByTier = sortAwardTotalsByTier(
    Array.isArray(data?.totals_by_tier)
      ? data.totals_by_tier.map((t) => ({
          awardTier: t.award_tier,
          awardName: t.award_name,
          awardCount: Number(t.award_count) || 0,
          marksReceived: Number(t.marks_received) || 0,
        }))
      : []
  );
  // Older RPC capped the history at 50. Public SELECT on forge_awards is the
  // full permanent record.
  if (awards.length >= 50) {
    const all = await listReceivedAwardsForProfile(userId);
    if (all?.length) awards = all;
  }
  return {
    ...mapBalance(data),
    awards,
    totalsByTier,
    missing: false,
  };
}

async function listReceivedAwardsForProfile(userId) {
  const { data, error } = await supabase
    .from('forge_awards')
    .select(
      'id, award_tier, award_name, marks_spent, target_type, target_id, target_url, message, created_at, giver_id'
    )
    .eq('receiver_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data?.length) return null;

  const giverIds = [
    ...new Set(data.map((row) => row.giver_id).filter(Boolean)),
  ];
  const profiles = {};
  if (giverIds.length) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, pinned_badge_key')
      .in('id', giverIds);
    for (const p of profs || []) {
      profiles[p.id] = p;
    }
  }

  return data
    .map((row) => {
      const p = profiles[row.giver_id] || {};
      return mapAward({
        ...row,
        giver_username: p.username || null,
        giver_avatar_url: p.avatar_url || null,
        giver_pinned_badge_key: p.pinned_badge_key || null,
      });
    })
    .filter(Boolean);
}

export async function fetchForgeAwardTiers() {
  try {
    const { data, error } = await supabase
      .from('forge_award_tiers')
      .select('id, name, description, marks_cost, sort_order, allows_message')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    if (data?.length) {
      return data.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description || '',
        marksCost: Number(t.marks_cost) || 0,
        sortOrder: Number(t.sort_order) || 0,
        allowsMessage: Boolean(t.allows_message),
      }));
    }
  } catch (err) {
    console.warn('[forgeMarks] award tiers', err?.message || err);
  }
  return FORGE_AWARD_TIERS.map((t) => ({ ...t }));
}

export const forgeMarksService = {
  fetchMyForgeMarks,
  fetchMyForgeMarkLedger,
  fetchPublicForgeMarksProfile,
  fetchForgeAwardTiers,
  listForgeAwardsForTargets,
  placeForgeAward,
  formatForgeMarks,
};

export default forgeMarksService;
