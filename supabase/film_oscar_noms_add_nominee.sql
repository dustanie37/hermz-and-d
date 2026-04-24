-- ── film_oscar_noms — add nominee_name column ────────────────────────────────
-- Run in Supabase SQL Editor BEFORE re-running oscar_noms_fetch.py + update SQL.
--
-- Purpose: allows multiple nominations in the same category from the same film
-- (e.g. Amadeus: F. Murray Abraham AND Tom Hulce both nominated for Best Actor).
-- Previously collapsed to one row due to UNIQUE (film_id, ceremony_year, category_name).

-- 1. Add the nominee_name column (NULL = non-acting category or unknown nominee)
ALTER TABLE public.film_oscar_noms
  ADD COLUMN IF NOT EXISTS nominee_name TEXT;

-- 2. Drop the old unique constraint
ALTER TABLE public.film_oscar_noms
  DROP CONSTRAINT IF EXISTS film_oscar_noms_film_id_ceremony_year_category_name_key;

-- 3a. New partial unique index — rows WITH a named nominee
--     Allows two actors in the same category (different nominee_name values).
CREATE UNIQUE INDEX IF NOT EXISTS film_oscar_noms_unique_named
  ON public.film_oscar_noms (film_id, ceremony_year, category_name, nominee_name)
  WHERE nominee_name IS NOT NULL;

-- 3b. New partial unique index — rows WITHOUT a nominee name (technical/craft categories)
--     Still prevents duplicates for categories where nominee_name is NULL.
CREATE UNIQUE INDEX IF NOT EXISTS film_oscar_noms_unique_unnamed
  ON public.film_oscar_noms (film_id, ceremony_year, category_name)
  WHERE nominee_name IS NULL;

-- Verify:
-- SELECT count(*) FROM film_oscar_noms;                     -- row count unchanged
-- \d film_oscar_noms                                         -- confirm new column + indexes
