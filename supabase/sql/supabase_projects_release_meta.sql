-- =============================================================================
-- Projects: optional release catalog metadata for /released/:slug
-- Run after supabase_projects_completion.sql
-- Safe to re-run
-- =============================================================================

-- Flexible JSON for Released Game Detail (platforms, genre, media, Steam reviews, story)
-- Shape example:
-- {
--   "tagline": "One sentence hook",
--   "platforms": ["PC", "Web"],
--   "genre": ["Co-op", "Puzzle"],
--   "cover_image": "/images/releases/tether-cover.webp",
--   "media": [
--     { "url": "/images/releases/tether-1.webp", "alt": "Gameplay", "caption": "" }
--   ],
--   "steam_reviews": {
--     "recent":  { "label": "Overwhelmingly Positive", "percent": 97 },
--     "overall": { "label": "Very Positive", "percent": 94, "count": 8512 },
--     "url": "https://store.steampowered.com/app/…"
--   },
--   "development_story": "How we made it…",
--   "origin_idea_ids": [12]
-- }
alter table if exists projects
  add column if not exists release_meta jsonb default '{}'::jsonb;

comment on column projects.release_meta is
  'Optional Released Games detail: tagline, platforms, genre, media[], steam_reviews {recent, overall, url}, development_story, cover_image, origin_idea_ids';
