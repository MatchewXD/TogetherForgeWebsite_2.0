/**
 * Public bug reports + staff triage.
 * Requires supabase/sql/supabase_bug_reports.sql
 */

import { supabase } from '../lib/supabase';

export const BUG_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];

/** Staff triage workflow */
export const BUG_STATUSES = [
  'Reported',
  'Confirmed',
  'In Progress',
  'Fixed',
  'Closed',
];

/** Shown as "open" on the public tracker by default */
export const OPEN_BUG_STATUSES = ['Reported', 'Confirmed', 'In Progress'];

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function isMissingTableError(error) {
  const msg = error?.message || '';
  const code = error?.code || '';
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    /relation .* does not exist|Could not find the table|schema cache/i.test(msg)
  );
}

function missingTableMessage(error) {
  const detail = error?.message || error?.code || '';
  return (
    'Bug tracker table is missing on this Supabase project. ' +
    'Open SQL Editor for project lbstantgrrrupzeasndg, run the FULL file ' +
    'supabase/sql/supabase_bug_reports.sql, then run: ' +
    "select to_regclass('public.bug_reports'); — it must return public.bug_reports. " +
    (detail ? `(API: ${detail})` : '')
  );
}

function mapBugRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    stepsToReproduce: row.steps_to_reproduce || '',
    severity: row.severity || 'Medium',
    status: row.status || 'Reported',
    screenshotUrl: row.screenshot_url || null,
    browserInfo: row.browser_info || '',
    deviceInfo: row.device_info || '',
    reporterId: row.reporter_id || null,
    reporterEmail: row.reporter_email || null,
    reporterName: row.reporter_name || null,
    staffNotes: row.staff_notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  };
}

export function severityBadgeVariant(severity) {
  if (severity === 'Critical' || severity === 'High') return 'purple';
  if (severity === 'Medium') return 'neon';
  return 'default';
}

export function statusBadgeVariant(status) {
  if (status === 'Fixed') return 'neon';
  if (status === 'In Progress') return 'purple';
  if (status === 'Confirmed') return 'neon';
  if (status === 'Closed') return 'default';
  return 'default';
}

/** Common Browser / OS choices for the report form dropdown */
export const BROWSER_OS_OPTIONS = [
  '',
  'Chrome on Windows',
  'Chrome on macOS',
  'Chrome on Linux',
  'Chrome on Android',
  'Firefox on Windows',
  'Firefox on macOS',
  'Firefox on Linux',
  'Safari on macOS',
  'Safari on iOS',
  'Edge on Windows',
  'Edge on macOS',
  'Opera',
  'Samsung Internet',
  'Other / not sure',
];

/**
 * Best-effort match of navigator.userAgent to a BROWSER_OS_OPTIONS value.
 * Returns empty string if no clear match (user picks from dropdown).
 */
export function detectBrowserOsOption() {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent || '';
  const isWin = /Windows/i.test(ua);
  const isMac = /Macintosh|Mac OS X/i.test(ua) && !/iPhone|iPad|iPod/i.test(ua);
  const isLinux = /Linux/i.test(ua) && !/Android/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  // Edge/Opera before Chrome (they include Chrome in UA)
  const isEdge = /Edg\//i.test(ua);
  const isOpera = /OPR\/|Opera/i.test(ua);
  const isFirefox = /Firefox\//i.test(ua);
  const isSafari =
    /Safari\//i.test(ua) && !/Chrome|Chromium|Edg|OPR|Android/i.test(ua);
  const isChrome =
    /Chrome\//i.test(ua) && !/Edg\/|OPR\/|SamsungBrowser/i.test(ua);
  const isSamsung = /SamsungBrowser/i.test(ua);

  if (isSamsung) return 'Samsung Internet';
  if (isOpera) return 'Opera';
  if (isEdge && isWin) return 'Edge on Windows';
  if (isEdge && isMac) return 'Edge on macOS';
  if (isEdge) return 'Edge on Windows';
  if (isFirefox && isWin) return 'Firefox on Windows';
  if (isFirefox && isMac) return 'Firefox on macOS';
  if (isFirefox && isLinux) return 'Firefox on Linux';
  if (isFirefox) return 'Firefox on Windows';
  if (isSafari && isIOS) return 'Safari on iOS';
  if (isSafari && isMac) return 'Safari on macOS';
  if (isChrome && isAndroid) return 'Chrome on Android';
  if (isChrome && isWin) return 'Chrome on Windows';
  if (isChrome && isMac) return 'Chrome on macOS';
  if (isChrome && isLinux) return 'Chrome on Linux';
  if (isIOS) return 'Safari on iOS';
  if (isAndroid) return 'Chrome on Android';
  return '';
}

/** @deprecated use detectBrowserOsOption — kept for older imports */
export function detectBrowserInfo() {
  return detectBrowserOsOption();
}

export const bugReportsService = {
  async listBugs({ status = 'open', limit = 50 } = {}) {
    let q = supabase
      .from('bug_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status === 'open') {
      q = q.in('status', OPEN_BUG_STATUSES);
    } else if (status && status !== 'all') {
      q = q.eq('status', status);
    }

    const { data, error } = await q;
    if (error) {
      if (isMissingTableError(error)) {
        const err = new Error(missingTableMessage(error));
        err.code = 'MISSING_TABLE';
        throw err;
      }
      throw error;
    }
    return (data || []).map(mapBugRow);
  },

  async getBug(id) {
    const { data, error } = await supabase
      .from('bug_reports')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return mapBugRow(data);
  },

  /**
   * Upload optional screenshot. Returns public URL or null.
   * @param {File} file
   */
  async uploadScreenshot(file) {
    if (!file) return null;
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error('Screenshot must be JPEG, PNG, WebP, or GIF.');
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      throw new Error('Screenshot must be under 5MB.');
    }

    const ext =
      (file.name && file.name.split('.').pop()?.toLowerCase()) ||
      (file.type === 'image/png' ? 'png' : 'jpg');
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('bug-screenshots')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (upErr) {
      if (/bucket|not found|does not exist/i.test(upErr.message || '')) {
        throw new Error(
          'Screenshot storage is not set up. Create a public "bug-screenshots" bucket or run supabase/sql/supabase_bug_reports.sql.'
        );
      }
      throw upErr;
    }

    const { data } = supabase.storage.from('bug-screenshots').getPublicUrl(path);
    return data?.publicUrl || null;
  },

  /**
   * Submit a bug (anon or signed-in).
   * @param {object} payload
   * @param {File|null} [screenshotFile]
   */
  async submitBug(payload, screenshotFile = null) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let screenshotUrl = null;
    if (screenshotFile) {
      screenshotUrl = await this.uploadScreenshot(screenshotFile);
    }

    const title = String(payload.title || '').trim();
    const description = String(payload.description || '').trim();
    if (title.length < 3) throw new Error('Title must be at least 3 characters.');
    if (description.length < 10) {
      throw new Error('Description must be at least 10 characters.');
    }

    const severity = BUG_SEVERITIES.includes(payload.severity)
      ? payload.severity
      : 'Medium';

    const row = {
      title,
      description,
      steps_to_reproduce: String(payload.stepsToReproduce || '').trim() || null,
      severity,
      status: 'Reported',
      screenshot_url: screenshotUrl,
      browser_info: String(payload.browserInfo || '').trim() || null,
      device_info: String(payload.deviceInfo || '').trim() || null,
      reporter_id: user?.id || null,
      reporter_email:
        String(payload.reporterEmail || user?.email || '').trim() || null,
      reporter_name: String(payload.reporterName || '').trim() || null,
    };

    const { data, error } = await supabase
      .from('bug_reports')
      .insert([row])
      .select('*')
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        const err = new Error(missingTableMessage(error));
        err.code = 'MISSING_TABLE';
        throw err;
      }
      throw error;
    }
    return mapBugRow(data);
  },

  /** Staff only: change triage status */
  async updateStatus(id, status, staffNotes) {
    if (!BUG_STATUSES.includes(status)) {
      throw new Error('Invalid status');
    }
    const patch = { status };
    if (staffNotes !== undefined) {
      patch.staff_notes = staffNotes || null;
    }
    const { data, error } = await supabase
      .from('bug_reports')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return mapBugRow(data);
  },

  async deleteBug(id) {
    const { error } = await supabase.from('bug_reports').delete().eq('id', id);
    if (error) throw error;
    return true;
  },
};

export default bugReportsService;
