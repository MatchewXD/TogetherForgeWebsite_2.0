# Copilot Instructions

## Project Guidelines
- Supabase schema snapshot: public tables — ideas, votes, comments, donations, profiles, username_history. profiles columns: id (uuid PK -> auth.users), username, email, joined_at, avatar_url, about, bio, interests, favorite_games, favorite_game_types. Stored for workspace context.
- Supabase schema migration pending: run ALTER TABLE statements to add bio, interests, favorite_games, favorite_game_types columns to profiles. Error 'bio column not found' indicates columns not applied to live DB yet. Confidence: 0.8
- Updated local supabase_schema.sql to include profile fields; added ALTER TABLE statements for migration.