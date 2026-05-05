-- ── Oscars Status Migration ──────────────────────────────────────────────────
-- Adds a status column to oscar_years to distinguish upcoming vs complete
-- ceremonies. Also deletes the 2027 ceremony if it exists.
-- Run once in Supabase SQL Editor.

-- 1. Add status column
ALTER TABLE public.oscar_years
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'upcoming'
  CHECK (status IN ('upcoming', 'complete'));

-- 2. Mark all existing ceremonies as complete
UPDATE public.oscar_years SET status = 'complete';

-- 3. Drop and recreate the view to expose status
DROP VIEW IF EXISTS public.v_oscar_year_summary;

CREATE VIEW public.v_oscar_year_summary AS
SELECT
  oy.year,
  oy.ceremony_name,
  oy.winner,
  oy.tiebreaker_used,
  oy.status,
  SUM(CASE WHEN p.username = 'dustin' AND og.is_correct THEN 1 ELSE 0 END) AS dustin_correct,
  SUM(CASE WHEN p.username = 'matt'   AND og.is_correct THEN 1 ELSE 0 END) AS matt_correct,
  COUNT(DISTINCT og.category_id) AS total_categories
FROM public.oscar_years oy
LEFT JOIN public.oscar_guesses og ON og.year_id = oy.id
LEFT JOIN public.profiles p ON p.id = og.user_id
GROUP BY oy.id, oy.year, oy.ceremony_name, oy.winner, oy.tiebreaker_used, oy.status
ORDER BY oy.year;

-- 4. Delete 2027 ceremony if it exists (nominees and guesses first due to FK)
DELETE FROM public.oscar_guesses
  WHERE year_id IN (SELECT id FROM public.oscar_years WHERE year = 2027);

DELETE FROM public.oscar_nominees
  WHERE year_id IN (SELECT id FROM public.oscar_years WHERE year = 2027);

DELETE FROM public.oscar_years WHERE year = 2027;
