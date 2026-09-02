/**
 * GameIdeas - global Ideas hub (SDD: community idea listing)
 *
 * Features: search, category/tag/status filters, sort (newest / voted / title),
 * fire-vote, UserAvatar cards, server-paged "Load more", empty/loading states, project feed.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Sparkles,
  Lightbulb,
  X,
  ChevronDown,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import {
  ideasService,
  IDEAS_PAGE_SIZE,
  normalizeProjectKeys,
} from '../services/ideasService';
import {
  expandStudioStageKeys,
  ideaLinkMeta,
  isStudioStageKey,
} from '../utils/ideaStatus';
import {
  RELATED_PHASE_OPTIONS,
  loadRelatedProjectOptions,
} from '../utils/relatedToOptions';
import IdeaCard from '../components/ui/IdeaCard';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import Button from '../components/ui/Buttons';
import BannerImage from '../components/ui/BannerImage';
import DiscordLink from '../components/ui/DiscordLink';
import LoadingScreen from '../components/ui/LoadingScreen';
import TagPicker from '../components/ideas/TagPicker';
import {
  parseIdeaListTagParams,
  slugifyTag,
  tagNamesEqual,
  uniqueTagNames,
} from '../utils/ideaTags';
import { listForgeAwardsForTargets } from '../services/forgeMarksService';
import {
  optimisticPublicCount,
  reconcilePublicCount,
} from '../utils/publicCounts';

const CATEGORIES = [
  'Full Game Idea',
  'Game Mechanic',
  'Setting / Story / Lore',
  'Art / Visual Design',
  'Audio / Sound / Music',
  'Multiplayer / Cooperative Systems',
  'Twitch / Streamer Integration',
  'Progression / Economy / Crafting',
  'Enemy / AI / Combat',
  'World Building / Environment',
  'Other',
];

/** Heat / TF-engagement filters. First option is the control label. */
const FILTER_OPTIONS = [
  { value: 'all', label: 'Filters' },
  { value: 'UnderReview', label: 'Under Review' },
  { value: 'Promising', label: 'Promising' },
  { value: 'Hot', label: 'Hot' },
  { value: 'Adopted', label: 'Adopted by Together Forge' },
];

const PAGE_SIZE = IDEAS_PAGE_SIZE;
const IDEAS_BANNER_SRC = '/images/Ideas_Page_Background.webp';

/** Normalize idea/vote ids so Set lookups are stable across number|string */
function voteKey(id) {
  if (id == null || id === '') return null;
  // Always string keys so optimistic UI and DB ids never diverge
  return String(id);
}

// re-export for any tests that import from this module
export { deriveIdeaStatus } from '../utils/ideaStatus';

const controlClass =
  'bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 text-text-primary focus:border-neon-cyan outline-none transition-colors text-sm';

const GameIdeas = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryMenuRef = useRef(null);

  const [allIdeas, setAllIdeas] = useState([]);
  const allIdeasRef = useRef([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const listingRequestRef = useRef(0);
  const [message, setMessage] = useState('');
  /** Idea ids the current user has voted on (string keys via voteKey) */
  const [userVotes, setUserVotes] = useState(() => new Set());
  /** Mirror of userVotes for any sync reads (keeps ref always defined) */
  const userVotesRef = useRef(userVotes);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [votingId, setVotingId] = useState(null);
  /** Idea keys currently toggling (prevent double-click) */
  const togglingRef = useRef(new Set());

  const [searchTerm, setSearchTerm] = useState(
    () => searchParams.get('q') || ''
  );
  const [sortMode, setSortMode] = useState(() => {
    const raw = searchParams.get('sort') || 'newest';
    if (raw === 'discussed') return 'newest';
    if (raw === 'popular') return 'votes';
    return raw;
  });
  const [selectedCategories, setSelectedCategories] = useState([]);
  const selectedTags = useMemo(
    () => parseIdeaListTagParams(searchParams),
    [searchParams]
  );

  const applySelectedTags = useCallback(
    (nextOrUpdater) => {
      const current = parseIdeaListTagParams(searchParams);
      const next =
        typeof nextOrUpdater === 'function'
          ? nextOrUpdater(current)
          : nextOrUpdater;
      const names = uniqueTagNames(next);
      if (tagNamesEqual(current, names)) return;
      const params = new URLSearchParams(searchParams);
      params.delete('tag');
      params.delete('tags');
      for (const name of names) params.append('tag', name);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );
  const [statusFilter, setStatusFilter] = useState(() => {
    const raw = searchParams.get('status') || 'all';
    if (raw === 'Proposed' || raw === 'Archived' || raw === 'Open') return 'all';
    if (raw === 'Linked') return 'all';
    return raw;
  });
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);

  const [feedMode, setFeedMode] = useState(
    () => searchParams.get('feed') || 'community'
  ); // community | together
  const [stageLinks] = useState(() =>
    RELATED_PHASE_OPTIONS.filter((p) => p.id)
  );
  const [projectLinks, setProjectLinks] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);

  const [awardsByIdea, setAwardsByIdea] = useState({});
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);

  useEffect(() => {
    userVotesRef.current = userVotes;
  }, [userVotes]);

  // Prefill project filter from ?project=
  useEffect(() => {
    const p = searchParams.get('project');
    if (p) {
      setFeedMode('together');
    }
  }, [searchParams]);

  /** Load current user's vote set from server (source of truth for orange fire). */
  const loadUserVotes = useCallback(async (userId) => {
    if (!userId) {
      const empty = new Set();
      userVotesRef.current = empty;
      setUserVotes(empty);
      return empty;
    }
    try {
      const ids = await ideasService.getUserVotedIdeaIds(userId);
      const voted = new Set(ids.map((id) => voteKey(id)).filter(Boolean));
      userVotesRef.current = voted;
      setUserVotes(voted);
      return voted;
    } catch (err) {
      console.warn('[GameIdeas] loadUserVotes failed', err);
      const empty = new Set();
      userVotesRef.current = empty;
      setUserVotes(empty);
      return empty;
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  const listingFilters = useMemo(
    () => ({
      search: debouncedSearch,
      sort: sortMode,
      categories: selectedCategories,
      tags: selectedTags,
      statusFilter,
      feedMode,
      projectKeys: selectedProject
        ? isStudioStageKey(selectedProject.slug || selectedProject.id)
          ? expandStudioStageKeys(selectedProject.slug || selectedProject.id)
          : normalizeProjectKeys(
              selectedProject.slug || selectedProject.id || selectedProject.title
            )
        : [],
    }),
    [
      debouncedSearch,
      sortMode,
      selectedCategories,
      selectedTags,
      statusFilter,
      feedMode,
      selectedProject,
    ]
  );

  const loadListing = useCallback(
    async ({ append = false } = {}) => {
      const requestId = listingRequestRef.current + 1;
      listingRequestRef.current = requestId;
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setLoadError(null);
      }
      try {
        const offset = append ? allIdeasRef.current.length : 0;
        const { ideas, total, hasMore: more } =
          await ideasService.getIdeasListingPage({
            limit: PAGE_SIZE,
            offset,
            ...listingFilters,
          });
        if (requestId !== listingRequestRef.current) return;
        const mapped = (ideas || []).map((idea) => ({
          ...idea,
          votes: Math.max(0, Number(idea.votes) || 0),
        }));
        const next = append
          ? [
              ...allIdeasRef.current,
              ...mapped.filter(
                (idea) =>
                  !allIdeasRef.current.some(
                    (row) => voteKey(row.id) === voteKey(idea.id)
                  )
              ),
            ]
          : mapped;
        allIdeasRef.current = next;
        setAllIdeas(next);
        setTotalCount(typeof total === 'number' ? total : next.length);
        setHasMore(Boolean(more));
      } catch (err) {
        if (requestId !== listingRequestRef.current) return;
        console.error('[GameIdeas] load failed', err);
        if (!append) {
          allIdeasRef.current = [];
          setAllIdeas([]);
          setTotalCount(0);
          setHasMore(false);
        }
        setLoadError(err?.message || 'Could not load ideas.');
      } finally {
        if (requestId === listingRequestRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [listingFilters]
  );

  useEffect(() => {
    void loadListing({ append: false });
  }, [loadListing]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let uid = null;
      const { data: sessionData } = await supabase.auth.getSession();
      uid = sessionData?.session?.user?.id || null;
      if (!uid) {
        const { data: userData } = await supabase.auth.getUser();
        uid = userData?.user?.id || null;
      }
      if (cancelled) return;
      setCurrentUserId(uid);
      await loadUserVotes(uid);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadUserVotes]);

  // Refresh liked set on sign-in / sign-out only
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const uid = session?.user?.id || null;
      setCurrentUserId(uid);
      if (event === 'SIGNED_OUT') {
        const empty = new Set();
        userVotesRef.current = empty;
        setUserVotes(empty);
        return;
      }
      // loadListing already hydrates votes on mount; only re-fetch on true sign-in
      if (event === 'SIGNED_IN') {
        await loadUserVotes(uid);
      }
    });
    return () => subscription?.unsubscribe();
  }, [loadUserVotes]);

  // Click-outside + Escape closes Category menu (tag filter uses modal)
  useEffect(() => {
    if (!categoryOpen) return undefined;

    const onPointerDown = (e) => {
      const t = e.target;
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(t)) {
        setCategoryOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setCategoryOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [categoryOpen]);

  // Linked-to options: studio stages + live workspace projects (not phase_games).
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rows = await loadRelatedProjectOptions();
        if (!mounted) return;
        setProjectLinks(rows);
        const qp = searchParams.get('project');
        if (!qp) return;
        const all = [
          ...RELATED_PHASE_OPTIONS.filter((p) => p.id),
          ...rows,
        ];
        const match = all.find(
          (p) =>
            String(p.id) === qp ||
            String(p.id).toLowerCase() === String(qp).toLowerCase()
        );
        if (match) {
          setSelectedProject({
            id: match.id,
            slug: match.id,
            title: match.label,
          });
        } else {
          setSelectedProject({ id: qp, slug: qp, title: qp });
        }
      } catch {
        if (mounted) setProjectLinks([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [searchParams]);

  const visibleIdeas = allIdeas;
  const filteredIdeas = allIdeas;

  const visibleIdeaIds = useMemo(
    () => visibleIdeas.map((i) => String(i.id)).filter(Boolean),
    [visibleIdeas]
  );

  useEffect(() => {
    let mounted = true;
    if (!visibleIdeaIds.length) {
      setAwardsByIdea({});
      return undefined;
    }
    listForgeAwardsForTargets('idea', visibleIdeaIds).then((grouped) => {
      if (mounted) setAwardsByIdea(grouped || {});
    });
    return () => {
      mounted = false;
    };
  }, [visibleIdeaIds]);

  const submitHref = selectedProject
    ? `/ideas/submit?project=${encodeURIComponent(
        selectedProject.slug || selectedProject.id
      )}`
    : '/ideas/submit';

  const hasUserVoted = useCallback(
    (ideaId) => {
      const k = voteKey(ideaId);
      // Prefer state for render; ref stays in sync for any async edge cases
      return k != null && (userVotes.has(k) || userVotesRef.current.has(k));
    },
    [userVotes]
  );

  const resolveProjectMeta = useCallback((idea) => {
    const key =
      idea?.project_id || idea?.projectId || idea?.project_slug || null;
    if (!key) return { name: null, href: null };
    const match = projectLinks.find(
      (p) => String(p.id).toLowerCase() === String(key).toLowerCase()
    );
    return ideaLinkMeta(key, match?.label);
  }, [projectLinks]);

  /**
   * Simple vote toggle:
   * 1) require auth
   * 2) ideasService.toggleVote (insert or delete + recount)
   * 3) apply server { voted, votes } to UI
   */
  const handleVote = async (e, idea) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    const ideaId = idea?.id;
    const key = voteKey(ideaId);
    if (key == null) return;
    if (togglingRef.current.has(key)) {
      console.log('[GameIdeas] vote ignored (in flight)', key);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setMessage('Sign in to vote. Join the forge and back ideas you love.');
      return;
    }

    togglingRef.current.add(key);
    setVotingId(ideaId);
    const wasVoted = userVotesRef.current.has(key);
    const prevCount = Math.max(0, Number(idea.votes) || 0);

    setUserVotes((prev) => {
      const next = new Set(prev);
      if (wasVoted) next.delete(key);
      else next.add(key);
      userVotesRef.current = next;
      return next;
    });
    setAllIdeas((prev) => {
      const next = prev.map((i) =>
        voteKey(i.id) === key
          ? { ...i, votes: optimisticPublicCount(prevCount, !wasVoted) }
          : i
      );
      allIdeasRef.current = next;
      return next;
    });

    try {
      const { voted, votes } = await ideasService.toggleVote(ideaId, user.id);

      setUserVotes((prev) => {
        const next = new Set(prev);
        if (voted) next.add(key);
        else next.delete(key);
        userVotesRef.current = next;
        return next;
      });

      setAllIdeas((prev) => {
        const next = prev.map((i) =>
          voteKey(i.id) === key
            ? { ...i, votes: reconcilePublicCount(prevCount, votes) }
            : i
        );
        allIdeasRef.current = next;
        return next;
      });
    } catch (err) {
      setUserVotes((prev) => {
        const next = new Set(prev);
        if (wasVoted) next.add(key);
        else next.delete(key);
        userVotesRef.current = next;
        return next;
      });
      setAllIdeas((prev) => {
        const next = prev.map((i) =>
          voteKey(i.id) === key ? { ...i, votes: prevCount } : i
        );
        allIdeasRef.current = next;
        return next;
      });
      setMessage(err?.message || 'Could not update vote.');
    } finally {
      togglingRef.current.delete(key);
      setVotingId((cur) => (voteKey(cur) === key ? null : cur));
    }
  };

  const toggleCategory = (cat) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const toggleTag = (tag) => {
    const cleaned = String(tag || '').trim();
    if (!cleaned) return;
    const slug = slugifyTag(cleaned);
    applySelectedTags((prev) => {
      const exists = prev.some((t) => slugifyTag(t) === slug);
      if (exists) {
        return prev.filter((t) => slugifyTag(t) !== slug);
      }
      return [...prev, cleaned];
    });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategories([]);
    setStatusFilter('all');
    setSelectedProject(null);
    setSortMode('newest');
    setCategoryOpen(false);
    setTagPickerOpen(false);
    setSearchParams({});
  };

  const activeFilterCount =
    selectedCategories.length +
    selectedTags.length +
    (statusFilter !== 'all' ? 1 : 0) +
    (selectedProject ? 1 : 0) +
    (searchTerm.trim() ? 1 : 0);

  return (
    <div className="min-h-screen bg-cyber-bg text-text-primary">
      {/* Page header banner */}
      <header className="relative pt-20 overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          <BannerImage
            src={IDEAS_BANNER_SRC}
            className="absolute inset-0 w-full h-full object-cover object-center"
            fetchPriority="high"
          />
          <div className="tf-banner-scrim tf-banner-scrim-center" />
        </div>
        <div className="tf-banner-fade h-28 sm:h-32" aria-hidden="true" />

        <div className="container-custom relative z-10 py-10 md:py-14">
          <div className="text-center max-w-3xl mx-auto [text-shadow:0_1px_2px_rgb(0_0_0_/_0.9),0_2px_16px_rgb(0_0_0_/_0.55)]">
            <div className="section-header justify-center">Game Ideas</div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mt-2">
              {feedMode === 'community'
                ? 'Community idea forge'
                : 'Linked ideas'}
            </h1>
            <p className="text-white/85 mt-4 text-base sm:text-lg leading-relaxed">
              {feedMode === 'community'
                ? 'Browse every community pitch. Vote, discuss, and spark the next build. Project leads can adopt ideas into workspaces.'
                : 'Ideas linked to Early, Mid, or Late Game, or to a live project like Tether.'}
            </p>
            <p className="mt-3 text-sm text-white/70">
              Want to talk through a pitch live?{' '}
              <DiscordLink
                variant="link"
                labelKey="join"
                className="text-neon-cyan hover:text-white"
              />
            </p>

            {/* Feed toggle + CTA */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <div className="inline-flex items-center bg-cyber-surface/95 border border-cyber-border rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => {
                    setFeedMode('community');
                    setSelectedProject(null);
                  }}
                  className={`px-4 py-2 text-sm rounded-md transition-colors ${
                    feedMode === 'community'
                      ? 'bg-neon-cyan text-cyber-bg font-medium'
                      : 'text-text-secondary hover:text-white'
                  }`}
                >
                  Community
                </button>
                <button
                  type="button"
                  onClick={() => setFeedMode('together')}
                  className={`px-4 py-2 text-sm rounded-md transition-colors ${
                    feedMode === 'together'
                      ? 'bg-neon-cyan text-cyber-bg font-medium'
                      : 'text-text-secondary hover:text-white'
                  }`}
                >
                  Together Forge
                </button>
              </div>

              <Link
                to={submitHref}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-neon-cyan text-cyber-bg font-medium border border-neon-cyan shadow-neon-cyan hover:bg-cyan-400 transition-colors w-full sm:w-auto"
              >
                <Sparkles className="w-5 h-5" />
                Submit an Idea
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container-custom relative z-10 py-8 md:py-10">
        {message && (
          <div
            role="status"
            className="max-w-3xl mx-auto mb-6 rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 px-4 py-3 text-sm text-text-secondary flex items-center justify-between gap-3"
          >
            <span>{message}</span>
            <button
              type="button"
              className="text-neon-cyan text-xs font-mono shrink-0"
              onClick={() => {
                setMessage('');
                navigate('/profile');
              }}
            >
              Sign in →
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="max-w-3xl mx-auto mb-6 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
              <input
                type="search"
                placeholder="Search title, summary, tags, creator…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`${controlClass} w-full pl-10`}
                aria-label="Search ideas"
              />
            </div>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value)}
              className={controlClass}
              aria-label="Sort ideas"
            >
              <option value="newest">Newest</option>
              <option value="votes">Most Voted</option>
              <option value="title">Title A–Z</option>
            </select>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-row sm:flex-wrap gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`${controlClass} w-full min-w-0 sm:w-auto`}
              aria-label="Filters"
            >
              {FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              value={
                selectedProject
                  ? String(selectedProject.slug || selectedProject.id || '')
                  : ''
              }
              onChange={(e) => {
                const val = e.target.value;
                if (!val) {
                  setSelectedProject(null);
                  return;
                }
                setFeedMode('together');
                const match = [...stageLinks, ...projectLinks].find(
                  (p) => String(p.id) === val
                );
                setSelectedProject(
                  match
                    ? { id: match.id, slug: match.id, title: match.label }
                    : { id: val, slug: val, title: val }
                );
              }}
              className={`${controlClass} w-full min-w-0 sm:w-auto`}
              id="ideas-project-filter"
              aria-label="Linked ideas"
            >
              <option value="">Linked ideas</option>
              {stageLinks.length > 0 && (
                <optgroup label="Stages">
                  {stageLinks.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </optgroup>
              )}
              {projectLinks.length > 0 && (
                <optgroup label="Projects">
                  {projectLinks.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            {/* Category multi-select */}
            <div className="relative min-w-0" ref={categoryMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setCategoryOpen((o) => !o);
                  setTagPickerOpen(false);
                }}
                className={`${controlClass} inline-flex items-center justify-between gap-2 w-full sm:w-auto`}
                aria-expanded={categoryOpen}
                aria-haspopup="listbox"
              >
                Category
                {selectedCategories.length > 0 && (
                  <span className="text-xs bg-neon-cyan text-cyber-bg px-2 py-0.5 rounded-full font-mono">
                    {selectedCategories.length}
                  </span>
                )}
                <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
              </button>
              {categoryOpen && (
                <div className="absolute mt-2 w-72 max-w-[calc(100vw-2rem)] bg-cyber-surface border border-cyber-border rounded-lg p-4 z-50 shadow-lg">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm text-text-muted">Categories</span>
                    <button
                      type="button"
                      onClick={() => setSelectedCategories([])}
                      className="text-xs text-neon-cyan hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="task-scroll max-h-56 overflow-auto space-y-1">
                    {CATEGORIES.map((cat) => (
                      <label
                        key={cat}
                        className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white/5 p-1.5 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(cat)}
                          onChange={() => toggleCategory(cat)}
                          className="accent-cyan-400"
                        />
                        <span className="text-text-secondary">{cat}</span>
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="mt-3 text-xs text-neon-cyan hover:underline"
                    onClick={() => setCategoryOpen(false)}
                  >
                    Done
                  </button>
                </div>
              )}
            </div>

            {/* Tags — same hybrid picker as create/edit */}
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => {
                  setTagPickerOpen(true);
                  setCategoryOpen(false);
                }}
                className={`${controlClass} inline-flex items-center justify-between gap-2 w-full sm:w-auto`}
                aria-haspopup="dialog"
              >
                Tags
                {selectedTags.length > 0 && (
                  <span className="text-xs bg-neon-cyan text-cyber-bg px-2 py-0.5 rounded-full font-mono">
                    {selectedTags.length}
                  </span>
                )}
                <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
              </button>
              <TagPicker
                isOpen={tagPickerOpen}
                onClose={() => setTagPickerOpen(false)}
                selected={selectedTags}
                onChange={applySelectedTags}
                mode="filter"
                ideasFallback={allIdeas}
                allowSuggest={false}
              />
            </div>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-neon-cyan transition-colors px-2 col-span-2 sm:col-auto self-center"
              >
                <X className="w-4 h-4" />
                Clear filters
              </button>
            )}
          </div>

          {/* Active filter chips */}
          {(selectedCategories.length > 0 || selectedTags.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {selectedCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className="inline-flex items-center gap-1 text-xs font-mono rounded-full border border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan px-2.5 py-1"
                >
                  {cat}
                  <X className="w-3 h-3" />
                </button>
              ))}
              {selectedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="inline-flex items-center gap-1 text-xs font-mono rounded-full border border-neon-purple/40 bg-neon-purple/10 text-neon-purple px-2.5 py-1"
                >
                  #{tag}
                  <X className="w-3 h-3" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Project picker (Together Forge feed) */}
        {feedMode === 'together' && (
          <div id="ideas-project-picker" className="max-w-3xl mx-auto mb-8">
            <div className="text-xs font-mono tracking-widest text-text-muted uppercase mb-2">
              Filter by link
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedProject(null)}
                className={`shrink-0 px-3 py-2 rounded-lg text-sm border transition-colors ${
                  !selectedProject
                    ? 'bg-neon-cyan text-cyber-bg border-neon-cyan'
                    : 'bg-cyber-surface text-text-secondary border-cyber-border hover:border-neon-cyan/50'
                }`}
              >
                All linked
              </button>
              {[...stageLinks, ...projectLinks].map((p) => (
                <button
                  key={String(p.id)}
                  type="button"
                  onClick={() =>
                    setSelectedProject({
                      id: p.id,
                      slug: p.id,
                      title: p.label,
                    })
                  }
                  className={`shrink-0 px-3 py-2 rounded-lg text-sm border transition-colors ${
                    selectedProject &&
                    String(selectedProject.id) === String(p.id)
                      ? 'bg-neon-cyan text-cyber-bg border-neon-cyan'
                      : 'bg-cyber-surface text-text-secondary border-cyber-border hover:border-neon-cyan/50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Result meta */}
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-2 mb-4">
          <p className="text-xs font-mono text-text-muted tracking-widest uppercase">
            {loading
              ? 'Loading…'
              : `${totalCount} idea${totalCount === 1 ? '' : 's'}`}
          </p>
          <Badge variant="neon">
            {feedMode === 'community' ? 'Community feed' : 'Linked feed'}
          </Badge>
        </div>

        {loadError && (
          <div
            role="alert"
            className="max-w-3xl mx-auto mb-6 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-100/90"
          >
            {loadError}
            <button
              type="button"
              className="ml-3 text-neon-cyan hover:underline"
              onClick={() => void loadListing({ append: false })}
            >
              Retry
            </button>
          </div>
        )}

        {/* Listing - card grid (IdeaCard mirrors ProjectCard cyber styling) */}
        <div className="max-w-5xl mx-auto">
          {loading ? (
            <LoadingScreen
              variant="section"
              message="Loading the forge…"
            />
          ) : filteredIdeas.length === 0 ? (
            <Card className="bg-cyber-card/80 border-neon-cyan/20 text-center py-12 px-6 max-w-3xl mx-auto">
              <Lightbulb className="w-10 h-10 text-neon-cyan mx-auto mb-4 opacity-80" />
              <h2 className="text-xl font-semibold text-white mb-2">
                {activeFilterCount > 0 || feedMode === 'together'
                  ? 'No ideas match your filters'
                  : 'No ideas yet - spark the first one'}
              </h2>
              <p className="text-sm text-text-secondary mb-6 max-w-md mx-auto">
                {activeFilterCount > 0 || feedMode === 'together'
                  ? 'Try clearing filters or switching feeds. Your next favorite pitch might be one toggle away.'
                  : 'Share a mechanic, a setting, or a full game vision. The community votes and Project Leads adopt what ships next.'}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                {(activeFilterCount > 0 || feedMode === 'together') && (
                  <Button variant="secondary" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
                <Link
                  to={submitHref}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-neon-cyan text-cyber-bg font-medium border border-neon-cyan"
                >
                  <Plus className="w-4 h-4" />
                  Submit an Idea
                </Link>
              </div>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {visibleIdeas.map((idea) => {
                const voted = hasUserVoted(idea.id);
                const busy =
                  votingId != null && voteKey(votingId) === voteKey(idea.id);
                const projectMeta = resolveProjectMeta(idea);

                return (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    voted={voted}
                    isOwn={false}
                    voting={busy}
                    onVote={handleVote}
                    onOpen={(id) => navigate(`/ideas/${id}`)}
                    projectName={projectMeta.name}
                    projectHref={projectMeta.href}
                    commentCount={idea.commentCount || 0}
                    showTags
                    className="h-full"
                    awards={awardsByIdea[String(idea.id)] || []}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && hasMore && (
          <div className="max-w-3xl mx-auto mt-8 flex justify-center">
            <Button
              variant="secondary"
              disabled={loadingMore}
              onClick={() => void loadListing({ append: true })}
            >
              {loadingMore ? 'Loading…' : 'Load more ideas'}
            </Button>
          </div>
        )}

        {/* Bottom CTA */}
        {!loading && allIdeas.length > 0 && (
          <div className="max-w-3xl mx-auto mt-12 mb-4">
            <Card className="bg-cyber-card/80 border-neon-cyan/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Got a spark for the forge?
                </h3>
                <p className="text-sm text-text-secondary mt-1">
                  Share a mechanic, a story, or a full game vision with the
                  community.
                </p>
              </div>
              <Link
                to={submitHref}
                className="inline-flex items-center justify-center gap-2 shrink-0 px-5 py-2.5 rounded-lg bg-neon-cyan text-cyber-bg font-medium border border-neon-cyan shadow-neon-cyan hover:bg-cyan-400 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Submit an Idea
              </Link>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameIdeas;
