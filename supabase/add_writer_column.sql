-- ============================================================
-- Hermz & D — Add writer column to films table
-- Run this in the Supabase SQL Editor BEFORE omdb_writer_update.sql
-- ============================================================

ALTER TABLE public.films
  ADD COLUMN IF NOT EXISTS writer TEXT;

-- No index needed — this is a display-only field, not queried
