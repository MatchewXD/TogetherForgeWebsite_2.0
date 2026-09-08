/**
 * Staff-initiated Open Questions on a project hub.
 * Community posts Suggestions (support + replies). Staff may Adopt or close with a note.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronsUp,
  ChevronLeft,
  Loader2,
  MessageCircle,
  MessageCircleQuestion,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';

import Button from '../ui/Buttons';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import CharCount from '../ui/CharCount';
import Modal from '../ui/Modal';
import UserAvatar from '../ui/UserAvatar';
import UserNameWithBadge from '../badges/UserNameWithBadge';
import {
  OPEN_QUESTION_BODY_MAX,
  OPEN_QUESTION_CLOSE_NOTE_MAX,
  OPEN_QUESTION_REPLY_MAX,
  OPEN_QUESTION_TITLE_MAX,
  openQuestionsService,
} from '../../services/openQuestionsService';

const fieldLabel =
  'block text-sm font-mono tracking-widest text-neon-cyan mb-2';
const fieldControl =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors';

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

function AuthorLine({ author, extra }) {
  const name = author?.username || 'Member';
  return (
    <div className="flex items-center gap-2 min-w-0 text-xs">
      <UserAvatar
        src={author?.avatarUrl || author?.avatar_url}
        name={name}
        username={author?.username}
        size="sm"
      />
      <UserNameWithBadge
        username={author?.username}
        displayName={name}
        pinnedBadgeKey={author?.pinnedBadgeKey || author?.pinned_badge_key}
        linkClassName="truncate text-text-primary"
      />
      {extra ? (
        <span className="text-text-muted font-mono shrink-0">{extra}</span>
      ) : null}
    </div>
  );
}

function VoteButton({ suggestion, disabled, onVote }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => onVote(e, suggestion.id)}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-mono transition-colors ${
        suggestion.supportedByMe
          ? 'border-neon-cyan/50 bg-neon-cyan/15 text-neon-cyan'
          : 'border-cyber-border text-text-muted hover:text-neon-cyan hover:border-neon-cyan/40'
      } disabled:opacity-50`}
      title="Vote this answer up"
    >
      <ChevronsUp className="w-3.5 h-3.5" />
      {suggestion.supportCount}
    </button>
  );
}

function CommentThread({
  comments = [],
  isOpen,
  user,
  busy,
  replyDrafts,
  setReplyDrafts,
  replyOpenFor,
  setReplyOpenFor,
  onPostReply,
}) {
  if (!comments.length) {
    return (
      <p className="text-sm text-text-muted">
        No comments yet. Start the discussion below.
      </p>
    );
  }

  const renderNode = (node, depth = 0) => (
    <li key={node.id} className={depth > 0 ? 'mt-3' : ''}>
      <AuthorLine author={node.author} extra={formatDate(node.createdAt)} />
      <p className="text-sm text-text-secondary mt-1 whitespace-pre-wrap leading-relaxed">
        {node.body}
      </p>
      {isOpen && user ? (
        <button
          type="button"
          className="mt-1 text-[11px] font-mono text-neon-cyan hover:text-white"
          onClick={() =>
            setReplyOpenFor((id) => (id === node.id ? null : node.id))
          }
        >
          Reply
        </button>
      ) : null}
      {replyOpenFor === node.id && isOpen ? (
        <div className="mt-2 space-y-2">
          <textarea
            className={`${fieldControl} min-h-[4rem]`}
            maxLength={OPEN_QUESTION_REPLY_MAX}
            value={replyDrafts[node.id] || ''}
            onChange={(e) =>
              setReplyDrafts((prev) => ({
                ...prev,
                [node.id]: e.target.value,
              }))
            }
            placeholder={`Reply to ${node.author?.username || 'this comment'}…`}
          />
          <CharCount
            value={replyDrafts[node.id] || ''}
            max={OPEN_QUESTION_REPLY_MAX}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={() => onPostReply(node.id)}
            >
              Send
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setReplyOpenFor(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {node.replies?.length ? (
        <ul className="mt-3 space-y-3 border-l border-white/10 pl-4">
          {node.replies.map((child) => renderNode(child, depth + 1))}
        </ul>
      ) : null}
    </li>
  );

  return (
    <ul className="space-y-4">{comments.map((c) => renderNode(c, 0))}</ul>
  );
}

function AnswerDetail({
  question,
  suggestion,
  isStaff,
  user,
  busy,
  commentDraft,
  setCommentDraft,
  replyDrafts,
  setReplyDrafts,
  replyOpenFor,
  setReplyOpenFor,
  onBack,
  onVote,
  onAdopt,
  onPostComment,
  onPostReply,
}) {
  const isAdopted = question.adoptedSuggestion?.id === suggestion.id;
  const isTop = question.topRanked?.id === suggestion.id;

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs font-mono text-neon-cyan hover:text-white"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to question
      </button>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-mono text-text-muted">
          #{suggestion.rank}
        </span>
        {isAdopted ? (
          <Badge variant="success" className="!normal-case">
            Adopted
          </Badge>
        ) : null}
        {isTop && !isAdopted ? (
          <Badge variant="neon" className="!normal-case">
            Top ranked
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

      <p className="text-base text-text-primary leading-relaxed whitespace-pre-wrap">
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

      <div className="border-t border-white/10 pt-4 space-y-4">
        <div className="font-mono tracking-widest text-sm text-neon-cyan flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          DISCUSSION THREAD
        </div>
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
                className={`${fieldControl} min-h-[5rem]`}
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
            <p className="text-sm text-text-muted">
              <Link to="/account" className="text-neon-cyan hover:underline">
                Sign in
              </Link>{' '}
              to comment.
            </p>
          )
        ) : (
          <p className="text-xs text-text-muted">This question is closed.</p>
        )}
      </div>
    </div>
  );
}

const OpenQuestionsSection = ({
  projectId,
  projectTitle = 'this project',
  isStaff = false,
  user = null,
}) => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [formError, setFormError] = useState('');

  const [activeId, setActiveId] = useState(null);
  const [activeSuggestionId, setActiveSuggestionId] = useState(null);
  const [suggestionDraft, setSuggestionDraft] = useState('');
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyOpenFor, setReplyOpenFor] = useState(null);
  const [closeNote, setCloseNote] = useState('');
  const [commentDraft, setCommentDraft] = useState('');

  const showToast = (message, kind = 'info') => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 5000);
  };

  const load = useCallback(async () => {
    if (!projectId) {
      setQuestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const rows = await openQuestionsService.listForProject(projectId, {
        viewerUserId: user?.id || null,
      });
      setQuestions(rows);
    } catch (err) {
      setError(err?.message || 'Could not load open questions.');
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const active = useMemo(
    () => questions.find((q) => q.id === activeId) || null,
    [questions, activeId]
  );
  const activeSuggestion = useMemo(
    () =>
      (active?.suggestions || []).find((s) => s.id === activeSuggestionId) ||
      null,
    [active, activeSuggestionId]
  );

  const openList = questions.filter((q) => q.isOpen);
  const closedList = questions.filter((q) => !q.isOpen);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setBody('');
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (q) => {
    setActiveId(null);
    setEditing(q);
    setTitle(q.title || '');
    setBody(q.body || '');
    setFormError('');
    setFormOpen(true);
  };

  const saveQuestion = async (e) => {
    e.preventDefault();
    if (!isStaff || !user?.id || !projectId) return;
    setBusy(true);
    setFormError('');
    try {
      if (editing) {
        await openQuestionsService.updateQuestion(editing.id, { title, body });
        showToast('Question updated.', 'success');
      } else {
        await openQuestionsService.createQuestion(
          projectId,
          { title, body },
          user.id
        );
        showToast('Question posted to the community.', 'success');
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err?.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  const removeQuestion = async (q) => {
    if (!isStaff) return;
    const ok = window.confirm(
      `Delete “${q.title}” and all suggestions? This cannot be undone.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      await openQuestionsService.deleteQuestion(q.id);
      if (activeId === q.id) {
        setActiveId(null);
        setActiveSuggestionId(null);
      }
      showToast('Question deleted.', 'success');
      await load();
    } catch (err) {
      showToast(err?.message || 'Could not delete.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const postSuggestion = async () => {
    if (!active || !user?.id) return;
    setBusy(true);
    try {
      await openQuestionsService.postReply({
        questionId: active.id,
        userId: user.id,
        body: suggestionDraft,
      });
      setSuggestionDraft('');
      await load();
    } catch (err) {
      showToast(err?.message || 'Could not post.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const postComment = async () => {
    if (!active || !activeSuggestion || !user?.id) return;
    setBusy(true);
    try {
      await openQuestionsService.postReply({
        questionId: active.id,
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

  const postNestedReply = async (suggestionId) => {
    if (!active || !user?.id) return;
    const text = replyDrafts[suggestionId] || '';
    setBusy(true);
    try {
      await openQuestionsService.postReply({
        questionId: active.id,
        userId: user.id,
        body: text,
        parentId: suggestionId,
      });
      setReplyDrafts((prev) => ({ ...prev, [suggestionId]: '' }));
      setReplyOpenFor(null);
      await load();
    } catch (err) {
      showToast(err?.message || 'Could not post.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const closeActive = async () => {
    if (!active || !isStaff) return;
    setBusy(true);
    try {
      await openQuestionsService.closeQuestion(active.id, {
        note: closeNote,
        adoptedReplyId: active.adoptedReplyId || null,
      });
      setCloseNote('');
      showToast('Question closed.', 'success');
      await load();
    } catch (err) {
      showToast(err?.message || 'Could not close.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const adoptSuggestion = async (suggestionId) => {
    if (!active || !isStaff) return;
    setBusy(true);
    try {
      await openQuestionsService.adoptSuggestion(active.id, suggestionId);
      showToast('Suggestion adopted as the official decision.', 'success');
      await load();
    } catch (err) {
      showToast(err?.message || 'Could not adopt.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleSupport = async (e, suggestionId) => {
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

  const openQuestion = (q) => {
    setActiveId(q.id);
    setActiveSuggestionId(null);
    setCloseNote(q.closeNote || '');
    setSuggestionDraft('');
    setCommentDraft('');
    setReplyOpenFor(null);
  };

  const openAnswer = (suggestionId) => {
    setActiveSuggestionId(suggestionId);
    setCommentDraft('');
    setReplyOpenFor(null);
  };

  const backToQuestion = () => {
    setActiveSuggestionId(null);
    setCommentDraft('');
    setReplyOpenFor(null);
  };

  const renderCard = (q) => {
    const highlight = q.adoptedSuggestion || q.topRanked;
    return (
      <Card
        key={q.id}
        interactive
        className="bg-cyber-card/80 flex flex-col h-full hover:border-neon-cyan/40 transition-colors"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openQuestion(q);
          }
        }}
        onClick={() => openQuestion(q)}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-base font-semibold text-white leading-snug">
            {q.title}
          </h3>
          <Badge variant={q.isOpen ? 'neon' : 'success'} className="!normal-case shrink-0">
            {q.isOpen ? 'Open' : 'Closed'}
          </Badge>
        </div>
        {q.body ? (
          <p className="text-sm text-text-secondary flex-1 mb-3 line-clamp-3">
            {q.body}
          </p>
        ) : (
          <div className="flex-1 mb-3" />
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-text-muted">
          <span className="text-neon-cyan">
            {q.suggestionCount} suggestion{q.suggestionCount === 1 ? '' : 's'}
            {q.topRanked
              ? ` · ${q.topRanked.supportCount} support${q.topRanked.supportCount === 1 ? '' : 's'} on #1`
              : ''}
          </span>
          <span className="text-text-secondary">View →</span>
        </div>
        {highlight ? (
          <p className="text-[11px] text-text-muted mt-2 line-clamp-2">
            {q.adoptedSuggestion ? 'Adopted: ' : 'Top ranked: '}
            {highlight.body}
          </p>
        ) : null}
      </Card>
    );
  };

  return (
    <section id="open-questions" aria-labelledby="questions-heading">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          <div className="section-header">Open Questions</div>
          <h2 id="questions-heading" className="text-2xl font-bold text-white">
            Decisions for {projectTitle}
          </h2>
          <p className="text-text-secondary text-sm mt-1 max-w-xl leading-relaxed">
            Staff ask a focused question when the project needs a call. Open a
            question to read it and see every answer as a card. The most voted
            answers sit at the top. Open an answer to read the full idea and
            comment, the same way you would on Ideas.
          </p>
        </div>
        {isStaff && projectId && (
          <Button
            className="gap-2 self-start sm:self-auto"
            onClick={openCreate}
            disabled={busy}
          >
            <Plus className="w-4 h-4" />
            Ask a question
          </Button>
        )}
      </div>

      {toast && (
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
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-text-muted py-8">
          <Loader2 className="w-4 h-4 animate-spin text-neon-cyan" />
          Loading questions…
        </div>
      ) : error ? (
        <Card className="bg-cyber-card/80 border-semantic-warning/40">
          <p className="text-sm text-semantic-warning">{error}</p>
        </Card>
      ) : questions.length === 0 ? (
        <Card className="bg-cyber-card/80">
          <div className="flex items-start gap-3">
            <MessageCircleQuestion className="w-5 h-5 text-neon-cyan shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-text-secondary leading-relaxed">
                No open questions right now. When staff need a concrete call
                for {projectTitle}, it will show up here, separate from the
                Ideas board.
              </p>
              {isStaff && (
                <p className="text-xs text-text-muted mt-2">
                  Use “Ask a question” to put a decision in front of the
                  community.
                </p>
              )}
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {openList.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {openList.map(renderCard)}
            </div>
          )}
          {closedList.length > 0 && (
            <div>
              <p className="text-[10px] font-mono tracking-widest text-text-muted uppercase mb-3">
                Closed
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {closedList.map(renderCard)}
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={formOpen}
        onClose={() => !busy && setFormOpen(false)}
        title={editing ? 'Edit question' : 'Ask a question'}
        size="md"
      >
        <form onSubmit={saveQuestion} className="space-y-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            Ask one concrete decision. Keep it tighter than an Idea. The
            community posts Suggestions, not a new game pitch.
          </p>
          <div>
            <label className={fieldLabel} htmlFor="oq-title">
              Question
            </label>
            <input
              id="oq-title"
              className={fieldControl}
              value={title}
              maxLength={OPEN_QUESTION_TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. How long should a co-op session feel?"
              required
            />
            <CharCount value={title} max={OPEN_QUESTION_TITLE_MAX} />
          </div>
          <div>
            <label className={fieldLabel} htmlFor="oq-body">
              Context (optional)
            </label>
            <textarea
              id="oq-body"
              className={`${fieldControl} min-h-[7rem]`}
              value={body}
              maxLength={OPEN_QUESTION_BODY_MAX}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What you already know, options you are weighing, or why this call matters now."
            />
            <CharCount value={body} max={OPEN_QUESTION_BODY_MAX} />
          </div>
          {formError && (
            <p className="text-sm text-semantic-danger">{formError}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save' : 'Post question'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setFormOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(active)}
        onClose={() => {
          if (busy) return;
          setActiveId(null);
          setActiveSuggestionId(null);
        }}
        title={
          activeSuggestion
            ? `Answer #${activeSuggestion.rank}`
            : active?.title || 'Question'
        }
        size="lg"
      >
        {active && activeSuggestion ? (
          <AnswerDetail
            question={active}
            suggestion={activeSuggestion}
            isStaff={isStaff}
            user={user}
            busy={busy}
            commentDraft={commentDraft}
            setCommentDraft={setCommentDraft}
            replyDrafts={replyDrafts}
            setReplyDrafts={setReplyDrafts}
            replyOpenFor={replyOpenFor}
            setReplyOpenFor={setReplyOpenFor}
            onBack={backToQuestion}
            onVote={toggleSupport}
            onAdopt={adoptSuggestion}
            onPostComment={postComment}
            onPostReply={postNestedReply}
          />
        ) : active ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={active.isOpen ? 'neon' : 'success'} className="!normal-case">
                {active.isOpen ? 'Open' : 'Closed'}
              </Badge>
              <AuthorLine
                author={active.author}
                extra={formatDate(active.createdAt)}
              />
              {isStaff && (
                <div className="ml-auto flex items-center gap-1">
                  {active.isOpen && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1"
                      onClick={() => openEdit(active)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </Button>
                  )}
                  <button
                    type="button"
                    className="p-1.5 rounded-md border border-cyber-border text-text-muted hover:text-red-300 hover:border-red-400/40"
                    onClick={() => removeQuestion(active)}
                    aria-label="Delete question"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {active.body ? (
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                {active.body}
              </p>
            ) : null}

            {active.adoptedSuggestion && (
              <div className="rounded-lg border border-semantic-success/40 bg-semantic-success/10 px-3 py-2.5">
                <p className="text-[10px] font-mono tracking-widest text-semantic-success uppercase mb-1">
                  Adopted decision
                </p>
                <p className="text-sm text-text-primary leading-relaxed">
                  {active.adoptedSuggestion.body}
                </p>
              </div>
            )}

            {active.closeNote && !active.isOpen && (
              <div className="rounded-lg border border-cyber-border bg-cyber-surface/60 px-3 py-2.5">
                <p className="text-[10px] font-mono tracking-widest text-text-muted uppercase mb-1">
                  Staff note
                </p>
                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                  {active.closeNote}
                </p>
              </div>
            )}

            <div>
              <p className="text-xs font-mono tracking-widest text-text-muted uppercase mb-3">
                Answers
                {active.suggestionCount
                  ? ` · ${active.suggestionCount}`
                  : ''}
              </p>
              {(active.suggestions || []).length === 0 ? (
                <p className="text-sm text-text-muted">
                  No answers yet.{' '}
                  {active.isOpen ? 'Be the first to post one.' : ''}
                </p>
              ) : (
                <ul className="space-y-3">
                  {active.suggestions.map((suggestion) => {
                    const isTop = active.topRanked?.id === suggestion.id;
                    const isAdopted =
                      active.adoptedSuggestion?.id === suggestion.id;
                    return (
                      <li key={suggestion.id}>
                        <button
                          type="button"
                          onClick={() => openAnswer(suggestion.id)}
                          className={`w-full text-left rounded-lg border px-3 py-3 transition-colors ${
                            isAdopted
                              ? 'border-semantic-success/40 bg-semantic-success/5 hover:border-semantic-success/60'
                              : isTop
                                ? 'border-neon-cyan/35 bg-neon-cyan/5 hover:border-neon-cyan/55'
                                : 'border-cyber-border bg-cyber-surface/50 hover:border-neon-cyan/40'
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-mono text-text-muted">
                              #{suggestion.rank}
                            </span>
                            <AuthorLine
                              author={suggestion.author}
                              extra={formatDate(suggestion.createdAt)}
                            />
                            {isAdopted ? (
                              <Badge
                                variant="success"
                                className="!normal-case !text-[10px]"
                              >
                                Adopted
                              </Badge>
                            ) : null}
                            {isTop && !isAdopted ? (
                              <Badge
                                variant="neon"
                                className="!normal-case !text-[10px]"
                              >
                                Top ranked
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-sm text-text-primary leading-relaxed mt-2 line-clamp-3 whitespace-pre-wrap">
                            {suggestion.body}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] font-mono text-text-muted">
                            <span className="inline-flex items-center gap-1">
                              <ChevronsUp className="w-3.5 h-3.5" />
                              {suggestion.supportCount} vote
                              {suggestion.supportCount === 1 ? '' : 's'}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MessageCircle className="w-3.5 h-3.5" />
                              {suggestion.replyCount} comment
                              {suggestion.replyCount === 1 ? '' : 's'}
                            </span>
                            <span className="ml-auto text-neon-cyan">
                              Open answer →
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {active.isOpen && (
              <div className="pt-2 border-t border-cyber-border space-y-2">
                {user ? (
                  <>
                    <label className={fieldLabel} htmlFor="oq-suggestion">
                      Your answer
                    </label>
                    <textarea
                      id="oq-suggestion"
                      className={`${fieldControl} min-h-[5rem]`}
                      maxLength={OPEN_QUESTION_REPLY_MAX}
                      value={suggestionDraft}
                      onChange={(e) => setSuggestionDraft(e.target.value)}
                      placeholder="Propose a direction. Others can vote it up and comment on the full answer."
                    />
                    <CharCount
                      value={suggestionDraft}
                      max={OPEN_QUESTION_REPLY_MAX}
                    />
                    <Button disabled={busy} onClick={postSuggestion}>
                      {busy ? 'Posting…' : 'Post answer'}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-text-muted">
                    <Link to="/account" className="text-neon-cyan hover:underline">
                      Sign in
                    </Link>{' '}
                    to post an answer.
                  </p>
                )}
              </div>
            )}

            {isStaff && active.isOpen && (
              <div className="pt-2 border-t border-cyber-border space-y-2">
                <p className="text-xs font-mono tracking-widest text-text-muted uppercase">
                  Close this question
                </p>
                <p className="text-xs text-text-muted leading-relaxed">
                  Adopt a suggestion first if it is the official call. Closing
                  needs a short note so the community can see the final choice,
                  including if nothing was adopted because it did not fit the
                  game.
                </p>
                <textarea
                  className={`${fieldControl} min-h-[4.5rem]`}
                  maxLength={OPEN_QUESTION_CLOSE_NOTE_MAX}
                  value={closeNote}
                  onChange={(e) => setCloseNote(e.target.value)}
                  placeholder="Why this is the call, or why the top-ranked suggestion was not adopted."
                />
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={closeActive}
                >
                  Close question
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </section>
  );
};

export default OpenQuestionsSection;
