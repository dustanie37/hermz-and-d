-- ============================================================
-- Hermz & D — Extend actor columns from 5 to 10
-- Run in Supabase SQL Editor ONCE
-- ============================================================

ALTER TABLE public.films
  ADD COLUMN IF NOT EXISTS actor_6  TEXT,
  ADD COLUMN IF NOT EXISTS actor_7  TEXT,
  ADD COLUMN IF NOT EXISTS actor_8  TEXT,
  ADD COLUMN IF NOT EXISTS actor_9  TEXT,
  ADD COLUMN IF NOT EXISTS actor_10 TEXT;
