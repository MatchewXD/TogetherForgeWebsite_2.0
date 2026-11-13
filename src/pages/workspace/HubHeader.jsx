/**
 * Project workspace: project hub header and overview cards.
 * Presentational: all state and handlers live in ProjectWorkspace and arrive as props.
 */

import { phaseImageSrc, phaseImageAlt } from '../../utils/phaseImages';
import BannerImage from '../../components/ui/BannerImage';
import Button from '../../components/ui/Buttons';
import {
  LayoutGrid,
  Github,
  Sparkles,
  Users,
  CheckCircle2,
  Hammer,
} from 'lucide-react';
import DiscordLink from '../../components/ui/DiscordLink';
import StatWidget from '../../components/ui/StatWidget';
import UserAvatar from '../../components/ui/UserAvatar';
import UserNameWithBadge from '../../components/badges/UserNameWithBadge';

export default function HubHeader({
  boardPath,
  displayProject,
  projectGithubUrl,
  projectPath,
  projectSubmitPath,
  pulse,
}) {
  return (
    <>
      {/* 1. PROJECT HEADER (hub) */}
      <header className="space-y-4">
        {phaseImageSrc(displayProject.phase) && (
          <div className="relative w-full h-40 sm:h-52 md:h-56 rounded-xl overflow-hidden border border-cyber-border bg-cyber-surface">
            <BannerImage
              src={phaseImageSrc(displayProject.phase)}
              alt={phaseImageAlt(
                displayProject.phase,
                displayProject.title
              )}
              className="absolute inset-0 w-full h-full object-cover"
              loading="eager"
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-cyber-bg via-cyber-bg/40 to-transparent pointer-events-none"
              aria-hidden="true"
            />
          </div>
        )}

        <div className="space-y-5">
          <div className="max-w-4xl">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
              {displayProject.title}
            </h1>
            <p className="mt-4 text-text-secondary text-base sm:text-lg leading-relaxed">
              {displayProject.description}
            </p>
            <p className="mt-2 text-xs font-mono text-text-muted tracking-widest">
              ID // {displayProject.slug || displayProject.id}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              className="gap-2"
              to={boardPath}
            >
              <LayoutGrid className="w-4 h-4" />
              Task Board
            </Button>
            {projectGithubUrl ? (
              <a
                href={projectGithubUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 px-5 py-2.5 text-base font-semibold text-neon-cyan hover:bg-neon-cyan/20 transition-colors"
              >
                <Github className="w-4 h-4" />
                View on GitHub
              </a>
            ) : null}
            <Button
              variant="secondary"
              className="gap-2"
              to={projectSubmitPath}
            >
              <Sparkles className="w-4 h-4" />
              Submit Idea
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              to={`${projectPath}/contributors`}
            >
              <Users className="w-4 h-4" />
              Contributors
            </Button>
          </div>
        </div>
        <div className="max-w-xl">
          <DiscordLink
            variant="note"
            labelKey="chat"
            note="Coordinate claims, ask questions, or discuss scope with the community."
          />
        </div>
      </header>

      {/* 2. PROJECT PULSE */}
      <section aria-label="Project activity stats">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatWidget
            label="Contributors"
            value={pulse.contributors ?? pulse.activePeople ?? 0}
            icon={<Users className="w-7 h-7 text-neon-cyan mx-auto" />}
          />
          <StatWidget
            label="Tasks Completed"
            value={pulse.tasksCompleted ?? 0}
            icon={
              <CheckCircle2 className="w-7 h-7 text-neon-cyan mx-auto" />
            }
          />
          <StatWidget
            label="Open Tasks"
            value={pulse.openTasks ?? 0}
            icon={
              <Hammer className="w-7 h-7 text-semantic-achievement mx-auto" />
            }
          />
        </div>

        {pulse.activeWorkers?.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-xs font-mono tracking-widest text-text-muted uppercase">
              On the forge now
            </span>
            <div className="flex flex-wrap gap-2">
              {pulse.activeWorkers.map((w) => (
                <div
                  key={w.userId}
                  className="inline-flex items-center gap-2 rounded-full border border-neon-cyan/30 bg-cyber-surface/80 pl-1 pr-3 py-1"
                  title={w.username}
                >
                  <UserAvatar
                    src={w.avatarUrl || w.avatar_url}
                    name={w.username}
                    username={w.username}
                    initials={w.initials}
                    size="sm"
                  />
                  <UserNameWithBadge
                    username={w.username}
                    displayName={w.username}
                    pinnedBadgeKey={
                      w.pinnedBadgeKey || w.pinned_badge_key || null
                    }
                    linkClassName="text-sm text-text-primary"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
