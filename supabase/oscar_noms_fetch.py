#!/usr/bin/env python3
"""
Hermz & D — Oscar Nominations Fetch Script (Phase 8.5 v2)
==========================================================
Queries the Wikidata SPARQL API to retrieve per-category Oscar nomination
and win data for all films in our database, then generates SQL to populate
the film_oscar_noms table.

Key improvements over v1:
  - SPARQL now returns the award's Wikidata QID (URI) in addition to the label.
    This lets us distinguish "Best Sound Mixing" from "Best Sound Editing" even
    when Wikidata's English label for both is "Academy Award for Best Sound".
  - SQL is generated using omdb_id (not integer film_id) for the JOIN, so it
    is robust against films table re-imports that reassign integer IDs.
  - Cache version check: if the existing cache is v1 (no awardUri), the script
    warns you to delete oscar_noms_cache.json and re-run.

Prerequisites:
    1. film_oscar_noms_schema.sql has been run in Supabase
    2. omdb_cache.json exists (populated by omdb_fetch.py in Phase 5)
    3. pip install requests --break-system-packages

Usage:
    cd hermz-and-d/supabase
    python3 oscar_noms_fetch.py              # incremental (uses cache)
    python3 oscar_noms_fetch.py --refresh    # delete cache, re-fetch all

Output files (in the same supabase/ directory):
    oscar_noms_update.sql     — INSERT statements for film_oscar_noms table
    oscar_noms_no_data.txt    — Films with OMDB Oscar mentions but no Wikidata results
    oscar_noms_mismatch.txt   — Films where Wikidata win count differs from OMDB wins
    oscar_noms_qids.txt       — All QIDs encountered (add unknowns to QID_OVERRIDE below)
"""

import json
import time
import sys
import re
import argparse
from pathlib import Path

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
QIDS_LOG     = SCRIPT_DIR / "oscar_noms_qids.txt"

ACTOR_CACHE  = SCRIPT_DIR / "oscar_actor_cache.json"   # person-side query cache

WIKIDATA_URL = "https://query.wikidata.org/sparql"
BATCH_SIZE        = 15   # IMDb IDs per film-side SPARQL request
ACTOR_BATCH_SIZE  = 8    # IMDb IDs per person-side request (heavier query)
SLEEP_SECS        = 2.0  # be polite to Wikidata's public endpoint

CACHE_VERSION = 2    # v1 = no awardUri; v2 = awardUri present

# Acting category canonical names — used to decide which rows come from
# the person-side query vs the film-side query during merge.
ACTING_CATEGORIES = {
    "Best Actor", "Best Actress",
    "Best Supporting Actor", "Best Supporting Actress",
}

# ── QID override map ───────────────────────────────────────────────────────────
# Maps Wikidata entity IDs (Q-numbers) to canonical category names.
# This is the authoritative fix for categories whose English labels are
# ambiguous or incorrect in Wikidata (especially historical sound categories).
#
# To find a QID: search https://www.wikidata.org/wiki/Special:Search for the
# award name.  The QID is the "Q12345" code on the item page.
#
# HOW TO ADD ENTRIES:
#   1. Run the script once — check oscar_noms_qids.txt for all QIDs seen.
#   2. Look up any "UNMAPPED" QID on Wikidata.
#   3. Add it here with the correct canonical display name.
#
QID_OVERRIDE = {
    # ── Sound ONLY — this is the only category where Wikidata uses ambiguous labels.
    # Pre-2021, there were TWO separate sound categories (Mixing and Effects Editing),
    # but Wikidata often labels both as "Academy Award for Best Sound".
    # The QIDs distinguish them — if Wikidata returns the correct QIDs:
    "Q19024":   "Best Sound Mixing",      # Academy Award for Best Sound Mixing  (1930–2020)
    "Q869717":  "Best Sound Editing",     # Academy Award for Best Sound Editing (1963–2020)
    "Q1047215": "Best Sound",             # Academy Award for Best Sound         (2021+, unified)
    "Q1148280": "Best Sound",             # alternate Wikidata item for unified sound

    # NOTE: All other categories (Best Director, Best Screenplay, etc.) are handled
    # correctly by the label-based CATEGORY_NORM below. Do NOT add QIDs for them
    # unless Wikidata is verified to use ambiguous labels for that category.
    # Adding unverified QIDs here will OVERRIDE the correct label mapping and
    # cause data corruption (e.g. Q103360 mapped to screenplay renamed Best Director).
}

# ── Category normalisation map (label-based, used when QID not in QID_OVERRIDE) ─
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
    "best writing, story and screenplay":                   "Best Original Screenplay",
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

    # Sound — keep these for label-based fallback
    "best sound":                                           "Best Sound",
    "best sound editing":                                   "Best Sound Editing",
    "best sound mixing":                                    "Best Sound Mixing",
    "best sound effects editing":                           "Best Sound Editing",

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
    "best documentary":                                     "Best Documentary Feature",

    # Live Action Short
    "best live action short film":                          "Best Live Action Short",
    "best live action short":                               "Best Live Action Short",
    "best short film, live action":                         "Best Live Action Short",
    "best short subject, live action":                      "Best Live Action Short",

    # International
    "best international feature film":                      "Best International Feature Film",
    "best international feature":                           "Best International Feature Film",
    "best foreign language film":                           "Best International Feature Film",

    # Special awards (non-competitive, but worth showing)
    "special achievement academy award":                    "Special Achievement Award",
    "honorary award":                                       "Honorary Award",
}


# ── helpers ────────────────────────────────────────────────────────────────────

def extract_qid(uri: str) -> str:
    """Extract Q-number from a Wikidata entity URI, e.g. 'http://www.wikidata.org/entity/Q19024' → 'Q19024'."""
    if not uri:
        return ""
    m = re.search(r'(Q\d+)$', uri)
    return m.group(1) if m else ""


def normalize_category(raw_label: str, award_uri: str = "") -> str | None:
    """
    Given a Wikidata label and (optionally) a QID URI, return our canonical
    category name, or None if we can't identify it.

    QID_OVERRIDE takes priority over label-based CATEGORY_NORM.
    """
    # 1. Try QID override first (most precise)
    qid = extract_qid(award_uri)
    if qid and qid in QID_OVERRIDE:
        return QID_OVERRIDE[qid]

    s = raw_label.strip()

    # 2. Try full label first (handles e.g. "Special Achievement Academy Award")
    full_key = s.lower()
    if full_key in CATEGORY_NORM:
        return CATEGORY_NORM[full_key]

    # 3. Strip common prefixes
    for prefix in ("Academy Award for Best ", "Academy Award for "):
        if s.lower().startswith(prefix.lower()):
            s = s[len(prefix):]
            break

    # 4. Try exact lowercase match
    key = s.lower()
    if key in CATEGORY_NORM:
        return CATEGORY_NORM[key]

    # 5. Try with "best " prepended
    key2 = "best " + key
    if key2 in CATEGORY_NORM:
        return CATEGORY_NORM[key2]

    # No match — return the cleaned label as-is for review
    return f"[UNKNOWN] {s}"


def escape_sql(s: str) -> str:
    return s.replace("'", "''")


def build_sparql_query(imdb_ids: list[str]) -> str:
    """Build a SPARQL query to fetch Oscar noms/wins for a batch of IMDb IDs.
    Returns imdbId, awardUri (QID), awardLabel, won, ceremony year, and
    optional nomineeName (P1706 'together with' qualifier — present for acting
    awards where Wikidata stores the performer on the film's award statement)."""
    values = " ".join(f'"{iid}"' for iid in imdb_ids)
    return f"""
SELECT ?imdbId ?awardUri ?awardLabel ?won ?year ?nomineeName WHERE {{
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
  BIND(str(?award) AS ?awardUri)
  SERVICE wikibase:label {{
    bd:serviceParam wikibase:language "en" .
    ?award rdfs:label ?awardLabel .
  }}
  OPTIONAL {{
    ?stmt pq:P585 ?date .
    BIND(YEAR(?date) AS ?year)
  }}
  OPTIONAL {{
    ?stmt pq:P1706 ?nomineeEntity .
    SERVICE wikibase:label {{
      bd:serviceParam wikibase:language "en" .
      ?nomineeEntity rdfs:label ?nomineeName .
    }}
  }}
}}
"""


def build_person_sparql_query(imdb_ids: list[str]) -> str:
    """Query Oscar acting nominations from the PERSON's Wikidata page.
    In Wikidata, acting nominees typically have the award on their own page
    with a P1716 (award for) qualifier pointing back to the film.
    This is the only reliable way to get individual nominee names for cases
    like Amadeus (F. Murray Abraham + Tom Hulce, both Best Actor)."""
    values = " ".join(f'"{iid}"' for iid in imdb_ids)
    return f"""
SELECT ?imdbId ?awardUri ?awardLabel ?won ?year ?actorName WHERE {{
  VALUES ?imdbId {{ {values} }}
  ?film wdt:P345 ?imdbId .
  {{
    ?actor p:P166 ?stmt .
    ?stmt ps:P166 ?award .
    BIND(true AS ?won)
  }} UNION {{
    ?actor p:P1411 ?stmt .
    ?stmt ps:P1411 ?award .
    BIND(false AS ?won)
  }}
  ?stmt pq:P1716 ?film .
  ?award wdt:P31 wd:Q19020 .
  BIND(str(?award) AS ?awardUri)
  SERVICE wikibase:label {{
    bd:serviceParam wikibase:language "en" .
    ?award rdfs:label ?awardLabel .
    ?actor rdfs:label ?actorName .
  }}
  OPTIONAL {{
    ?stmt pq:P585 ?date .
    BIND(YEAR(?date) AS ?year)
  }}
}}
"""


def query_wikidata(imdb_ids: list[str], query: str = None) -> list[dict]:
    """Run a SPARQL query for a batch of IMDb IDs.
    If query is not provided, uses the default film-side query."""
    if query is None:
        query = build_sparql_query(imdb_ids)
    headers = {
        "Accept": "application/sparql-results+json",
        "User-Agent": "HermzAndDMoviesApp/2.0 (film ranking app; contact: bard37@gmail.com)"
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
                    "imdbId":      b.get("imdbId",      {}).get("value", ""),
                    "awardUri":    b.get("awardUri",    {}).get("value", ""),
                    "awardLabel":  b.get("awardLabel",  {}).get("value", ""),
                    "won":         b.get("won",         {}).get("value", "false").lower() == "true",
                    "year":        int(b["year"]["value"]) if "year" in b else None,
                    "nomineeName": (b.get("nomineeName") or b.get("actorName") or {}).get("value", "") or None,
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
    parser = argparse.ArgumentParser(description="Fetch Oscar nomination data from Wikidata")
    parser.add_argument("--refresh", action="store_true",
                        help="Delete existing cache and re-fetch everything from scratch")
    args = parser.parse_args()

    print("=" * 60)
    print("Hermz & D — Oscar Nominations Fetch (Phase 8.5 v2)")
    print("=" * 60)

    # 1. Load omdb_cache.json
    if not CACHE_FILE.exists():
        print(f"ERROR: {CACHE_FILE} not found. Run omdb_fetch.py first.")
        sys.exit(1)

    with open(CACHE_FILE) as f:
        omdb_cache = json.load(f)

    # Build film maps
    film_to_imdb: dict[str, str]  = {}       # film_id (str) → imdbID
    film_to_omdb_wins: dict[str, int] = {}   # film_id (str) → oscar wins per OMDB text
    film_to_title: dict[str, str] = {}       # film_id (str) → title (for logging)

    for film_id, entry in omdb_cache.items():
        if not entry or not isinstance(entry, dict):
            continue
        imdb_id = entry.get("imdbID", "")
        if imdb_id and imdb_id.startswith("tt"):
            film_to_imdb[str(film_id)]  = imdb_id
            film_to_title[str(film_id)] = entry.get("Title", f"film_id={film_id}")
            awards_text = entry.get("Awards", "")
            m = re.search(r"Won (\d+) Oscar", awards_text, re.IGNORECASE)
            film_to_omdb_wins[str(film_id)] = int(m.group(1)) if m else 0

    print(f"Films with IMDb IDs: {len(film_to_imdb)}")

    # 2. Handle --refresh
    if args.refresh and NOM_CACHE.exists():
        NOM_CACHE.unlink()
        print("Cache cleared (--refresh).")

    # 3. Load or create nominations cache
    nom_cache: dict[str, list] = {}
    if NOM_CACHE.exists():
        with open(NOM_CACHE) as f:
            nom_cache = json.load(f)
        # Check cache version — v1 entries lack 'awardUri'
        sample = next(
            (v[0] for v in nom_cache.values() if isinstance(v, list) and v),
            None
        )
        if sample and "awardUri" not in sample:
            print()
            print("⚠️  Cache is version 1 (no QID data). QID_OVERRIDE fixes won't apply.")
            print("    To get accurate sound category data, delete oscar_noms_cache.json")
            print("    and re-run:  python3 oscar_noms_fetch.py --refresh")
            print()
        else:
            print(f"Loaded {len(nom_cache)} cached IMDb IDs from {NOM_CACHE.name}")

    # 4. Build list of IMDb IDs not yet cached
    imdb_to_filmids: dict[str, list[str]] = {}
    for film_id, imdb_id in film_to_imdb.items():
        imdb_to_filmids.setdefault(imdb_id, []).append(film_id)

    all_imdb_ids = list(imdb_to_filmids.keys())
    to_fetch     = [iid for iid in all_imdb_ids if iid not in nom_cache]

    print(f"IMDb IDs to fetch from Wikidata: {len(to_fetch)}")
    print()

    # 5. Fetch in batches
    total_batches = (len(to_fetch) + BATCH_SIZE - 1) // BATCH_SIZE
    for batch_num, i in enumerate(range(0, len(to_fetch), BATCH_SIZE), 1):
        batch = to_fetch[i : i + BATCH_SIZE]
        print(f"  Batch {batch_num}/{total_batches}: {len(batch)} IDs … ", end="", flush=True)

        for iid in batch:
            nom_cache[iid] = []

        try:
            rows = query_wikidata(batch)
        except Exception as e:
            print(f"FAILED ({e}) — skipping batch")
            for iid in batch:
                del nom_cache[iid]
            time.sleep(SLEEP_SECS * 4)
            continue

        by_imdb: dict[str, list] = {iid: [] for iid in batch}
        for row in rows:
            iid = row["imdbId"]
            if iid in by_imdb:
                by_imdb[iid].append(row)

        for iid, film_rows in by_imdb.items():
            nom_cache[iid] = film_rows

        hits = sum(1 for iid in batch if nom_cache.get(iid))
        print(f"{len(rows)} rows  ({hits}/{len(batch)} films with data)")

        with open(NOM_CACHE, "w") as f:
            json.dump(nom_cache, f, indent=2)

        if batch_num < total_batches:
            time.sleep(SLEEP_SECS)

    print()
    print("All film-side batches complete.")

    # 5b. Person-side query — acting nominees (stored on the person's Wikidata page
    #     with P1716 qualifier pointing back to the film)
    if args.refresh and ACTOR_CACHE.exists():
        ACTOR_CACHE.unlink()
        print("Actor cache cleared (--refresh).")

    actor_cache: dict[str, list] = {}
    if ACTOR_CACHE.exists():
        with open(ACTOR_CACHE) as f:
            actor_cache = json.load(f)
        print(f"Loaded {len(actor_cache)} cached IMDb IDs from {ACTOR_CACHE.name}")

    actor_to_fetch = [iid for iid in all_imdb_ids if iid not in actor_cache]
    print(f"IMDb IDs to fetch (person-side): {len(actor_to_fetch)}")
    print()

    total_actor_batches = (len(actor_to_fetch) + ACTOR_BATCH_SIZE - 1) // ACTOR_BATCH_SIZE
    for batch_num, i in enumerate(range(0, len(actor_to_fetch), ACTOR_BATCH_SIZE), 1):
        batch = actor_to_fetch[i : i + ACTOR_BATCH_SIZE]
        print(f"  Actor batch {batch_num}/{total_actor_batches}: {len(batch)} IDs … ", end="", flush=True)

        for iid in batch:
            actor_cache[iid] = []

        try:
            rows = query_wikidata(batch, build_person_sparql_query(batch))
        except Exception as e:
            print(f"FAILED ({e}) — skipping batch")
            for iid in batch:
                del actor_cache[iid]
            time.sleep(SLEEP_SECS * 4)
            continue

        by_imdb: dict[str, list] = {iid: [] for iid in batch}
        for row in rows:
            iid = row["imdbId"]
            if iid in by_imdb:
                by_imdb[iid].append(row)

        for iid, film_rows in by_imdb.items():
            actor_cache[iid] = film_rows

        hits = sum(1 for iid in batch if actor_cache.get(iid))
        print(f"{len(rows)} rows  ({hits}/{len(batch)} films with data)")

        with open(ACTOR_CACHE, "w") as f:
            json.dump(actor_cache, f, indent=2)

        if batch_num < total_actor_batches:
            time.sleep(SLEEP_SECS)

    print()
    print("All batches complete. Generating SQL…")

    # 6. Compile results per film + collect all QIDs seen
    # Structure: imdb_id → list of (category_name, is_winner, ceremony_year, nominee_name)
    imdb_noms: dict[str, list[tuple[str, bool, int | None, str | None]]] = {}
    unknown_categories: set[str] = set()
    all_qids_seen: dict[str, str] = {}   # QID → label (for logging)

    def process_rows(rows):
        """Normalise raw SPARQL rows into (canon, won, year, nominee_name) tuples.

        Dedup rules:
        - Non-acting categories: dedup on (canon, year, nominee_name); upgrade False→True
          when the same entity appears as both nominated and won.
        - Acting categories (Best Actor/Actress/Supporting): a won=True row alongside a
          won=False row for the same (canon, year) means two DIFFERENT people — one was
          nominated, one won. Keep both. Only deduplicate identical won-status duplicates.
        """
        seen: set[tuple] = set()        # (canon, year, nominee_name, won) for acting
        seen_non_acting: set[tuple] = set()  # (canon, year, nominee_name) for non-acting
        result: list[tuple[str, bool, int | None, str | None]] = []
        for row in rows:
            raw_label    = row.get("awardLabel", "")
            award_uri    = row.get("awardUri", "")
            nominee_name = row.get("nomineeName") or None
            qid          = extract_qid(award_uri)
            if qid:
                all_qids_seen[qid] = raw_label
            canon = normalize_category(raw_label, award_uri)
            if not canon:
                continue
            if canon.startswith("[UNKNOWN]"):
                unknown_categories.add(f"{raw_label}  (URI: {award_uri})")
            won  = row["won"]
            year = row.get("year")

            if canon in ACTING_CATEGORIES:
                # For acting: dedup includes won-status so a win + a nom are kept separately
                key = (canon, year, nominee_name, won)
                if key not in seen:
                    seen.add(key)
                    result.append((canon, won, year, nominee_name))
            else:
                # For non-acting: dedup on (canon, year, nominee_name); upgrade to win
                key = (canon, year, nominee_name)
                if key in seen_non_acting:
                    if won:
                        result = [(c, w, y, n) for c, w, y, n in result
                                  if not (c == canon and y == year and n == nominee_name)]
                        result.append((canon, True, year, nominee_name))
                else:
                    seen_non_acting.add(key)
                    result.append((canon, won, year, nominee_name))
        return result

    for imdb_id in imdb_to_filmids:
        # Person-side: acting nominees with names (P1716 → film)
        person_noms = process_rows(actor_cache.get(imdb_id, []))
        person_covered = {(cat, year) for cat, _, year, _ in person_noms}

        # Film-side: all categories — but skip acting categories already covered by
        # person-side data (those have nominee names; film-side rows would lack them)
        film_rows_raw = [
            r for r in nom_cache.get(imdb_id, [])
            if normalize_category(r.get("awardLabel", ""), r.get("awardUri", ""))
               not in ACTING_CATEGORIES
            or (normalize_category(r.get("awardLabel", ""), r.get("awardUri", "")), r.get("year"))
               not in person_covered
        ]
        film_noms = process_rows(film_rows_raw)

        noms: list[tuple[str, bool, int | None, str | None]] = person_noms + film_noms
        # Final dedup across the merged set
        seen_keys: set[tuple] = set()
        deduped: list[tuple[str, bool, int | None, str | None]] = []
        for item in noms:
            # For acting categories include won-status in the key so a win and a nomination
            # from the same film (different people) are not collapsed into one row.
            k = (item[0], item[2], item[3], item[1]) if item[0] in ACTING_CATEGORIES \
                else (item[0], item[2], item[3])
            if k not in seen_keys:
                seen_keys.add(k)
                deduped.append(item)
        imdb_noms[imdb_id] = deduped

    # 7. Generate SQL (join by omdb_id, not integer film_id)
    print(f"Generating {OUTPUT_SQL.name} …")

    insert_rows: list[str] = []
    for imdb_id in sorted(imdb_to_filmids.keys()):
        noms = imdb_noms.get(imdb_id, [])
        if not noms:
            continue
        for (cat, won, year, nominee) in sorted(noms, key=lambda x: (x[2] or 0, x[0], x[3] or "")):
            year_sql    = str(year) if year else "NULL"
            won_sql     = "TRUE" if won else "FALSE"
            cat_sql     = escape_sql(cat)
            imdb_sql    = escape_sql(imdb_id)
            nominee_sql = f"'{escape_sql(nominee)}'" if nominee else "NULL"
            insert_rows.append(
                f"  ('{imdb_sql}', {year_sql}, '{cat_sql}', {won_sql}, {nominee_sql})"
            )

    with open(OUTPUT_SQL, "w") as f:
        f.write("-- Generated by oscar_noms_fetch.py (v3 — nominee_name support)\n")
        f.write("-- Run in Supabase SQL Editor AFTER film_oscar_noms_add_nominee.sql\n")
        f.write(f"-- Total rows: {len(insert_rows)}\n\n")

        f.write("BEGIN;\n\n")
        f.write("-- Clear any previous data\n")
        f.write("TRUNCATE public.film_oscar_noms RESTART IDENTITY CASCADE;\n\n")

        if insert_rows:
            f.write("-- Join by omdb_id so integer film IDs don't need to match exactly\n")
            f.write("INSERT INTO public.film_oscar_noms (film_id, ceremony_year, category_name, is_winner, nominee_name)\n")
            f.write("SELECT f.id, v.ceremony_year, v.category_name, v.is_winner, v.nominee_name\n")
            f.write("FROM public.films f\n")
            f.write("JOIN (\n  VALUES\n")
            f.write(",\n".join(insert_rows))
            f.write("\n) AS v(omdb_id, ceremony_year, category_name, is_winner, nominee_name)\n")
            f.write("  ON f.omdb_id = v.omdb_id\n")
            f.write("ON CONFLICT DO NOTHING;\n")

        f.write("\nCOMMIT;\n")

    print(f"  → {len(insert_rows)} rows across "
          f"{sum(1 for n in imdb_noms.values() if n)} films")

    # 8. Log QIDs seen (for adding to QID_OVERRIDE)
    print(f"Writing {QIDS_LOG.name} …")
    with open(QIDS_LOG, "w") as f:
        f.write("All Wikidata award QIDs encountered during this run.\n")
        f.write("QIDs not in QID_OVERRIDE are normalised by label (less precise).\n\n")
        f.write(f"{'QID':<12} {'In QID_OVERRIDE':<18} Label\n")
        f.write("-" * 80 + "\n")
        for qid, label in sorted(all_qids_seen.items()):
            mapped = "YES → " + QID_OVERRIDE.get(qid, "") if qid in QID_OVERRIDE else "no"
            f.write(f"{qid:<12} {mapped:<18} {label}\n")
    print(f"  → {len(all_qids_seen)} unique QIDs")

    # 9. Log films with OMDB Oscar mentions but no Wikidata data
    print(f"Writing {NO_DATA_LOG.name} …")
    no_data_films = []
    for film_id, imdb_id in film_to_imdb.items():
        omdb_wins  = film_to_omdb_wins.get(film_id, 0)
        noms       = imdb_noms.get(imdb_id, [])
        awards_txt = omdb_cache.get(film_id, {}).get("Awards", "")
        has_noms   = bool(re.search(r"\d+ Oscar|\d+ nomination", awards_txt, re.IGNORECASE))
        if has_noms and not noms:
            no_data_films.append((film_id, imdb_id, film_to_title.get(film_id, ""), awards_txt))

    with open(NO_DATA_LOG, "w") as f:
        f.write("Films with OMDB Oscar mentions but no Wikidata data found:\n")
        f.write("(These need manual entry or Wikidata has no structured data for them)\n\n")
        for fid, iid, title, awards in sorted(no_data_films, key=lambda x: x[2]):
            f.write(f"film_id={fid}  {iid}  {title}\n  OMDB: {awards}\n\n")

    print(f"  → {len(no_data_films)} films with OMDB mentions but no Wikidata data")

    # 10. Mismatch log
    print(f"Writing {MISMATCH_LOG.name} …")
    mismatches = []
    for film_id, imdb_id in film_to_imdb.items():
        noms = imdb_noms.get(imdb_id, [])
        wd_wins   = sum(1 for _, won, _, _ in noms if won)
        omdb_wins = film_to_omdb_wins.get(film_id, 0)
        if wd_wins != omdb_wins and (wd_wins > 0 or omdb_wins > 0):
            title = film_to_title.get(film_id, "")
            mismatches.append((film_id, imdb_id, title, omdb_wins, wd_wins))

    with open(MISMATCH_LOG, "w") as f:
        f.write("Films where Wikidata win count differs from OMDB-reported wins:\n")
        f.write("(Review — usually sound category QID issues or Wikidata data gaps)\n\n")
        f.write(f"{'film_id':<10} {'IMDb ID':<12} {'OMDB wins':<12} {'WD wins':<10} Title\n")
        f.write("-" * 80 + "\n")
        for fid, iid, title, ow, ww in sorted(mismatches, key=lambda x: x[2]):
            f.write(f"{fid:<10} {iid:<12} {ow:<12} {ww:<10} {title}\n")

    print(f"  → {len(mismatches)} mismatches")

    # 11. Log unknown categories
    if unknown_categories:
        print()
        print(f"⚠️  {len(unknown_categories)} unrecognised award labels "
              f"(check oscar_noms_qids.txt to map their QIDs):")
        for cat in sorted(unknown_categories):
            print(f"    {cat}")

    print()
    print("Done!")
    print()
    print("Next steps:")
    print("  1. Review oscar_noms_qids.txt — add any UNMAPPED QIDs to QID_OVERRIDE")
    print("  2. Review oscar_noms_mismatch.txt — if wins differ, a QID may be missing")
    print("  3. Run oscar_noms_update.sql in Supabase SQL Editor")
    print("     (the Oscar History section on film pages updates automatically)")


if __name__ == "__main__":
    main()
