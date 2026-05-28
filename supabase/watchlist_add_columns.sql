-- ── Watchlist Enhancement: list_type + notes ──────────────────────────────────
-- Run this in Supabase SQL Editor to enable the three-list + notes feature.
--
-- list_type values:
--   'unseen'     — haven't seen it yet, want to watch
--   'first_time' — saw it for the first time, considering for future ranking
--   'rewatch'    — rewatched, keeping notes for ranking

-- 1. Add list_type column; existing rows default to 'unseen'
ALTER TABLE watchlist
  ADD COLUMN IF NOT EXISTS list_type TEXT NOT NULL DEFAULT 'unseen';

-- 2. Add notes column (used on first_time and rewatch entries)
ALTER TABLE watchlist
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. Allow users to update their own entries (required for note editing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'watchlist' AND policyname = 'watchlist_update_own'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "watchlist_update_own"
        ON watchlist FOR UPDATE
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    $policy$;
  END IF;
END $$;
