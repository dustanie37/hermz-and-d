#!/usr/bin/env python3
"""
Hermz & D — Oscar Nominations Fetch Script (Phase 8.5)
=======================================================
Queries the Wikidata SPARQL API to retrieve per-category Oscar nomination
and win data for all films in our database, then generates SQL to populate
the film_oscar_noms table.

Prerequisites:
    1. film_oscar_noms_schema.sql has been run in Supabase
    2. omdb_cache.json exists (populated by omdb_fetch.py in Phase 5)
    3. pip install requests --break-system-packages

Usage:
    cd hermz-and-d/supabase
    python3 oscar_noms_fetch.py

Output files (in the same supabase/ directory):
    oscar_noms_update.sql     — INSERT statements for film_oscar_noms table
    oscar_noms_no_data.txt    — Films with OMDB Oscar mentions but no Wikidata results
    oscar_noms_mismatch.txt   — Films where Wikidata win count differs from films.oscar_wins

Notes:
    - Queries Wikidata in batches of 40 IMDb IDs (avoids SPARQL timeout)
    - Results are cached in oscar_noms_cache.json for resumable re-runs
    - Wikidata is occasionally inconsistent — mismatch log is for manual review
    - Category names are normalized to a consistent set (see CATEGORY_NORM below)
"""

import json
import time
import sys
import re
from pathlib import Path
from urllib.parse import quote

try:
    import requests
except ImportError:
    print("requests not found. Run: pip install requests --break-system-packages")
    sys.exit(1)

# ── Config ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR   = Path(__file__).parent
CACHE_FILE   = SCRIPT_DIR / "omdb_cache.json"
NOM_CACHE    = SCRIPT_DIR / "oscar_noms_cache.json"
OUTPUT_SQL   = SCRIPT_DIR / "oscar_noms_update.sql"
NO_DATA_LOG  = SCRIPT_DIR / "oscar_noms_no_data.txt"
MISMATCH_LOG = SCRIPT_DIR / "oscar_noms_mismatch.txt"

WIKIDATA_URL = "https://query.wikidata.org/sparql"
BATCH_SIZE   = 15    # IMDb IDs per SPARQL request
SLEEP_SECS   = 2.0   # be polite to Wikidata's public endpoint

# ── Category normalisation map ─────────────────────────────────────────────────
# Keys are lowercased Wikidata award labels (after stripping "Academy Award for "
# and "Academy Award for Best ").  Values are the canonical display names.
#
# Wikidata label → our canonical name
CATEGORY_NORM = {
    # Picture / Directing
    "best picture":                                         "Best Picture",
    "outstanding picture":                                  "Best Picture",
    "outstanding production":                               "Best Picture",
    "best director":                                        "Best Director",
    "directing":                                            "Best Director",
    "best directing":                                       "Best Director",

    # Acting
    "best actor in a leading role":                         "Best Actor",
    "best actor":                                           "Best Actor",
    "best performance by an actor in a leading role":       "Best Actor",
    "best actress in a leading role":                       "Best Actress",
    "best actress":                                         "Best Actress",
    "best performance by an actress in a leading role":     "Best Actress",
    "best actor in a supporting role":                      "Best Supporting Actor",
    "best supporting actor":                                "Best Supporting Actor",
    "best performance by an actor in a supporting role":    "Best Supporting Actor",
    "best actress in a supporting role":                    "Best Supporting Actress",
    "best supporting actress":                              "Best Supporting Actress",
    "best performance by an actress in a supporting role":  "Best Supporting Actress",

    # Writing
    "best original screenplay":                             "Best Original Screenplay",
    "best writing, original screenplay":                    "Best Original Screenplay",
    "best writing, screenplay written directly for the screen": "Best Original Screenplay",
    "best writing, story and screenplay written directly for the screen": "Best Original Screenplay",
    "best writing, motion picture story":                   "Best Original Screenplay",
    "best original story":                                  "Best Original Screenplay",
    "best adapted screenplay":                              "Best Adapted Screenplay",
    "best writing, adapted screenplay":                     "Best Adapted Screenplay",
    "best writing, screenplay based on material previously produced or published": "Best Adapted Screenplay",
    "best writing, screenplay adapted from other material": "Best Adapted Screenplay",
    "best writing, adaptation":                             "Best Adapted Screenplay",

    # Cinematography (including color/B&W era splits)
    "best cinematography":                                  "Best Cinematography",
    "best cinematography (color)":                          "Best Cinematography",
    "best cinematography (black-and-white)":                "Best Cinematography",
    "best cinematography, color":                           "Best Cinematography",
    "best cinematography, black-and-white":                 "Best Cinematography",

    # Editing
    "best film editing":                                    "Best Film Editing",
    "best editing":                                         "Best Film Editing",

    # Production Design / Art Direction (including color/B&W era splits)
    "best production design":                               "Best Production Design",
    "best art direction":                                   "Best Production Design",
    "best art direction-set decoration":                    "Best Production Design",
    "best art direction-set decoration (color)":            "Best Production Design",
    "best art direction-set decoration (black-and-white)":  "Best Production Design",
    "best art direction, color":                            "Best Production Design",
    "best art direction, black and white":                  "Best Production Design",

    # Costume Design (including color/B&W era splits)
    "best costume design":                                  "Best Costume Design",
    "best costume design (color)":                          "Best Costume Design",
    "best costume design (black-and-white)":                "Best Costume Design",
    "best costume design, black-and-white":                 "Best Costume Design",

    # Makeup
    "best makeup and hairstyling":                          "Best Makeup and Hairstyling",
    "best makeup":                                          "Best Makeup and Hairstyling",

    # Music
    "best original score":                                  "Best Original Score",
    "best original dramatic score":                         "Best Original Score",
    "best original dramatic or comedy score":               "Best Original Score",
    "best original musical or comedy score":                "Best Original Score",
    "best original score, no musical":                      "Best Original Score",
    "best score":                                           "Best Original Score",
    "best score, adaptation or treatment":                  "Best Original Score",
    "best scoring: substantially original":                 "Best Original Score",
    "best scoring: adaptation or treatment":                "Best Original Score",
    "best original song":                                   "Best Original Song",
    "best original song score":                             "Best Original Song Score",
    "best original song score or adaptation score":         "Best Original Song Score",

    # Sound
    "best sound":                                           "Best Sound",
    "best sound editing":                                   "Best Sound Editing",
    "best sound mixing":                                    "Best Sound Mixing",

    # Visual Effects
    "best visual effects":                                  "Best Visual Effects",
    "best special effects":                                 "Best Visual Effects",
    "best special visual effects":                          "Best Visual Effects",

    # Animated
    "best animated feature film":                           "Best Animated Feature",
    "best animated feature":                                "Best Animated Feature",
    "best animated short film":                             "Best Animated Short",
    "best animated short":                                  "Best Animated Short",

    # Documentary
    "best documentary feature":                             "Best Documentary Feature",
    "best documentary feature film":                        "Best Documentary Feature",
    "best feature documentary":                             "Best Documentary Feature",
    "best documentary short film":                          "Best Documentary Short",
    "best documentary short subject":                       "Best Documentary Short",
    "best documentary short":                               "Best Documentary Short",

    # Live Action Short
    "best live action short film":                          "Best Live Action Short",
    "best live action short":                               "Best Live Action Short",
    "best short film, live action":                         "Best Live Action Short",
    "best short subject, live action":                      "Best Live Action Short",

    # International
    "best international feature film":                      "Best International Feature Film",
    "best international feature":                           "Best International Feature Film",
    "best foreign language film":                           "Best International Feature Film",

    # Other / historical
    "best documentary":                                     "Best Documentary Feature",
    "best writing, story and screenplay":                   "Best Original Screenplay",

    # Special awards (non-competitive, but worth showing)
    "special achievement academy award":                    "Special Achievement Award",
}

# ── helpers ────────────────────────────────────────────────────────────────────

def normalize_category(raw_label: str) -> str | None:
    """
    Given a Wikidata label like 'Academy Award for Best Picture',
    return our canonical category name or None if we don't recognise it.
    """
    s = raw_label.strip()

    # Try full label first (handles "Special Achievement Academy Award" etc.)
    full_key = s.lower()
    if full_key in CATEGORY_NORM:
        return CATEGORY_NORM[full_key]

    # Strip common prefixes
    for prefix in ("Academy Award for Best ", "Academy Award for "):
        if s.lower().startswith(prefix.lower()):
            s = s[len(prefix):]
            break

    # Try exact lowercase match
    key = s.lower()
    if key in CATEGORY_NORM:
        return CATEGORY_NORM[key]

    # Try with "best " prepended (some labels don't include it after stripping)
    key2 = "best " + key
    if key2 in CATEGORY_NORM:
        return CATEGORY_NORM[key2]

    # No match — return the cleaned label as-is so we can review it
    return f"[UNKNOWN] {s}"


def escape_sql(s: str) -> str:
    return s.replace("'", "''")


def build_sparql_query(imdb_ids: list[str]) -> str:
    """Build a SPARQL query to fetch Oscar noms/wins for a batch of IMDb IDs."""
    values = " ".join(f'"{iid}"' for iid in imdb_ids)
    return f"""
SELECT ?imdbId ?awardLabel ?won ?year WHERE {{
  VALUES ?imdbId {{ {values} }}
  ?film wdt:P345 ?imdbId .
  {{
    ?film p:P166 ?stmt .
    ?stmt ps:P166 ?award .
    BIND(true AS ?won)
  }} UNION {{
    ?film p:P1411 ?stmt .
    ?stmt ps:P1411 ?award .
    BIND(false AS ?won)
  }}
  ?award wdt:P31 wd:Q19020 .
  SERVICE wikibase:label {{
    bd:serviceParam wikibase:language "en" .
    ?award rdfs:label ?awardLabel .
  }}
  OPTIONAL {{
    ?stmt pq:P585 ?date .
    BIND(YEAR(?date) AS ?year)
  }}
}}
"""


def query_wikidata(imdb_ids: list[str]) -> list[dict]:
    """
    Run a SPARQL query for a batch of IMDb IDs.
    Returns list of { imdbId, awardLabel, won, year } dicts.
    """
    query = build_sparql_query(imdb_ids)
    headers = {
        "Accept": "application/sparql-results+json",
        "User-Agent": "HermzAndDMoviesApp/1.0 (film ranking app; contact: bard37@gmail.com)"
    }
    for attempt in range(3):
        try:
            resp = requests.get(
                WIKIDATA_URL,
                params={"query": query, "format": "json"},
                headers=headers,
                timeout=60
            )
            resp.raise_for_status()
            data = resp.json()
            rows = []
            for b in data.get("results", {}).get("bindings", []):
                rows.append({
                    "imdbId":     b.get("imdbId",     {}).get("value", ""),
                    "awardLabel": b.get("awardLabel", {}).get("value", ""),
                    "won":        b.get("won",        {}).get("value", "false").lower() == "true",
                    "year":       int(b["year"]["value"]) if "year" in b else None,
                })
            return rows
        except requests.exceptions.Timeout:
            print(f"  Timeout on attempt {attempt+1}/3 — retrying in {SLEEP_SECS*3:.0f}s...")
            time.sleep(SLEEP_SECS * 3)
        except Exception as e:
            print(f"  Error on attempt {attempt+1}/3: {e}")
            if attempt < 2:
                time.sleep(SLEEP_SECS * 2)
            else:
                raise
    return []


# ── main ───────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Hermz & D — Oscar Nominations Fetch (Phase 8.5)")
    print("=" * 60)

    # 1. Load omdb_cache.json → map of film_id → { imdbID, oscar_noms }
    if not CACHE_FILE.exists():
        print(f"ERROR: {CACHE_FILE} not found. Run omdb_fetch.py first.")
        sys.exit(1)

    with open(CACHE_FILE) as f:
        omdb_cache = json.load(f)

    # Build: film_id → imdbID, only for films with an IMDb ID
    film_to_imdb: dict[str, str] = {}       # film_id (str) → imdbID
    film_to_omdb_wins: dict[str, int] = {}  # film_id (str) → oscar wins per OMDB text
    film_to_title: dict[str, str] = {}      # film_id (str) → title (for logging)

    for film_id, entry in omdb_cache.items():
        if not entry or not isinstance(entry, dict):
            continue  # skip null / non-dict cache entries
        imdb_id = entry.get("imdbID", "")
        if imdb_id and imdb_id.startswith("tt"):
            film_to_imdb[str(film_id)] = imdb_id
            film_to_title[str(film_id)] = entry.get("Title", f"film_id={film_id}")
            # Parse OMDB awards text to get expected win count
            awards_text = entry.get("Awards", "")
            m = re.search(r"Won (\d+) Oscar", awards_text, re.IGNORECASE)
            film_to_omdb_wins[str(film_id)] = int(m.group(1)) if m else 0

    print(f"Films with IMDb IDs: {len(film_to_imdb)}")

    # 2. Load oscar_noms_cache.json if it exists (allows resuming)
    nom_cache: dict[str, list] = {}  # imdbID → list of nom records
    if NOM_CACHE.exists():
        with open(NOM_CACHE) as f:
            nom_cache = json.load(f)
        print(f"Loaded {len(nom_cache)} cached IMDb IDs from {NOM_CACHE.name}")

    # 3. Build list of IMDb IDs not yet cached
    imdb_to_filmids: dict[str, list[str]] = {}
    for film_id, imdb_id in film_to_imdb.items():
        imdb_to_filmids.setdefault(imdb_id, []).append(film_id)

    all_imdb_ids = list(imdb_to_filmids.keys())
    to_fetch     = [iid for iid in all_imdb_ids if iid not in nom_cache]

    print(f"IMDb IDs to fetch from Wikidata: {len(to_fetch)}")
    print()

    # 4. Fetch in batches
    total_batches = (len(to_fetch) + BATCH_SIZE - 1) // BATCH_SIZE
    for batch_num, i in enumerate(range(0, len(to_fetch), BATCH_SIZE), 1):
        batch = to_fetch[i : i + BATCH_SIZE]
        print(f"  Batch {batch_num}/{total_batches}: {len(batch)} IDs … ", end="", flush=True)

        # Pre-populate cache with empty list (avoids re-querying truly empty films)
        for iid in batch:
            nom_cache[iid] = []

        try:
            rows = query_wikidata(batch)
        except Exception as e:
            print(f"FAILED ({e}) — skipping batch")
            # Don't save empty lists — will retry on re-run
            for iid in batch:
                del nom_cache[iid]
            time.sleep(SLEEP_SECS * 4)
            continue

        # Group rows by imdbId
        by_imdb: dict[str, list] = {iid: [] for iid in batch}
        for row in rows:
            iid = row["imdbId"]
            if iid in by_imdb:
                by_imdb[iid].append(row)

        for iid, film_rows in by_imdb.items():
            nom_cache[iid] = film_rows

        hits = sum(1 for iid in batch if nom_cache.get(iid))
        print(f"{len(rows)} rows  ({hits}/{len(batch)} films with data)")

        # Save cache after each batch
        with open(NOM_CACHE, "w") as f:
            json.dump(nom_cache, f, indent=2)

        if batch_num < total_batches:
            time.sleep(SLEEP_SECS)

    print()
    print("All batches complete. Generating SQL…")

    # 5. Compile results per film
    # Structure: film_id → set of (category_name, is_winner, ceremony_year)
    film_noms: dict[str, list[tuple[str, bool, int | None]]] = {}
    unknown_categories: set[str] = set()

    for film_id, imdb_id in film_to_imdb.items():
        rows = nom_cache.get(imdb_id, [])
        seen: set[tuple] = set()
        noms: list[tuple[str, bool, int | None]] = []

        for row in rows:
            raw_label = row["awardLabel"]
            canon = normalize_category(raw_label)
            if canon and canon.startswith("[UNKNOWN]"):
                unknown_categories.add(raw_label)
                # Still include it — useful to see what we got
                canon = raw_label  # use raw label as-is for now

            if not canon:
                continue

            won  = row["won"]
            year = row["year"]

            # De-duplicate: if we have the same category won=True AND won=False,
            # keep won=True (Wikidata sometimes has both)
            key = (canon, year)
            existing = [(c, w, y) for c, w, y in noms if (c, y) == key]
            if existing:
                # If incoming is a win and existing is not, upgrade it
                if won and not existing[0][1]:
                    noms = [(c, w2, y) for c, w2, y in noms if (c, y) != key]
                    noms.append((canon, True, year))
                # else skip duplicate
            else:
                noms.append((canon, won, year))

        film_noms[film_id] = noms

    # 6. Generate SQL
    print(f"Generating {OUTPUT_SQL.name} …")

    insert_rows: list[str] = []
    for film_id in sorted(film_noms.keys(), key=lambda x: int(x)):
        noms = film_noms[film_id]
        if not noms:
            continue
        for (cat, won, year) in sorted(noms, key=lambda x: (x[2] or 0, x[0])):
            year_sql = str(year) if year else "NULL"
            won_sql  = "TRUE" if won else "FALSE"
            cat_sql  = escape_sql(cat)
            insert_rows.append(
                f"  ({film_id}, {year_sql}, '{cat_sql}', {won_sql})"
            )

    with open(OUTPUT_SQL, "w") as f:
        f.write("-- Generated by oscar_noms_fetch.py (Phase 8.5)\n")
        f.write("-- Run in Supabase SQL Editor AFTER film_oscar_noms_schema.sql\n")
        f.write(f"-- Total rows: {len(insert_rows)}\n\n")

        f.write("BEGIN;\n\n")
        f.write("-- Clear any previous data\n")
        f.write("TRUNCATE public.film_oscar_noms RESTART IDENTITY CASCADE;\n\n")

        if insert_rows:
            # JOIN against films table so stale film_ids are silently skipped
            f.write("INSERT INTO public.film_oscar_noms (film_id, ceremony_year, category_name, is_winner)\n")
            f.write("SELECT f.id, v.ceremony_year, v.category_name, v.is_winner\n")
            f.write("FROM public.films f\n")
            f.write("JOIN (\n  VALUES\n")
            f.write(",\n".join(insert_rows))
            f.write("\n) AS v(film_id, ceremony_year, category_name, is_winner)\n")
            f.write("  ON f.id = v.film_id\n")
            f.write("ON CONFLICT (film_id, ceremony_year, category_name) DO UPDATE\n")
            f.write("  SET is_winner = EXCLUDED.is_winner;\n")

        f.write("\nCOMMIT;\n")

    print(f"  → {len(insert_rows)} rows across {sum(1 for n in film_noms.values() if n)} films")

    # 7. Log films with OMDB Oscar mentions but no Wikidata data
    print(f"Writing {NO_DATA_LOG.name} …")
    no_data_films = []
    for film_id, imdb_id in film_to_imdb.items():
        omdb_wins  = film_to_omdb_wins.get(film_id, 0)
        noms       = film_noms.get(film_id, [])
        awards_txt = omdb_cache.get(film_id, {}).get("Awards", "")
        has_noms   = bool(re.search(r"\d+ Oscar|\d+ nomination", awards_txt, re.IGNORECASE))
        if has_noms and not noms:
            no_data_films.append((film_id, imdb_id, film_to_title.get(film_id, ""), awards_txt))

    with open(NO_DATA_LOG, "w") as f:
        f.write("Films with OMDB Oscar mentions but no Wikidata data found:\n")
        f.write("(These may need manual review or Wikidata has no structured data for them)\n\n")
        for fid, iid, title, awards in sorted(no_data_films, key=lambda x: x[2]):
            f.write(f"film_id={fid}  {iid}  {title}\n  OMDB: {awards}\n\n")

    print(f"  → {len(no_data_films)} films with OMDB mentions but no Wikidata data")

    # 8. Mismatch log — Wikidata win count vs. films.oscar_wins
    print(f"Writing {MISMATCH_LOG.name} …")
    mismatches = []
    for film_id in sorted(film_noms.keys(), key=lambda x: int(x)):
        noms = film_noms[film_id]
        wd_wins    = sum(1 for _, won, _ in noms if won)
        omdb_wins  = film_to_omdb_wins.get(film_id, 0)
        if wd_wins != omdb_wins and (wd_wins > 0 or omdb_wins > 0):
            title = film_to_title.get(film_id, "")
            imdb_id = film_to_imdb.get(film_id, "")
            mismatches.append((film_id, imdb_id, title, omdb_wins, wd_wins))

    with open(MISMATCH_LOG, "w") as f:
        f.write("Films where Wikidata win count differs from OMDB-reported wins:\n")
        f.write("(Review these to decide if films.oscar_wins needs correcting)\n\n")
        f.write(f"{'film_id':<10} {'IMDb ID':<12} {'OMDB wins':<12} {'WD wins':<10} Title\n")
        f.write("-" * 80 + "\n")
        for fid, iid, title, ow, ww in sorted(mismatches, key=lambda x: x[2]):
            f.write(f"{fid:<10} {iid:<12} {ow:<12} {ww:<10} {title}\n")

    print(f"  → {len(mismatches)} mismatches")

    # 9. Log unknown categories for review
    if unknown_categories:
        print()
        print(f"⚠️  {len(unknown_categories)} unrecognised Wikidata award labels (review CATEGORY_NORM):")
        for cat in sorted(unknown_categories):
            print(f"    {cat}")

    print()
    print("Done!")
    print()
    print("Next steps:")
    print("  1. Review oscar_noms_no_data.txt and oscar_noms_mismatch.txt")
    print("  2. Add any missing CATEGORY_NORM entries and re-run if needed")
    print("  3. Run film_oscar_noms_schema.sql in Supabase SQL Editor")
    print("  4. Run oscar_noms_update.sql in Supabase SQL Editor")
    print("  5. The MovieDetail page will automatically show the full Oscar panel")


if __name__ == "__main__":
    main()
