-- ── Migrate external list data from films columns → external_list_entries ────
--
-- Run AFTER external_list_entries_schema.sql.
-- This populates the new table with all films already in our database that
-- have list data. Entries for films not yet in our DB must be added separately
-- (import SQL per list, using title/year/imdb_id, with film_id left NULL).
--
-- After running, the old columns on films can remain as a read cache or be
-- dropped — they are no longer the source of truth for the lists page.

-- AFI Top 100
INSERT INTO public.external_list_entries (list_name, rank, title, year, imdb_id, film_id)
SELECT 'afi_top100', afi_top100_rank, title, release_year, omdb_id, id
FROM public.films
WHERE afi_top100_rank IS NOT NULL
ON CONFLICT DO NOTHING;

-- AFI 100 Greatest Comedies
INSERT INTO public.external_list_entries (list_name, rank, title, year, imdb_id, film_id)
SELECT 'afi_comedies', afi_comedies_rank, title, release_year, omdb_id, id
FROM public.films
WHERE afi_comedies_rank IS NOT NULL
ON CONFLICT DO NOTHING;

-- IMDB Top 250
INSERT INTO public.external_list_entries (list_name, rank, title, year, imdb_id, film_id)
SELECT 'imdb_top250', imdb_top250_rank, title, release_year, omdb_id, id
FROM public.films
WHERE imdb_top250_rank IS NOT NULL
ON CONFLICT DO NOTHING;

-- NYT Best of 2000s
INSERT INTO public.external_list_entries (list_name, rank, title, year, imdb_id, film_id)
SELECT 'nyt_2000s', nyt_2000s_rank, title, release_year, omdb_id, id
FROM public.films
WHERE nyt_2000s_rank IS NOT NULL
ON CONFLICT DO NOTHING;

-- Sight & Sound 2022
INSERT INTO public.external_list_entries (list_name, rank, title, year, imdb_id, film_id)
SELECT 'sight_sound', sight_sound_2022_rank, title, release_year, omdb_id, id
FROM public.films
WHERE sight_sound_2022_rank IS NOT NULL
ON CONFLICT DO NOTHING;

-- Variety Comedies
INSERT INTO public.external_list_entries (list_name, rank, title, year, imdb_id, film_id)
SELECT 'variety_comedies', variety_comedies_rank, title, release_year, omdb_id, id
FROM public.films
WHERE variety_comedies_rank IS NOT NULL
ON CONFLICT DO NOTHING;

-- National Film Registry (unranked — rank is NULL)
INSERT INTO public.external_list_entries (list_name, rank, title, year, imdb_id, film_id)
SELECT 'nfr', NULL, title, release_year, omdb_id, id
FROM public.films
WHERE national_film_registry = true
ON CONFLICT DO NOTHING;

-- ── Verification queries ──────────────────────────────────────────────────────
-- Run these after the inserts to confirm counts look right:
--
-- SELECT list_name, COUNT(*) FROM external_list_entries GROUP BY list_name ORDER BY list_name;
-- SELECT list_name, COUNT(*) FILTER (WHERE film_id IS NULL) AS missing_from_db,
--        COUNT(*) FILTER (WHERE film_id IS NOT NULL) AS in_db
-- FROM external_list_entries GROUP BY list_name ORDER BY list_name;
