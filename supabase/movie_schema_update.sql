-- ============================================================
-- Hermz & D — Movies Schema Update (run before movie_import.sql)
-- Adds custom genre columns to the films table.
-- Run in Supabase SQL Editor AFTER schema.sql, BEFORE movie_import.sql
-- ============================================================

-- Add custom genre columns from spreadsheet taxonomy
ALTER TABLE public.films
  ADD COLUMN IF NOT EXISTS custom_genre_1 TEXT,
  ADD COLUMN IF NOT EXISTS custom_genre_2 TEXT;

-- The existing omdb_genres column will hold comma-separated genres
-- from OMDB once Phase 5 OMDB fetching runs.
-- custom_genre_1 / custom_genre_2 hold the genres from the spreadsheet
-- taxonomy (Drama, Dramedy, Shakespeare, Comedy, etc.)
