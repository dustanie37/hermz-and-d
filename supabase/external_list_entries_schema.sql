-- ── external_list_entries ────────────────────────────────────────────────────
-- Stores every entry on every external curated list, independent of whether
-- the film exists in our films table. film_id is a nullable FK — NULL means
-- the film has not yet been added to our database. When a film is later added,
-- update film_id to link it and the UI will automatically populate.
--
-- list_name values (match keys in MoviesLists.jsx LISTS config):
--   'afi_top100'       AFI Top 100 (2007 edition)
--   'afi_comedies'     AFI 100 Greatest Comedies (2000)
--   'imdb_top250'      IMDB Top 250 (snapshot — date in notes column)
--   'nyt_2000s'        NYT Best Films of 2000s
--   'sight_sound'      Sight & Sound Greatest Films Poll 2022
--   'variety_comedies' Variety 100 Greatest Comedies
--   'nfr'              National Film Registry (Library of Congress)

CREATE TABLE public.external_list_entries (
  id        SERIAL  PRIMARY KEY,
  list_name TEXT    NOT NULL,
  rank      INTEGER,                  -- NULL for unranked lists (nfr)
  title     TEXT    NOT NULL,         -- canonical title as it appears on the list
  year      INTEGER,                  -- release year (for disambiguation)
  imdb_id   TEXT,                     -- IMDb ID e.g. 'tt0111161' — used for future auto-linking
  film_id   INTEGER REFERENCES public.films(id) ON DELETE SET NULL,  -- NULL = not yet in our DB
  notes     TEXT                      -- e.g. IMDB snapshot date, list edition notes
);

-- Unique rank per list (partial — NULLs are allowed for unranked lists)
CREATE UNIQUE INDEX idx_ele_list_rank
  ON public.external_list_entries (list_name, rank)
  WHERE rank IS NOT NULL;

-- Unique imdb_id per list (partial — only when imdb_id is known)
CREATE UNIQUE INDEX idx_ele_list_imdb
  ON public.external_list_entries (list_name, imdb_id)
  WHERE imdb_id IS NOT NULL;

CREATE INDEX idx_ele_list_name ON public.external_list_entries (list_name);
CREATE INDEX idx_ele_film_id   ON public.external_list_entries (film_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.external_list_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read"
  ON public.external_list_entries FOR SELECT USING (true);

CREATE POLICY "Auth write"
  ON public.external_list_entries FOR ALL
  USING (auth.role() = 'authenticated');
