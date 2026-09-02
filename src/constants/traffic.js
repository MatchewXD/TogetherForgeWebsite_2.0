/**
 * Staff Traffic dashboard ranges and bucket labels.
 * Must stay in sync with public.get_traffic_report (supabase_traffic.sql).
 */

export const TRAFFIC_HEARTBEAT_MS = 20_000;
export const TRAFFIC_ACTIVE_POLL_MS = 8_000;
export const TRAFFIC_REPORT_POLL_MS = 45_000;
export const TRAFFIC_SESSION_IDLE_MS = 30 * 60 * 1000;
export const TRAFFIC_SESSION_KEY = 'tf_traffic_sk';
export const TRAFFIC_SESSION_AT_KEY = 'tf_traffic_sk_at';

export const TRAFFIC_DEFAULT_RANGE = '7d';

export const TRAFFIC_RANGES = [
  { id: '1h', label: '1 hour' },
  { id: '6h', label: '6 hours' },
  { id: '12h', label: '12 hours' },
  { id: '24h', label: '24 hours' },
  { id: '3d', label: '3 days' },
  { id: '7d', label: '7 days' },
  { id: '14d', label: '14 days' },
  { id: '21d', label: '21 days' },
  { id: '30d', label: '30 days' },
  { id: '3m', label: '3 months' },
  { id: '6m', label: '6 months' },
  { id: '9m', label: '9 months' },
  { id: '12m', label: '12 months' },
  { id: '3y', label: '3 years' },
  { id: 'lifetime', label: 'Lifetime' },
];

export const TRAFFIC_RANGE_IDS = TRAFFIC_RANGES.map((r) => r.id);

export function isTrafficRangeId(id) {
  return TRAFFIC_RANGE_IDS.includes(String(id || ''));
}
