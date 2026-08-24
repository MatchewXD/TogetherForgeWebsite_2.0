/**
 * Community Showcase submission form.
 * Route: /showcase/submit
 * Submissions enter pending moderation; not public until approved.
 * After success, the form is replaced by a clear confirmation panel.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  Loader2,
  CheckCircle2,
  LayoutDashboard,
  Plus,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Buttons';
import LoadingScreen from '../components/ui/LoadingScreen';
import { supabase } from '../lib/supabase';
import {
  submitShowcasePost,
  SHOWCASE_CONTENT_TYPES,
} from '../services/showcaseService';
import { loadRelatedProjectOptions } from '../utils/relatedToOptions';

const fieldClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors';

const labelClass =
  'block text-sm font-mono tracking-widest text-neon-cyan mb-2';

const emptyForm = () => ({
  contentType: 'video',
  title: '',
  description: '',
  youtubeUrl: '',
  url: '',
  imageUrl: '',
  projectTag: '',
  submitterEmail: '',
});

const ShowcaseSubmit = () => {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  /** When set, form is hidden and a success panel is shown */
  const [submittedMeta, setSubmittedMeta] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [authUsername, setAuthUsername] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  /** Official TF projects only (from projects table). */
  const [officialProjects, setOfficialProjects] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!mounted) return;
        setAuthUser(user || null);
        if (!user?.id) {
          setAuthUsername(null);
          setAuthLoading(false);
          return;
        }
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .maybeSingle();
        if (mounted) {
          setAuthUsername(profile?.username?.trim() || null);
          setAuthLoading(false);
        }
      } catch {
        if (mounted) {
          setAuthUser(null);
          setAuthLoading(false);
        }
      }
    })();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthUser(session?.user || null);
      if (!session?.user) setAuthUsername(null);
    });
    return () => {
      mounted = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    loadRelatedProjectOptions().then((list) => {
      if (mounted) setOfficialProjects(Array.isArray(list) ? list : []);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (!authUser?.id) {
      setSubmitError('Sign in to submit to the Community Showcase.');
      return;
    }
    if (!authUsername) {
      setSubmitError(
        'Set a username on your profile before submitting. Credit uses your account name.'
      );
      return;
    }
    setSubmitting(true);
    try {
      const title = (form.title || '').trim();
      await submitShowcasePost({
        contentType: form.contentType,
        title: form.title,
        description: form.description,
        youtubeUrl: form.youtubeUrl,
        url: form.url,
        imageUrl: form.imageUrl,
        thumbnailUrl: form.imageUrl,
        projectTag: form.projectTag,
        submitterEmail: form.submitterEmail,
      });
      setSubmittedMeta({
        title,
        signedIn: true,
      });
      setForm(emptyForm());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setSubmitError(err?.message || 'Could not submit. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const startAnother = () => {
    setSubmittedMeta(null);
    setSubmitError('');
    setForm(emptyForm());
  };

  return (
    <div className="min-h-screen bg-cyber-bg text-text-primary">
      <header className="relative pt-20 border-b border-cyber-border bg-cyber-surface/80">
        <div className="container-custom py-10 sm:py-12 max-w-3xl">
          <Link
            to="/showcase"
            className="inline-flex items-center gap-1.5 text-xs font-mono tracking-widest text-neon-cyan hover:text-white mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Community Showcase
          </Link>
          <div className="section-header">Community</div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-3">
            {submittedMeta ? 'Submission received' : 'Submit content'}
          </h1>
          <p className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-2xl">
            {submittedMeta
              ? 'Your post is in the moderation queue. Nothing is public until a moderator approves it.'
              : 'Share a community video, stream, art piece, or article about Together Forge. Posts go to a private queue first. Moderators approve before anything is public.'}
          </p>
        </div>
      </header>

      <div className="container-custom py-12 md:py-16 max-w-3xl">
        {authLoading ? (
          <LoadingScreen />
        ) : !authUser ? (
          <Card className="p-6 sm:p-10 border-neon-cyan/30 text-center space-y-4">
            <h2 className="text-xl font-bold text-white">Sign in required</h2>
            <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
              You need an account to submit content to the Community Showcase.
              Create a free profile, then come back to this page.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link to="/profile">
                <Button size="lg" className="w-full sm:w-auto">
                  Log in / Join
                </Button>
              </Link>
              <Link to="/showcase">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  Back to Showcase
                </Button>
              </Link>
            </div>
          </Card>
        ) : submittedMeta ? (
          <Card className="p-6 sm:p-10 border-neon-cyan/35 text-center">
            <div
              className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-neon-cyan/40 bg-neon-cyan/10"
              aria-hidden
            >
              <CheckCircle2 className="w-9 h-9 text-neon-cyan" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              Thanks for your submission
            </h2>
            <p className="text-sm sm:text-base text-text-secondary max-w-lg mx-auto leading-relaxed mb-6">
              We received your showcase submission
              {submittedMeta.title ? (
                <>
                  {' '}
                  <span className="text-white font-semibold">
                    “{submittedMeta.title}”
                  </span>
                </>
              ) : null}
              . Moderators will review it before it appears on the Showcase.
              That can take a few days.
            </p>

            <div className="rounded-xl border border-cyber-border bg-cyber-surface/50 px-4 py-3 text-left text-sm text-text-secondary max-w-md mx-auto mb-8 space-y-1.5">
              <p>
                <span className="font-mono text-[10px] tracking-widest uppercase text-text-muted">
                  Status
                </span>
                <br />
                <span className="text-forge-gold font-semibold">
                  Pending review
                </span>
              </p>
              <p className="text-xs text-text-muted pt-1">
                Track pending / approved / rejected on your Dashboard under
                Showcase submissions.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center">
              <Link to="/showcase">
                <Button size="lg" className="w-full sm:w-auto gap-2">
                  Back to Showcase
                </Button>
              </Link>
              {submittedMeta.signedIn && (
                <Link to="/dashboard#showcase-submissions">
                  <Button
                    type="button"
                    size="lg"
                    variant="secondary"
                    className="w-full sm:w-auto gap-2"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    My Dashboard
                  </Button>
                </Link>
              )}
              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="w-full sm:w-auto gap-2"
                onClick={startAnother}
              >
                <Plus className="w-4 h-4" />
                Submit another
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-5 sm:p-8 border-neon-purple/30">
            {submitError && (
              <div
                role="alert"
                className="mb-5 rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-100"
              >
                {submitError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelClass} htmlFor="sc-type">
                  Content type *
                </label>
                <select
                  id="sc-type"
                  className={fieldClass}
                  value={form.contentType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contentType: e.target.value }))
                  }
                  required
                >
                  {SHOWCASE_CONTENT_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="sc-title">
                  Title *
                </label>
                <input
                  id="sc-title"
                  className={fieldClass}
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  required
                  maxLength={160}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="sc-desc">
                  Short description
                </label>
                <textarea
                  id="sc-desc"
                  className={`${fieldClass} min-h-[4.5rem]`}
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  maxLength={500}
                />
              </div>
              {(form.contentType === 'video' ||
                form.contentType === 'stream') && (
                <div>
                  <label className={labelClass} htmlFor="sc-yt">
                    YouTube URL *
                  </label>
                  <input
                    id="sc-yt"
                    type="url"
                    className={fieldClass}
                    value={form.youtubeUrl}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, youtubeUrl: e.target.value }))
                    }
                    placeholder="https://www.youtube.com/watch?v=…"
                  />
                </div>
              )}
              {(form.contentType === 'art' ||
                form.contentType === 'article') && (
                <div>
                  <label className={labelClass} htmlFor="sc-url">
                    {form.contentType === 'art'
                      ? 'Image or portfolio link *'
                      : 'Article / post link *'}
                  </label>
                  <input
                    id="sc-url"
                    type="url"
                    className={fieldClass}
                    value={form.url}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, url: e.target.value }))
                    }
                    placeholder="https://…"
                  />
                </div>
              )}
              {form.contentType === 'art' && (
                <div>
                  <label className={labelClass} htmlFor="sc-img">
                    Direct image URL (optional, for thumbnail)
                  </label>
                  <input
                    id="sc-img"
                    type="url"
                    className={fieldClass}
                    value={form.imageUrl}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, imageUrl: e.target.value }))
                    }
                    placeholder="https://…/image.webp"
                  />
                </div>
              )}
              <div>
                <label className={labelClass} htmlFor="sc-project">
                  Related project (optional)
                </label>
                <select
                  id="sc-project"
                  className={fieldClass}
                  value={form.projectTag}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, projectTag: e.target.value }))
                  }
                >
                  <option value="">None (general community)</option>
                  {officialProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-text-muted leading-relaxed">
                  Only official Together Forge projects are listed. New names
                  cannot be invented here.
                </p>
              </div>
              <div>
                <label className={labelClass} htmlFor="sc-email">
                  Email for updates (optional)
                </label>
                <input
                  id="sc-email"
                  type="email"
                  className={fieldClass}
                  value={form.submitterEmail}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      submitterEmail: e.target.value,
                    }))
                  }
                  placeholder="If you want moderation feedback"
                />
              </div>
              <div
                role="note"
                className="rounded-xl border-2 border-forge-gold/45 bg-forge-gold/10 px-4 py-3.5 text-sm sm:text-base text-text-secondary leading-relaxed"
              >
                <p className="font-semibold text-forge-gold text-xs font-mono tracking-widest uppercase mb-1.5">
                  Before you submit
                </p>
                <p>
                  By submitting you confirm you have rights to share this content
                  and that it relates to Together Forge. Moderators will review
                  your content before it is posted. It may take a few days.
                </p>
                <p className="mt-2 text-xs sm:text-sm">
                  Track status on{' '}
                  <Link
                    to="/dashboard#showcase-submissions"
                    className="text-neon-cyan hover:underline"
                  >
                    My Dashboard
                  </Link>
                  .
                </p>
              </div>
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-1">
                <Button
                  type="submit"
                  size="lg"
                  className="gap-2"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit for review
                    </>
                  )}
                </Button>
                <Link to="/showcase">
                  <Button type="button" size="lg" variant="secondary">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ShowcaseSubmit;
