/**
 * Shared password strength rules for sign-up, change-password, and reset flows.
 */

export const PASSWORD_MIN_LENGTH = 8;

/**
 * Human-readable requirements for sign-up UI (always list these).
 * Keep in sync with validatePasswordStrength.
 */
export const PASSWORD_REQUIREMENTS = [
  {
    id: 'length',
    label: `At least ${PASSWORD_MIN_LENGTH} characters (max 72)`,
  },
  {
    id: 'letter',
    label: 'At least one letter',
  },
  {
    id: 'number',
    label: 'At least one number',
  },
  {
    id: 'no_spaces',
    label: 'No spaces',
  },
  {
    id: 'not_email',
    label: 'Must not contain your email username',
  },
];

/**
 * Live checklist for a password against requirements.
 * @param {string} password
 * @param {{ email?: string|null }} [opts]
 * @returns {Array<{ id: string, label: string, met: boolean }>}
 */
export function getPasswordRequirementStatus(password, opts = {}) {
  const pw = String(password || '');
  const email = String(opts.email || '').trim().toLowerCase();
  const local = email.split('@')[0] || '';
  const containsEmail =
    local.length >= 3 && pw.toLowerCase().includes(local);

  return [
    {
      id: 'length',
      label: `At least ${PASSWORD_MIN_LENGTH} characters (max 72)`,
      met: pw.length >= PASSWORD_MIN_LENGTH && pw.length <= 72,
    },
    {
      id: 'letter',
      label: 'At least one letter',
      met: /[a-zA-Z]/.test(pw),
    },
    {
      id: 'number',
      label: 'At least one number',
      met: /[0-9]/.test(pw),
    },
    {
      id: 'no_spaces',
      label: 'No spaces',
      met: pw.length > 0 ? !/\s/.test(pw) : false,
    },
    {
      id: 'not_email',
      label: 'Must not contain your email username',
      // No email yet / short local part → rule does not apply (ok)
      met:
        !email || local.length < 3
          ? true
          : pw.length > 0 && !containsEmail,
    },
  ];
}

/**
 * @param {string} password
 * @param {{ email?: string|null }} [opts]
 * @returns {{ ok: true } | { ok: false, message: string, code: string }}
 */
export function validatePasswordStrength(password, opts = {}) {
  const pw = String(password || '');
  if (pw.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      code: 'TOO_SHORT',
      message: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
    };
  }
  if (pw.length > 72) {
    // bcrypt practical limit many stacks use
    return {
      ok: false,
      code: 'TOO_LONG',
      message: 'Password must be 72 characters or fewer.',
    };
  }
  if (!/[a-zA-Z]/.test(pw)) {
    return {
      ok: false,
      code: 'NEED_LETTER',
      message: 'Include at least one letter.',
    };
  }
  if (!/[0-9]/.test(pw)) {
    return {
      ok: false,
      code: 'NEED_NUMBER',
      message: 'Include at least one number.',
    };
  }
  if (/\s/.test(pw)) {
    return {
      ok: false,
      code: 'NO_SPACES',
      message: 'Password cannot contain spaces.',
    };
  }
  const email = String(opts.email || '').trim().toLowerCase();
  if (email) {
    const local = email.split('@')[0] || '';
    if (local.length >= 3 && pw.toLowerCase().includes(local)) {
      return {
        ok: false,
        code: 'CONTAINS_EMAIL',
        message: 'Do not include your email username in the password.',
      };
    }
  }
  return { ok: true };
}

/**
 * Soft strength score 0–4 for UI meter (does not replace validation).
 * @param {string} password
 */
export function passwordStrengthScore(password) {
  const pw = String(password || '');
  let score = 0;
  if (pw.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/[0-9]/.test(pw) && /[^a-zA-Z0-9]/.test(pw)) score += 1;
  return Math.min(4, score);
}

export function passwordStrengthLabel(score) {
  if (score <= 1) return 'Weak';
  if (score === 2) return 'Fair';
  if (score === 3) return 'Good';
  return 'Strong';
}
