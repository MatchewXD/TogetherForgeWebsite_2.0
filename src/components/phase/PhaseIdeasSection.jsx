/**
 * Reusable phase-scoped ideas list (Early / Mid / Late hubs).
 * Ideas are filtered by project_id + tags; still listed on global /ideas.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lightbulb, Plus, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { phasePageService } from '../../services/phasePageService';
import { PHASE_IDEA_KEYS } from '../../utils/phasePageContent';
import { ideasService } from '../../services/ideasService';
import IdeaCard from '../ui/IdeaCard';
import Card from '../ui/Card';
import Button from '../ui/Buttons';

/**
 * @param {'early'|'mid'|'late'} phase
 * @param {string} [title]
 * @param {string} [description]
 */
const PhaseIdeasSection = ({
  phase = 'early',
  title,
  description,
  className = '',
  /** Center title + description (e.g. Mid hub) */
  descriptionCentered = false,
  /** Extra classes for the intro paragraph */
  descriptionClassName = '',
}) => {
  const navigate = useNavigate();
  const meta = PHASE_IDEA_KEYS[phase] || PHASE_IDEA_KEYS.early;
  const sectionTitle = title || `${meta.label} Ideas`;
  const sectionDesc =
    description ||
    `Community ideas linked or tagged to ${meta.label}: full games, mechanics, systems, and more. These also appear on the main Ideas board. Open an idea to discuss, vote, or attach related ideas and add-ons.`;

  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [userVotes, setUserVotes] = useState(() => new Set());
  const [votingId, setVotingId] = useState(null);

  const submitHref = `/ideas/submit?project=${encodeURIComponent(
    meta.submitProjectId
  )}&tag=${encodeURIComponent(meta.submitTag)}`;

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const uid = session?.user?.id || null;
        if (mounted) setUserId(uid);

        const list = await phasePageService.getIdeasForPhase(phase);
        if (!mounted) return;
        setIdeas(list || []);

        if (uid) {
          try {
            const voted = await ideasService.getUserVotedIdeaIds(uid);
            if (mounted) {
              setUserVotes(new Set((voted || []).map(String)));
            }
          } catch {
            /* ignore */
          }
        }
      } catch (err) {
        console.warn('[PhaseIdeasSection]', err);
        if (mounted) setIdeas([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [phase]);

  const handleVote = async (idea) => {
    if (!userId || !idea?.id) {
      navigate('/profile');
      return;
    }
    const id = idea.id;
    setVotingId(id);
    try {
      const result = await ideasService.toggleVote(id, userId);
      setUserVotes((prev) => {
        const next = new Set(prev);
        if (result?.voted) next.add(String(id));
        else next.delete(String(id));
        return next;
      });
      if (typeof result?.votes === 'number') {
        setIdeas((list) =>
          list.map((i) =>
            String(i.id) === String(id) ? { ...i, votes: result.votes } : i
          )
        );
      }
    } catch (err) {
      console.warn('[PhaseIdeasSection] vote', err);
    } finally {
      setVotingId(null);
    }
  };

  return (
    <section
      id={`${phase}-phase-ideas`}
      className={`mt-14 md:mt-16 pt-10 border-t border-cyber-border ${className}`}
      aria-labelledby={`${phase}-phase-ideas-heading`}
    >
      <div
        className={
          descriptionCentered
            ? 'flex flex-col items-center text-center gap-4 mb-8'
            : 'flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6'
        }
      >
        <div className={descriptionCentered ? 'min-w-0 w-full max-w-3xl mx-auto' : 'min-w-0'}>
          <div
            className={
              descriptionCentered
                ? 'flex items-center justify-center gap-2 mb-3'
                : 'flex items-center gap-2 mb-2'
            }
          >
            <Lightbulb className="w-4 h-4 text-neon-cyan" />
            <h2
              id={`${phase}-phase-ideas-heading`}
              className={`section-header mb-0 ${descriptionCentered ? 'text-center' : ''}`}
            >
              {sectionTitle}
            </h2>
          </div>
          <p
            className={
              descriptionClassName ||
              (descriptionCentered
                ? 'text-base sm:text-lg font-semibold text-white leading-relaxed max-w-3xl mx-auto'
                : 'text-sm text-text-secondary max-w-2xl leading-relaxed')
            }
          >
            {sectionDesc}
          </p>
        </div>
        <Link
          to={submitHref}
          className={`btn-neon inline-flex items-center gap-2 shrink-0 ${
            descriptionCentered ? '' : 'self-start sm:self-auto'
          }`}
        >
          <Plus className="w-4 h-4" />
          Submit a {meta.label} Idea
        </Link>
      </div>

      {loading ? (
        <Card className="bg-cyber-card/60 p-8 text-center text-sm text-text-muted font-mono tracking-widest">
          Loading ideas…
        </Card>
      ) : ideas.length === 0 ? (
        <Card className="bg-cyber-card/60 border-dashed border-cyber-border p-8 text-center space-y-4">
          <p className="text-text-secondary text-sm max-w-md mx-auto">
            No {meta.label} ideas yet. Share a full game pitch, a mechanic, a
            system, or any concept that fits this stage.
          </p>
          <Link to={submitHref} className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Be the first
          </Link>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4 md:gap-5">
          {ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              voted={userVotes.has(String(idea.id))}
              isOwn={userId && idea.user_id === userId}
              voting={votingId === idea.id}
              onVote={() => handleVote(idea)}
              onOpen={() => navigate(`/ideas/${idea.id}`)}
              commentCount={idea.commentCount}
            />
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          to={`/ideas?project=${encodeURIComponent(meta.submitProjectId)}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono tracking-widest text-text-muted hover:text-neon-cyan transition-colors uppercase"
        >
          Browse {meta.label} on Ideas board
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <Link
          to="/ideas"
          className="inline-flex items-center gap-1.5 text-xs font-mono tracking-widest text-text-muted hover:text-neon-cyan transition-colors uppercase"
        >
          View all ideas
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <Button
          type="button"
          variant="secondary"
          className="gap-2 text-xs"
          onClick={() => navigate(submitHref)}
        >
          <Plus className="w-3.5 h-3.5" />
          Submit a {meta.label} Idea
        </Button>
      </div>
      {(phase === 'mid' || phase === 'late') && (
        <p
          className={`mt-4 text-xs text-text-muted leading-relaxed max-w-2xl ${
            descriptionCentered ? 'mx-auto text-center' : ''
          }`}
        >
          Tip: On any {meta.label} idea, open the detail page to discuss, vote,
          and attach related ideas or add-ons so concepts can grow before they
          become active projects.
        </p>
      )}
    </section>
  );
};

export default PhaseIdeasSection;
