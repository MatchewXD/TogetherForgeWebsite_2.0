import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  listUserProviders,
  userHasProvider,
  isEmailVerified,
  hasSsoLinked,
  canUnlinkProvider,
  findIdentity,
  providerDisplayName,
  humanizeAuthIdentityError,
  formatIdentityAlreadyLinkedToOtherError,
  formatAutoLinkedSuccess,
  formatAlreadyLinkedToSelf,
  parseAuthCallbackParams,
  cleanAuthCallbackUrl,
  isRecentlyCreatedIdentity,
  userHasMultipleIdentities,
  describeSsoReturnOutcome,
  stashOAuthIntent,
  consumeOAuthIntent,
  resolveOAuthReturnState,
  authSignInRedirectUrl,
  linkedAccountsRedirectUrl,
  safeReturnToPath,
} from '../utils/authIdentities';

describe('authIdentities', () => {
  it('lists providers from identities and app_metadata', () => {
    expect(
      listUserProviders({
        identities: [{ provider: 'email' }, { provider: 'Discord' }],
        app_metadata: { providers: ['email', 'discord'] },
      })
    ).toEqual(expect.arrayContaining(['email', 'discord']));
  });

  it('detects email verification', () => {
    expect(isEmailVerified(null)).toBe(false);
    expect(isEmailVerified({ email_confirmed_at: null })).toBe(false);
    expect(isEmailVerified({ email_confirmed_at: '2024-01-01' })).toBe(true);
  });

  it('detects SSO for identity gate', () => {
    expect(hasSsoLinked({ identities: [{ provider: 'email' }] })).toBe(false);
    expect(hasSsoLinked({ identities: [{ provider: 'google' }] })).toBe(true);
    expect(hasSsoLinked({ identities: [{ provider: 'github' }] })).toBe(true);
    expect(userHasProvider({ identities: [{ provider: 'discord' }] }, 'discord')).toBe(
      true
    );
  });

  it('findIdentity matches provider case-insensitively', () => {
    const id = { id: '1', provider: 'Google' };
    expect(findIdentity({ identities: [id] }, 'google')?.id).toBe('1');
  });

  it('blocks unlinking the only identity', () => {
    const only = [{ id: '1', provider: 'discord' }];
    expect(
      canUnlinkProvider(
        { identities: only },
        'discord',
        only
      )
    ).toBe(false);
    expect(
      canUnlinkProvider(
        {
          identities: [
            { id: '1', provider: 'email' },
            { id: '2', provider: 'discord' },
          ],
        },
        'discord',
        [
          { id: '1', provider: 'email' },
          { id: '2', provider: 'discord' },
        ]
      )
    ).toBe(true);
  });

  it('labels providers consistently', () => {
    expect(providerDisplayName('google')).toBe('Google');
    expect(providerDisplayName('DISCORD')).toBe('Discord');
    expect(providerDisplayName('github')).toBe('GitHub');
  });

  it('builds redirect URLs with provider', () => {
    expect(authSignInRedirectUrl('https://example.com', 'google')).toBe(
      'https://example.com/dashboard?sso=1&provider=google'
    );
    expect(linkedAccountsRedirectUrl('https://example.com', 'discord')).toBe(
      'https://example.com/account/linked?linked=1&provider=discord'
    );
  });

  it('allows in-app return paths and rejects open redirects', () => {
    expect(safeReturnToPath('/ideas')).toBe('/ideas');
    expect(safeReturnToPath('/ideas/22?tab=comments')).toBe(
      '/ideas/22?tab=comments'
    );
    expect(safeReturnToPath('/dashboard')).toBeNull();
    expect(safeReturnToPath('/account')).toBeNull();
    expect(safeReturnToPath('https://evil.test/phish')).toBeNull();
    expect(safeReturnToPath('//evil.test')).toBeNull();
  });
});

describe('SSO edge-case messages', () => {
  it('humanizes identity already linked to another user', () => {
    expect(
      humanizeAuthIdentityError(
        { code: 'identity_already_exists', message: 'Identity already linked' },
        'google'
      )
    ).toBe(formatIdentityAlreadyLinkedToOtherError('google'));

    expect(
      humanizeAuthIdentityError(
        'Identity is already linked to another user',
        'discord'
      )
    ).toMatch(/already linked to a different Together Forge account/i);
  });

  it('humanizes already linked to self phrasing', () => {
    expect(
      humanizeAuthIdentityError(
        'Identity already linked to the user',
        'github'
      )
    ).toBe(formatAlreadyLinkedToSelf('github'));
  });

  it('humanizes provider disabled and cancel', () => {
    expect(
      humanizeAuthIdentityError('Provider is not enabled', 'google')
    ).toMatch(/not enabled/i);
    expect(
      humanizeAuthIdentityError({ code: 'access_denied' }, 'discord')
    ).toMatch(/cancelled/i);
  });

  it('parses query and hash callback params', () => {
    const fromQuery = parseAuthCallbackParams(
      'https://app.test/account?error=server_error&error_description=Identity+already+linked&provider=google'
    );
    expect(fromQuery.error).toBe('server_error');
    expect(fromQuery.error_description).toMatch(/Identity/i);
    expect(fromQuery.provider).toBe('google');

    const fromHash = parseAuthCallbackParams(
      'https://app.test/account#error=access_denied&provider=github'
    );
    expect(fromHash.error).toBe('access_denied');
    expect(fromHash.provider).toBe('github');
  });

  it('cleans auth noise from URLs', () => {
    const cleaned = cleanAuthCallbackUrl(
      'https://app.test/account/profile?sso=1&provider=google&foo=bar#error=x'
    );
    expect(cleaned).toContain('/account/profile');
    expect(cleaned).toContain('foo=bar');
    expect(cleaned).not.toMatch(/sso=1/);
    expect(cleaned).not.toMatch(/provider=google/);
  });

  it('detects recently created identities', () => {
    const now = Date.parse('2026-01-01T12:00:00.000Z');
    expect(
      isRecentlyCreatedIdentity(
        { created_at: '2026-01-01T11:59:00.000Z' },
        now
      )
    ).toBe(true);
    expect(
      isRecentlyCreatedIdentity(
        { created_at: '2025-12-01T12:00:00.000Z' },
        now
      )
    ).toBe(false);
    expect(isRecentlyCreatedIdentity({}, now)).toBe(false);
  });

  it('detects multiple identities for auto-link', () => {
    expect(
      userHasMultipleIdentities({
        identities: [{ provider: 'email' }, { provider: 'google' }],
      })
    ).toBe(true);
    expect(
      userHasMultipleIdentities({
        identities: [{ provider: 'google' }],
      })
    ).toBe(false);
  });

  it('describes auto-link success when new SSO identity joins existing account', () => {
    const now = new Date().toISOString();
    const user = {
      identities: [
        { provider: 'email', created_at: '2024-01-01T00:00:00.000Z' },
        { provider: 'google', created_at: now },
      ],
    };
    const outcome = describeSsoReturnOutcome(
      user,
      { intent: 'signin', provider: 'google' },
      { sso: '1', provider: 'google' }
    );
    expect(outcome.kind).toBe('success');
    expect(outcome.message).toBe(formatAutoLinkedSuccess('google'));
  });

  it('stays quiet for normal returning SSO sign-in', () => {
    const user = {
      identities: [
        { provider: 'email', created_at: '2024-01-01T00:00:00.000Z' },
        { provider: 'google', created_at: '2024-06-01T00:00:00.000Z' },
      ],
    };
    const outcome = describeSsoReturnOutcome(
      user,
      { intent: 'signin', provider: 'google' },
      { sso: '1', provider: 'google' }
    );
    expect(outcome.message).toBeNull();
  });

  it('stays quiet for brand-new OAuth-only account', () => {
    const now = new Date().toISOString();
    const user = {
      identities: [{ provider: 'discord', created_at: now }],
    };
    const outcome = describeSsoReturnOutcome(
      user,
      { intent: 'signin', provider: 'discord' },
      { sso: '1', provider: 'discord' }
    );
    expect(outcome.message).toBeNull();
  });

  it('describes successful manual link', () => {
    const user = {
      identities: [
        { provider: 'email' },
        { provider: 'github', created_at: new Date().toISOString() },
      ],
    };
    const outcome = describeSsoReturnOutcome(
      user,
      { intent: 'link', provider: 'github' },
      { linked: '1', provider: 'github' }
    );
    expect(outcome.message).toMatch(/GitHub linked successfully/i);
  });
});

describe('OAuth intent + resolveOAuthReturnState', () => {
  beforeEach(() => {
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });
  afterEach(() => {
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });

  it('stashes and consumes intent', () => {
    stashOAuthIntent({ intent: 'link', provider: 'Google', returnTo: '/ideas' });
    const got = consumeOAuthIntent();
    expect(got).toEqual(
      expect.objectContaining({
        intent: 'link',
        provider: 'google',
        returnTo: '/ideas',
      })
    );
    expect(consumeOAuthIntent()).toBeNull();
  });

  it('resolves identity_already_exists from callback URL', () => {
    stashOAuthIntent({ intent: 'link', provider: 'google' });
    const result = resolveOAuthReturnState({
      user: null,
      href:
        'https://app.test/account/linked?error=server_error&error_code=identity_already_exists&error_description=Identity+already+exists&provider=google',
      consumeIntent: true,
    });
    expect(result.ok).toBe(false);
    expect(result.message).toBe(
      formatIdentityAlreadyLinkedToOtherError('google')
    );
    expect(result.cleanPath).toContain('/account/linked');
    expect(result.cleanPath).not.toMatch(/error=/);
  });

  it('resolves auto-link success for signed-in user', () => {
    stashOAuthIntent({ intent: 'signin', provider: 'discord' });
    const now = new Date().toISOString();
    const user = {
      identities: [
        { provider: 'email', created_at: '2024-01-01T00:00:00.000Z' },
        { provider: 'discord', created_at: now },
      ],
    };
    const result = resolveOAuthReturnState({
      user,
      href: 'https://app.test/account?sso=1&provider=discord',
      consumeIntent: true,
    });
    expect(result.ok).toBe(true);
    expect(result.message).toBe(formatAutoLinkedSuccess('discord'));
  });
});
