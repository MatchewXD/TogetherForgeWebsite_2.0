/**
 * Hybrid idea tags — shared constants.
 * Keep TAG_PROMOTION_THRESHOLD in sync with supabase_idea_tags.sql.
 */

/** Suggested tags become publicly selectable after this many ideas use them. */
export const TAG_PROMOTION_THRESHOLD = 9;

/** Max length for a single tag label. */
export const TAG_MAX_LENGTH = 40;

/** Max tags attachable to one idea. */
export const TAG_MAX_PER_IDEA = 12;

/**
 * Curated core tags — always available when the DB catalog is missing.
 * Seeded as status=curated in supabase_idea_tags.sql.
 */
export const CURATED_CORE_TAGS = [
  'co-op',
  'multiplayer',
  'singleplayer',
  'PvE',
  'PvP',
  'horror',
  'puzzle',
  'action',
  'adventure',
  'RPG',
  'roguelike',
  'strategy',
  'simulation',
  'sandbox',
  'story-rich',
  'atmospheric',
  'pixel-art',
  '3D',
  '2D',
  'Twitch',
  'streamer',
  'community',
  'survival',
  'crafting',
  'building',
  'exploration',
  'stealth',
  'platformer',
  'shooter',
  'open-world',
  'narrative',
  'procedural',
  'physics',
  'tactical',
  'casual',
  'hardcore',
  'VR',
  'local multiplayer',
  'asymmetric',
  'sci-fi',
  'fantasy',
];

export const TAG_STATUS = {
  CURATED: 'curated',
  SUGGESTED: 'suggested',
  APPROVED: 'approved',
  HIDDEN: 'hidden',
};
