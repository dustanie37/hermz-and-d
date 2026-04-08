-- Fix: 2013 Best Sound Mixing nominees were missing from the original import.
-- 85th Academy Awards (February 24, 2013) — Best Sound Mixing
-- Run this once in the Supabase SQL editor.

INSERT INTO public.oscar_nominees (year_id, category_id, nominee_name, is_winner, display_order)
SELECT
  (SELECT id FROM public.oscar_years WHERE year = 2013),
  (SELECT id FROM public.oscar_categories WHERE name = 'Best Sound Mixing'),
  'Argo',
  TRUE,
  1;

INSERT INTO public.oscar_nominees (year_id, category_id, nominee_name, is_winner, display_order)
SELECT
  (SELECT id FROM public.oscar_years WHERE year = 2013),
  (SELECT id FROM public.oscar_categories WHERE name = 'Best Sound Mixing'),
  'Les Miserables',
  FALSE,
  2;

INSERT INTO public.oscar_nominees (year_id, category_id, nominee_name, is_winner, display_order)
SELECT
  (SELECT id FROM public.oscar_years WHERE year = 2013),
  (SELECT id FROM public.oscar_categories WHERE name = 'Best Sound Mixing'),
  'Life of Pi',
  FALSE,
  3;

INSERT INTO public.oscar_nominees (year_id, category_id, nominee_name, is_winner, display_order)
SELECT
  (SELECT id FROM public.oscar_years WHERE year = 2013),
  (SELECT id FROM public.oscar_categories WHERE name = 'Best Sound Mixing'),
  'Lincoln',
  FALSE,
  4;

INSERT INTO public.oscar_nominees (year_id, category_id, nominee_name, is_winner, display_order)
SELECT
  (SELECT id FROM public.oscar_years WHERE year = 2013),
  (SELECT id FROM public.oscar_categories WHERE name = 'Best Sound Mixing'),
  'Skyfall',
  FALSE,
  5;
