/**
 * Open Questions hub — full page like Ideas.
 * Search, sort, status, and project filters for staff questions and community answers.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageCircleQuestion, Plus, Search, X } from 'lucide-react';

import { supabase } from '../lib/supabase';
import {
  QUESTION_SORTS,
  QUESTION_STATUS_FILTERS,
  filterQuestions,
  openQuestionsService,
  questionPath,
  sortQuestions,
} from '../services/openQuestionsService';
import { useStaffRole } from '../hooks/useStaffRole';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Buttons';
import Card from '../components/ui/Card';
import LoadingScreen from '../components/ui/LoadingScreen';
import AskQuestionModal from '../components/questions/AskQuestionModal';
import QuestionCard from '../components/questions/QuestionCard';
import { controlClass } from '../components/questions/questionStyles';

export default function OpenQuestions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isStaff } = useStaffRole();

  const [user, setUser] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState(
    () => searchParams.get('q') || ''
  );
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);

  const sortMode = searchParams.get('sort') || 'newest';
  const statusFilter = searchParams.get('status') || 'all';
  const projectKey = searchParams.get('project') || '';

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    const q = searchParams.get('q') || '';
    setSearchTerm((prev) => (prev === q ? prev : q));
  }, [searchParams]);

  const patchParams = useCallback(
    (patch) => {
      const params = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        const empty =
          !value ||
          (key === 'sort' && value === 'newest') ||
          (key === 'status' && value === 'all');
        if (empty) params.delete(key);
        else params.set(key, value);
      });
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    const current = searchParams.get('q') || '';
    if (debouncedSearch === current) return;
    patchParams({ q: debouncedSearch.trim() });
  }, [debouncedSearch, searchParams, patchParams]);

  const showToast = (message, kind = 'info') => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 5000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rows, projectRows, auth] = await Promise.all([
        openQuestionsService.listAll({ viewerUserId: user?.id || null }),
        openQuestionsService.listProjects(),
        user
          ? Promise.resolve({ data: { user } })
          : supabase.auth.getUser(),
      ]);
      setQuestions(rows);
      setProjects(projectRows);
      if (!user && auth?.data?.user) setUser(auth.data.user);
    } catch (err) {
      setError(err?.message || 'Could not load open questions.');
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUser(data?.user || null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUser(session?.user || null);
    });
    return () => {
      mounted = false;
      data?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedProject = useMemo(() => {
    if (!projectKey) return null;
    const key = projectKey.toLowerCase();
    return (
      projects.find(
        (p) =>
          String(p.slug).toLowerCase() === key ||
          String(p.id).toLowerCase() === key
      ) || null
    );
  }, [projects, projectKey]);

  const visible = useMemo(() => {
    const filtered = filterQuestions(questions, {
      search: debouncedSearch,
      status: statusFilter,
      projectKey,
    });
    return sortQuestions(filtered, sortMode);
  }, [questions, debouncedSearch, statusFilter, projectKey, sortMode]);

  const activeFilterCount =
    (debouncedSearch.trim() ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    (projectKey ? 1 : 0) +
    (sortMode !== 'newest' ? 1 : 0);

  const clearFilters = () => {
    setSearchTerm('');
    setSearchParams({}, { replace: true });
  };

  const saveQuestion = async ({ title, prompt, projectId }) => {
    if (!isStaff || !user?.id) return;
    setBusy(true);
    try {
      const created = await openQuestionsService.createQuestion(
        projectId,
        { title, prompt },
        user.id
      );
      showToast('Question posted to the community.', 'success');
      setFormOpen(false);
      await load();
      return created;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-cyber-bg text-text-primary">
      <header className="relative pt-20 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,249,255,0.08)_0%,transparent_55%)]"
          aria-hidden="true"
        />
        <div className="container-custom relative z-10 py-10 md:py-14">
          <div className="text-center max-w-3xl mx-auto">
            <div className="section-header justify-center">Open Questions</div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mt-2">
              Community decisions
            </h1>
            <p className="text-white/85 mt-4 text-base sm:text-lg leading-relaxed">
              Staff ask a focused question when a project needs a call. The
              community posts answers, votes them up, and discusses the full
              idea, the same way you would on Ideas.
            </p>
            {isStaff ? (
              <div className="mt-8 flex justify-center">
                <Button className="gap-2" onClick={() => setFormOpen(true)}>
                  <Plus className="w-4 h-4" />
                  Ask a question
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="container-custom relative z-10 py-8 md:py-10">
        {toast ? (
          <p
            className={`text-sm mb-4 ${
              toast.kind === 'error'
                ? 'text-semantic-danger'
                : toast.kind === 'success'
                  ? 'text-semantic-success'
                  : 'text-text-secondary'
            }`}
          >
            {toast.message}
          </p>
        ) : null}

        <div className="max-w-3xl mx-auto mb-6 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
              <input
                type="search"
                placeholder="Search questions, answers, project…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`${controlClass} w-full pl-10`}
                aria-label="Search open questions"
              />
            </div>
            <select
              value={QUESTION_SORTS.some((s) => s.value === sortMode) ? sortMode : 'newest'}
              onChange={(e) => patchParams({ sort: e.target.value })}
              className={controlClass}
              aria-label="Sort questions"
            >
              {QUESTION_SORTS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-row sm:flex-wrap gap-3">
            <select
              value={
                QUESTION_STATUS_FILTERS.some((s) => s.value === statusFilter)
                  ? statusFilter
                  : 'all'
              }
              onChange={(e) => patchParams({ status: e.target.value })}
              className={`${controlClass} w-full min-w-0 sm:w-auto`}
              aria-label="Filter by status"
            >
              {QUESTION_STATUS_FILTERS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              value={projectKey}
              onChange={(e) => patchParams({ project: e.target.value })}
              className={`${controlClass} w-full min-w-0 sm:w-auto`}
              aria-label="Filter by project"
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.slug || p.id}>
                  {p.title}
                </option>
              ))}
            </select>

            {activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-neon-cyan transition-colors px-2 col-span-2 sm:col-auto self-center"
              >
                <X className="w-4 h-4" />
                Clear filters
              </button>
            ) : null}
          </div>
        </div>

        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-2 mb-4">
          <p className="text-xs font-mono text-text-muted tracking-widest uppercase">
            {loading
              ? 'Loading…'
              : `${visible.length} question${visible.length === 1 ? '' : 's'}`}
          </p>
          <Badge variant="neon">
            {selectedProject ? selectedProject.title : 'All projects'}
          </Badge>
        </div>

        {loading ? (
          <LoadingScreen variant="section" message="Loading questions…" />
        ) : error ? (
          <Card className="bg-cyber-card/80 border-semantic-warning/40 max-w-3xl mx-auto">
            <p className="text-sm text-semantic-warning">{error}</p>
          </Card>
        ) : visible.length === 0 ? (
          <Card className="bg-cyber-card/80 max-w-3xl mx-auto">
            <div className="flex items-start gap-3">
              <MessageCircleQuestion className="w-5 h-5 text-neon-cyan shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {questions.length === 0
                    ? 'No open questions yet. When staff need a concrete call, it will show up here, separate from the Ideas board.'
                    : 'No questions match these filters.'}
                </p>
                {questions.length > 0 ? (
                  <button
                    type="button"
                    className="mt-2 text-xs font-mono text-neon-cyan hover:underline"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </button>
                ) : (
                  <p className="text-xs text-text-muted mt-2">
                    Looking for a pitch instead?{' '}
                    <Link to="/ideas" className="text-neon-cyan hover:underline">
                      Browse Ideas
                    </Link>
                    .
                  </p>
                )}
              </div>
            </div>
          </Card>
        ) : (
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-4">
            {visible.map((q) => (
              <QuestionCard key={q.id} question={q} to={questionPath(q.id)} />
            ))}
          </div>
        )}
      </div>

      <AskQuestionModal
        isOpen={formOpen}
        onClose={() => !busy && setFormOpen(false)}
        onSave={saveQuestion}
        busy={busy}
        projects={projects}
        selectedProjectId={selectedProject?.id || ''}
      />
    </div>
  );
}
