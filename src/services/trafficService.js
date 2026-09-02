/**
 * First-party traffic RPCs. Staff reads aggregates only.
 * Heartbeat never throws to the UI.
 */

import { supabase } from '../lib/supabase';
import { TRAFFIC_DEFAULT_RANGE, isTrafficRangeId } from '../constants/traffic';
import { sanitizeTrafficPath } from '../utils/trafficPath';
import { getTrafficSessionKey } from '../utils/trafficSession';

function isMissingRpc(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || error.details || '');
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    /could not find the function|does not exist|schema cache/i.test(msg)
  );
}

function isStaffDenied(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '');
  return code === '42501' || /STAFF_ONLY|permission denied/i.test(msg);
}

function asInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function mapTrafficActive(raw) {
  const row = raw && typeof raw === 'object' ? raw : {};
  return {
    activeNow: asInt(row.active_now),
    signedIn: asInt(row.signed_in),
    guests: asInt(row.guests),
  };
}

export function mapTrafficReport(raw) {
  const row = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const series = Array.isArray(row.series)
    ? row.series.map((p) => ({
        t: p?.t || null,
        concurrent: asInt(p?.concurrent),
        pageviews: asInt(p?.pageviews),
      }))
    : [];
  const topPages = Array.isArray(row.top_pages)
    ? row.top_pages
        .map((p) => ({
          path: sanitizeTrafficPath(p?.path || '/'),
          pageviews: asInt(p?.pageviews),
          uniquePages: Math.max(1, asInt(p?.unique_pages) || 1),
        }))
        .sort((a, b) => b.pageviews - a.pageviews || a.path.localeCompare(b.path))
    : [];
  return {
    range: isTrafficRangeId(row.range) ? row.range : TRAFFIC_DEFAULT_RANGE,
    bucket: typeof row.bucket === 'string' ? row.bucket : '',
    from: row.from || null,
    to: row.to || null,
    activeNow: asInt(row.active_now),
    uniqueVisitors: asInt(row.unique_visitors),
    pageviews: asInt(row.pageviews),
    signedInVisitors: asInt(row.signed_in_visitors),
    guestVisitors: asInt(row.guest_visitors),
    signedInPageviews: asInt(row.signed_in_pageviews),
    guestPageviews: asInt(row.guest_pageviews),
    series,
    topPages,
  };
}

export async function recordTrafficHeartbeat({
  path,
  isPageview = false,
} = {}) {
  try {
    const sessionKey = getTrafficSessionKey();
    const { error } = await supabase.rpc('record_traffic_heartbeat', {
      p_session_key: sessionKey,
      p_path: sanitizeTrafficPath(path || '/'),
      p_is_pageview: Boolean(isPageview),
    });
    if (error && !isMissingRpc(error)) {
      console.warn('[traffic] heartbeat', error.message || error);
    }
  } catch {
    /* never break the site */
  }
}

export async function getTrafficActiveNow() {
  const { data, error } = await supabase.rpc('get_traffic_active_now');
  if (error) {
    if (isMissingRpc(error)) {
      const err = new Error(
        'Traffic is not set up yet. Apply supabase/sql/supabase_traffic.sql.'
      );
      err.code = 'TABLE_MISSING';
      throw err;
    }
    if (isStaffDenied(error)) {
      const err = new Error('Staff only.');
      err.code = 'STAFF_ONLY';
      throw err;
    }
    throw new Error('Could not load live traffic.');
  }
  return mapTrafficActive(data);
}

export async function getTrafficReport(range = TRAFFIC_DEFAULT_RANGE) {
  const id = isTrafficRangeId(range) ? range : TRAFFIC_DEFAULT_RANGE;
  const { data, error } = await supabase.rpc('get_traffic_report', {
    p_range: id,
  });
  if (error) {
    if (isMissingRpc(error)) {
      const err = new Error(
        'Traffic is not set up yet. Apply supabase/sql/supabase_traffic.sql.'
      );
      err.code = 'TABLE_MISSING';
      throw err;
    }
    if (isStaffDenied(error)) {
      const err = new Error('Staff only.');
      err.code = 'STAFF_ONLY';
      throw err;
    }
    throw new Error('Could not load traffic report.');
  }
  return mapTrafficReport(data);
}

export const trafficService = {
  recordTrafficHeartbeat,
  getTrafficActiveNow,
  getTrafficReport,
};

export default trafficService;
