/**
 * Project workspace: ideas scoped to this project.
 * Presentational: all state and handlers live in ProjectWorkspace and arrive as props.
 */

import Button from '../../components/ui/Buttons';
import { Lightbulb, Loader2, Sparkles } from 'lucide-react';
import Card from '../../components/ui/Card';
import IdeaCard from '../../components/ui/IdeaCard';
import { canonicalProjectSlug } from '../../utils/ideaStatus';
import { IDEA_CATEGORIES } from './shared';

export default function ProjectIdeasSection({
  displayProject,
  handleVoteIdea,
  ideaCategoryFilter,
  ideaFilterOpen,
  ideaSearch,
  ideasError,
  ideasLoading,
  ideaSortMode,
  openIdeaDetail,
  projectIdeas,
  projectSlug,
  projectSubmitPath,
  setIdeaCategoryFilter,
  setIdeaFilterOpen,
  setIdeaSearch,
  setIdeaSortMode,
  sortedIdeas,
  toggleIdeaCategory,
  userIdeaVotes,
  voteKey,
}) {
  return (
    <section id="project-ideas" aria-labelledby="project-ideas-heading">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
        <div className="max-w-2xl">
          <div className="section-header">Project Ideas</div>
          <h2
            id="project-ideas-heading"
            className="text-2xl font-bold text-white"
          >
            Ideas for {displayProject.title}
          </h2>
          <p className="text-text-secondary text-sm mt-2 leading-relaxed">
            Only ideas linked to this project. Vote, discuss, and help shape
            what we build next.
          </p>
        </div>

        <Button
          className="gap-2 self-start lg:self-auto shrink-0"
          to={projectSubmitPath}
        >
          <Lightbulb className="w-4 h-4" />
          Submit Idea for this Project
        </Button>
      </div>

      {/* Sort / filter bar (aligned with main Ideas page) */}
      <div className="mb-5 flex flex-col sm:flex-row gap-3 max-w-4xl">
        <input
          type="search"
          placeholder="Search project ideas..."
          value={ideaSearch}
          onChange={(e) => setIdeaSearch(e.target.value)}
          className="bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 w-full sm:max-w-xs text-text-primary placeholder:text-text-muted focus:border-neon-cyan outline-none text-sm"
        />
        <select
          value={ideaSortMode}
          onChange={(e) => setIdeaSortMode(e.target.value)}
          className="bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 text-text-primary focus:border-neon-cyan outline-none text-sm"
        >
          <option value="newest">Newest</option>
          <option value="votes">Most Voted</option>
          <option value="title">Title A–Z</option>
        </select>

        <div className="relative">
          <button
            type="button"
            onClick={() => setIdeaFilterOpen((o) => !o)}
            className="w-full sm:w-auto bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 text-text-primary text-sm flex items-center gap-2 hover:border-neon-cyan transition-colors"
          >
            Filter by Category
            {ideaCategoryFilter.length > 0 && (
              <span className="text-xs bg-neon-cyan text-cyber-bg px-2 py-0.5 rounded-full font-mono">
                {ideaCategoryFilter.length}
              </span>
            )}
          </button>
          {ideaFilterOpen && (
            <div className="absolute mt-2 w-72 max-w-[calc(100vw-2rem)] bg-cyber-surface border border-cyber-border rounded-lg p-4 z-50 shadow-lg">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-text-muted">Categories</span>
                <button
                  type="button"
                  onClick={() => setIdeaCategoryFilter([])}
                  className="text-xs text-neon-cyan hover:underline"
                >
                  Clear all
                </button>
              </div>
              <div className="task-scroll max-h-60 overflow-auto space-y-1">
                {IDEA_CATEGORIES.map((cat) => (
                  <label
                    key={cat}
                    className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white/5 p-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={ideaCategoryFilter.includes(cat)}
                      onChange={() => toggleIdeaCategory(cat)}
                      className="accent-cyan-400"
                    />
                    <span className="text-text-secondary">{cat}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {ideasError && (
        <div
          role="alert"
          className="mb-4 max-w-4xl rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-100/90"
        >
          {ideasError}
        </div>
      )}

      <div>
        {ideasLoading ? (
          <div className="flex items-center gap-2 py-10 text-text-secondary text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-neon-cyan" />
            Loading project ideas…
          </div>
        ) : sortedIdeas.length === 0 ? (
          <Card className="bg-cyber-card/80 border-neon-cyan/20 max-w-4xl">
            <p className="text-sm text-text-secondary leading-relaxed">
              {projectIdeas.length === 0
                ? 'No ideas linked to this project yet. Be the first - submit an idea and it will land here for the team.'
                : 'No ideas match your search or filters. Clear filters to see everything for this project.'}
            </p>
            <Button
              className="gap-2 mt-4"
              size="sm"
              to={projectSubmitPath}
            >
              <Lightbulb className="w-4 h-4" />
              Submit Idea for this Project
            </Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {sortedIdeas.map((idea) => {
            const key = voteKey(idea.id);
            const voted =
              userIdeaVotes.has(key) ||
              userIdeaVotes.has(idea.id) ||
              userIdeaVotes.has(Number(idea.id));
            // Ideas on this workspace are linked to this project
            const projectLabel =
              displayProject.title ||
              displayProject.slug ||
              projectSlug ||
              'This project';
            const projectKey =
              displayProject.slug || projectSlug || idea.project_id;

            return (
              <div key={idea.id} className="min-w-0">
                <IdeaCard
                  idea={{
                    ...idea,
                    // Ensure Linked status + project key for chip
                    project_id: idea.project_id || projectKey,
                  }}
                  voted={voted}
                  isOwn={false}
                  onVote={(e, ideaRow) => handleVoteIdea(e, ideaRow.id)}
                  onOpen={openIdeaDetail}
                  projectName={projectLabel}
                  projectHref={
                    projectKey
                      ? `/projects/${canonicalProjectSlug(projectKey) || projectKey}`
                      : null
                  }
                  commentCount={idea.commentCount || 0}
                  showTags
                />
              </div>
            );
            })}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <Button
          variant="outline"
          className="gap-2"
          to={projectSubmitPath}
        >
          <Sparkles className="w-4 h-4" />
          Submit Idea for this Project
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          to={`/ideas?project=${displayProject.slug || displayProject.id}`}
        >
          View all ideas
        </Button>
        {!ideasLoading && projectIdeas.length > 0 && (
          <span className="text-xs font-mono text-text-muted">
            {sortedIdeas.length} of {projectIdeas.length} shown
          </span>
        )}
      </div>
    </section>
  );
}
