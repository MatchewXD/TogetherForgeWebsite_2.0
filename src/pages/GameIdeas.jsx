/**
 * GameIdeas — global Ideas hub (SDD: community idea listing)
 *
 * Features: search, category/tag/status filters, sort (newest / voted / discussed),
 * fire-vote, UserAvatar cards, pagination, empty/loading states, project feed.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Loader2,
  Search,
  Sparkles,
  Lightbulb,
  X,
  ChevronDown,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import { ideasService, ideaMatchesProject } from '../services/ideasService';
import { deriveIdeaStatus, parseTags } from '../utils/ideaStatus';
import IdeaCard from '../components/ui/IdeaCard';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import Button from '../components/ui/Buttons';

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

/** Status filter options — values must match deriveIdeaStatus() */
const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'Proposed', label: 'Proposed — new / under 5 votes' },
  { value: 'UnderReview', label: 'Under Review' },
  { value: 'Promising', label: 'Promising — 5–14 votes' },
  { value: 'Hot', label: 'Hot — 15+ votes' },
  { value: 'Linked', label: 'Linked to project' },
  { value: 'Adopted', label: 'Adopted' },
  { value: 'Archived', label: 'Archived' },
];

const PAGE_SIZE = 12;

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
  const tagMenuRef = useRef(null);

  const [allIdeas, setAllIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
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
  const [sortMode, setSortMode] = useState(
    () => searchParams.get('sort') || 'newest'
  );
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagDraft, setTagDraft] = useState('');
  const [statusFilter, setStatusFilter] = useState(
    () => searchParams.get('status') || 'all'
  );
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);

  const [feedMode, setFeedMode] = useState(
    () => searchParams.get('feed') || 'community'
  ); // community | together
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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
      console.log('[GameIdeas] loaded user votes', { userId, count: voted.size });
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

  const loadListing = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { ideas } = await ideasService.getIdeasListing();
      setAllIdeas(
        (ideas || []).map((idea) => ({
          ...idea,
          votes: Math.max(0, Number(idea.votes) || 0),
        }))
      );

      let uid = null;
      const { data: sessionData } = await supabase.auth.getSession();
      uid = sessionData?.session?.user?.id || null;
      if (!uid) {
        const { data: userData } = await supabase.auth.getUser();
        uid = userData?.user?.id || null;
      }
      setCurrentUserId(uid);
      await loadUserVotes(uid);
    } catch (err) {
      console.error('[GameIdeas] load failed', err);
      setAllIdeas([]);
      setLoadError(err?.message || 'Could not load ideas.');
    } finally {
      setLoading(false);
    }
  }, [loadUserVotes]);

  useEffect(() => {
    loadListing();
  }, [loadListing]);

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
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        await loadUserVotes(uid);
      }
    });
    return () => subscription?.unsubscribe();
  }, [loadUserVotes]);

  // Click-outside + Escape closes Category / Tags menus (native <select> already auto-closes)
  useEffect(() => {
    if (!categoryOpen && !tagOpen) return undefined;

    const onPointerDown = (e) => {
      const t = e.target;
      if (categoryOpen && categoryMenuRef.current && !categoryMenuRef.current.contains(t)) {
        setCategoryOpen(false);
      }
      if (tagOpen && tagMenuRef.current && !tagMenuRef.current.contains(t)) {
        setTagOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setCategoryOpen(false);
        setTagOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [categoryOpen, tagOpen]);

  // Projects for Together Forge feed (workspace projects + phase_games)
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const results = [];
        const { data: workspace } = await supabase
          .from('projects')
          .select('id, slug, title, phase, status')
          .order('created_at', { ascending: false });
        if (workspace?.length) {
          results.push(
            ...workspace.map((p) => ({
              id: p.slug || p.id,
              slug: p.slug,
              title: p.title,
              phase: p.phase,
              source: 'workspace',
            }))
          );
        }
        const { data: phase } = await supabase.from('phase_games').select('*');
        if (phase?.length) {
          for (const p of phase) {
            const id = p.id || p.slug || p.title;
            if (!results.some((r) => String(r.id) === String(id))) {
              results.push({
                id,
                slug: p.slug || p.id,
                title: p.title || p.name || String(id),
                phase: p.phase,
                source: 'phase',
              });
            }
          }
        }
        setProjects(results);

        const qp = searchParams.get('project');
        if (qp && results.length) {
          const match = results.find(
            (p) =>
              String(p.id) === qp ||
              String(p.slug) === qp ||
              String(p.title).toLowerCase() === qp.toLowerCase()
          );
          if (match) setSelectedProject(match);
          else setSelectedProject({ id: qp, slug: qp, title: qp });
        }
      } catch {
        setProjects([]);
      }
    };
    fetchProjects();
  }, [searchParams]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [
    searchTerm,
    sortMode,
    selectedCategories,
    selectedTags,
    statusFilter,
    feedMode,
    selectedProject,
  ]);

  const availableTags = useMemo(() => {
    const set = new Set();
    for (const idea of allIdeas) {
      parseTags(idea.tags).forEach((t) => set.add(t));
    }
    // Include any user-selected tags even if no longer present
    selectedTags.forEach((t) => set.add(t));
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [allIdeas, selectedTags]);

  const filteredIdeas = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const now = Date.now();
    const DECAY = 0.0000001;
    const selectedTagLower = selectedTags.map((t) => t.toLowerCase());

    const popularity = (idea) => {
      const votes = idea.votes || 0;
      const last = idea.last_vote_time || idea.created_at
        ? new Date(idea.last_vote_time || idea.created_at).getTime()
        : now;
      return votes * Math.exp(-DECAY * Math.max(0, now - last));
    };

    let list = allIdeas.filter((idea) => {
      const title = (idea.title || '').toLowerCase();
      const summary = (idea.summary || '').toLowerCase();
      const tags = parseTags(idea.tags);
      const tagsLower = tags.map((t) => t.toLowerCase());
      const status = deriveIdeaStatus(idea);

      const matchesSearch =
        !q ||
        title.includes(q) ||
        summary.includes(q) ||
        tagsLower.some((t) => t.includes(q)) ||
        (idea.creator?.username || '').toLowerCase().includes(q);

      const matchesCategory =
        selectedCategories.length === 0 ||
        selectedCategories.includes(idea.category);

      // Multi-select tags: match if idea has ANY selected tag (OR)
      const matchesTags =
        selectedTagLower.length === 0 ||
        selectedTagLower.some((t) => tagsLower.includes(t));

      // Exact status key: Proposed | UnderReview | Promising | Hot | Linked | Adopted | Archived
      // "Open" kept as alias for Proposed for old query strings
      const matchesStatus =
        statusFilter === 'all' ||
        status === statusFilter ||
        (statusFilter === 'Open' && status === 'Proposed');

      return matchesSearch && matchesCategory && matchesTags && matchesStatus;
    });

    // Feed: community = all (or unlinked-only optional); together = project-linked
    if (feedMode === 'together') {
      if (selectedProject) {
        const keys = [
          selectedProject.id,
          selectedProject.slug,
          selectedProject.title,
        ].filter(Boolean);
        list = list.filter((i) => ideaMatchesProject(i, keys));
      } else {
        // All ideas that have any project link
        list = list.filter(
          (i) => i.project_id || i.projectId || i.project_slug
        );
      }
    }

    list = [...list].sort((a, b) => {
      if (sortMode === 'votes') return (b.votes || 0) - (a.votes || 0);
      if (sortMode === 'discussed') {
        return (b.commentCount || 0) - (a.commentCount || 0);
      }
      if (sortMode === 'popular') return popularity(b) - popularity(a);
      if (sortMode === 'title') {
        return (a.title || '').localeCompare(b.title || '');
      }
      // newest (default)
      return (
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
      );
    });

    return list;
  }, [
    allIdeas,
    searchTerm,
    selectedCategories,
    selectedTags,
    statusFilter,
    sortMode,
    feedMode,
    selectedProject,
  ]);

  const visibleIdeas = useMemo(
    () => filteredIdeas.slice(0, visibleCount),
    [filteredIdeas, visibleCount]
  );
  const hasMore = visibleCount < filteredIdeas.length;

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

  /** Map project_id → display name / slug from loaded project list */
  const resolveProjectMeta = useCallback(
    (idea) => {
      const key =
        idea?.project_id || idea?.projectId || idea?.project_slug || null;
      if (!key) return { name: null, slug: null };
      const match = projects.find(
        (p) =>
          String(p.id) === String(key) ||
          String(p.slug) === String(key) ||
          String(p.title || '').toLowerCase() === String(key).toLowerCase()
      );
      return {
        name: match?.title || String(key),
        slug: match?.slug || match?.id || String(key),
      };
    },
    [projects]
  );

  const handleProjectChipClick = useCallback(
    ({ slug, name, key }) => {
      // Filter global list to this project (Together Forge feed)
      setFeedMode('together');
      const match = projects.find(
        (p) =>
          String(p.id) === String(slug || key) ||
          String(p.slug) === String(slug || key)
      );
      setSelectedProject(
        match || {
          id: slug || key,
          slug: slug || key,
          title: name || slug || key,
        }
      );
      // Soft-scroll to project chips
      window.setTimeout(() => {
        document
          .getElementById('ideas-project-picker')
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    },
    [projects]
  );

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
    console.log('[GameIdeas] vote click', {
      ideaId,
      beforeVoted: userVotesRef.current.has(key),
      beforeCount: idea.votes,
    });

    try {
      const { voted, votes } = await ideasService.toggleVote(ideaId, user.id);
      console.log('[GameIdeas] vote server result', { ideaId, voted, votes });

      setUserVotes((prev) => {
        const next = new Set(prev);
        if (voted) next.add(key);
        else next.delete(key);
        userVotesRef.current = next;
        return next;
      });

      setAllIdeas((prev) =>
        prev.map((i) =>
          voteKey(i.id) === key
            ? { ...i, votes: Math.max(0, Number(votes) || 0) }
            : i
        )
      );
    } catch (err) {
      console.error('[GameIdeas] vote failed', err);
      setMessage(err?.message || 'Could not update vote.');
      await loadUserVotes(user.id);
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
    setSelectedTags((prev) => {
      const exists = prev.some(
        (t) => t.toLowerCase() === cleaned.toLowerCase()
      );
      if (exists) {
        return prev.filter((t) => t.toLowerCase() !== cleaned.toLowerCase());
      }
      return [...prev, cleaned];
    });
  };

  const addTagFromDraft = () => {
    const cleaned = tagDraft.trim().replace(/^#/, '');
    if (!cleaned) return;
    toggleTag(cleaned);
    setTagDraft('');
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategories([]);
    setSelectedTags([]);
    setTagDraft('');
    setStatusFilter('all');
    setSortMode('newest');
    setCategoryOpen(false);
    setTagOpen(false);
    setSearchParams({});
  };

  const activeFilterCount =
    selectedCategories.length +
    selectedTags.length +
    (statusFilter !== 'all' ? 1 : 0) +
    (searchTerm.trim() ? 1 : 0);

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,249,255,0.05)_0%,transparent_50%)]"
        aria-hidden="true"
      />

      <div className="container-custom relative z-10 py-10 md:py-14">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group transition-colors"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />
          BACK TO HOME
        </Link>

        {/* Header */}
        <header className="mb-10 md:mb-12 text-center max-w-3xl mx-auto">
          <div className="section-header justify-center">Game Ideas</div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mt-2">
            {feedMode === 'community'
              ? 'Community idea forge'
              : 'Project-linked ideas'}
          </h1>
          <p className="text-text-secondary mt-4 text-base sm:text-lg leading-relaxed">
            {feedMode === 'community'
              ? 'Browse every community pitch — vote, discuss, and spark the next build. Project leads can adopt ideas into workspaces.'
              : 'Ideas tied to Together Forge projects. Pick a project or browse everything already linked.'}
          </p>

          {/* Feed toggle + CTA */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <div className="inline-flex items-center bg-cyber-surface border border-cyber-border rounded-lg p-1">
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
        </header>

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
              <option value="discussed">Most Discussed</option>
              <option value="popular">Most Popular</option>
              <option value="title">Title A–Z</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={controlClass}
              aria-label="Filter by status"
              title="Proposed/Promising/Hot are vote-based heat; Under Review / Adopted / Archived are workflow; Linked has project_id"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Category multi-select */}
            <div className="relative" ref={categoryMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setCategoryOpen((o) => !o);
                  setTagOpen(false);
                }}
                className={`${controlClass} inline-flex items-center gap-2 w-full sm:w-auto`}
                aria-expanded={categoryOpen}
                aria-haspopup="listbox"
              >
                Category
                {selectedCategories.length > 0 && (
                  <span className="text-xs bg-neon-cyan text-cyber-bg px-2 py-0.5 rounded-full font-mono">
                    {selectedCategories.length}
                  </span>
                )}
                <ChevronDown className="w-4 h-4 text-text-muted" />
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
                  <div className="max-h-56 overflow-auto space-y-1">
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

            {/* Tags multi-select + freeform entry */}
            <div className="relative" ref={tagMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setTagOpen((o) => !o);
                  setCategoryOpen(false);
                }}
                className={`${controlClass} inline-flex items-center gap-2 w-full sm:w-auto`}
                aria-expanded={tagOpen}
                aria-haspopup="listbox"
              >
                Tags
                {selectedTags.length > 0 && (
                  <span className="text-xs bg-neon-cyan text-cyber-bg px-2 py-0.5 rounded-full font-mono">
                    {selectedTags.length}
                  </span>
                )}
                <ChevronDown className="w-4 h-4 text-text-muted" />
              </button>
              {tagOpen && (
                <div className="absolute mt-2 w-80 max-w-[calc(100vw-2rem)] bg-cyber-surface border border-cyber-border rounded-lg p-4 z-50 shadow-lg">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm text-text-muted">
                      Filter by tags (any match)
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedTags([])}
                      className="text-xs text-neon-cyan hover:underline"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTagFromDraft();
                        }
                      }}
                      placeholder="Type a tag + Enter"
                      className={`${controlClass} flex-1 !py-2`}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={addTagFromDraft}
                    >
                      Add
                    </Button>
                  </div>

                  {availableTags.length === 0 ? (
                    <p className="text-xs text-text-muted mb-2">
                      No tags on ideas yet. Type a tag above to filter, or add
                      tags when submitting ideas.
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-auto space-y-1">
                      {availableTags.map((tag) => {
                        const checked = selectedTags.some(
                          (t) => t.toLowerCase() === tag.toLowerCase()
                        );
                        return (
                          <label
                            key={tag}
                            className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white/5 p-1.5 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleTag(tag)}
                              className="accent-cyan-400"
                            />
                            <span className="text-text-secondary">#{tag}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    className="mt-3 text-xs text-neon-cyan hover:underline"
                    onClick={() => setTagOpen(false)}
                  >
                    Done
                  </button>
                </div>
              )}
            </div>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-neon-cyan transition-colors px-2"
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
              Filter by project
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
              {projects.length === 0 ? (
                <span className="text-sm text-text-muted py-2">
                  No projects loaded yet.
                </span>
              ) : (
                projects.map((p) => (
                  <button
                    key={String(p.id)}
                    type="button"
                    onClick={() => setSelectedProject(p)}
                    className={`shrink-0 px-3 py-2 rounded-lg text-sm border transition-colors ${
                      selectedProject &&
                      String(selectedProject.id) === String(p.id)
                        ? 'bg-neon-cyan text-cyber-bg border-neon-cyan'
                        : 'bg-cyber-surface text-text-secondary border-cyber-border hover:border-neon-cyan/50'
                    }`}
                  >
                    {p.title || p.slug || p.id}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Result meta */}
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-2 mb-4">
          <p className="text-xs font-mono text-text-muted tracking-widest uppercase">
            {loading
              ? 'Loading…'
              : `${filteredIdeas.length} idea${
                  filteredIdeas.length === 1 ? '' : 's'
                }`}
          </p>
          <Badge variant="neon">
            {feedMode === 'community' ? 'Community feed' : 'Project feed'}
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
              onClick={loadListing}
            >
              Retry
            </button>
          </div>
        )}

        {/* Listing — card grid (IdeaCard mirrors ProjectCard cyber styling) */}
        <div className="max-w-5xl mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-text-secondary">
              <Loader2 className="w-8 h-8 animate-spin text-neon-cyan" />
              <p className="text-sm font-mono tracking-widest">
                Loading the forge…
              </p>
            </div>
          ) : filteredIdeas.length === 0 ? (
            <Card className="bg-cyber-card/80 border-neon-cyan/20 text-center py-12 px-6 max-w-3xl mx-auto">
              <Lightbulb className="w-10 h-10 text-neon-cyan mx-auto mb-4 opacity-80" />
              <h2 className="text-xl font-semibold text-white mb-2">
                {allIdeas.length === 0
                  ? 'No ideas yet — spark the first one'
                  : 'No ideas match your filters'}
              </h2>
              <p className="text-sm text-text-secondary mb-6 max-w-md mx-auto">
                {allIdeas.length === 0
                  ? 'Share a mechanic, a setting, or a full game vision. The community votes and Project Leads adopt what ships next.'
                  : 'Try clearing filters or switching feeds. Your next favorite pitch might be one toggle away.'}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                {allIdeas.length > 0 && (
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
                    projectSlug={projectMeta.slug}
                    onProjectClick={handleProjectChipClick}
                    commentCount={idea.commentCount || 0}
                    showTags
                    className="h-full"
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
              onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
            >
              Load more ideas
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
