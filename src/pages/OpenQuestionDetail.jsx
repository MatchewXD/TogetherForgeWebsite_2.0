/**
 * Open Question detail — full question + ranked answers, or a single answer thread.
 * Routes: /questions/:questionId
 *         /questions/:questionId/answers/:answerId
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import {
  ANSWER_SORTS,
  OPEN_QUESTION_REPLY_MAX,
  filterSuggestions,
  openQuestionsService,
  questionPath,
  questionsListPath,
  sortSuggestions,
} from '../services/openQuestionsService';
import { useStaffRole } from '../hooks/useStaffRole';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Buttons';
import Card from '../components/ui/Card';
import CharCount from '../components/ui/CharCount';
import LoadingScreen from '../components/ui/LoadingScreen';
import AskQuestionModal from '../components/questions/AskQuestionModal';
import CloseQuestionModal from '../components/questions/CloseQuestionModal';
import QuestionPromptView from '../components/questions/QuestionPromptView';
import PostAnswerModal from '../components/questions/PostAnswerModal';
import AnswerCard from '../components/questions/AnswerCard';
import {
  AuthorLine,
  CommentThread,
  SignInHint,
  VoteButton,
} from '../components/questions/questionUi';
import {
  controlClass,
  fieldControl,
  fieldLabel,
  formatDate,
} from '../components/questions/questionStyles';

export default function OpenQuestionDetail() {
  const { questionId, answerId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isStaff } = useStaffRole();

  const [user, setUser] = useState(null);
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyOpenFor, setReplyOpenFor] = useState(null);
  const [closeNote, setCloseNote] = useState('');
  const [closeOpen, setCloseOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);

  const sortMode = searchParams.get('sort') || 'votes';
  const votedOnly = searchParams.get('voted') === '1';

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  const patchParams = useCallback(
    (patch) => {
      const params = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        const empty =
          !value ||
          (key === 'sort' && value === 'votes') ||
          (key === 'voted' && value !== '1');
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

  const load = useCallback(async () => {
    if (!questionId) {
      setQuestion(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const view = await openQuestionsService.getById(questionId, {
        viewerUserId: user?.id || null,
      });
      setQuestion(view);
      if (view?.closeNote) setCloseNote(view.closeNote);
    } catch (err) {
      setError(err?.message || 'Could not load this question.');
      setQuestion(null);
    } finally {
      setLoading(false);
    }
  }, [questionId, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const activeSuggestion = useMemo(
    () => (question?.suggestions || []).find((s) => s.id === answerId) || null,
    [question, answerId]
  );

  const visibleAnswers = useMemo(() => {
    const filtered = filterSuggestions(question?.suggestions || [], {
      search: debouncedSearch,
      votedOnly,
    });
    return sortSuggestions(filtered, sortMode);
  }, [question, debouncedSearch, votedOnly, sortMode]);

  const listHref = questionsListPath({
    project: question?.project?.slug || '',
  });

  const toggleSupport = async (e, suggestionId) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!user?.id) {
      showToast('Sign in to support a suggestion.', 'error');
      return;
    }
    setBusy(true);
    try {
      await openQuestionsService.toggleSupport(suggestionId, user.id);
      await load();
    } catch (err) {
      showToast(err?.message || 'Could not update support.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const postSuggestion = async (body) => {
    if (!question || !user?.id) {
      throw new Error('Sign in to post an answer.');
    }
    setBusy(true);
    try {
      await openQuestionsService.postReply({
        questionId: question.id,
        userId: user.id,
        body,
      });
      showToast('Answer posted.', 'success');
      await load();
    } catch (err) {
      throw err instanceof Error
        ? err
        : new Error(err?.message || 'Could not post.');
    } finally {
      setBusy(false);
    }
  };

  const postComment = async () => {
    if (!question || !activeSuggestion || !user?.id) return;
    setBusy(true);
    try {
      await openQuestionsService.postReply({
        questionId: question.id,
        userId: user.id,
        body: commentDraft,
        parentId: activeSuggestion.id,
      });
      setCommentDraft('');
      await load();
    } catch (err) {
      showToast(err?.message || 'Could not post.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const postNestedReply = async (parentId) => {
    if (!question || !user?.id) return;
    const text = replyDrafts[parentId] || '';
    setBusy(true);
    try {
      await openQuestionsService.postReply({
        questionId: question.id,
        userId: user.id,
        body: text,
        parentId,
      });
      setReplyDrafts((prev) => ({ ...prev, [parentId]: '' }));
      setReplyOpenFor(null);
      await load();
    } catch (err) {
      showToast(err?.message || 'Could not post.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const adoptSuggestion = async (suggestionId) => {
    if (!question || !isStaff) return;
    setBusy(true);
    try {
      await openQuestionsService.adoptSuggestion(question.id, suggestionId);
      showToast('Suggestion adopted as the official decision.', 'success');
      await load();
    } catch (err) {
      showToast(err?.message || 'Could not adopt.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const closeQuestion = async (note) => {
    if (!question || !isStaff) return;
    setBusy(true);
    try {
      await openQuestionsService.closeQuestion(question.id, {
        note,
        adoptedReplyId: question.adoptedReplyId || null,
      });
      showToast('Question closed.', 'success');
      setCloseOpen(false);
      await load();
    } catch (err) {
      throw err instanceof Error
        ? err
        : new Error(err?.message || 'Could not close.');
    } finally {
      setBusy(false);
    }
  };

  const saveQuestion = async ({ title, prompt }) => {
    if (!question || !isStaff) return;
    setBusy(true);
    try {
      await openQuestionsService.updateQuestion(question.id, { title, prompt });
      showToast('Question updated.', 'success');
      setFormOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const removeQuestion = async () => {
    if (!question || !isStaff) return;
    const ok = window.confirm(
      `Delete “${question.title}” and all suggestions? This cannot be undone.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      await openQuestionsService.deleteQuestion(question.id);
      navigate(listHref);
    } catch (err) {
      showToast(err?.message || 'Could not delete.', 'error');
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="pt-20 min-h-screen">
        <LoadingScreen variant="section" message="Loading question…" />
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="pt-20 min-h-screen">
        <div className="container-custom py-12 max-w-3xl">
          <Card className="bg-cyber-card/80">
            <p className="text-sm text-text-secondary">
              {error || 'Question not found.'}
            </p>
            <Link
              to="/questions"
              className="inline-flex items-center gap-1 mt-4 text-xs font-mono text-neon-cyan hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
              All questions
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  if (answerId && !activeSuggestion) {
    return (
      <div className="pt-20 min-h-screen">
        <div className="container-custom py-12 max-w-3xl">
          <Card className="bg-cyber-card/80">
            <p className="text-sm text-text-secondary">Answer not found.</p>
            <Link
              to={questionPath(question.id)}
              className="inline-flex items-center gap-1 mt-4 text-xs font-mono text-neon-cyan hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to question
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const projectLabel = question.project?.title || question.project?.slug;
  const projectHref = question.project?.slug
    ? `/projects/${question.project.slug}`
    : null;

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,249,255,0.04)_0%,transparent_50%)]"
        aria-hidden="true"
      />

      <div className="container-custom relative z-10 py-12 max-w-5xl">
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

        {activeSuggestion ? (
          <AnswerPage
            question={question}
            suggestion={activeSuggestion}
            projectLabel={projectLabel}
            projectHref={projectHref}
            isStaff={isStaff}
            user={user}
            busy={busy}
            commentDraft={commentDraft}
            setCommentDraft={setCommentDraft}
            replyDrafts={replyDrafts}
            setReplyDrafts={setReplyDrafts}
            replyOpenFor={replyOpenFor}
            setReplyOpenFor={setReplyOpenFor}
            onVote={toggleSupport}
            onAdopt={adoptSuggestion}
            onPostComment={postComment}
            onPostReply={postNestedReply}
          />
        ) : (
          <QuestionPage
            question={question}
            projectLabel={projectLabel}
            projectHref={projectHref}
            listHref={listHref}
            isStaff={isStaff}
            user={user}
            busy={busy}
            visibleAnswers={visibleAnswers}
            sortMode={sortMode}
            votedOnly={votedOnly}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            patchParams={patchParams}
            onVote={toggleSupport}
            onAdopt={adoptSuggestion}
            onPostSuggestion={postSuggestion}
            onCloseQuestion={() => setCloseOpen(true)}
            onEdit={() => setFormOpen(true)}
            onDelete={removeQuestion}
          />
        )}
      </div>

      <AskQuestionModal
        isOpen={formOpen}
        onClose={() => !busy && setFormOpen(false)}
        onSave={saveQuestion}
        busy={busy}
        editing={question}
      />
      <CloseQuestionModal
        isOpen={closeOpen}
        onClose={() => !busy && setCloseOpen(false)}
        onSubmit={closeQuestion}
        busy={busy}
        initialNote={closeNote}
      />
    </div>
  );
}

function QuestionPage({
  question,
  projectLabel,
  projectHref,
  listHref,
  isStaff,
  user,
  busy,
  visibleAnswers,
  sortMode,
  votedOnly,
  searchTerm,
  setSearchTerm,
  patchParams,
  onVote,
  onAdopt,
  onPostSuggestion,
  onCloseQuestion,
  onEdit,
  onDelete,
}) {
  const [answerFormOpen, setAnswerFormOpen] = useState(false);

  return (
    <div className="space-y-8">
      <Link
        to={listHref}
        className="inline-flex items-center gap-1 text-xs font-mono text-neon-cyan hover:text-white"
      >
        <ChevronLeft className="w-4 h-4" />
        All questions
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge
            variant={question.isOpen ? 'neon' : 'success'}
            className="!normal-case"
          >
            {question.isOpen ? 'Open' : 'Closed'}
          </Badge>
          {question.adoptedSuggestion ? (
            <Badge variant="success" className="!normal-case">
              Adopted
            </Badge>
          ) : null}
          {projectLabel ? (
            projectHref ? (
              <Link
                to={projectHref}
                className="text-[11px] font-mono text-neon-cyan hover:text-white"
              >
                {projectLabel}
              </Link>
            ) : (
              <span className="text-[11px] font-mono text-text-muted">
                {projectLabel}
              </span>
            )
          ) : null}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4 break-words">
              {question.title}
            </h1>
            <AuthorLine
              author={question.author}
              extra={formatDate(question.createdAt)}
            />
          </div>
          {isStaff ? (
            <div className="flex items-center gap-1 shrink-0">
              {question.isOpen ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1"
                  onClick={onEdit}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </Button>
              ) : null}
              <button
                type="button"
                className="p-1.5 rounded-md border border-cyber-border text-text-muted hover:text-red-300 hover:border-red-400/40"
                onClick={onDelete}
                aria-label="Delete question"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <QuestionPromptView question={question} />

      {question.adoptedSuggestion ? (
        <div className="rounded-lg border border-semantic-success/40 bg-semantic-success/10 px-4 py-3">
          <p className="text-[10px] font-mono tracking-widest text-semantic-success uppercase mb-1">
            Adopted decision
          </p>
          <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
            {question.adoptedSuggestion.body}
          </p>
        </div>
      ) : null}

      {question.closeNote && !question.isOpen ? (
        <div className="rounded-lg border border-cyber-border bg-cyber-surface/60 px-4 py-3">
          <p className="text-[10px] font-mono tracking-widest text-text-muted uppercase mb-1">
            Staff note
          </p>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
            {question.closeNote}
          </p>
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Community Ideas
            {question.suggestionCount ? (
              <span className="text-text-muted font-semibold">
                {' '}
                · {question.suggestionCount}
              </span>
            ) : null}
          </h2>
          {question.isOpen ? (
            <Button
              className="gap-2 self-start sm:self-auto"
              onClick={() => setAnswerFormOpen(true)}
            >
              <Plus className="w-4 h-4" />
              Post an answer
            </Button>
          ) : null}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              type="search"
              placeholder="Search answers…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`${controlClass} w-full pl-10`}
              aria-label="Search answers"
            />
          </div>
          <select
            value={ANSWER_SORTS.some((s) => s.value === sortMode) ? sortMode : 'votes'}
            onChange={(e) => patchParams({ sort: e.target.value })}
            className={controlClass}
            aria-label="Sort answers"
          >
            {ANSWER_SORTS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <label className={`${controlClass} inline-flex items-center gap-2 cursor-pointer w-full sm:w-auto`}>
            <input
              type="checkbox"
              checked={votedOnly}
              onChange={(e) =>
                patchParams({ voted: e.target.checked ? '1' : '' })
              }
              className="accent-cyan-400"
            />
            <span>My votes</span>
          </label>
        </div>

        {visibleAnswers.length === 0 ? (
          <p className="text-sm text-text-muted">
            {question.suggestionCount
              ? 'No answers match these filters.'
              : question.isOpen
                ? 'No answers yet. Be the first to post one.'
                : 'No answers were posted.'}
          </p>
        ) : (
          <ul className="grid md:grid-cols-2 gap-4">
            {visibleAnswers.map((suggestion) => (
              <li key={suggestion.id} className="min-w-0">
                <AnswerCard
                  question={question}
                  suggestion={suggestion}
                  isStaff={isStaff}
                  busy={busy}
                  onVote={onVote}
                  onAdopt={onAdopt}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <PostAnswerModal
        isOpen={answerFormOpen}
        onClose={() => !busy && setAnswerFormOpen(false)}
        onSubmit={onPostSuggestion}
        busy={busy}
        user={user}
      />

      {isStaff && question.isOpen ? (
        <div className="pt-2 border-t border-cyber-border">
          <Button variant="outline" disabled={busy} onClick={onCloseQuestion}>
            Close this question
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function AnswerPage({
  question,
  suggestion,
  projectLabel,
  projectHref,
  isStaff,
  user,
  busy,
  commentDraft,
  setCommentDraft,
  replyDrafts,
  setReplyDrafts,
  replyOpenFor,
  setReplyOpenFor,
  onVote,
  onAdopt,
  onPostComment,
  onPostReply,
}) {
  const isAdopted = question.adoptedSuggestion?.id === suggestion.id;

  return (
    <div className="space-y-6">
      <Link
        to={questionPath(question.id)}
        className="inline-flex items-center gap-1 text-xs font-mono text-neon-cyan hover:text-white"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to question
      </Link>

      <header className="space-y-3">
        <p className="text-xs font-mono tracking-widest text-text-muted uppercase">
          {projectLabel && projectHref ? (
            <Link to={projectHref} className="text-neon-cyan hover:text-white">
              {projectLabel}
            </Link>
          ) : projectLabel ? (
            projectLabel
          ) : (
            'Open Question'
          )}
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-white leading-snug">
          {question.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {isAdopted ? (
            <Badge variant="success" className="!normal-case">
              Adopted
            </Badge>
          ) : null}
          <AuthorLine
            author={suggestion.author}
            extra={formatDate(suggestion.createdAt)}
          />
          <div className="ml-auto">
            <VoteButton
              suggestion={suggestion}
              disabled={busy || !question.isOpen}
              onVote={onVote}
            />
          </div>
        </div>
      </header>

      <p className="text-base sm:text-lg text-text-primary leading-relaxed whitespace-pre-wrap">
        {suggestion.body}
      </p>

      {isStaff && question.isOpen && !isAdopted ? (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => onAdopt(suggestion.id)}
        >
          Adopt this answer
        </Button>
      ) : null}

      <div className="border-t border-white/10 pt-6 space-y-4">
        <div className="font-mono tracking-widest text-sm text-neon-cyan flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          DISCUSSION THREAD
        </div>
        <p className="text-sm text-text-secondary">
          Comment on this answer, or reply to any comment to keep the thread
          going. Votes stay on the answer.
        </p>
        <CommentThread
          comments={suggestion.replies || []}
          isOpen={question.isOpen}
          user={user}
          busy={busy}
          replyDrafts={replyDrafts}
          setReplyDrafts={setReplyDrafts}
          replyOpenFor={replyOpenFor}
          setReplyOpenFor={setReplyOpenFor}
          onPostReply={onPostReply}
        />
        {question.isOpen ? (
          user ? (
            <div className="space-y-2 pt-2">
              <label className={fieldLabel} htmlFor="oq-comment">
                Comment
              </label>
              <textarea
                id="oq-comment"
                className={`${fieldControl} min-h-[6rem]`}
                maxLength={OPEN_QUESTION_REPLY_MAX}
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="Comment on this answer…"
              />
              <CharCount value={commentDraft} max={OPEN_QUESTION_REPLY_MAX} />
              <Button disabled={busy} onClick={onPostComment}>
                {busy ? 'Posting…' : 'Post comment'}
              </Button>
            </div>
          ) : (
            <SignInHint action="comment" />
          )
        ) : (
          <p className="text-xs text-text-muted">This question is closed.</p>
        )}
      </div>
    </div>
  );
}
