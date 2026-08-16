/**
 * Private community / moderation concern reports.
 * Emails REPORTS_EMAIL and always FOUNDER_EMAIL. Not stored in public tables.
 *
 * POST JSON:
 *   whatHappened, whereHappened (discord|website|both),
 *   reference?, contact?, website? (honeypot)
 *
 * Secrets (supabase secrets set / supabase/.env):
 *   REPORTS_EMAIL          — primary staff inbox
 *   FOUNDER_EMAIL          — always receives a copy
 *   RESEND_API_KEY         — Resend API key for sending mail
 *   REPORTS_FROM_EMAIL     — optional verified From (default Resend onboarding)
 *
 * Deploy: supabase functions deploy submit-concern-report --no-verify-jwt
 */

// deno-lint-ignore-file
// @ts-nocheck
import { enforceRateLimit } from '../_shared/rateLimit.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const REPORTS_LIMIT = {
  limit: 5,
  windowMs: 15 * 60 * 1000,
  bucket: 'concern-report',
  message: 'Too many reports from this network. Please wait a bit and try again.',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function clean(s, max) {
  return String(s || '')
    .trim()
    .slice(0, max);
}

function isPlaceholderEmail(value) {
  const v = String(value || '').trim();
  if (!v) return true;
  if (/PLACEHOLDER/i.test(v)) return true;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return true;
  return false;
}

function validate(body) {
  // Honeypot: if filled, pretend success (do not email)
  const honeypot = clean(body.website || body.company || body.honeypot, 200);
  if (honeypot) {
    return { honeypot: true };
  }

  const whatHappened = clean(body.whatHappened || body.what_happened, 4000);
  let whereHappened = clean(
    body.whereHappened || body.where_happened,
    20
  ).toLowerCase();
  const reference = clean(body.reference, 500);
  const contact = clean(body.contact, 200);

  if (!['discord', 'website', 'both'].includes(whereHappened)) {
    whereHappened = '';
  }

  if (!whatHappened || whatHappened.length < 10) {
    return {
      error: 'Please describe what happened (at least a short sentence).',
    };
  }
  if (!whereHappened) {
    return { error: 'Please select where it happened.' };
  }

  return {
    report: {
      whatHappened,
      whereHappened,
      reference: reference || null,
      contact: contact || null,
    },
  };
}

function whereLabel(id) {
  if (id === 'discord') return 'Discord';
  if (id === 'website') return 'Website';
  if (id === 'both') return 'Both';
  return id;
}

function buildEmailText(report, timestampIso) {
  return [
    'Together Forge — private concern report',
    'This message is for designated report handlers only.',
    '',
    `Timestamp (UTC): ${timestampIso}`,
    `Where: ${whereLabel(report.whereHappened)}`,
    `Contact (optional): ${report.contact || '(anonymous — none provided)'}`,
    `Reference (optional): ${report.reference || '(none)'}`,
    '',
    'What happened:',
    report.whatHappened,
    '',
    '—',
    'Submitted via the site Report a concern form.',
  ].join('\n');
}

/**
 * Send one message to both inboxes (To + always include founder).
 * If addresses differ, both are on the To line so each always gets a copy.
 */
async function sendReportEmails(report) {
  const reportsEmail = clean(
    Deno.env.get('REPORTS_EMAIL') ||
      Deno.env.get('REPORTS_EMAIL_PLACEHOLDER') ||
      '',
    254
  );
  const founderEmail = clean(
    Deno.env.get('FOUNDER_EMAIL') ||
      Deno.env.get('FOUNDER_EMAIL_PLACEHOLDER') ||
      '',
    254
  );
  const resendKey = String(Deno.env.get('RESEND_API_KEY') || '').trim();
  const fromAddr = clean(
    Deno.env.get('REPORTS_FROM_EMAIL') ||
      'Together Forge Reports <onboarding@resend.dev>',
    200
  );

  if (isPlaceholderEmail(reportsEmail) || isPlaceholderEmail(founderEmail)) {
    console.error(
      '[submit-concern-report] REPORTS_EMAIL and FOUNDER_EMAIL must be real addresses'
    );
    return {
      ok: false,
      error: 'Reporting is not configured on this environment yet.',
    };
  }

  if (!resendKey) {
    console.error('[submit-concern-report] RESEND_API_KEY missing');
    return {
      ok: false,
      error: 'Reporting is not configured on this environment yet.',
    };
  }

  const timestampIso = new Date().toISOString();
  const text = buildEmailText(report, timestampIso);

  // Unique recipients; founder always included
  const to = [...new Set([reportsEmail, founderEmail].map((e) => e.toLowerCase()))];

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddr,
      to,
      subject: `[TF Concern] ${whereLabel(report.whereHappened)} — ${timestampIso.slice(0, 16)}Z`,
      text,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.error(
      '[submit-concern-report] resend',
      res.status,
      errBody.slice(0, 400)
    );
    return {
      ok: false,
      error: 'Could not deliver report. Please try again later.',
    };
  }

  // If both addresses are the same, one email is enough.
  // If different and Resend only accepted one To, we already put both on To.
  // Extra guarantee: when they differ, send a second copy explicitly to founder.
  if (reportsEmail.toLowerCase() !== founderEmail.toLowerCase()) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddr,
          to: [founderEmail],
          subject: `[TF Concern copy] ${whereLabel(report.whereHappened)} — ${timestampIso.slice(0, 16)}Z`,
          text:
            'COPY for founder inbox (same report).\n\n' + text,
        }),
      });
    } catch (e) {
      // Primary already went to both on first send when both were in `to`.
      console.warn(
        '[submit-concern-report] founder copy',
        e?.message || e
      );
    }
  }

  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const limited = enforceRateLimit(req, {
      ...REPORTS_LIMIT,
      userId: null,
      cors,
    });
    if (limited) return limited;

    const body = await req.json().catch(() => ({}));
    const v = validate(body);

    // Honeypot: quiet fake success
    if (v.honeypot) {
      return json({ ok: true });
    }
    if (v.error) return json({ error: v.error }, 400);

    const sent = await sendReportEmails(v.report);
    if (!sent.ok) {
      return json({ error: sent.error || 'Could not send report.' }, 503);
    }

    return json({ ok: true });
  } catch (e) {
    console.error('[submit-concern-report]', e?.message || e);
    return json({ error: 'Could not send report. Please try again later.' }, 500);
  }
});
