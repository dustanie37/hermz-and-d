-- ── Watchlist Table ───────────────────────────────────────────────────────────
-- Per-user private list of films under consideration for the next ranking event.
-- Films not yet in the `films` table are stored with film_id = NULL.
-- Films already in `films` are linked via film_id for easy display.

CREATE TABLE IF NOT EXISTS watchlist (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text        NOT NULL,
  year       text,
  poster_url text,
  imdb_id    text,
  film_id    integer     REFERENCES films(id) ON DELETE SET NULL,
  added_at   timestamptz NOT NULL DEFAULT now()
);

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS watchlist_user_id_idx ON watchlist(user_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

-- Users can only read their own entries
CREATE POLICY "watchlist_select_own"
  ON watchlist FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own entries
CREATE POLICY "watchlist_insert_own"
  ON watchlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own entries
CREATE POLICY "watchlist_delete_own"
  ON watchlist FOR DELETE
  USING (auth.uid() = user_id);
