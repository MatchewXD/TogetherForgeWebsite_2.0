/**
 * Shared community destinations. Use these so Discord (and later socials)
 * stay consistent across footer, contribution pages, and boards.
 *
 * Official invite (single source of truth for the whole site):
 *   DISCORD_URL — change here only; DiscordLink and pages import this.
 *   X_URL — official X account.
 */

export const DISCORD_URL = 'https://discord.gg/fHjR5q4Puv';

export const X_URL = 'https://x.com/TogetherForge';

export const YOUTUBE_URL = 'https://www.youtube.com/@TogetherForge';

/** Preferred short CTAs — pick by context, keep wording consistent site-wide */
export const DISCORD_LABELS = {
  join: 'Join the Discord',
  community: 'Join the Community',
  chat: 'Chat with the community',
  short: 'Discord',
};

export const X_LABELS = {
  follow: 'Follow on X',
  short: 'X',
  handle: '@TogetherForge',
};
