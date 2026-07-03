-- Fix: phantom Oscar nomination rows in film_oscar_noms (run 2026-07-03 — ALREADY APPLIED)
--
-- Bug: Wikidata film pages often carry BOTH a "nominated for" (P1411) and an
-- "award received" (P166) statement for the same win. The backfill dedup kept
-- win + nom rows separately for acting categories (intended for true two-nominee
-- cases like Amadeus), so every unnamed acting WIN also produced a phantom extra
-- NOMINATION row. 30 phantom rows existed across 27 films, verified one by one
-- against actual Oscar history and the spreadsheet totals in films.oscar_nominations.
--
-- Legitimate two-nominee films excluded from deletion (win + nom are different people):
--   id 10  Amadeus                (Best Actor: Abraham won, Hulce nominated)
--   id 121 Bullets Over Broadway  (Supporting Actress: Wiest won, Tilly nominated)
--   id 167 Chicago                (Supporting Actress: Zeta-Jones won, Latifah nominated)
--
-- Also deletes 8 duplicate rows with NULL ceremony_year where a real-year row for
-- the same film + category already exists (the real-year row's is_winner flag was
-- verified correct in every case, including Star Trek: First Contact and The
-- Poseidon Adventure where the NULL row wrongly claimed a win).
--
-- Root cause fixed in code the same day:
--   src/pages/movies/MoviesOscarBackfill.jsx  (processRows)
--   supabase/oscar_noms_fetch.py              (process_rows)
-- Unnamed acting rows now collapse win-over-nom; only NAMED acting rows may keep
-- a win and a nomination side by side.

-- 1. Phantom unnamed acting nominations that duplicate an unnamed win (30 rows)
DELETE FROM film_oscar_noms n
WHERE NOT n.is_winner AND n.nominee_name IS NULL
  AND n.category_name IN ('Best Actor','Best Actress','Best Supporting Actor','Best Supporting Actress')
  AND n.film_id NOT IN (10, 121, 167)
  AND EXISTS (
    SELECT 1 FROM film_oscar_noms w
    WHERE w.film_id = n.film_id AND w.category_name = n.category_name
      AND COALESCE(w.ceremony_year, -1) = COALESCE(n.ceremony_year, -1)
      AND w.is_winner AND w.nominee_name IS NULL);

-- 2. NULL-ceremony-year duplicates of real-year rows (8 rows)
DELETE FROM film_oscar_noms a
WHERE a.ceremony_year IS NULL
  AND EXISTS (
    SELECT 1 FROM film_oscar_noms b
    WHERE b.film_id = a.film_id AND b.category_name = a.category_name
      AND b.ceremony_year IS NOT NULL);

-- Verification (spreadsheet totals vs category rows):
-- before: 90 matched / 66 mismatched / 14 zero-row (of 170 films with recorded noms)
-- after: 104 matched / 52 mismatched / 14 zero-row
-- Remaining mismatches are Wikidata UNDER-counts (missing rows) — see updates.md audit list.
