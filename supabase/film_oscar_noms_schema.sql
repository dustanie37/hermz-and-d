-- ── Phase 8.5: film_oscar_noms table ─────────────────────────────────────────
-- Run this in the Supabase SQL Editor BEFORE running oscar_noms_fetch.py
-- and BEFORE running oscar_noms_update.sql
--
-- Purpose: stores per-category Oscar nomination/win data for every film
--          in the films table, sourced from Wikidata SPARQL API.
--
-- The existing boolean columns on films (won_best_picture, won_best_director,
-- etc.) are kept as-is for backward compatibility and fast lookups.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.film_oscar_noms (
  id             SERIAL PRIMARY KEY,
  film_id        INTEGER NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  ceremony_year  INTEGER,              -- e.g. 1942 for Citizen Kane's 14th Academy Awards
  category_name  TEXT NOT NULL,        -- normalized: "Best Picture", "Best Cinematography", etc.
  is_winner      BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (film_id, ceremony_year, category_name)
);

-- 2. Index for fast per-film lookups
CREATE INDEX IF NOT EXISTS idx_film_oscar_noms_film
  ON public.film_oscar_noms (film_id);

-- 3. Enable Row-Level Security
ALTER TABLE public.film_oscar_noms ENABLE ROW LEVEL SECURITY;

-- 4. Allow anyone (anonymous + authenticated) to read
CREATE POLICY "Allow public read on film_oscar_noms"
  ON public.film_oscar_noms
  FOR SELECT
  USING (true);

-- 5. Allow authenticated users to insert/update/delete
--    (needed when running oscar_noms_update.sql via the SQL editor)
--    The SQL editor runs as the postgres superuser so this isn't
--    strictly needed, but it's good practice.
CREATE POLICY "Allow authenticated write on film_oscar_noms"
  ON public.film_oscar_noms
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
