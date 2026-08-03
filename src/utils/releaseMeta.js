/**
 * Helpers for Released Games listing + detail pages.
 */

/** Prefer play / download / buy order for key action links */
export function sortReleaseLinks(links = []) {
  const order = {
    play: 0,
    download: 1,
    buy: 2,
    store: 3,
    steam: 4,
    itch: 5,
    itchio: 5,
    website: 6,
  };
  return [...(links || [])].sort((a, b) => {
    const ka =
      order[String(a.kind || a.label || '').toLowerCase().replace(/\s+/g, '')] ??
      50;
    const kb =
      order[String(b.kind || b.label || '').toLowerCase().replace(/\s+/g, '')] ??
      50;
    if (ka !== kb) return ka - kb;
    return String(a.label || '').localeCompare(String(b.label || ''));
  });
}

export function phaseBadgeVariant(phase) {
  const p = String(phase || '').toLowerCase();
  if (p.startsWith('mid')) return 'purple';
  if (p.startsWith('late')) return 'gold';
  return 'neon';
}

export function formatReleaseDate(iso, { long = true } = {}) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: long ? 'long' : 'short',
    day: 'numeric',
  });
}

function asStringList(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v || '').trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    // Allow comma-separated strings from CMS/admin forms
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function asMediaList(value) {
  if (!value) return [];
  if (!Array.isArray(value)) return [];
  return value
    .map((item, i) => {
      if (!item) return null;
      if (typeof item === 'string') {
        const url = item.trim();
        return url ? { url, alt: `Screenshot ${i + 1}`, caption: '' } : null;
      }
      if (typeof item === 'object') {
        const url = String(item.url || item.src || item.href || '').trim();
        if (!url) return null;
        return {
          url,
          alt: String(item.alt || item.title || `Screenshot ${i + 1}`).trim(),
          caption: String(item.caption || item.label || '').trim(),
        };
      }
      return null;
    })
    .filter(Boolean);
}

/**
 * Parse a single Steam review bucket (recent or overall).
 * Fields: label (e.g. "Very Positive"), percent (0–100), count (optional).
 */
function parseSteamReviewBucket(bucket, flatPrefix, obj) {
  const src =
    bucket && typeof bucket === 'object' && !Array.isArray(bucket)
      ? bucket
      : {};
  const label = String(
    src.label ||
      src.rating ||
      src.summary ||
      obj?.[`${flatPrefix}_label`] ||
      obj?.[`${flatPrefix}Label`] ||
      ''
  ).trim();

  const rawPercent =
    src.percent ??
    src.percentage ??
    src.positive_percent ??
    src.positivePercent ??
    obj?.[`${flatPrefix}_percent`] ??
    obj?.[`${flatPrefix}Percent`] ??
    obj?.[`${flatPrefix}_percentage`];
  let percent = null;
  if (rawPercent != null && rawPercent !== '') {
    const n = Number(String(rawPercent).replace(/%/g, '').trim());
    if (Number.isFinite(n)) percent = Math.round(n);
  }

  const rawCount =
    src.count ??
    src.review_count ??
    src.reviewCount ??
    src.total ??
    obj?.[`${flatPrefix}_count`] ??
    obj?.[`${flatPrefix}Count`] ??
    obj?.[`${flatPrefix}_review_count`];
  let count = null;
  if (rawCount != null && rawCount !== '') {
    const n = Number(String(rawCount).replace(/,/g, '').trim());
    if (Number.isFinite(n) && n >= 0) count = Math.round(n);
  }

  if (!label && percent == null && count == null) return null;
  return { label: label || null, percent, count };
}

/**
 * Steam Reviews only (manual entry for now).
 * Accepts nested steam_reviews / steamReviews, or flat steam_recent_* fields.
 */
export function parseSteamReviews(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return emptySteamReviews();
  }

  const nested =
    (obj.steam_reviews && typeof obj.steam_reviews === 'object'
      ? obj.steam_reviews
      : null) ||
    (obj.steamReviews && typeof obj.steamReviews === 'object'
      ? obj.steamReviews
      : null) ||
    (obj.steam && typeof obj.steam === 'object' ? obj.steam : null) ||
    {};

  const recent = parseSteamReviewBucket(
    nested.recent || nested.Recent,
    'steam_recent',
    { ...obj, ...nested }
  );
  // Also try flat keys on root when nested.recent missing
  const recentFinal =
    recent ||
    parseSteamReviewBucket(null, 'steam_recent', obj) ||
    parseSteamReviewBucket(null, 'recent', obj);

  const overall = parseSteamReviewBucket(
    nested.overall || nested.Overall,
    'steam_overall',
    { ...obj, ...nested }
  );
  const overallFinal =
    overall ||
    parseSteamReviewBucket(null, 'steam_overall', obj) ||
    parseSteamReviewBucket(null, 'overall', obj);

  const url = String(
    nested.url ||
      nested.store_url ||
      nested.storeUrl ||
      obj.steam_url ||
      obj.steamUrl ||
      obj.steam_store_url ||
      ''
  ).trim() || null;

  return {
    recent: recentFinal,
    overall: overallFinal,
    url,
  };
}

export function emptySteamReviews() {
  return { recent: null, overall: null, url: null };
}

export function hasSteamReviews(steam) {
  if (!steam) return false;
  return Boolean(steam.recent || steam.overall);
}

/** Format review count with thousands separators */
export function formatReviewCount(count) {
  if (count == null || !Number.isFinite(Number(count))) return null;
  return new Intl.NumberFormat(undefined).format(Number(count));
}

/**
 * Recent: Overwhelmingly Positive (97%)
 * Returns null when nothing useful to show.
 */
export function formatSteamRecentLine(recent) {
  if (!recent) return null;
  const { label, percent } = recent;
  if (label && percent != null) return `${label} (${percent}%)`;
  if (label) return label;
  if (percent != null) return `${percent}%`;
  return null;
}

/**
 * Overall: Very Positive (94% of 8,512)
 * Returns null when nothing useful to show.
 */
export function formatSteamOverallLine(overall) {
  if (!overall) return null;
  const { label, percent, count } = overall;
  const countStr = formatReviewCount(count);
  if (label && percent != null && countStr) {
    return `${label} (${percent}% of ${countStr})`;
  }
  if (label && percent != null) return `${label} (${percent}%)`;
  if (label && countStr) return `${label} (${countStr} reviews)`;
  if (label) return label;
  if (percent != null && countStr) return `${percent}% of ${countStr}`;
  if (percent != null) return `${percent}%`;
  if (countStr) return `${countStr} reviews`;
  return null;
}

/**
 * Normalize release_meta JSON (DB or static extras) into a stable shape.
 */
export function parseReleaseMeta(raw) {
  let obj = raw;
  if (!raw) {
    return emptyReleaseMeta();
  }
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return emptyReleaseMeta();
    }
  }
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    return emptyReleaseMeta();
  }

  const originIds = Array.isArray(obj.origin_idea_ids)
    ? obj.origin_idea_ids
    : Array.isArray(obj.originIdeaIds)
      ? obj.originIdeaIds
      : obj.origin_idea_id != null
        ? [obj.origin_idea_id]
        : obj.originIdeaId != null
          ? [obj.originIdeaId]
          : [];

  return {
    tagline: String(obj.tagline || obj.hook || '').trim() || null,
    platforms: asStringList(obj.platforms || obj.platform),
    genre: asStringList(obj.genre || obj.genres),
    coverImage: String(
      obj.cover_image || obj.coverImage || obj.hero_image || obj.heroImage || ''
    ).trim() || null,
    media: asMediaList(obj.media || obj.screenshots || obj.gallery),
    steamReviews: parseSteamReviews(obj),
    developmentStory: String(
      obj.development_story ||
        obj.developmentStory ||
        obj.how_it_was_made ||
        obj.howItWasMade ||
        ''
    ).trim() || null,
    originIdeaIds: originIds
      .map((id) => (id == null ? null : String(id).trim()))
      .filter(Boolean),
  };
}

export function emptyReleaseMeta() {
  return {
    tagline: null,
    platforms: [],
    genre: [],
    coverImage: null,
    media: [],
    steamReviews: emptySteamReviews(),
    developmentStory: null,
    originIdeaIds: [],
  };
}

function steamBucketHasData(bucket) {
  return Boolean(
    bucket &&
      (bucket.label || bucket.percent != null || bucket.count != null)
  );
}

/**
 * Merge DB release_meta with optional static extras (static fills empty slots only).
 */
export function mergeReleaseMeta(primary, fallback) {
  const a = parseReleaseMeta(primary);
  const b = parseReleaseMeta(fallback);
  const steamA = a.steamReviews || emptySteamReviews();
  const steamB = b.steamReviews || emptySteamReviews();
  return {
    tagline: a.tagline || b.tagline,
    platforms: a.platforms.length ? a.platforms : b.platforms,
    genre: a.genre.length ? a.genre : b.genre,
    coverImage: a.coverImage || b.coverImage,
    media: a.media.length ? a.media : b.media,
    steamReviews: {
      recent: steamBucketHasData(steamA.recent)
        ? steamA.recent
        : steamB.recent,
      overall: steamBucketHasData(steamA.overall)
        ? steamA.overall
        : steamB.overall,
      url: steamA.url || steamB.url,
    },
    developmentStory: a.developmentStory || b.developmentStory,
    originIdeaIds: a.originIdeaIds.length
      ? a.originIdeaIds
      : b.originIdeaIds,
  };
}
