import { useNavigate } from 'react-router-dom';

import Badge from '../ui/Badge';
import Button from '../ui/Buttons';
import Card from '../ui/Card';
import { answerPath } from '../../services/openQuestionsService';
import { QuestionImageGrid } from './QuestionImageField';
import { AnswerMeta, AuthorLine, VoteButton } from './questionUi';
import { formatDate } from './questionStyles';

export default function AnswerCard({
  question,
  suggestion,
  isStaff = false,
  busy = false,
  onVote,
  onAdopt,
  onHide,
}) {
  const navigate = useNavigate();
  const href = answerPath(question.id, suggestion.id);
  const isPicked =
    (question.pickedSuggestion || question.adoptedSuggestion)?.id ===
    suggestion.id;

  const cardClass = isPicked
    ? 'border-semantic-success/40 bg-semantic-success/5 hover:border-semantic-success/60'
    : suggestion.hidden
      ? 'border-cyber-border/50 bg-cyber-surface/30 opacity-70'
      : 'border-cyber-border bg-cyber-surface/50 hover:border-neon-cyan/40';

  const open = () => navigate(href);

  return (
    <Card
      interactive
      variant="subtle"
      className={`h-full flex flex-col p-4 sm:p-5 transition-colors group ${cardClass}`}
      onClick={open}
      role="link"
      tabIndex={0}
      aria-label="Open this idea"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <AuthorLine
            author={suggestion.author}
            extra={formatDate(suggestion.createdAt)}
          />
        </div>
        {isPicked ? (
          <Badge variant="success" className="!normal-case !text-[10px]">
            Picked
          </Badge>
        ) : null}
        {suggestion.hidden ? (
          <Badge variant="warning" className="!normal-case !text-[10px]">
            Hidden
          </Badge>
        ) : null}
        <div
          className="ml-auto"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <VoteButton
            suggestion={suggestion}
            disabled={busy || !question.isOpen}
            onVote={onVote}
          />
        </div>
      </div>
      <p className="text-sm sm:text-base text-text-primary leading-relaxed mt-3 line-clamp-2 whitespace-pre-wrap flex-1 group-hover:text-white">
        {suggestion.body}
      </p>
      {suggestion.hidden && suggestion.hiddenNote ? (
        <p className="text-xs text-text-secondary mt-2 rounded-lg border border-cyber-border bg-cyber-surface/80 px-3 py-2">
          <span className="font-mono text-[10px] tracking-widest uppercase text-text-muted block mb-1">
            Staff note
          </span>
          {suggestion.hiddenNote}
        </p>
      ) : null}
      <QuestionImageGrid urls={suggestion.images} alt="" />
      <div className="flex flex-wrap items-center gap-3 mt-3">
        <AnswerMeta suggestion={suggestion} />
        {isStaff && question.isOpen && !isPicked ? (
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onAdopt(suggestion.id)}
            >
              Mark Picked
            </Button>
          </div>
        ) : null}
        {isStaff ? (
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => onHide?.(suggestion.id, !suggestion.hidden)}
            >
              {suggestion.hidden ? 'Show' : 'Hide'}
            </Button>
          </div>
        ) : null}
        <span className="ml-auto text-[11px] font-mono text-neon-cyan group-hover:text-white">
          Open discussion →
        </span>
      </div>
    </Card>
  );
}
