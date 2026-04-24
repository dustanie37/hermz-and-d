-- ── film_oscar_noms — fix unique indexes for acting double-nominations ────────
-- The previous film_oscar_noms_unique_unnamed index enforces uniqueness on
-- (film_id, ceremony_year, category_name) when nominee_name IS NULL.
-- This blocks inserting both a win row AND a nomination row for the same
-- acting category (e.g. Amadeus Best Actor: Abraham won + Hulce nominated).
-- Fix: split into two partial indexes — one for wins, one for nominations —
-- so both can coexist when nominee_name is NULL.

-- Drop the blocking index
DROP INDEX IF EXISTS film_oscar_noms_unique_unnamed;

-- Also drop the original unique constraint if it still exists
ALTER TABLE public.film_oscar_noms
  DROP CONSTRAINT IF EXISTS film_oscar_noms_film_id_ceremony_year_category_name_key;

-- New: one win row allowed per (film, year, category) with no nominee name
CREATE UNIQUE INDEX IF NOT EXISTS film_oscar_noms_unique_unnamed_win
  ON public.film_oscar_noms (film_id, ceremony_year, category_name)
  WHERE nominee_name IS NULL AND is_winner = TRUE;

-- New: one nomination row allowed per (film, year, category) with no nominee name
CREATE UNIQUE INDEX IF NOT EXISTS film_oscar_noms_unique_unnamed_nom
  ON public.film_oscar_noms (film_id, ceremony_year, category_name)
  WHERE nominee_name IS NULL AND is_winner = FALSE;
