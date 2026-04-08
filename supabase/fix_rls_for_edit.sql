-- fix_rls_for_edit.sql
-- Allows any authenticated user to update oscar_guesses and oscar_nominees.
-- Required for the OscarsYear edit mode, where either player can correct
-- data entry errors or enter a new year's results post-ceremony.
--
-- Background: the existing oscar_guesses UPDATE policy restricts updates to
-- the row owner only (auth.uid() = user_id AND locked = FALSE). This prevents
-- either player from correcting the other's data. Since this is a private
-- two-person app we replace it with an authenticated-user policy.
--
-- Run this in the Supabase SQL Editor.

-- ── oscar_guesses ─────────────────────────────────────────────────────────────

-- Drop the restrictive owner-only update policy
DROP POLICY IF EXISTS "Users can update own unlocked guesses" ON oscar_guesses;

-- Add a new policy: any authenticated user can update any guess
CREATE POLICY "Authenticated users can update any guess"
  ON oscar_guesses
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── oscar_nominees ────────────────────────────────────────────────────────────
-- oscar_nominees typically has no RLS (or an open read policy).
-- If updates are blocked, enable RLS and add the policy below.
-- Uncomment if you see "permission denied" errors when toggling nominee winners.

-- ALTER TABLE oscar_nominees ENABLE ROW LEVEL SECURITY;

-- DROP POLICY IF EXISTS "Authenticated users can update nominees" ON oscar_nominees;

-- CREATE POLICY "Authenticated users can update nominees"
--   ON oscar_nominees
--   FOR UPDATE
--   USING (auth.role() = 'authenticated')
--   WITH CHECK (auth.role() = 'authenticated');

-- ── Verify ────────────────────────────────────────────────────────────────────
-- After running, you can check active policies with:
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('oscar_guesses', 'oscar_nominees')
-- ORDER BY tablename, policyname;
