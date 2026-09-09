import { hasStructuredPrompt } from '../../services/openQuestionsService';

function Section({ title, children }) {
  if (!children) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-mono tracking-widest text-neon-cyan uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Block({ children, className = '' }) {
  return (
    <p
      className={`text-base text-text-secondary leading-relaxed whitespace-pre-wrap ${className}`}
    >
      {children}
    </p>
  );
}

export default function QuestionPromptView({ question }) {
  const prompt = question?.prompt || {};
  const structured = hasStructuredPrompt(prompt);
  const context = prompt.context || (!structured ? question?.body : '');

  if (
    !context &&
    !prompt.questionDetail &&
    !prompt.shouldFit &&
    !prompt.shouldNotFit &&
    !prompt.additional
  ) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Section title="Context">
        {context ? <Block>{context}</Block> : null}
      </Section>

      {structured ? (
        <Section title="The Question">
          <p className="text-lg sm:text-xl font-semibold text-white leading-snug">
            {question.title}
          </p>
          {prompt.questionDetail ? (
            <Block className="mt-2">{prompt.questionDetail}</Block>
          ) : null}
        </Section>
      ) : null}

      {prompt.shouldFit || prompt.shouldNotFit ? (
        <Section title="Conditions">
          <div className="grid sm:grid-cols-2 gap-3">
            {prompt.shouldFit ? (
              <div className="rounded-lg border border-semantic-success/30 bg-semantic-success/5 px-4 py-3">
                <p className="text-[10px] font-mono tracking-widest text-semantic-success uppercase mb-1.5">
                  Should fit
                </p>
                <Block className="text-sm text-text-primary">
                  {prompt.shouldFit}
                </Block>
              </div>
            ) : null}
            {prompt.shouldNotFit ? (
              <div className="rounded-lg border border-semantic-danger/25 bg-semantic-danger/5 px-4 py-3">
                <p className="text-[10px] font-mono tracking-widest text-semantic-danger uppercase mb-1.5">
                  Should not fit
                </p>
                <Block className="text-sm text-text-primary">
                  {prompt.shouldNotFit}
                </Block>
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      {prompt.additional ? (
        <Section title="Additional info">
          <Block>{prompt.additional}</Block>
        </Section>
      ) : null}
    </div>
  );
}
