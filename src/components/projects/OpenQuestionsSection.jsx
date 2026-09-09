/**
 * Project hub preview for Open Questions.
 * Full read/answer/discussion lives on /questions pages.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, MessageCircleQuestion, Plus } from 'lucide-react';

import Button from '../ui/Buttons';
import Card from '../ui/Card';
import AskQuestionModal from '../questions/AskQuestionModal';
import QuestionCard from '../questions/QuestionCard';
import {
  openQuestionsService,
  questionPath,
  questionsListPath,
} from '../../services/openQuestionsService';

const OpenQuestionsSection = ({
  projectId,
  projectSlug = '',
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

  const listHref = questionsListPath({
    project: projectSlug || projectId || '',
  });

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

  const openList = questions.filter((q) => q.isOpen);
  const closedList = questions.filter((q) => !q.isOpen);
  const preview = [...openList, ...closedList].slice(0, 6);
  const extraCount = Math.max(0, questions.length - preview.length);

  const saveQuestion = async ({ title, body }) => {
    if (!isStaff || !user?.id || !projectId) return;
    setBusy(true);
    try {
      await openQuestionsService.createQuestion(
        projectId,
        { title, body },
        user.id
      );
      showToast('Question posted to the community.', 'success');
      setFormOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
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
            question to read every answer, sort by votes, and discuss the full
            idea the same way you would on Ideas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {isStaff && projectId ? (
            <Button
              className="gap-2"
              onClick={() => setFormOpen(true)}
              disabled={busy}
            >
              <Plus className="w-4 h-4" />
              Ask a question
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" className="gap-2" to={listHref}>
            View all questions
          </Button>
        </div>
      </div>

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
              {isStaff ? (
                <p className="text-xs text-text-muted mt-2">
                  Use “Ask a question” to put a decision in front of the
                  community.
                </p>
              ) : null}
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {preview.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                showProject={false}
                to={questionPath(q.id)}
              />
            ))}
          </div>
          {extraCount > 0 ? (
            <p className="text-xs font-mono text-text-muted">
              +{extraCount} more on the questions page
            </p>
          ) : null}
        </div>
      )}

      <AskQuestionModal
        isOpen={formOpen}
        onClose={() => !busy && setFormOpen(false)}
        onSave={saveQuestion}
        busy={busy}
        selectedProjectId={projectId}
      />
    </section>
  );
};

export default OpenQuestionsSection;
