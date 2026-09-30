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
  ImagePlus,
  X,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Buttons';
import LoadingScreen from '../components/ui/LoadingScreen';
import { supabase } from '../lib/supabase';
import {
  submitShowcasePost,
  uploadShowcaseImage,
  SHOWCASE_CONTENT_TYPES,
  SHOWCASE_IMAGE_MAX_BYTES,
  SHOWCASE_IMAGE_TYPES,
} from '../services/showcaseService';
import { loadRelatedProjectOptions } from '../utils/relatedToOptions';
import { pingUserNotices } from '../utils/userNotices';

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
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

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

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

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
    const imageLink = (form.url || '').trim();
    if (form.contentType === 'art' && !imageFile && !imageLink) {
      setSubmitError('Please upload an image or share a link.');
      return;
    }
    setSubmitting(true);
    try {
      const title = (form.title || '').trim();
      let uploadedUrl = null;
      if (form.contentType === 'art' && imageFile) {
        uploadedUrl = await uploadShowcaseImage(imageFile, authUser.id);
      }
      const artImageUrl = uploadedUrl || imageLink || null;
      await submitShowcasePost({
        contentType: form.contentType,
        title: form.title,
        description: form.description,
        youtubeUrl: form.contentType === 'video' ? form.youtubeUrl : '',
        url:
          form.contentType === 'art'
            ? imageLink || uploadedUrl
            : form.url,
        imageUrl: form.contentType === 'art' ? artImageUrl : form.imageUrl,
        thumbnailUrl: form.contentType === 'art' ? artImageUrl : form.imageUrl,
        projectTag: form.projectTag,
        submitterEmail: form.submitterEmail,
      });
      setSubmittedMeta({
        title,
        signedIn: true,
      });
      pingUserNotices();
      setForm(emptyForm());
      setImageFile(null);
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
    setImageFile(null);
  };

  const artMissingMedia =
    form.contentType === 'art' &&
    !imageFile &&
    !(form.url || '').trim();
  const artMediaHint = 'Please upload an image or share a link';

  const onArtImagePick = (e) => {
    const next = e.target.files?.[0] || null;
    e.target.value = '';
    if (!next) {
      setImageFile(null);
      return;
    }
    if (!SHOWCASE_IMAGE_TYPES.includes(next.type)) {
      setSubmitError('Image must be JPEG, PNG, WebP, or GIF.');
      setImageFile(null);
      return;
    }
    if (next.size > SHOWCASE_IMAGE_MAX_BYTES) {
      setSubmitError('Image must be under 5MB.');
      setImageFile(null);
      return;
    }
    setSubmitError('');
    setImageFile(next);
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
          <h1 className="section-header dashboard-page-title !mb-4 !text-3xl sm:!text-4xl !font-bold !tracking-tight !normal-case">
            {submittedMeta ? 'Submission received' : 'Submit content'}
          </h1>
          {!submittedMeta && (
            <p className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-2xl">
              Community made videos, streams, clips, art and posts related to
              Together Forge.
            </p>
          )}
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
            <p className="text-sm sm:text-base text-text-secondary max-w-lg mx-auto leading-relaxed mb-8">
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
                  onChange={(e) => {
                    const contentType = e.target.value;
                    setForm((f) => ({ ...f, contentType }));
                    if (contentType !== 'art') setImageFile(null);
                  }}
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
              {form.contentType === 'video' && (
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
                    required
                  />
                </div>
              )}
              {form.contentType === 'stream' && (
                <div>
                  <label className={labelClass} htmlFor="sc-stream-url">
                    URL *
                  </label>
                  <input
                    id="sc-stream-url"
                    type="url"
                    className={fieldClass}
                    value={form.url}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, url: e.target.value }))
                    }
                    placeholder="https://…"
                    required
                  />
                </div>
              )}
              {form.contentType === 'article' && (
                <div>
                  <label className={labelClass} htmlFor="sc-url">
                    Article / post link *
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
                    required
                  />
                </div>
              )}
              {form.contentType === 'art' && (
                <>
                  <div>
                    <p className={labelClass}>Image</p>
                    <p className="text-xs text-text-muted mb-3 leading-relaxed">
                      JPEG, PNG, WebP, or GIF · max 5MB. Upload a file or share
                      an image link below.
                    </p>
                    {imagePreview ? (
                      <div className="mb-3 relative rounded-xl overflow-hidden border border-cyber-border bg-cyber-surface max-w-md">
                        <img
                          src={imagePreview}
                          alt="Art preview"
                          className="w-full max-h-56 object-contain bg-cyber-bg/50"
                        />
                        <button
                          type="button"
                          onClick={() => setImageFile(null)}
                          className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-lg border border-cyber-border bg-cyber-bg/90 px-2 py-1 text-xs text-text-secondary hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>
                    ) : null}
                    <label
                      htmlFor="sc-art-file"
                      className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-cyber-border bg-cyber-surface px-4 py-2.5 text-sm font-semibold text-text-secondary hover:border-neon-cyan hover:text-neon-cyan transition-colors"
                    >
                      <ImagePlus className="w-4 h-4" aria-hidden />
                      {imageFile ? 'Replace image' : 'Choose image'}
                      <input
                        id="sc-art-file"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        onChange={onArtImagePick}
                      />
                    </label>
                    {imageFile && (
                      <span className="ml-3 text-xs text-neon-cyan align-middle">
                        {imageFile.name}
                      </span>
                    )}
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="sc-url">
                      Image link
                    </label>
                    <input
                      id="sc-url"
                      type="url"
                      className={fieldClass}
                      value={form.url}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, url: e.target.value }))
                      }
                      placeholder="https://…/image.webp"
                    />
                  </div>
                </>
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
                {artMissingMedia ? (
                  <span
                    className="group/art-submit relative inline-flex cursor-not-allowed"
                    tabIndex={0}
                    aria-label={artMediaHint}
                  >
                    <span className="pointer-events-none">
                      <Button
                        type="button"
                        size="lg"
                        className="gap-2 !opacity-40 !bg-cyber-surface !border-cyber-border !text-text-muted !shadow-none"
                        disabled
                        aria-disabled="true"
                      >
                        <Send className="w-4 h-4" />
                        Submit for review
                      </Button>
                    </span>
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute left-0 bottom-full z-20 mb-2 hidden w-max max-w-xs rounded-lg border border-cyber-border bg-cyber-card px-3 py-1.5 text-xs text-text-primary shadow-lg group-hover/art-submit:block group-focus-within/art-submit:block"
                    >
                      {artMediaHint}
                    </span>
                  </span>
                ) : (
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
                )}
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
