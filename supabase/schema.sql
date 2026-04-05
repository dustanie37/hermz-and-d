-- =============================================================
-- HERMZ & D — Full Database Schema
-- Run this in the Supabase SQL editor to initialise the database
-- =============================================================

-- Enable UUID extension (already enabled in Supabase by default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- USERS (thin wrapper around Supabase auth.users)
-- =============================================================
CREATE TABLE public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   TEXT UNIQUE NOT NULL,       -- 'dustin' or 'matt'
  display_name TEXT NOT NULL,            -- 'Dustin' or 'Matt'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row-level security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile"      ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'username', NEW.raw_user_meta_data->>'display_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =============================================================
-- PART 1: OSCAR TRACKER
-- =============================================================

-- Oscar ceremony years
CREATE TABLE public.oscar_years (
  id                       SERIAL PRIMARY KEY,
  year                     INTEGER UNIQUE NOT NULL,
  ceremony_name            TEXT NOT NULL,      -- e.g. '98th Academy Awards'
  ceremony_date            DATE,
  actual_runtime           INTERVAL,           -- e.g. '03:44:00'
  dustin_runtime_guess     INTERVAL,
  matt_runtime_guess       INTERVAL,
  actual_monologue         INTERVAL,           -- secondary tiebreaker (2026+)
  dustin_monologue_guess   INTERVAL,
  matt_monologue_guess     INTERVAL,
  winner                   TEXT CHECK (winner IN ('dustin', 'matt', 'tied', 'pending')),
  tiebreaker_used          BOOLEAN DEFAULT FALSE,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Canonical Oscar categories (one row per category — handles lifecycle)
CREATE TABLE public.oscar_categories (
  id            SERIAL PRIMARY KEY,
  name          TEXT UNIQUE NOT NULL,   -- full official name e.g. 'Best Makeup and Hairstyling'
  display_order INTEGER NOT NULL,       -- order to show in UI
  active_from   INTEGER,               -- year first tracked (NULL = always)
  active_until  INTEGER                -- year last tracked (NULL = still active)
);

-- Seed all categories
INSERT INTO public.oscar_categories (name, display_order, active_from, active_until) VALUES
  ('Best Picture',                         1,    NULL, NULL),
  ('Best Director',                        2,    NULL, NULL),
  ('Best Actor',                           3,    NULL, NULL),
  ('Best Actress',                         4,    NULL, NULL),
  ('Best Supporting Actor',                5,    NULL, NULL),
  ('Best Supporting Actress',              6,    NULL, NULL),
  ('Best Original Screenplay',             7,    NULL, NULL),
  ('Best Adapted Screenplay',              8,    NULL, NULL),
  ('Best Animated Feature Film',           9,    NULL, NULL),
  ('Best International Feature Film',      10,   NULL, NULL),
  ('Best Production Design',               11,   NULL, NULL),
  ('Best Cinematography',                  12,   NULL, NULL),
  ('Best Costume Design',                  13,   NULL, NULL),
  ('Best Documentary Feature Film',        14,   NULL, NULL),
  ('Best Documentary Short Film',          15,   NULL, NULL),
  ('Best Film Editing',                    16,   NULL, NULL),
  ('Best Makeup and Hairstyling',          17,   NULL, NULL),
  ('Best Visual Effects',                  18,   NULL, NULL),
  ('Best Original Score',                  19,   NULL, NULL),
  ('Best Original Song',                   20,   NULL, NULL),
  ('Best Animated Short Film',             21,   NULL, NULL),
  ('Best Live Action Short Film',          22,   NULL, NULL),
  ('Best Sound Editing',                   23,   2008, 2020),  -- retired after 2020
  ('Best Sound Mixing',                    24,   2008, 2020),  -- retired after 2020
  ('Best Sound',                           25,   2021, NULL),  -- replaced Sound Editing + Mixing
  ('Best Casting',                         26,   2026, NULL);  -- new in 2026

-- Nominees per category per year (variable count: Best Picture 5–10, all others max 5)
CREATE TABLE public.oscar_nominees (
  id            SERIAL PRIMARY KEY,
  year_id       INTEGER NOT NULL REFERENCES public.oscar_years(id) ON DELETE CASCADE,
  category_id   INTEGER NOT NULL REFERENCES public.oscar_categories(id),
  nominee_name  TEXT NOT NULL,         -- film title or person name as displayed
  is_winner     BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0      -- order within the category
);
CREATE INDEX idx_oscar_nominees_year_cat ON public.oscar_nominees (year_id, category_id);

-- Guesses per person per category per year
CREATE TABLE public.oscar_guesses (
  id            SERIAL PRIMARY KEY,
  year_id       INTEGER NOT NULL REFERENCES public.oscar_years(id) ON DELETE CASCADE,
  category_id   INTEGER NOT NULL REFERENCES public.oscar_categories(id),
  user_id       UUID NOT NULL REFERENCES public.profiles(id),
  guess         TEXT NOT NULL,         -- nominee name guessed
  is_correct    BOOLEAN,               -- NULL until winner announced; then true/false
  locked        BOOLEAN DEFAULT FALSE, -- true once ceremony begins
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (year_id, category_id, user_id)
);
CREATE INDEX idx_oscar_guesses_year_user ON public.oscar_guesses (year_id, user_id);

-- RLS for guesses: users can always read all guesses; can only write their own
ALTER TABLE public.oscar_guesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All guesses are readable"        ON public.oscar_guesses FOR SELECT USING (true);
CREATE POLICY "Users insert their own guesses"  ON public.oscar_guesses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own guesses"  ON public.oscar_guesses FOR UPDATE USING (auth.uid() = user_id AND locked = FALSE);


-- =============================================================
-- PART 2: MOVIES RANKINGS
-- =============================================================

-- Master film table
CREATE TABLE public.films (
  id                    SERIAL PRIMARY KEY,
  title                 TEXT NOT NULL,
  release_year          INTEGER,
  director              TEXT,
  omdb_id               TEXT UNIQUE,           -- imdbID from OMDB e.g. 'tt0111161'
  poster_url            TEXT,
  -- OMDB genres (comma-separated as returned by OMDB)
  omdb_genres           TEXT,
  -- Top 5 actors from OMDB
  actor_1               TEXT,
  actor_2               TEXT,
  actor_3               TEXT,
  actor_4               TEXT,
  actor_5               TEXT,
  -- Acclaim (agreed score out of 10)
  acclaim_score         SMALLINT CHECK (acclaim_score BETWEEN 1 AND 10),
  -- Oscar data
  oscar_nominations     SMALLINT DEFAULT 0,
  oscar_wins            SMALLINT DEFAULT 0,
  won_best_picture      BOOLEAN DEFAULT FALSE,
  won_best_director     BOOLEAN DEFAULT FALSE,
  won_best_actor        BOOLEAN DEFAULT FALSE,
  won_best_actress      BOOLEAN DEFAULT FALSE,
  won_best_supp_actor   BOOLEAN DEFAULT FALSE,
  won_best_supp_actress BOOLEAN DEFAULT FALSE,
  won_screenplay        BOOLEAN DEFAULT FALSE,
  won_cinematography    BOOLEAN DEFAULT FALSE,
  won_production_design BOOLEAN DEFAULT FALSE,
  -- External list appearances (NULL = not on list; integer = rank on that list)
  afi_top100_rank       SMALLINT,
  afi_comedies_rank     SMALLINT,
  imdb_top250_rank      SMALLINT,
  nyt_2000s_rank        SMALLINT,
  sight_sound_2022_rank SMALLINT,
  variety_comedies_rank SMALLINT,
  national_film_registry BOOLEAN DEFAULT FALSE,
  omdb_fetched_at       TIMESTAMPTZ,           -- when OMDB data was last pulled
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_films_title ON public.films (title);
CREATE INDEX idx_films_omdb  ON public.films (omdb_id);

-- Ranking events (2001, 2007, 2016, 2026 — and future ones)
CREATE TABLE public.ranking_events (
  id         SERIAL PRIMARY KEY,
  year       INTEGER UNIQUE NOT NULL,
  label      TEXT NOT NULL             -- e.g. '2026 Rankings'
);

INSERT INTO public.ranking_events (year, label) VALUES
  (2001, '2001 Rankings'),
  (2007, '2007 Rankings'),
  (2016, '2016 Rankings'),
  (2026, '2026 Rankings');

-- Individual rankings: one row per film × event × person
-- Stores all category scores; NULL for categories not applicable to that year
CREATE TABLE public.individual_rankings (
  id                      SERIAL PRIMARY KEY,
  film_id                 INTEGER NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  event_id                INTEGER NOT NULL REFERENCES public.ranking_events(id),
  user_id                 UUID NOT NULL REFERENCES public.profiles(id),
  rank                    SMALLINT NOT NULL,
  total_score             SMALLINT,
  -- 2001-only categories
  score_plot              SMALLINT CHECK (score_plot BETWEEN 1 AND 10),        -- 2001 only
  score_dialogue          SMALLINT CHECK (score_dialogue BETWEEN 1 AND 10),    -- 2001 only
  -- 2007+ categories (NULL in 2001 rows)
  score_screenplay        SMALLINT CHECK (score_screenplay BETWEEN 1 AND 10),  -- 2007+
  score_production_design SMALLINT CHECK (score_production_design BETWEEN 1 AND 10), -- 2007+
  -- Always-present scoring categories
  score_lead_performance  SMALLINT CHECK (score_lead_performance BETWEEN 1 AND 10),
  score_supp_performance  SMALLINT CHECK (score_supp_performance BETWEEN 1 AND 10),
  score_direction         SMALLINT CHECK (score_direction BETWEEN 1 AND 10),
  score_cinematography    SMALLINT CHECK (score_cinematography BETWEEN 1 AND 10),
  score_influence         SMALLINT CHECK (score_influence BETWEEN 1 AND 10),
  score_acclaim           SMALLINT CHECK (score_acclaim BETWEEN 1 AND 10),
  score_personal_impact   SMALLINT CHECK (score_personal_impact BETWEEN 1 AND 20),
  -- Tiebreaker counts (derived but stored for performance)
  tb_tens                 SMALLINT,
  tb_nines                SMALLINT,
  tb_eights               SMALLINT,
  UNIQUE (film_id, event_id, user_id)
);
CREATE INDEX idx_individual_rankings_event_user ON public.individual_rankings (event_id, user_id);
CREATE INDEX idx_individual_rankings_film       ON public.individual_rankings (film_id);

-- Combined rankings: films appearing on BOTH personal lists for a given event
-- Tiebreaker order: avg_rank ASC → total_score DESC → total_tens DESC → total_impact DESC
CREATE TABLE public.combined_rankings (
  id             SERIAL PRIMARY KEY,
  film_id        INTEGER NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  event_id       INTEGER NOT NULL REFERENCES public.ranking_events(id),
  combined_rank  SMALLINT NOT NULL,
  dustin_rank    SMALLINT,
  matt_rank      SMALLINT,
  avg_rank       DECIMAL(6,2),
  dustin_score   SMALLINT,
  matt_score     SMALLINT,
  total_score    SMALLINT,
  dustin_impact  SMALLINT,
  matt_impact    SMALLINT,
  total_impact   SMALLINT,
  total_tens     SMALLINT,
  UNIQUE (film_id, event_id)
);
CREATE INDEX idx_combined_rankings_event ON public.combined_rankings (event_id, combined_rank);

-- Combined list sizes per event (for reference)
-- 2001: ~42  |  2007: 54  |  2016: 48  |  2026: 47


-- =============================================================
-- USEFUL VIEWS
-- =============================================================

-- Oscar yearly summary: total correct per person per year
CREATE OR REPLACE VIEW public.v_oscar_year_summary AS
SELECT
  oy.year,
  oy.ceremony_name,
  oy.winner,
  oy.tiebreaker_used,
  SUM(CASE WHEN p.username = 'dustin' AND og.is_correct THEN 1 ELSE 0 END) AS dustin_correct,
  SUM(CASE WHEN p.username = 'matt'   AND og.is_correct THEN 1 ELSE 0 END) AS matt_correct,
  COUNT(DISTINCT og.category_id) AS total_categories
FROM public.oscar_years oy
LEFT JOIN public.oscar_guesses og ON og.year_id = oy.id
LEFT JOIN public.profiles p ON p.id = og.user_id
GROUP BY oy.id, oy.year, oy.ceremony_name, oy.winner, oy.tiebreaker_used
ORDER BY oy.year;

-- Oscar category accuracy across all years per person
CREATE OR REPLACE VIEW public.v_category_accuracy AS
SELECT
  oc.name AS category,
  p.username,
  COUNT(*) FILTER (WHERE og.is_correct IS NOT NULL) AS years_played,
  COUNT(*) FILTER (WHERE og.is_correct = TRUE)       AS years_correct,
  ROUND(
    COUNT(*) FILTER (WHERE og.is_correct = TRUE)::DECIMAL /
    NULLIF(COUNT(*) FILTER (WHERE og.is_correct IS NOT NULL), 0) * 100, 1
  ) AS pct_correct
FROM public.oscar_guesses og
JOIN public.oscar_categories oc ON oc.id = og.category_id
JOIN public.profiles p ON p.id = og.user_id
GROUP BY oc.name, p.username
ORDER BY oc.name, p.username;

-- Film rank history across all events (both personal and combined)
CREATE OR REPLACE VIEW public.v_film_rank_history AS
SELECT
  f.id AS film_id,
  f.title,
  f.release_year,
  re.year AS event_year,
  ir.rank AS personal_rank,
  ir.total_score,
  p.username,
  cr.combined_rank,
  cr.avg_rank,
  cr.total_score AS combined_total_score
FROM public.films f
JOIN public.individual_rankings ir ON ir.film_id = f.id
JOIN public.ranking_events re      ON re.id = ir.event_id
JOIN public.profiles p             ON p.id = ir.user_id
LEFT JOIN public.combined_rankings cr ON cr.film_id = f.id AND cr.event_id = ir.event_id
ORDER BY f.title, re.year, p.username;
