#!/usr/bin/env python3
"""
Hermz & D — OMDB Batch Fetch Script
=====================================
Queries OMDB for every film in the films table and generates omdb_update.sql
with UPDATE statements to fill in omdb_id, poster_url, omdb_genres, and actors.

Prerequisites:
    1. movie_import.sql has been run in Supabase (films table populated)
    2. pip install requests --break-system-packages

Usage:
    python3 omdb_fetch.py

Output:
    omdb_update.sql       — UPDATE statements for omdb_id, poster, genres, actors
    omdb_no_match.txt     — Films that OMDB didn't find (manual review needed)

Notes:
    - Respects OMDB's free tier limit (1,000 requests/day) by sleeping between calls
    - Results are cached in omdb_cache.json; re-runs skip already-fetched films
    - Tries title + year first; falls back to title-only on miss
    - Manually verify any films in omdb_no_match.txt and add overrides to OMDB_OVERRIDES
"""

import json
import time
import re
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("requests not found. Run: pip install requests --break-system-packages")
    sys.exit(1)

try:
    import openpyxl
except ImportError:
    print("openpyxl not found. Run: pip install openpyxl --break-system-packages")
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────────
OMDB_KEY    = "97ac5fbe"
OMDB_BASE   = "https://www.omdbapi.com"
SLEEP_SECS  = 0.15          # ~6.5 requests/second — well within free tier
SCRIPT_DIR  = Path(__file__).parent
WORKSPACE   = SCRIPT_DIR.parent.parent
CACHE_FILE  = SCRIPT_DIR / "omdb_cache.json"
OUTPUT_SQL  = SCRIPT_DIR / "omdb_update.sql"
NO_MATCH    = SCRIPT_DIR / "omdb_no_match.txt"

# ── Manual overrides for films OMDB struggles with ───────────────────────────
# Key: normalized title (lowercase, no punctuation) + ':' + year
# Value: OMDB imdbID
OMDB_OVERRIDES = {
    "noises off:1992": "tt0104990",
    "o brother where art thou:2000": "tt0190590",
    "loves labours lost:2000": "tt0212863",
    "1917:2019": "tt8579674",
    "the burbs:1989": "tt0096734",
    "much ado about nothing:1993": "tt0107616",
    "2001 a space odyssey:1968": "tt0062622",
    "star trek ii the wrath of khan:1982": "tt0084726",
    "star trek iv the voyage home:1986": "tt0092007",
    "star wars episode iv a new hope:1977": "tt0076759",
    "star wars episode v the empire strikes back:1980": "tt0080684",
    "star wars episode vi return of the jedi:1983": "tt0086190",
    "star wars episode vii the force awakens:2015": "tt2488496",
    "the lord of the rings the fellowship of the ring:2001": "tt0120737",
    "the lord of the rings the two towers:2002": "tt0167261",
    "the lord of the rings the return of the king:2003": "tt0167260",
    "indiana jones and the last crusade:1989": "tt0097576",
    "ferris buellers day off:1986": "tt0091042",
    "wall e:2008": "tt0910970",
    "its a wonderful life:1946": "tt0038650",
    "avengers endgame:2019": "tt4154796",
    "scott pilgrim vs the world:2010": "tt0446029",
    "dr strangelove:1964": "tt0057012",
    # Fixed from omdb_no_match.txt — title mismatches
    "lord of the rings fellowship of the ring:2001":    "tt0120737",   # missing "The"
    "william shakespeares romeo  juliet:1996":          "tt0117509",   # Romeo + Juliet
    "poltergiest:1982":                                 "tt0084516",   # typo → Poltergeist
    "annie hall:1977":                                  "tt0075686",
    "apocalypse now:1979":                              "tt0078788",
    "spiderman 2:2004":                                 "tt0316654",   # Spider-Man 2
    "x men 2:2003":                                     "tt0290334",   # X2
    "the bourne identity:2002":                         "tt0258463",
    "sunset boulevard:1950":                            "tt0043014",
    "the invisible man:1933":                           "tt0024184",
    "grand budapest hotel:2014":                        "tt2278388",   # missing "The"
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def normalize_key(title, year=None):
    t = str(title).lower()
    t = re.sub(r"[^a-z0-9 ]", '', t).strip()
    t = re.sub(r'\s+', ' ', t)
    if year:
        return t + ':' + str(int(year))
    return t

def omdb_fetch(title, year=None, imdb_id=None):
    """Query OMDB. Returns raw JSON dict or None."""
    if imdb_id:
        url = f"{OMDB_BASE}/?i={imdb_id}&apikey={OMDB_KEY}"
    elif year:
        url = f"{OMDB_BASE}/?t={requests.utils.quote(title)}&y={year}&apikey={OMDB_KEY}"
    else:
        url = f"{OMDB_BASE}/?t={requests.utils.quote(title)}&apikey={OMDB_KEY}"

    try:
        resp = requests.get(url, timeout=10)
        data = resp.json()
        if data.get("Response") == "True":
            return data
        return None
    except Exception as e:
        print(f"  ERROR fetching {title}: {e}")
        return None

def sql_str(v):
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"

# ── Load Films from Spreadsheets ──────────────────────────────────────────────
# Re-parse just enough to get (id, title, year) for every film

def get_all_films():
    """Re-run a lightweight version of the movie_import to get film list."""
    sys.path.insert(0, str(SCRIPT_DIR))
    # We'll parse from the existing movie_import.sql to get film ids + titles
    sql_file = SCRIPT_DIR / "movie_import.sql"
    films = []
    if not sql_file.exists():
        print("movie_import.sql not found — run movie_import.py first")
        sys.exit(1)

    with open(sql_file, 'r') as f:
        for line in f:
            # Match: VALUES (id, 'title', year, ...
            if line.startswith("INSERT INTO public.films"):
                m = re.search(r'VALUES \((\d+), \'(.*?)\', (\d+|NULL)', line)
                if m:
                    film_id = int(m.group(1))
                    title = m.group(2).replace("''", "'")
                    year_str = m.group(3)
                    year = int(year_str) if year_str != 'NULL' else None
                    films.append({'id': film_id, 'title': title, 'year': year})

    return films

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    # Load cache
    cache = {}
    if CACHE_FILE.exists():
        with open(CACHE_FILE) as f:
            cache = json.load(f)
        print(f"Loaded {len(cache)} cached OMDB results")

    films = get_all_films()
    print(f"Films to process: {len(films)}")

    updates = []     # (film_id, omdb_data)
    no_match = []    # (film_id, title, year)

    for i, film in enumerate(films):
        film_id = film['id']
        title   = film['title']
        year    = film['year']
        key     = normalize_key(title, year)

        # Check override first
        override_id = OMDB_OVERRIDES.get(key)

        # Check cache
        cache_key = f"{film_id}"
        if cache_key in cache:
            data = cache[cache_key]
            if data:
                updates.append((film_id, data))
            else:
                no_match.append((film_id, title, year))
            continue

        print(f"  [{i+1}/{len(films)}] {title} ({year})…", end=' ', flush=True)

        # Fetch from OMDB
        data = None
        if override_id:
            data = omdb_fetch(title, imdb_id=override_id)
            print(f"override({override_id})", end=' ')

        if data is None and year:
            data = omdb_fetch(title, year=year)

        if data is None:
            # Fallback: try without year
            data = omdb_fetch(title)

        if data is None:
            # Try with slight title modifications for common issues
            # Strip "The " prefix / suffix
            alt_title = title
            if title.startswith("The "):
                alt_title = title[4:]
            elif not title.startswith("The ") and year:
                alt_title = "The " + title

            data = omdb_fetch(alt_title, year=year)

        if data:
            print(f"✓ ({data.get('imdbID', '?')})")
            cache[cache_key] = data
            updates.append((film_id, data))
        else:
            print("✗ NO MATCH")
            cache[cache_key] = None
            no_match.append((film_id, title, year))

        time.sleep(SLEEP_SECS)

        # Save cache every 50 films
        if i % 50 == 0:
            with open(CACHE_FILE, 'w') as f:
                json.dump(cache, f, indent=2)

    # Final cache save
    with open(CACHE_FILE, 'w') as f:
        json.dump(cache, f, indent=2)

    print(f"\nFetched:   {len(updates)}")
    print(f"No match:  {len(no_match)}")

    # ── Generate SQL ──────────────────────────────────────────────────────────
    lines = []
    lines.append("-- ============================================================")
    lines.append("-- Hermz & D — OMDB Metadata Update")
    lines.append(f"-- Generated by omdb_fetch.py")
    lines.append(f"-- {len(updates)} films updated; {len(no_match)} not found")
    lines.append("-- Run in Supabase SQL Editor AFTER movie_import.sql")
    lines.append("-- ============================================================")
    lines.append("")
    lines.append("BEGIN;")
    lines.append("")

    for film_id, data in updates:
        imdb_id  = data.get("imdbID")
        poster   = data.get("Poster")
        genres   = data.get("Genre")
        actors   = [a.strip() for a in (data.get("Actors") or "").split(",") if a.strip()]
        director = data.get("Director") if data.get("Director") != "N/A" else None

        poster   = poster  if poster  and poster  != "N/A" else None
        genres   = genres  if genres  and genres  != "N/A" else None
        director = director if director else None

        actor_cols = []
        for idx in range(5):
            actor_cols.append(
                f"actor_{idx+1} = {sql_str(actors[idx] if idx < len(actors) else None)}"
            )

        set_clauses = [
            f"omdb_id = {sql_str(imdb_id)}",
            f"poster_url = {sql_str(poster)}",
            f"omdb_genres = {sql_str(genres)}",
            f"omdb_fetched_at = NOW()",
        ] + actor_cols

        # Only update director if we don't already have one (spreadsheet data takes priority)
        if director:
            set_clauses.append(f"director = COALESCE(director, {sql_str(director)})")

        lines.append(
            f"UPDATE public.films SET "
            + ", ".join(set_clauses)
            + f" WHERE id = {film_id};"
        )

    lines.append("")
    lines.append("COMMIT;")

    OUTPUT_SQL.write_text("\n".join(lines), encoding="utf-8")
    print(f"✓ Wrote {OUTPUT_SQL} ({OUTPUT_SQL.stat().st_size:,} bytes)")

    # ── Write no-match file ───────────────────────────────────────────────────
    if no_match:
        with open(NO_MATCH, 'w') as f:
            f.write(f"Films not found on OMDB ({len(no_match)} total)\n")
            f.write("Add OMDB imdbID overrides to OMDB_OVERRIDES in omdb_fetch.py\n\n")
            for film_id, title, year in no_match:
                f.write(f"  ID {film_id:4d}  {title} ({year})\n")
        print(f"✓ Wrote {NO_MATCH}")
    else:
        print("✓ All films matched!")


if __name__ == "__main__":
    main()
