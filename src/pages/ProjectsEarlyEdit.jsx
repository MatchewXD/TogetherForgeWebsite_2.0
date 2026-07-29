/**
 * Staff editor for Early Phase page content.
 * Pattern is reusable for Mid/Late (swap phase key + defaults).
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import { useIsModerator } from '../hooks/useIsModerator';
import { phasePageService } from '../services/phasePageService';
import {
  EARLY_PHASE_DEFAULTS,
  contentToEditForm,
  editFormToContent,
} from '../utils/phasePageContent';
import Button from '../components/ui/Buttons';
import Card from '../components/ui/Card';

const PHASE = 'early';
const DEFAULTS = EARLY_PHASE_DEFAULTS;

const fieldClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors';

const labelClass =
  'block text-sm font-mono tracking-widest text-neon-cyan mb-2';

const ProjectsEarlyEdit = () => {
  const { isModerator, loading: roleLoading } = useIsModerator();
  const navigate = useNavigate();
  const [form, setForm] = useState(() => contentToEditForm(DEFAULTS));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const content = await phasePageService.getPageContent(PHASE);
        if (mounted) setForm(contentToEditForm(content));
      } catch (err) {
        console.warn('[ProjectsEarlyEdit] load', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const updateField = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const content = editFormToContent(form, DEFAULTS);
      await phasePageService.savePageContent(PHASE, content);
      navigate('/projects/early');
    } catch (err) {
      console.error('[ProjectsEarlyEdit] save', err);
      setMessage(
        err?.message ||
          'Failed to save. Confirm page_content table exists and you have staff permission.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (roleLoading) {
    return (
      <div className="pt-20 min-h-screen bg-cyber-bg text-text-secondary p-8 font-mono text-sm tracking-widest">
        Checking permissions…
      </div>
    );
  }

  if (!isModerator) {
    return (
      <div className="pt-20 min-h-screen bg-cyber-bg">
        <div className="container-custom py-12 max-w-lg">
          <Card className="p-8 text-center space-y-4">
            <p className="text-text-secondary">
              Access denied. Staff role (moderator, admin, or project lead)
              required.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div className="container-custom py-12 max-w-3xl">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <div className="section-header">STAFF EDIT</div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Early Phase content
            </h1>
            <p className="text-sm text-text-secondary mt-2 max-w-lg">
              Update public copy on the Early Phase hub. Layout stays the same;
              only the text changes. Mid and Late can reuse this same editor
              pattern.
            </p>
          </div>
          <Button
            type="button"
            className="gap-2 shrink-0"
            disabled={saving || loading}
            onClick={save}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>

        {message && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-100"
          >
            {message}
          </div>
        )}

        {loading ? (
          <Card className="p-6 text-text-muted font-mono text-sm">Loading…</Card>
        ) : (
          <div className="space-y-6">
            <Card className="p-5 sm:p-6 space-y-4">
              <h2 className="section-header mb-0">Hero</h2>
              <div>
                <label className={labelClass}>Page title</label>
                <input
                  className={fieldClass}
                  value={form.heroTitle}
                  onChange={(e) => updateField('heroTitle', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Series label</label>
                <input
                  className={fieldClass}
                  value={form.heroSeriesLabel}
                  onChange={(e) =>
                    updateField('heroSeriesLabel', e.target.value)
                  }
                />
              </div>
              <div>
                <label className={labelClass}>Intro body</label>
                <textarea
                  className={`${fieldClass} min-h-[6rem]`}
                  value={form.heroBody}
                  onChange={(e) => updateField('heroBody', e.target.value)}
                />
              </div>
            </Card>

            <Card className="p-5 sm:p-6 space-y-4">
              <h2 className="section-header mb-0">Early Game Goals</h2>
              <div>
                <label className={labelClass}>Goals intro line</label>
                <input
                  className={fieldClass}
                  value={form.goalsIntro}
                  onChange={(e) => updateField('goalsIntro', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Goals (one item per line — plain text, no markdown or HTML)
                </label>
                <textarea
                  className={`${fieldClass} min-h-[10rem] font-mono text-sm`}
                  value={form.goals}
                  onChange={(e) => updateField('goals', e.target.value)}
                />
                <p className="text-xs text-text-muted mt-1.5">
                  Do not use *, **, or HTML tags. Formatting is applied by the
                  page layout automatically.
                </p>
              </div>
              <div>
                <label className={labelClass}>Success metric</label>
                <textarea
                  className={`${fieldClass} min-h-[4rem]`}
                  value={form.successMetric}
                  onChange={(e) => updateField('successMetric', e.target.value)}
                />
              </div>
            </Card>

            <Card className="p-5 sm:p-6 space-y-4">
              <h2 className="section-header mb-0">Active project card</h2>
              <div>
                <label className={labelClass}>Title</label>
                <input
                  className={fieldClass}
                  value={form.activeProjectTitle}
                  onChange={(e) =>
                    updateField('activeProjectTitle', e.target.value)
                  }
                />
              </div>
              <div>
                <label className={labelClass}>Status label</label>
                <input
                  className={fieldClass}
                  value={form.activeProjectStatus}
                  onChange={(e) =>
                    updateField('activeProjectStatus', e.target.value)
                  }
                />
              </div>
              <div>
                <label className={labelClass}>Summary</label>
                <textarea
                  className={`${fieldClass} min-h-[6rem]`}
                  value={form.activeProjectSummary}
                  onChange={(e) =>
                    updateField('activeProjectSummary', e.target.value)
                  }
                />
              </div>
              <div>
                <label className={labelClass}>Workspace link path</label>
                <input
                  className={fieldClass}
                  value={form.activeProjectHref}
                  onChange={(e) =>
                    updateField('activeProjectHref', e.target.value)
                  }
                  placeholder="/projects/prototype-systems"
                />
              </div>
              <div>
                <label className={labelClass}>Game overviews note</label>
                <textarea
                  className={`${fieldClass} min-h-[4rem]`}
                  value={form.gameOverviewsNote}
                  onChange={(e) =>
                    updateField('gameOverviewsNote', e.target.value)
                  }
                />
              </div>
            </Card>

            <Card className="p-5 sm:p-6 space-y-4">
              <h2 className="section-header mb-0">Target style</h2>
              <div>
                <label className={labelClass}>Intro</label>
                <textarea
                  className={`${fieldClass} min-h-[4rem]`}
                  value={form.targetIntro}
                  onChange={(e) => updateField('targetIntro', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Examples (one item per line — plain text only)
                </label>
                <textarea
                  className={`${fieldClass} min-h-[10rem] font-mono text-sm`}
                  value={form.targetExamples}
                  onChange={(e) =>
                    updateField('targetExamples', e.target.value)
                  }
                />
              </div>
            </Card>

            <Card className="p-5 sm:p-6 space-y-4">
              <h2 className="section-header mb-0">About Early Game</h2>
              <div>
                <label className={labelClass}>
                  About text (blank line between paragraphs)
                </label>
                <textarea
                  className={`${fieldClass} min-h-[8rem]`}
                  value={form.aboutText}
                  onChange={(e) => updateField('aboutText', e.target.value)}
                />
              </div>
            </Card>

            <Card className="p-5 sm:p-6 space-y-4">
              <h2 className="section-header mb-0">How to Help</h2>
              <div>
                <label className={labelClass}>
                  Help items (one per line — plain text only)
                </label>
                <textarea
                  className={`${fieldClass} min-h-[10rem] font-mono text-sm`}
                  value={form.howToHelp}
                  onChange={(e) => updateField('howToHelp', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Footer note</label>
                <textarea
                  className={`${fieldClass} min-h-[3rem]`}
                  value={form.howToHelpNote}
                  onChange={(e) => updateField('howToHelpNote', e.target.value)}
                />
              </div>
            </Card>

            <div className="flex flex-wrap gap-3 justify-end">
              <Link to="/projects/early">
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </Link>
              <Button
                type="button"
                className="gap-2"
                disabled={saving}
                onClick={save}
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectsEarlyEdit;
