-- fix_rls_all_tables.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Enables Row-Level Security on all public-schema tables that were missing it.
-- Triggered by Supabase security alert: rls_disabled_in_public.
--
-- Policy design for this private two-person app:
--   • All data is publicly readable (the site is publicly accessible at Vercel)
--   • Writes (INSERT / UPDATE / DELETE) require authentication
--   • Some tables are effectively read-only from the UI (ranking_events, etc.)
--     but we still enable RLS to clear the Supabase warning.
--
-- Tables already secured (skip):
--   profiles          — RLS enabled in schema.sql
--   oscar_guesses     — RLS enabled in schema.sql (further updated by fix_rls_for_edit.sql)
--   film_oscar_noms   — RLS enabled in film_oscar_noms_schema.sql
--
-- Tables secured by THIS script:
--   oscar_years, oscar_categories, oscar_nominees
--   films, ranking_events, individual_rankings, combined_rankings
--
-- Run this in the Supabase SQL Editor (project: fpbjpefcrxdgwhautswl).
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS guards).
-- ─────────────────────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════════════════════
-- OSCAR TRACKER TABLES
-- ══════════════════════════════════════════════════════════════════════════════

-- ── oscar_years ───────────────────────────────────────────────────────────────
ALTER TABLE public.oscar_years ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on oscar_years"          ON public.oscar_years;
DROP POLICY IF EXISTS "Allow authenticated write on oscar_years"  ON public.oscar_years;

CREATE POLICY "Allow public read on oscar_years"
  ON public.oscar_years FOR SELECT USING (true);

CREATE POLICY "Allow authenticated write on oscar_years"
  ON public.oscar_years FOR ALL TO authenticated
  USING (true) WITH CHECK (true);


-- ── oscar_categories ──────────────────────────────────────────────────────────
ALTER TABLE public.oscar_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on oscar_categories"         ON public.oscar_categories;
DROP POLICY IF EXISTS "Allow authenticated write on oscar_categories" ON public.oscar_categories;

CREATE POLICY "Allow public read on oscar_categories"
  ON public.oscar_categories FOR SELECT USING (true);

CREATE POLICY "Allow authenticated write on oscar_categories"
  ON public.oscar_categories FOR ALL TO authenticated
  USING (true) WITH CHECK (true);


-- ── oscar_nominees ────────────────────────────────────────────────────────────
ALTER TABLE public.oscar_nominees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on oscar_nominees"         ON public.oscar_nominees;
DROP POLICY IF EXISTS "Allow authenticated write on oscar_nominees" ON public.oscar_nominees;

CREATE POLICY "Allow public read on oscar_nominees"
  ON public.oscar_nominees FOR SELECT USING (true);

CREATE POLICY "Allow authenticated write on oscar_nominees"
  ON public.oscar_nominees FOR ALL TO authenticated
  USING (true) WITH CHECK (true);


-- ══════════════════════════════════════════════════════════════════════════════
-- MOVIES RANKING TABLES
-- ══════════════════════════════════════════════════════════════════════════════

-- ── films ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.films ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on films"         ON public.films;
DROP POLICY IF EXISTS "Allow authenticated write on films" ON public.films;

CREATE POLICY "Allow public read on films"
  ON public.films FOR SELECT USING (true);

CREATE POLICY "Allow authenticated write on films"
  ON public.films FOR ALL TO authenticated
  USING (true) WITH CHECK (true);


-- ── ranking_events ────────────────────────────────────────────────────────────
ALTER TABLE public.ranking_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on ranking_events"         ON public.ranking_events;
DROP POLICY IF EXISTS "Allow authenticated write on ranking_events" ON public.ranking_events;

CREATE POLICY "Allow public read on ranking_events"
  ON public.ranking_events FOR SELECT USING (true);

CREATE POLICY "Allow authenticated write on ranking_events"
  ON public.ranking_events FOR ALL TO authenticated
  USING (true) WITH CHECK (true);


-- ── individual_rankings ───────────────────────────────────────────────────────
ALTER TABLE public.individual_rankings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on individual_rankings"         ON public.individual_rankings;
DROP POLICY IF EXISTS "Allow authenticated write on individual_rankings" ON public.individual_rankings;

CREATE POLICY "Allow public read on individual_rankings"
  ON public.individual_rankings FOR SELECT USING (true);

CREATE POLICY "Allow authenticated write on individual_rankings"
  ON public.individual_rankings FOR ALL TO authenticated
  USING (true) WITH CHECK (true);


-- ── combined_rankings ─────────────────────────────────────────────────────────
ALTER TABLE public.combined_rankings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on combined_rankings"         ON public.combined_rankings;
DROP POLICY IF EXISTS "Allow authenticated write on combined_rankings" ON public.combined_rankings;

CREATE POLICY "Allow public read on combined_rankings"
  ON public.combined_rankings FOR SELECT USING (true);

CREATE POLICY "Allow authenticated write on combined_rankings"
  ON public.combined_rankings FOR ALL TO authenticated
  USING (true) WITH CHECK (true);


-- ══════════════════════════════════════════════════════════════════════════════
-- VERIFY
-- Run this query after applying to confirm all tables have RLS enabled:
-- ══════════════════════════════════════════════════════════════════════════════
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
--
-- All rows should show rowsecurity = true.
--
-- To review all active policies:
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
