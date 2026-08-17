/**
 * Staff picker: attach existing users as permanent credits on an official video.
 */

import { useCallback, useEffect, useState } from 'react';
import { Plus, X, Search, Users } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import UserNameWithBadge from '../badges/UserNameWithBadge';
import Button from '../ui/Buttons';
import {
  listOfficialMediaCredits,
  ensureOfficialMediaCredit,
  hideOfficialMediaCredit,
  searchProfilesForCredit,
} from '../../services/contributorsService';

const fieldClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors';

function toDraftPerson(profile) {
  return {
    id: `draft:${profile.id}`,
    userId: profile.id,
    username: profile.username || null,
    displayName: profile.username || 'Contributor',
    avatarUrl: profile.avatarUrl || null,
    pinnedBadgeKey: profile.pinnedBadgeKey || null,
  };
}

/**
 * @param {{
 *   videoId?: string|null,
 *   videoTitle?: string,
 *   draftPeople?: Array,
 *   onDraftPeopleChange?: (next: Array) => void,
 * }} props
 */
const OfficialMediaContributorsEditor = ({
  videoId = null,
  videoTitle = '',
  draftPeople = [],
  onDraftPeopleChange,
}) => {
  const isDraft = !videoId;
  const [savedCredits, setSavedCredits] = useState([]);
  const [loading, setLoading] = useState(!isDraft);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const credits = isDraft ? draftPeople : savedCredits;

  const load = useCallback(async () => {
    if (!videoId) {
      setSavedCredits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await listOfficialMediaCredits(videoId);
      setSavedCredits(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.warn('[OfficialMediaContributorsEditor] load', err);
      setSavedCredits([]);
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return undefined;
    }

    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      const excludeIds = credits.map((c) => c.userId).filter(Boolean);
      const found = await searchProfilesForCredit(q, { excludeIds });
      if (!cancelled) {
        setResults(found);
        setSearching(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, credits]);

  const handleAdd = async (profile) => {
    if (!profile?.id || busyId) return;
    setBusyId(profile.id);
    setError('');
    try {
      if (isDraft) {
        const already = draftPeople.some((p) => p.userId === profile.id);
        if (!already) {
          onDraftPeopleChange?.([...draftPeople, toDraftPerson(profile)]);
        }
        setQuery('');
        setResults([]);
        return;
      }
      await ensureOfficialMediaCredit({
        videoId,
        videoTitle,
        userId: profile.id,
        username: profile.username,
        displayName: profile.username,
      });
      setQuery('');
      setResults([]);
      await load();
    } catch (err) {
      setError(err?.message || 'Could not add contributor.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (row) => {
    if (!row || busyId) return;
    const name = row.displayName || row.username || 'this person';
    if (isDraft) {
      onDraftPeopleChange?.(
        draftPeople.filter((p) => p.userId !== row.userId && p.id !== row.id)
      );
      return;
    }
    if (
      !window.confirm(
        `Remove public credit for ${name} on this video? You can add them again later.`
      )
    ) {
      return;
    }
    setBusyId(row.id);
    setError('');
    try {
      await hideOfficialMediaCredit(row.id);
      await load();
    } catch (err) {
      setError(err?.message || 'Could not remove contributor.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="pt-4 mt-2 border-t border-cyber-border space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-neon-cyan" aria-hidden />
          Contributors
        </h3>
        <p className="mt-1 text-xs text-text-muted leading-relaxed">
          {isDraft
            ? 'Search existing members now. They are credited when you add the video.'
            : 'Credit existing members who helped make this official video. Names appear on the public media item, All Contributors, and their profile.'}
        </p>
      </div>

      {error && (
        <p className="text-xs text-red-200" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-xs font-mono tracking-widest text-text-muted">
          Loading credits…
        </p>
      ) : credits.length === 0 ? (
        <p className="text-xs text-text-muted">No one credited yet.</p>
      ) : (
        <ul className="space-y-2 list-none p-0 m-0">
          {credits.map((row) => {
            const name = row.displayName || row.username || 'Contributor';
            return (
              <li
                key={row.id}
                className="flex items-center gap-3 rounded-lg border border-cyber-border bg-cyber-surface/50 px-3 py-2"
              >
                <UserAvatar
                  src={row.avatarUrl}
                  name={name}
                  username={row.username}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <UserNameWithBadge
                    username={row.username}
                    displayName={name}
                    pinnedBadgeKey={row.pinnedBadgeKey}
                    linkClassName="text-sm font-semibold text-white"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="gap-1 shrink-0 text-text-muted"
                  disabled={busyId === row.id}
                  onClick={() => handleRemove(row)}
                >
                  <X className="w-3.5 h-3.5" aria-hidden />
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="relative">
        <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2" htmlFor="ov-credit-search">
          Add by username
        </label>
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
            aria-hidden
          />
          <input
            id="ov-credit-search"
            className={`${fieldClass} pl-10`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search an existing username"
            autoComplete="off"
          />
        </div>
        {(searching || results.length > 0 || query.trim().length >= 2) && (
          <ul
            className="mt-2 rounded-lg border border-cyber-border bg-cyber-card overflow-hidden list-none p-0 m-0"
            role="listbox"
          >
            {searching && (
              <li className="px-3 py-2 text-xs text-text-muted">Searching…</li>
            )}
            {!searching && results.length === 0 && (
              <li className="px-3 py-2 text-xs text-text-muted">
                No matching usernames.
              </li>
            )}
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-cyber-surface transition-colors disabled:opacity-50"
                  disabled={busyId === p.id}
                  onClick={() => handleAdd(p)}
                >
                  <UserAvatar
                    src={p.avatarUrl}
                    name={p.username}
                    username={p.username}
                    linkProfile={false}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 text-sm text-white truncate">
                    {p.username}
                  </span>
                  <Plus className="w-3.5 h-3.5 text-neon-cyan shrink-0" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default OfficialMediaContributorsEditor;
