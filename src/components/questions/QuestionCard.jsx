import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { questionPath } from '../../services/openQuestionsService';
import { formatDate } from './questionStyles';

export default function QuestionCard({
  question,
  showProject = true,
  to,
}) {
  const highlight = question.adoptedSuggestion || question.topRanked;
  const href = to || questionPath(question.id);
  const projectLabel = question.project?.title || question.project?.slug;

  return (
    <Card
      to={href}
      interactive
      variant="subtle"
      className="bg-cyber-card/80 flex flex-col h-full hover:border-neon-cyan/40 transition-colors group p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-lg sm:text-xl font-bold text-white leading-snug group-hover:text-neon-cyan transition-colors">
          {question.title}
        </h3>
        <Badge
          variant={question.isOpen ? 'neon' : 'success'}
          className="!normal-case shrink-0"
        >
          {question.isOpen ? 'Open' : 'Closed'}
        </Badge>
      </div>
      {showProject && projectLabel ? (
        <p className="text-[11px] font-mono text-neon-cyan/80 mb-2">
          {projectLabel}
        </p>
      ) : null}
      {question.body ? (
        <p className="text-sm text-text-secondary flex-1 mb-3 line-clamp-2 leading-relaxed">
          {question.body}
        </p>
      ) : (
        <div className="flex-1 mb-3" />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-text-muted">
        <span className="text-neon-cyan">
          {question.suggestionCount} answer
          {question.suggestionCount === 1 ? '' : 's'}
          {question.supportTotal
            ? ` · ${question.supportTotal} vote${
                question.supportTotal === 1 ? '' : 's'
              }`
            : ''}
        </span>
        <span>{formatDate(question.createdAt)}</span>
      </div>
      {highlight ? (
        <p className="text-[11px] text-text-muted mt-2 line-clamp-2">
          {question.adoptedSuggestion ? 'Adopted: ' : 'Top ranked: '}
          {highlight.body}
        </p>
      ) : null}
    </Card>
  );
}
