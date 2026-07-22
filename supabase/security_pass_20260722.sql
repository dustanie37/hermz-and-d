-- ===============================================================
-- SECURITY PASS 2026-07-22 -- applied to production, recorded here
-- ===============================================================
-- Trigger: Supabase advisor flagged CRITICAL rls_disabled_in_public.
-- Result: zero ERROR-level advisor findings remain.
--
-- Applied as three migrations:
--   security_pass_archive_orphaned_tables
--   security_pass_views_and_function_grants
--   security_pass_move_pg_trgm_to_extensions
-- ===============================================================

-- ---- 1. archive schema: quarantine for tables that must survive but must
--         not be reachable through the API (not in PostgREST's exposed list).
CREATE SCHEMA IF NOT EXISTS archive;
REVOKE ALL ON SCHEMA archive FROM anon, authenticated, public;

-- July 12 cleanup backups: created without RLS, so the anon key could read
-- AND delete them. The guesses copy was a full duplicate of both players'
-- picks with none of the Phase 13 privacy policies -- a bypass of ballot
-- secrecy.
ALTER TABLE public.oscar_nominees_backup_20260712 SET SCHEMA archive;
ALTER TABLE public.oscar_guesses_backup_20260712  SET SCHEMA archive;

-- Remnants of an unrelated deployment; verified unused (no repo refs, FKs,
-- views, functions, or realtime). theatre_companies had `anon full access`.
DROP POLICY IF EXISTS "anon full access" ON public.theatre_companies;
ALTER TABLE public.theatre_companies SET SCHEMA archive;
ALTER TABLE public.theatre_history   SET SCHEMA archive;

ALTER TABLE archive.oscar_nominees_backup_20260712 ENABLE ROW LEVEL SECURITY;
ALTER TABLE archive.oscar_guesses_backup_20260712  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA archive FROM anon, authenticated, public;

-- RULE: any *_backup_* table is created in `archive`, never `public`.
-- Restore is: ALTER TABLE archive.X SET SCHEMA public;  (then re-add policies)

-- ---- 2. SECURITY DEFINER views bypassed RLS on oscar_guesses.
DROP VIEW IF EXISTS public.v_category_accuracy;   -- unused by the app
DROP VIEW IF EXISTS public.v_film_rank_history;   -- unused by the app
ALTER VIEW public.v_oscar_year_summary SET (security_invoker = on);

-- ---- 3. Pin search_path so a caller cannot shadow what these resolve.
ALTER FUNCTION public.handle_new_user()          SET search_path = public, pg_temp;
ALTER FUNCTION public.oscar_year_open(integer)   SET search_path = public, pg_temp;

-- ---- 4. Dead code with anon EXECUTE (see retired_oscar_reveal_pick_20260722.sql)
DROP FUNCTION IF EXISTS public.oscar_reveal_pick(integer, integer, uuid);

-- ---- 5. Ceremony RPCs are only reached from <Protected> routes.
--         Revoke from PUBLIC first -- anon inherits PUBLIC grants.
REVOKE EXECUTE ON FUNCTION public.ceremony_picks(integer)  FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.ceremony_reveal(integer) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.ceremony_picks(integer)  TO authenticated;
GRANT  EXECUTE ON FUNCTION public.ceremony_reveal(integer) TO authenticated;

-- ---- 6. handle_new_user is an auth.users trigger, never an API endpoint.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

-- ---- 7. pg_trgm out of the API schema (no trgm indexes, no app usage).
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- ---- Deliberately NOT changed -------------------------------------------
-- The `rls_policy_always_true` warnings on films / oscar_* / ranking_events /
-- individual_rankings etc. are the intended "public read, authenticated
-- write" model. The database has exactly two accounts, both trusted owners.
-- Tightening these is a product decision (who may edit what), not a fix.
