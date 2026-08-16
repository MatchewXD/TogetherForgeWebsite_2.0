/**
 * Volunteer Your Skills / Community Moderator application form (private).
 */
import { useEffect, useState } from 'react';
import Button from '../ui/Buttons';
import {
  VOLUNTEER_SKILL_OPTIONS,
  TIME_COMMITMENT_OPTIONS,
  APPLICATION_TYPES,
} from '../../constants/volunteer';
import { submitVolunteerApplication } from '../../services/volunteerService';

const fieldClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none';
const labelClass =
  'block text-xs font-mono tracking-widest text-neon-cyan uppercase mb-1.5';

/**
 * @param {object} props
 * @param {'skill_offer'|'moderation_role'|'open_need'} [props.mode]
 * @param {string} [props.defaultOpenNeedId]
 * @param {string} [props.relatedNeedTitle] shown when opened from an Open Need card
 * @param {string[]} [props.defaultSkillIds]
 * @param {string} [props.formId]
 * @param {'card'|'plain'} [props.variant] plain = no outer card chrome (for modals)
 * @param {() => void} [props.onDone]
 * @param {() => void} [props.onCancel]
 */
export default function VolunteerOfferForm({
  mode = 'skill_offer',
  defaultOpenNeedId = '',
  relatedNeedTitle = '',
  defaultSkillIds = [],
  formId = 'volunteer-offer-form',
  variant = 'card',
  onDone,
  onCancel,
}) {
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [discordUsername, setDiscordUsername] = useState('');
  // Prefer a fresh list from the entry point (blank vs pre-filled skills)
  const [skillAreas, setSkillAreas] = useState(() =>
    Array.isArray(defaultSkillIds) ? [...defaultSkillIds] : []
  );
  const [skillOther, setSkillOther] = useState('');
  const [description, setDescription] = useState('');
  const [timeCommitment, setTimeCommitment] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const relatedTitle = String(relatedNeedTitle || '').trim();
  const relatedNeedId = String(defaultOpenNeedId || '').trim();
  const fromOpenNeed = Boolean(relatedTitle || relatedNeedId);
  const isModeration = mode === 'moderation_role';

  useEffect(() => {
    setSkillAreas(
      Array.isArray(defaultSkillIds) ? [...defaultSkillIds] : []
    );
  }, [defaultSkillIds]);

  const toggleSkill = (id) => {
    setSkillAreas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const applicationType = isModeration
        ? APPLICATION_TYPES.moderation_role
        : fromOpenNeed
          ? APPLICATION_TYPES.open_need
          : APPLICATION_TYPES.skill_offer;

      // Keep description clean; pass need title for staff queue / Discord
      const result = await submitVolunteerApplication({
        applicationType,
        handle,
        email,
        discordUsername,
        skillAreas: isModeration ? ['moderation'] : skillAreas,
        skillOther: isModeration ? null : skillOther,
        roleId: null,
        openNeedId: relatedNeedId || null,
        openNeedTitle: relatedTitle || null,
        description,
        timeCommitment,
        portfolioUrl,
      });
      if (!result.ok) {
        setError(result.error || 'Could not submit. Try again.');
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div
        id={formId}
        className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-6 text-center space-y-3"
        role="status"
      >
        <p className="text-lg font-semibold text-white">Thank you</p>
        <p className="text-sm text-text-secondary leading-relaxed max-w-md mx-auto">
          Your note went to the private review queue for coordinators. This is
          not public. A small trusted group will follow up if there is a fit.
          You can keep browsing open work while you wait.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {onDone ? (
            <Button type="button" size="sm" onClick={() => onDone()}>
              Close
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setDone(false);
              setDescription('');
              setSkillOther('');
              setPortfolioUrl('');
            }}
          >
            Submit another
          </Button>
        </div>
      </div>
    );
  }

  const shell =
    variant === 'plain'
      ? 'space-y-4'
      : 'space-y-4 rounded-xl border border-cyber-border bg-cyber-card/80 p-5 sm:p-6';

  return (
    <form id={formId} onSubmit={onSubmit} className={shell}>
      {/* Related need is pre-filled silently for staff routing (no on-page banner). */}
      {relatedTitle ? (
        <input type="hidden" name="related_need_title" value={relatedTitle} />
      ) : null}
      {relatedNeedId ? (
        <input type="hidden" name="related_need_id" value={relatedNeedId} />
      ) : null}

      <div>
        <label className={labelClass} htmlFor={`${formId}-handle`}>
          Name or preferred handle *
        </label>
        <input
          id={`${formId}-handle`}
          className={fieldClass}
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          required
          maxLength={80}
          autoComplete="nickname"
          placeholder="How we should refer to you"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor={`${formId}-discord`}>
            Discord username
          </label>
          <input
            id={`${formId}-discord`}
            className={fieldClass}
            value={discordUsername}
            onChange={(e) => setDiscordUsername(e.target.value)}
            maxLength={64}
            placeholder="name or name#0000"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor={`${formId}-email`}>
            Email
          </label>
          <input
            id={`${formId}-email`}
            type="email"
            className={fieldClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            autoComplete="email"
            placeholder="you@example.com"
          />
        </div>
      </div>
      <p className="text-[11px] text-text-muted -mt-2">
        Discord and/or email required (at least one).
      </p>

      {!isModeration ? (
        <fieldset>
          <legend className={labelClass}>Skill areas</legend>
          <div className="flex flex-wrap gap-2">
            {VOLUNTEER_SKILL_OPTIONS.map((s) => {
              const on = skillAreas.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSkill(s.id)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                    on
                      ? 'border-neon-cyan/50 bg-neon-cyan/15 text-neon-cyan'
                      : 'border-cyber-border text-text-secondary hover:border-white/30'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          {skillAreas.includes('other') ? (
            <input
              className={`${fieldClass} mt-2`}
              value={skillOther}
              onChange={(e) => setSkillOther(e.target.value)}
              placeholder="Describe other skills"
              maxLength={200}
            />
          ) : null}
        </fieldset>
      ) : null}

      <div>
        <label className={labelClass} htmlFor={`${formId}-desc`}>
          How can you help? *
        </label>
        <textarea
          id={`${formId}-desc`}
          className={fieldClass}
          rows={4}
          required
          maxLength={4000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={
            isModeration
              ? 'A few sentences about how you would like to help as a Community Moderator.'
              : 'A few sentences about skills, tools, and what you enjoy helping with.'
          }
        />
      </div>

      <div>
        <label className={labelClass} htmlFor={`${formId}-time`}>
          Preferred time commitment
        </label>
        <select
          id={`${formId}-time`}
          className={fieldClass}
          value={timeCommitment}
          onChange={(e) => setTimeCommitment(e.target.value)}
        >
          <option value="">Optional…</option>
          {TIME_COMMITMENT_OPTIONS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor={`${formId}-portfolio`}>
          Portfolio or example link (optional)
        </label>
        <input
          id={`${formId}-portfolio`}
          type="url"
          className={fieldClass}
          value={portfolioUrl}
          onChange={(e) => setPortfolioUrl(e.target.value)}
          placeholder="https://"
          maxLength={500}
        />
      </div>

      <p className="text-[11px] text-text-muted leading-relaxed">
        Applications are private. We start with a small trusted group and expand
        when the process is stable. See Community Guidelines for how we work
        together.
      </p>

      {error ? (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="submit" disabled={busy} className="gap-2">
          {busy ? 'Sending…' : 'Submit application'}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => onCancel()}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
