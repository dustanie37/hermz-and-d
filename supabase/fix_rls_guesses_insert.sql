-- fix_rls_guesses_insert.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Required for the OscarsNewYear wizard, which lets either authenticated user
-- enter nominees and guesses for BOTH players in a single session.
--
-- The original INSERT policy restricts guesses to the authenticated user's own
-- user_id. This fix replaces it with an authenticated-user policy (same pattern
-- as fix_rls_for_edit.sql which fixed the UPDATE policy).
--
-- Run this once in the Supabase SQL Editor (project: fpbjpefcrxdgwhautswl).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── oscar_guesses INSERT ──────────────────────────────────────────────────────

-- Drop the restrictive owner-only insert policy
DROP POLICY IF EXISTS "Users insert their own guesses" ON oscar_guesses;

-- Any authenticated user can insert a guess for any user_id
CREATE POLICY "Authenticated users can insert any guess"
  ON oscar_guesses
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

-- ── Verify ────────────────────────────────────────────────────────────────────
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'oscar_guesses'
-- ORDER BY policyname;
