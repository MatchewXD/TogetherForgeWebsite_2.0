import { useNavigate } from 'react-router-dom';

import Badge from '../ui/Badge';
import Button from '../ui/Buttons';
import Card from '../ui/Card';
import { answerPath } from '../../services/openQuestionsService';
import { AnswerMeta, AuthorLine, VoteButton } from './questionUi';
import { formatDate } from './questionStyles';

export default function AnswerCard({
  question,
  suggestion,
  isStaff = false,
  busy = false,
  onVote,
  onAdopt,
}) {
  const navigate = useNavigate();
  const href = answerPath(question.id, suggestion.id);
  const isAdopted = question.adoptedSuggestion?.id === suggestion.id;
  const isTop = question.topRanked?.id === suggestion.id;

  let cardClass =
    'border-cyber-border bg-cyber-surface/50 hover:border-neon-cyan/40';
  if (isAdopted) {
    cardClass =
      'border-semantic-success/40 bg-semantic-success/5 hover:border-semantic-success/60';
  } else if (isTop) {
    cardClass =
      'border-neon-cyan/35 bg-neon-cyan/5 hover:border-neon-cyan/55';
  }

  const open = () => navigate(href);

  return (
    <Card
      interactive
      variant="subtle"
      className={`h-full flex flex-col p-4 sm:p-5 transition-colors group ${cardClass}`}
      onClick={open}
      role="link"
      tabIndex={0}
      aria-label={`Open answer #${suggestion.rank}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-mono text-text-muted">
          #{suggestion.rank}
        </span>
        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <AuthorLine
            author={suggestion.author}
            extra={formatDate(suggestion.createdAt)}
          />
        </div>
        {isAdopted ? (
          <Badge variant="success" className="!normal-case !text-[10px]">
            Adopted
          </Badge>
        ) : null}
        {isTop && !isAdopted ? (
          <Badge variant="neon" className="!normal-case !text-[10px]">
            Top ranked
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
      <div className="flex flex-wrap items-center gap-3 mt-3">
        <AnswerMeta suggestion={suggestion} />
        {isStaff && question.isOpen && !isAdopted ? (
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
              Adopt
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
