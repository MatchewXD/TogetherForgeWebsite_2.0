/**
 * Track when a user last viewed their own ideas (localStorage).
 * Used on Dashboard "My Ideas" to show simple new-activity indicators.
 */

const storageKey = (userId) => `tf_idea_last_viewed_${userId || 'anon'}`;

/** @returns {Record<string, string>} ideaId → ISO timestamp */
export function getIdeaLastViewedMap(userId) {
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Record that the user opened this idea page now. */
export function markIdeaViewed(userId, ideaId) {
  if (!userId || ideaId == null) return;
  try {
    const map = getIdeaLastViewedMap(userId);
    map[String(ideaId)] = new Date().toISOString();
    localStorage.setItem(storageKey(userId), JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/**
 * Whether activity (comments, etc.) happened after the user's last visit.
 * If never viewed, baseline is idea.created_at so own post doesn't count as "new".
 */
export function ideaHasNewActivity(idea, lastViewedIso) {
  if (!idea) return false;
  const baseline = lastViewedIso
    ? new Date(lastViewedIso).getTime()
    : new Date(idea.created_at || 0).getTime();
  if (!Number.isFinite(baseline)) return false;

  const latestComment = idea.latestCommentAt
    ? new Date(idea.latestCommentAt).getTime()
    : 0;
  if (latestComment > baseline) return true;

  // Related / add-on ideas that reference this idea (if present)
  const relatedAt = idea.latestRelatedAt
    ? new Date(idea.latestRelatedAt).getTime()
    : 0;
  if (relatedAt > baseline) return true;

  return false;
}

/** Human-readable activity blurb for list rows. */
export function formatIdeaActivityHint(idea) {
  const parts = [];
  const n = Number(idea?.newCommentCount) || 0;
  if (n > 0) {
    parts.push(n === 1 ? '1 new comment' : `${n} new comments`);
  } else if (idea?.hasNewActivity && (idea?.commentCount || 0) > 0) {
    parts.push('New comments');
  }
  if (idea?.newRelatedCount > 0) {
    parts.push(
      idea.newRelatedCount === 1
        ? '1 new related idea'
        : `${idea.newRelatedCount} new related ideas`
    );
  } else if (idea?.hasNewActivity && idea?.relatedCount > 0) {
    parts.push('New related activity');
  }
  if (!parts.length && idea?.hasNewActivity) {
    return 'New activity';
  }
  return parts.join(' · ') || null;
}
