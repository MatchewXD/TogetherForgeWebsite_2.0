/**
 * Platform Suggestions — minimal site feedback list + submit form.
 * Medium-low visibility (Get Involved + footer only).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Lightbulb,
  Loader2,
  RefreshCw,
  EyeOff,
  Eye,
  CheckCircle2,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Buttons';
import UserAvatar from '../components/ui/UserAvatar';
import UserNameWithBadge from '../components/badges/UserNameWithBadge';
import useIsModerator from '../hooks/useIsModerator';
import platformSuggestionsService from '../services/platformSuggestionsService';
import {
  SUGGESTION_CATEGORIES,
  SUGGESTION_STATUSES,
} from '../constants/platformSuggestions';

const fieldLabel =
  'block text-sm font-mono tracking-widest text-neon-cyan mb-2';
const fieldControl =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors';

function statusVariant(status) {
  switch (status) {
    case 'Open':
      return 'default';
    case 'Under consideration':
      return 'neon';
    case 'Done':
      return 'success';
    case 'Closed':
      return 'default';
    default:
      return 'default';
  }
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

const PlatformSuggestions = () => {
  const { isModerator } = useIsModerator();
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Other');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await platformSuggestionsService.list({
        includeHidden: isModerator,
        limit: 60,
      });
      setItems(rows);
    } catch (err) {
      setError(err.message || 'Failed to load suggestions.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isModerator]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) setUser(session?.user || null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (mounted) setUser(session?.user || null);
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (!user) {
      setSubmitError('Sign in to submit a suggestion.');
      return;
    }
    setSubmitting(true);
    try {
      await platformSuggestionsService.submit({
        title,
        description,
        category,
        userId: user.id,
      });
      setTitle('');
      setDescription('');
      setCategory('Other');
      setSubmitted(true);
      await load();
    } catch (err) {
      setSubmitError(err.message || 'Could not submit.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatus = async (id, status) => {
    if (!isModerator) return;
    setBusyId(id);
    try {
      const updated = await platformSuggestionsService.updateStatus(id, status);
      setItems((prev) => prev.map((x) => (x.id === id ? updated : x)));
      showToast(`Status → ${status}`);
    } catch (err) {
      showToast(err.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleHide = async (id, hide) => {
    if (!isModerator) return;
    setBusyId(id);
    try {
      const updated = await platformSuggestionsService.setHidden(id, hide);
      if (hide && !isModerator) {
        setItems((prev) => prev.filter((x) => x.id !== id));
      } else {
        setItems((prev) => prev.map((x) => (x.id === id ? updated : x)));
      }
      showToast(hide ? 'Hidden from public list' : 'Visible again');
    } catch (err) {
      showToast(err.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg border border-cyber-border bg-cyber-surface text-sm shadow-lg"
        >
          {toast}
        </div>
      )}

      <div className="border-b border-white/10 bg-cyber-surface py-12 md:py-14">
        <div className="container-custom max-w-3xl">
          <div className="section-header !block mb-3">Feedback</div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Platform Suggestions
          </h1>
          <p className="text-text-secondary mt-3 text-sm sm:text-base max-w-xl leading-relaxed">
            Non-game related Ideas for Together Forge. Payments, Task Board,
            Auth, and more.
          </p>
        </div>
      </div>

      <div className="container-custom max-w-3xl py-10 space-y-10">
        {/* Submit */}
        <section aria-labelledby="suggest-heading">
          <h2 id="suggest-heading" className="text-lg font-bold text-white mb-3">
            Submit a suggestion
          </h2>

          {!user ? (
            <Card className="bg-cyber-card/80 p-6 text-center space-y-3">
              <p className="text-sm text-text-secondary">
                Sign in to submit. Your username is credited on the public list.
              </p>
              <Link to="/account">
                <Button size="sm">Log in / Join</Button>
              </Link>
            </Card>
          ) : submitted ? (
            <Card className="bg-cyber-card/80 p-6 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <p className="text-sm text-text-secondary">
                Thanks — your suggestion is on the list as Open.
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setSubmitted(false)}
              >
                Submit another
              </Button>
            </Card>
          ) : (
            <Card className="bg-cyber-card/80 p-5 sm:p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={fieldLabel} htmlFor="sug-title">
                    Title
                  </label>
                  <input
                    id="sug-title"
                    className={fieldControl}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={120}
                    required
                    placeholder="Short title"
                  />
                </div>
                <div>
                  <label className={fieldLabel} htmlFor="sug-desc">
                    Short description
                  </label>
                  <textarea
                    id="sug-desc"
                    className={fieldControl}
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={2000}
                    required
                    placeholder="What should improve, and why?"
                  />
                </div>
                <div>
                  <label className={fieldLabel} htmlFor="sug-cat">
                    Category (optional)
                  </label>
                  <select
                    id="sug-cat"
                    className={fieldControl}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {SUGGESTION_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                {submitError && (
                  <p className="text-sm text-red-300" role="alert">
                    {submitError}
                  </p>
                )}
                <Button type="submit" disabled={submitting} className="gap-2">
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lightbulb className="w-4 h-4" />
                  )}
                  Submit suggestion
                </Button>
              </form>
            </Card>
          )}
        </section>

        {/* List */}
        <section aria-labelledby="list-heading">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 id="list-heading" className="text-lg font-bold text-white">
              Suggestions
            </h2>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="gap-1.5"
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Refresh
            </Button>
          </div>

          {error && (
            <p className="text-sm text-red-300 mb-4" role="alert">
              {error}
            </p>
          )}

          {loading && !items.length ? (
            <div className="flex items-center gap-2 text-text-muted text-sm py-10 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading…
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-text-muted py-6">
              No suggestions yet. Be the first.
            </p>
          ) : (
            <div className="task-scroll max-h-[28rem] sm:max-h-[32rem] overflow-y-auto overscroll-contain rounded-xl border border-cyber-border/80 bg-cyber-bg/30 p-2 sm:p-2.5 space-y-3">
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.id}>
                  <Card
                    className={`bg-cyber-card/80 p-4 sm:p-5 space-y-2 ${
                      item.isHidden ? 'opacity-70 border-amber-400/30' : ''
                    }`}
                  >
                    <div className="flex flex-wrap items-start gap-2 justify-between">
                      <h3 className="text-base font-semibold text-white pr-2">
                        {item.title}
                      </h3>
                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        <Badge variant="default">{item.category}</Badge>
                        <Badge variant={statusVariant(item.status)}>
                          {item.status}
                        </Badge>
                        {item.isHidden && (
                          <Badge variant="warning">Hidden</Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                      {item.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-text-muted font-mono">
                      <UserAvatar
                        src={
                          item.creator?.avatar_url || item.creator?.avatarUrl
                        }
                        name={item.creator?.username || 'Member'}
                        username={item.creator?.username}
                        size="xs"
                      />
                      <span className="inline-flex items-center gap-1 min-w-0">
                        by{' '}
                        <UserNameWithBadge
                          username={item.creator?.username}
                          displayName={item.creator?.username || 'Member'}
                          pinnedBadgeKey={
                            item.creator?.pinnedBadgeKey ||
                            item.creator?.pinned_badge_key ||
                            null
                          }
                          linkClassName="text-neon-cyan hover:underline"
                        />
                      </span>
                      {item.createdAt && (
                        <span className="opacity-70">
                          · {formatDate(item.createdAt)}
                        </span>
                      )}
                    </div>

                    {isModerator && (
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                        <select
                          className="bg-cyber-surface border border-cyber-border rounded-lg px-2 py-1.5 text-xs text-white"
                          value={item.status}
                          disabled={busyId === item.id}
                          onChange={(e) =>
                            void handleStatus(item.id, e.target.value)
                          }
                        >
                          {SUGGESTION_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() =>
                            void handleHide(item.id, !item.isHidden)
                          }
                          className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-white border border-white/15 rounded-lg px-2 py-1.5"
                        >
                          {item.isHidden ? (
                            <>
                              <Eye className="w-3 h-3" /> Unhide
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3" /> Hide
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default PlatformSuggestions;
