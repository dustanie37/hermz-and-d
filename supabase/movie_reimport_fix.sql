-- ============================================================
-- Hermz & D — Movie Data Re-Import Fix
-- Run this in Supabase SQL Editor to clear the bad import
-- (which had 385 films with duplicates and float titles)
-- and prepare for a clean re-import.
--
-- Steps:
--   1. Run THIS file first (clears movies data)
--   2. Then run movie_import.sql (clean 318-film import)
-- ============================================================

BEGIN;

-- Clear all movies data (cascade handles dependent rows automatically)
TRUNCATE public.combined_rankings   RESTART IDENTITY CASCADE;
TRUNCATE public.individual_rankings RESTART IDENTITY CASCADE;
TRUNCATE public.films               RESTART IDENTITY CASCADE;

COMMIT;

-- After running this, run movie_import.sql
