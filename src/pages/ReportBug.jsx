/**
 * Public bug report form — no login required (login encouraged).
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bug,
  ImagePlus,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import bugReportsService, {
  BUG_SEVERITIES,
  BROWSER_OS_OPTIONS,
  detectBrowserOsOption,
} from '../services/bugReportsService';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Buttons';

const fieldLabel =
  'block text-sm font-mono tracking-widest text-neon-cyan mb-2';
const fieldControl =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors';

const ReportBug = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [severity, setSeverity] = useState('Medium');
  const [browserInfo, setBrowserInfo] = useState('');
  const [deviceInfo, setDeviceInfo] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submittedId, setSubmittedId] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user || null;
      setUser(u);
      if (u?.email) setReporterEmail(u.email);
    });
    setBrowserInfo(detectBrowserOsOption());
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setScreenshot(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setScreenshot(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const bug = await bugReportsService.submitBug(
        {
          title,
          description,
          stepsToReproduce: steps,
          severity,
          browserInfo,
          deviceInfo,
          reporterName,
          reporterEmail,
        },
        screenshot
      );
      setSubmittedId(bug.id);
    } catch (err) {
      setError(err.message || 'Could not submit bug report.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div className="border-b border-white/10 bg-cyber-surface py-12 md:py-16">
        <div className="container-custom">
          <Link
            to="/bugs"
            className="flex w-fit items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />
            BACK TO BUG TRACKER
          </Link>
          <div className="section-header !block mb-3">Bugs</div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
            Report a Bug
          </h1>
          <p className="text-text-secondary mt-3 max-w-2xl text-sm sm:text-base">
            Help us keep the forge stable. Anyone can report — signing in links
            the report to your account.
          </p>
        </div>
      </div>

      <div className="container-custom py-10 max-w-2xl space-y-6">
        {!user && (
          <Card className="bg-cyber-card/80 border-neon-cyan/20 py-4 px-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-text-secondary">
              Optional but helpful:{' '}
              <span className="text-white">sign in</span> so we can follow up.
            </p>
            <Link
              to="/profile"
              className="text-xs font-mono tracking-widest text-neon-cyan hover:underline shrink-0"
            >
              LOG IN / JOIN
            </Link>
          </Card>
        )}

        {submittedId ? (
          <Card className="bg-cyber-card/80 text-center py-12 space-y-4">
            <CheckCircle2 className="w-12 h-12 text-neon-cyan mx-auto" />
            <h2 className="text-xl font-bold text-white">Report received</h2>
            <p className="text-sm text-text-secondary max-w-md mx-auto">
              Thanks for filing this. Staff will triage it on the public
              tracker. Status starts as{' '}
              <Badge variant="default">Reported</Badge>.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button onClick={() => navigate('/bugs')}>View bug tracker</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setSubmittedId(null);
                  setTitle('');
                  setDescription('');
                  setSteps('');
                  setSeverity('Medium');
                  setScreenshot(null);
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                }}
              >
                Report another
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="bg-cyber-card/80">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex items-center gap-2 text-neon-cyan mb-2">
                <Bug className="w-5 h-5" />
                <span className="font-mono text-xs tracking-widest">
                  NEW REPORT
                </span>
              </div>

              <div>
                <label className={fieldLabel} htmlFor="bug-title">
                  TITLE *
                </label>
                <input
                  id="bug-title"
                  required
                  maxLength={120}
                  className={fieldControl}
                  placeholder="Short summary of the issue"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label className={fieldLabel} htmlFor="bug-desc">
                  DESCRIPTION *
                </label>
                <textarea
                  id="bug-desc"
                  required
                  rows={5}
                  maxLength={4000}
                  className={fieldControl}
                  placeholder="What went wrong? What did you expect?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div>
                <label className={fieldLabel} htmlFor="bug-steps">
                  STEPS TO REPRODUCE
                </label>
                <textarea
                  id="bug-steps"
                  rows={4}
                  maxLength={4000}
                  className={fieldControl}
                  placeholder={'1. Go to…\n2. Click…\n3. See error…'}
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                />
              </div>

              <div>
                <label className={fieldLabel} htmlFor="bug-severity">
                  SEVERITY *
                </label>
                <select
                  id="bug-severity"
                  className={fieldControl}
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                >
                  {BUG_SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-text-muted mt-1.5">
                  Critical = site unusable or data loss. Low = cosmetic.
                </p>
              </div>

              <div>
                <label className={fieldLabel}>SCREENSHOT (optional)</label>
                <label className="flex flex-col items-center justify-center gap-2 border border-dashed border-white/20 rounded-lg p-6 cursor-pointer hover:border-neon-cyan/50 transition-colors">
                  <ImagePlus className="w-8 h-8 text-neon-cyan opacity-80" />
                  <span className="text-xs font-mono text-text-muted">
                    JPEG, PNG, WebP, or GIF · max 5MB
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={onFile}
                  />
                  {screenshot && (
                    <span className="text-xs text-neon-cyan">{screenshot.name}</span>
                  )}
                </label>
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Screenshot preview"
                    className="mt-3 max-h-48 rounded-lg border border-cyber-border object-contain mx-auto"
                  />
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={fieldLabel} htmlFor="bug-browser">
                    BROWSER / OS (optional)
                  </label>
                  <select
                    id="bug-browser"
                    className={fieldControl}
                    value={browserInfo}
                    onChange={(e) => setBrowserInfo(e.target.value)}
                  >
                    <option value="">Select browser / OS…</option>
                    {BROWSER_OS_OPTIONS.filter(Boolean).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={fieldLabel} htmlFor="bug-device">
                    DEVICE (optional)
                  </label>
                  <select
                    id="bug-device"
                    className={fieldControl}
                    value={deviceInfo}
                    onChange={(e) => setDeviceInfo(e.target.value)}
                  >
                    <option value="">Select device…</option>
                    <option value="Desktop / laptop">Desktop / laptop</option>
                    <option value="Tablet">Tablet</option>
                    <option value="Phone">Phone</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {!user && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={fieldLabel} htmlFor="bug-name">
                      YOUR NAME (optional)
                    </label>
                    <input
                      id="bug-name"
                      className={fieldControl}
                      value={reporterName}
                      onChange={(e) => setReporterName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={fieldLabel} htmlFor="bug-email">
                      EMAIL (optional)
                    </label>
                    <input
                      id="bug-email"
                      type="email"
                      className={fieldControl}
                      value={reporterEmail}
                      onChange={(e) => setReporterEmail(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-400/30 bg-red-400/5 px-3 py-2 text-sm text-red-200"
                >
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full gap-2 py-4"
                disabled={busy}
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  'SUBMIT BUG REPORT'
                )}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ReportBug;
