#!/usr/bin/env python3
"""
Hermz & D — Movie Rankings Import Script
=========================================
Parses both movie ranking XLSX files and generates movie_import.sql.

Usage:
    python3 movie_import.py

Output:
    movie_import.sql   — INSERT statements for films, individual_rankings,
                         and combined_rankings tables.
                         Run in Supabase SQL Editor AFTER schema.sql.

Sources:
    2001 and 2007 Hermz and D Top 100 Favorite Films.xlsx
    2016 and 2026 Hermz and D Top 100 Favorite Movies.xlsx
"""

import re
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("openpyxl not found. Run: pip install openpyxl --break-system-packages")
    sys.exit(1)

# ── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
WORKSPACE = SCRIPT_DIR.parent.parent  # hermz-and-d/supabase/../.. = workspace root

FILE_0107 = WORKSPACE / "2001 and 2007 Hermz and D Top 100 Favorite Films.xlsx"
FILE_1626 = WORKSPACE / "2016 and 2026 Hermz and D Top 100 Favorite Movies.xlsx"
OUTPUT    = SCRIPT_DIR / "movie_import.sql"

# ── Helpers ───────────────────────────────────────────────────────────────────

def sql_str(v):
    """Safely escape a string for SQL."""
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"

def sql_int(v):
    if v is None or (isinstance(v, str) and v.strip().upper() in ('NR', '#NAME?', '-', '')):
        return "NULL"
    try:
        return str(int(float(v)))
    except (TypeError, ValueError):
        return "NULL"

def sql_bool(v):
    if v is None or v == '-':
        return "FALSE"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if str(v).strip().upper() in ('X', 'TRUE', '1', 'YES'):
        return "TRUE"
    return "FALSE"

def sql_score(v, min_=1, max_=10):
    """Return int score or NULL."""
    if v is None:
        return "NULL"
    try:
        n = int(float(v))
        if min_ <= n <= max_:
            return str(n)
        return "NULL"
    except (TypeError, ValueError):
        return "NULL"

def is_rank(v):
    """True if v is a valid numeric rank."""
    if v is None:
        return False
    if isinstance(v, bool):
        return False
    if isinstance(v, str) and v.strip().upper() in ('NR', '#NAME?', '-', ''):
        return False
    try:
        int(float(v))
        return True
    except (TypeError, ValueError):
        return False

def normalize_title(title):
    """Normalize a film title for matching purposes."""
    if title is None:
        return None
    t = str(title).strip()
    # Fix common inconsistencies
    t = t.replace('\u2019', "'").replace('\u2018', "'")  # curly quotes
    t = t.replace('\u201c', '"').replace('\u201d', '"')
    t = t.replace('\u2013', '-').replace('\u2014', '-')  # em/en dash
    t = re.sub(r'\s+', ' ', t)  # collapse whitespace
    return t

def title_key(title, year=None):
    """
    Generate a lookup key from title + optional year.
    Used to deduplicate films across sheets.
    """
    t = normalize_title(title)
    if t is None:
        return None
    # Lowercase, strip punctuation for matching
    key = re.sub(r"[^a-z0-9 ]", '', t.lower()).strip()
    key = re.sub(r'\s+', ' ', key)
    if year:
        try:
            return key + ':' + str(int(float(year)))
        except (TypeError, ValueError):
            pass
    return key

# ── Film Registry ─────────────────────────────────────────────────────────────
# All unique films keyed by normalized title+year

films = {}        # key → {id, title, release_year, ...metadata}
film_counter = [1]

def get_or_create_film(title, year=None):
    """Return film id, creating if needed."""
    raw_title = normalize_title(title)
    if not raw_title:
        return None
    key = title_key(raw_title, year)
    if key not in films:
        fid = film_counter[0]
        film_counter[0] += 1
        films[key] = {
            'id': fid,
            'title': raw_title,
            'release_year': int(float(year)) if year and is_rank(year) else None,
            'director': None,
            'actor_1': None, 'actor_2': None, 'actor_3': None, 'actor_4': None,
            'custom_genre_1': None, 'custom_genre_2': None,
            'acclaim_score': None,
            'oscar_nominations': 0,
            'oscar_wins': 0,
            'won_best_picture': False, 'won_best_director': False,
            'won_best_actor': False, 'won_best_actress': False,
            'won_best_supp_actor': False, 'won_best_supp_actress': False,
            'won_screenplay': False, 'won_cinematography': False,
            'won_production_design': False,
            'afi_top100_rank': None, 'afi_comedies_rank': None,
            'imdb_top250_rank': None, 'nyt_2000s_rank': None,
            'sight_sound_2022_rank': None, 'variety_comedies_rank': None,
            'national_film_registry': False,
        }
    return films[key]['id']

def get_film_id(title, year=None):
    raw_title = normalize_title(title)
    if not raw_title:
        return None
    key = title_key(raw_title, year)
    if key in films:
        return films[key]['id']
    # Try without year if year lookup fails
    if year:
        key_no_year = title_key(raw_title)
        for k, f in films.items():
            if k.split(':')[0] == key_no_year.split(':')[0]:
                return f['id']
    return None

# ── Individual Rankings ────────────────────────────────────────────────────────

individual_rankings = []   # list of dicts
combined_rankings   = []   # list of dicts

def add_individual_ranking(film_id, event_year, username, rank, total_score,
                            lead, supp, plot, dialogue, screenplay, direction,
                            cinematography, art_direction, influence, acclaim,
                            personal_impact, tens, nines, eights):
    individual_rankings.append({
        'film_id': film_id,
        'event_year': event_year,
        'username': username,
        'rank': rank,
        'total_score': total_score,
        'score_lead_performance': lead,
        'score_supp_performance': supp,
        'score_plot': plot,
        'score_dialogue': dialogue,
        'score_screenplay': screenplay,
        'score_direction': direction,
        'score_cinematography': cinematography,
        'score_production_design': art_direction,
        'score_influence': influence,
        'score_acclaim': acclaim,
        'score_personal_impact': personal_impact,
        'tb_tens': tens,
        'tb_nines': nines,
        'tb_eights': eights,
    })

# ── Parse 2001 Individual Lists (Martin + Hermz) ─────────────────────────────
# Columns: RANK(0), Title(1), Year(2), Lead(3), Sup(4), Plot(5), Dialogue(6),
#          Direction(7), Cinematog(8), Influence(9), Acclaim(10), Personal(11),
#          TOTAL(12), Tens(13), Nines(14), Eights(15)

def parse_2001_list(ws, username):
    for row in ws.iter_rows(values_only=True):
        rank_val = row[0]
        if not is_rank(rank_val):
            continue
        title = normalize_title(row[1])
        year  = row[2]
        if not title:
            continue
        fid = get_or_create_film(title, year)
        add_individual_ranking(
            film_id=fid,
            event_year=2001,
            username=username,
            rank=int(float(rank_val)),
            total_score=int(float(row[12])) if row[12] else None,
            lead=row[3], supp=row[4],
            plot=row[5], dialogue=row[6],
            screenplay=None, direction=row[7],
            cinematography=row[8], art_direction=None,
            influence=row[9], acclaim=row[10],
            personal_impact=row[11],
            tens=row[13], nines=row[14], eights=row[15],
        )

# ── Parse 2007 Individual Lists ───────────────────────────────────────────────
# Header rows 0–3; data from row 4.
# Cols: 2007rank(0), 2001rank(1), Change(2), Title(3), Year(4),
#       Lead(5), Supp(6), Screenplay(7), Direction(8), Cinematog(9),
#       ArtDir(10), Influence(11), Acclaim(12), Personal(13),
#       TOTAL(14), Tens(15), Nines(16), Eights(17)

def parse_2007_list(ws, username):
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i < 4:
            continue
        rank_val = row[0]
        if not is_rank(rank_val):
            continue
        title = normalize_title(row[3])
        year  = row[4]
        if not title:
            continue
        fid = get_or_create_film(title, year)
        add_individual_ranking(
            film_id=fid,
            event_year=2007,
            username=username,
            rank=int(float(rank_val)),
            total_score=int(float(row[14])) if row[14] else None,
            lead=row[5], supp=row[6],
            plot=None, dialogue=None,
            screenplay=row[7], direction=row[8],
            cinematography=row[9], art_direction=row[10],
            influence=row[11], acclaim=row[12],
            personal_impact=row[13],
            tens=row[15], nines=row[16], eights=row[17],
        )

# ── Parse 2016 Individual Lists ───────────────────────────────────────────────
# Header rows 0–2; data from row 3.
# Cols: 2001rank(0), 2007rank(1), 2016rank(2), Change01(3), Change07(4),
#       Title(5), Year(6), Total(7), Lead(8), Supp(9), Screenplay(10),
#       Direction(11), Cinematog(12), ArtDir(13), Influence(14), Acclaim(15),
#       Personal(16), Tens(17), Nines(18), Eights(19)

def parse_2016_list(ws, username):
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i < 3:
            continue
        rank_val = row[2]
        if not is_rank(rank_val):
            continue
        title = normalize_title(row[5])
        year  = row[6]
        if not title:
            continue
        fid = get_or_create_film(title, year)
        add_individual_ranking(
            film_id=fid,
            event_year=2016,
            username=username,
            rank=int(float(rank_val)),
            total_score=int(float(row[7])) if row[7] else None,
            lead=row[8], supp=row[9],
            plot=None, dialogue=None,
            screenplay=row[10], direction=row[11],
            cinematography=row[12], art_direction=row[13],
            influence=row[14], acclaim=row[15],
            personal_impact=row[16],
            tens=row[17], nines=row[18], eights=row[19],
        )

# ── Parse 2026 Individual Lists ───────────────────────────────────────────────
# Header rows 0–2; data from row 3.
# Cols: 2001(0), 2007(1), 2016(2), 2026rank(3), Changes(4-7),
#       Title(8), Year(9), Total(10), Lead(11), Supp(12), Screenplay(13),
#       Direction(14), Cinematog(15), ProdDesign(16), Influence(17),
#       Acclaim(18), Personal(19), Tens(20), Nines(21), Eights(22)

def parse_2026_list(ws, username):
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i < 3:
            continue
        rank_val = row[3]
        if not is_rank(rank_val):
            continue
        title = normalize_title(row[8])
        year  = row[9]
        if not title:
            continue
        fid = get_or_create_film(title, year)
        add_individual_ranking(
            film_id=fid,
            event_year=2026,
            username=username,
            rank=int(float(rank_val)),
            total_score=int(float(row[10])) if row[10] else None,
            lead=row[11], supp=row[12],
            plot=None, dialogue=None,
            screenplay=row[13], direction=row[14],
            cinematography=row[15], art_direction=row[16],
            influence=row[17], acclaim=row[18],
            personal_impact=row[19],
            tens=row[20], nines=row[21], eights=row[22],
        )

# ── Parse Combined Rankings ────────────────────────────────────────────────────

def add_combined_ranking(film_id, event_year, combined_rank,
                          dustin_rank, matt_rank, avg_rank,
                          dustin_score, matt_score, total_score,
                          dustin_impact, matt_impact, total_impact, total_tens):
    combined_rankings.append({
        'film_id': film_id,
        'event_year': event_year,
        'combined_rank': combined_rank,
        'dustin_rank': dustin_rank,
        'matt_rank': matt_rank,
        'avg_rank': avg_rank,
        'dustin_score': dustin_score,
        'matt_score': matt_score,
        'total_score': total_score,
        'dustin_impact': dustin_impact,
        'matt_impact': matt_impact,
        'total_impact': total_impact,
        'total_tens': total_tens,
    })

# 2001 Combined Rankings
# Header row 0; data from row 1.
# Cols: Rank(0), Film(1), DRank(2), MRank(3), AvgRank(4), DScore(5), MScore(6),
#       TotalScore(7), DImpact(8), MImpact(9), TotalImpact(10), TotalTens(11)

def parse_2001_combined(ws):
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i < 1:
            continue
        rank_val = row[0]
        if not is_rank(rank_val):
            continue
        title = normalize_title(row[1])
        if not title:
            continue
        fid = get_film_id(title)
        if fid is None:
            fid = get_or_create_film(title)
        add_combined_ranking(
            film_id=fid, event_year=2001,
            combined_rank=int(float(rank_val)),
            dustin_rank=row[2], matt_rank=row[3], avg_rank=row[4],
            dustin_score=row[5], matt_score=row[6], total_score=row[7],
            dustin_impact=row[8], matt_impact=row[9], total_impact=row[10],
            total_tens=row[11],
        )

# 2007 Combined Rankings
# Header rows 0–1; data from row 2.
# Cols: 2001rank(0), Rank(1), Change(2), Film(3), DRank(4), MRank(5),
#       AvgRank(6), DScore(7), MScore(8), TotalScore(9), DImpact(10),
#       MImpact(11), TotalImpact(12), TotalTens(13)

def parse_2007_combined(ws):
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i < 2:
            continue
        rank_val = row[1]
        if not is_rank(rank_val):
            continue
        title = normalize_title(row[3])
        if not title:
            continue
        fid = get_film_id(title)
        if fid is None:
            fid = get_or_create_film(title)
        add_combined_ranking(
            film_id=fid, event_year=2007,
            combined_rank=int(float(rank_val)),
            dustin_rank=row[4], matt_rank=row[5], avg_rank=row[6],
            dustin_score=row[7], matt_score=row[8], total_score=row[9],
            dustin_impact=row[10], matt_impact=row[11], total_impact=row[12],
            total_tens=row[13],
        )

# 2016 Combined Rankings (note: sheet is named "2016 Combined Top 25" but has all 48)
# Header row 0; data from row 1.
# Cols: 2007rank(0), 2016rank(1), Change(2), Film(3), Year(4), DRank(5), MRank(6),
#       AvgRank(7), DScore(8), MScore(9), TotalScore(10), DImpact(11), MImpact(12),
#       TotalImpact(13), Tens(14)

def parse_2016_combined(ws):
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i < 1:
            continue
        rank_val = row[1]
        if not is_rank(rank_val):
            continue
        title = normalize_title(row[3])
        year  = row[4]
        if not title:
            continue
        fid = get_film_id(title, year)
        if fid is None:
            fid = get_film_id(title)
        if fid is None:
            fid = get_or_create_film(title, year)
        add_combined_ranking(
            film_id=fid, event_year=2016,
            combined_rank=int(float(rank_val)),
            dustin_rank=row[5], matt_rank=row[6], avg_rank=row[7],
            dustin_score=row[8], matt_score=row[9], total_score=row[10],
            dustin_impact=row[11], matt_impact=row[12], total_impact=row[13],
            total_tens=row[14],
        )

# 2026 Combined Rankings
# Header rows 0–1; data from row 2.
# Cols: 2001(0), 2007(1), 2016(2), 2026rank(3), Changes(4-6), Film(7),
#       Year(8), DRank(9), MRank(10), AvgRank(11), DScore(12), MScore(13),
#       TotalScore(14), DImpact(15), MImpact(16), TotalImpact(17), TotalTens(18)

def parse_2026_combined(ws):
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i < 2:
            continue
        rank_val = row[3]
        if not is_rank(rank_val):
            continue
        title = normalize_title(row[7])
        year  = row[8]
        if not title:
            continue
        fid = get_film_id(title, year)
        if fid is None:
            fid = get_film_id(title)
        if fid is None:
            fid = get_or_create_film(title, year)
        add_combined_ranking(
            film_id=fid, event_year=2026,
            combined_rank=int(float(rank_val)),
            dustin_rank=row[9], matt_rank=row[10], avg_rank=row[11],
            dustin_score=row[12], matt_score=row[13], total_score=row[14],
            dustin_impact=row[15], matt_impact=row[16], total_impact=row[17],
            total_tens=row[18],
        )

# ── Parse Movie Metadata (2026 Movie Data) ────────────────────────────────────
# Header rows 0–1; data from row 2.
# Cols: 2026Nominee(0), Title(1), Year(2), Acclaim(3), D(4), Hermz(5),
#       AFI100(6), AFIComedies(7), IMDB250(8), NYT2000s(9), SightSound(10),
#       VarietyComedies(11), NatFilmReg(12), Noms(13), Wins(14), Special(15),
#       BestPicture(16), BestDir(17), BestActor(18), BestActress(19),
#       BestSuppActor(20), BestSuppActress(21), Screenplay(22), Cinematog(23),
#       ProdDesign(24), Genre1(25), Genre2(26), Director(27),
#       Actor1(28), Actor2(29), Actor3(30), Actor4(31)

def parse_movie_data(ws):
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i < 2:
            continue
        title = normalize_title(row[1])
        year  = row[2]
        if not title:
            continue
        # Skip rows without title data
        if isinstance(title, float):
            title = str(int(title))

        key = title_key(title, year)
        if key not in films:
            # create film if not yet seen
            get_or_create_film(title, year)
            key = title_key(title, year)

        f = films[key]

        # Metadata
        f['director'] = normalize_title(row[27]) if row[27] else f['director']
        f['actor_1']  = normalize_title(row[28]) if row[28] else f['actor_1']
        f['actor_2']  = normalize_title(row[29]) if row[29] else f['actor_2']
        f['actor_3']  = normalize_title(row[30]) if row[30] else f['actor_3']
        f['actor_4']  = normalize_title(row[31]) if row[31] else f['actor_4']
        f['custom_genre_1']  = normalize_title(row[25]) if row[25] else f.get('custom_genre_1')
        f['custom_genre_2']  = normalize_title(row[26]) if row[26] else f.get('custom_genre_2')

        # Acclaim score (agreed shared score)
        if row[3] is not None:
            try:
                f['acclaim_score'] = int(float(row[3]))
            except (TypeError, ValueError):
                pass

        # Oscar data
        if row[13] is not None:
            try:
                f['oscar_nominations'] = int(float(row[13]))
            except (TypeError, ValueError):
                pass
        if row[14] is not None:
            try:
                f['oscar_wins'] = int(float(row[14]))
            except (TypeError, ValueError):
                pass

        # Oscar wins by category (X = won)
        f['won_best_picture']      = (str(row[16]).strip() == 'X')
        f['won_best_director']     = (str(row[17]).strip() == 'X')
        f['won_best_actor']        = (str(row[18]).strip() == 'X')
        f['won_best_actress']      = (str(row[19]).strip() == 'X')
        f['won_best_supp_actor']   = (str(row[20]).strip() == 'X')
        f['won_best_supp_actress'] = (str(row[21]).strip() == 'X')
        f['won_screenplay']        = (str(row[22]).strip() == 'X')
        f['won_cinematography']    = (str(row[23]).strip() == 'X')
        f['won_production_design'] = (str(row[24]).strip() == 'X')

        # External list appearances
        def list_rank(v):
            if v is None or v == '-':
                return None
            try:
                return int(float(v))
            except (TypeError, ValueError):
                return None

        f['afi_top100_rank']        = list_rank(row[6])
        f['afi_comedies_rank']      = list_rank(row[7])
        f['imdb_top250_rank']       = list_rank(row[8])
        f['nyt_2000s_rank']         = list_rank(row[9])
        f['sight_sound_2022_rank']  = list_rank(row[10])
        f['variety_comedies_rank']  = list_rank(row[11])
        f['national_film_registry'] = (str(row[12]).strip() == 'X') if row[12] else False

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("Loading workbooks…")
    wb1 = openpyxl.load_workbook(FILE_0107, read_only=True, data_only=True)
    wb2 = openpyxl.load_workbook(FILE_1626, read_only=True, data_only=True)

    # ── Step 1: Parse all individual lists ───────────────────────────────────
    print("Parsing individual rankings…")
    parse_2001_list(wb1["Martin 2001 List"], "dustin")
    parse_2001_list(wb1["Hermz 2001 List"],  "matt")
    parse_2007_list(wb1["Martin 2007 List"], "dustin")
    parse_2007_list(wb1["Hermz 2007 List"],  "matt")
    parse_2016_list(wb2["Martin 2016 List"], "dustin")
    parse_2016_list(wb2["Hermz 2016 List"],  "matt")
    parse_2026_list(wb2["Martin 2026 List"], "dustin")
    parse_2026_list(wb2["Hermz 2026 List"],  "matt")

    # ── Step 2: Parse combined rankings ──────────────────────────────────────
    print("Parsing combined rankings…")
    parse_2001_combined(wb1["2001 Combined Rankings"])
    parse_2007_combined(wb1["2007 Combined Rankings"])
    parse_2016_combined(wb2["2016 Combined Top 25"])
    parse_2026_combined(wb2["2026 Combined Rankings"])

    # ── Step 3: Enrich film metadata from Movie Data sheet ───────────────────
    print("Parsing movie metadata…")
    parse_movie_data(wb2["2026 Movie Data"])

    # ── Step 4: Compute unique films list ────────────────────────────────────
    unique_films = sorted(films.values(), key=lambda f: f['id'])

    print(f"\nSummary:")
    print(f"  Unique films:          {len(unique_films)}")
    print(f"  Individual rankings:   {len(individual_rankings)}")
    print(f"  Combined rankings:     {len(combined_rankings)}")

    # ── Step 5: Generate SQL ──────────────────────────────────────────────────
    lines = []
    lines.append("-- ============================================================")
    lines.append("-- Hermz & D — Movie Rankings Import")
    lines.append(f"-- Generated by movie_import.py")
    lines.append(f"-- Films: {len(unique_films)} | Individual: {len(individual_rankings)} | Combined: {len(combined_rankings)}")
    lines.append("-- Run in Supabase SQL Editor AFTER schema.sql")
    lines.append("-- ============================================================")
    lines.append("")
    lines.append("BEGIN;")
    lines.append("")

    # ── Films ─────────────────────────────────────────────────────────────────
    lines.append("-- ─────────────────────────────────────")
    lines.append("-- Films")
    lines.append("-- ─────────────────────────────────────")
    lines.append("")

    for f in unique_films:
        yr  = sql_int(f['release_year'])
        acc = f['acclaim_score']
        noms = f.get('oscar_nominations', 0) or 0
        wins = f.get('oscar_wins', 0) or 0

        lines.append(
            f"INSERT INTO public.films "
            f"(id, title, release_year, director, "
            f"actor_1, actor_2, actor_3, actor_4, "
            f"custom_genre_1, custom_genre_2, "
            f"acclaim_score, "
            f"oscar_nominations, oscar_wins, "
            f"won_best_picture, won_best_director, "
            f"won_best_actor, won_best_actress, "
            f"won_best_supp_actor, won_best_supp_actress, "
            f"won_screenplay, won_cinematography, won_production_design, "
            f"afi_top100_rank, afi_comedies_rank, imdb_top250_rank, "
            f"nyt_2000s_rank, sight_sound_2022_rank, variety_comedies_rank, "
            f"national_film_registry) "
            f"VALUES ("
            f"{f['id']}, {sql_str(f['title'])}, {yr}, "
            f"{sql_str(f['director'])}, "
            f"{sql_str(f['actor_1'])}, {sql_str(f['actor_2'])}, "
            f"{sql_str(f['actor_3'])}, {sql_str(f['actor_4'])}, "
            f"{sql_str(f.get('custom_genre_1'))}, {sql_str(f.get('custom_genre_2'))}, "
            f"{sql_int(acc) if acc else 'NULL'}, "
            f"{noms}, {wins}, "
            f"{sql_bool(f['won_best_picture'])}, {sql_bool(f['won_best_director'])}, "
            f"{sql_bool(f['won_best_actor'])}, {sql_bool(f['won_best_actress'])}, "
            f"{sql_bool(f['won_best_supp_actor'])}, {sql_bool(f['won_best_supp_actress'])}, "
            f"{sql_bool(f['won_screenplay'])}, {sql_bool(f['won_cinematography'])}, "
            f"{sql_bool(f['won_production_design'])}, "
            f"{sql_int(f['afi_top100_rank'])}, {sql_int(f['afi_comedies_rank'])}, "
            f"{sql_int(f['imdb_top250_rank'])}, "
            f"{sql_int(f['nyt_2000s_rank'])}, {sql_int(f['sight_sound_2022_rank'])}, "
            f"{sql_int(f['variety_comedies_rank'])}, "
            f"{sql_bool(f['national_film_registry'])}"
            f");"
        )

    lines.append("")
    lines.append(f"-- Set sequence for films to avoid conflicts")
    lines.append(f"SELECT setval('public.films_id_seq', {film_counter[0]}, false);")
    lines.append("")

    # ── Individual Rankings ───────────────────────────────────────────────────
    lines.append("-- ─────────────────────────────────────")
    lines.append("-- Individual Rankings")
    lines.append("-- ─────────────────────────────────────")
    lines.append("")
    lines.append(
        "INSERT INTO public.individual_rankings "
        "(film_id, event_id, user_id, rank, total_score, "
        "score_lead_performance, score_supp_performance, "
        "score_plot, score_dialogue, score_screenplay, "
        "score_direction, score_cinematography, score_production_design, "
        "score_influence, score_acclaim, score_personal_impact, "
        "tb_tens, tb_nines, tb_eights) "
        "VALUES"
    )

    ir_rows = []
    for r in individual_rankings:
        ir_rows.append(
            f"  ({r['film_id']}, "
            f"(SELECT id FROM public.ranking_events WHERE year = {r['event_year']}), "
            f"(SELECT id FROM public.profiles WHERE username = {sql_str(r['username'])}), "
            f"{r['rank']}, {sql_int(r['total_score'])}, "
            f"{sql_score(r['score_lead_performance'])}, {sql_score(r['score_supp_performance'])}, "
            f"{sql_score(r['score_plot'])}, {sql_score(r['score_dialogue'])}, "
            f"{sql_score(r['score_screenplay'])}, "
            f"{sql_score(r['score_direction'])}, {sql_score(r['score_cinematography'])}, "
            f"{sql_score(r['score_production_design'])}, "
            f"{sql_score(r['score_influence'])}, {sql_score(r['score_acclaim'])}, "
            f"{sql_score(r['score_personal_impact'], max_=20)}, "
            f"{sql_int(r['tb_tens'])}, {sql_int(r['tb_nines'])}, {sql_int(r['tb_eights'])})"
        )

    lines.append(",\n".join(ir_rows) + ";")
    lines.append("")

    # ── Combined Rankings ──────────────────────────────────────────────────────
    lines.append("-- ─────────────────────────────────────")
    lines.append("-- Combined Rankings")
    lines.append("-- ─────────────────────────────────────")
    lines.append("")
    lines.append(
        "INSERT INTO public.combined_rankings "
        "(film_id, event_id, combined_rank, dustin_rank, matt_rank, avg_rank, "
        "dustin_score, matt_score, total_score, "
        "dustin_impact, matt_impact, total_impact, total_tens) "
        "VALUES"
    )

    cr_rows = []
    for r in combined_rankings:
        avg = "NULL"
        if r['avg_rank'] is not None:
            try:
                avg = str(float(r['avg_rank']))
            except (TypeError, ValueError):
                avg = "NULL"
        cr_rows.append(
            f"  ({r['film_id']}, "
            f"(SELECT id FROM public.ranking_events WHERE year = {r['event_year']}), "
            f"{r['combined_rank']}, "
            f"{sql_int(r['dustin_rank'])}, {sql_int(r['matt_rank'])}, "
            f"{avg}, "
            f"{sql_int(r['dustin_score'])}, {sql_int(r['matt_score'])}, "
            f"{sql_int(r['total_score'])}, "
            f"{sql_int(r['dustin_impact'])}, {sql_int(r['matt_impact'])}, "
            f"{sql_int(r['total_impact'])}, {sql_int(r['total_tens'])})"
        )

    lines.append(",\n".join(cr_rows) + ";")
    lines.append("")

    # ── Finalize ──────────────────────────────────────────────────────────────
    lines.append("COMMIT;")
    lines.append("")
    lines.append("-- Validation queries (run after import):")
    lines.append("-- SELECT COUNT(*) FROM public.films;")
    lines.append("-- SELECT COUNT(*) FROM public.individual_rankings;")
    lines.append("-- SELECT COUNT(*) FROM public.combined_rankings;")
    lines.append("-- SELECT re.year, p.username, COUNT(*) FROM public.individual_rankings ir")
    lines.append("--   JOIN public.ranking_events re ON re.id = ir.event_id")
    lines.append("--   JOIN public.profiles p ON p.id = ir.user_id")
    lines.append("--   GROUP BY re.year, p.username ORDER BY re.year, p.username;")

    sql_content = "\n".join(lines)

    OUTPUT.write_text(sql_content, encoding="utf-8")
    print(f"\n✓  Wrote {OUTPUT}")
    print(f"   File size: {OUTPUT.stat().st_size:,} bytes")

    # ── Print validation breakdown ────────────────────────────────────────────
    from collections import Counter
    print("\nIndividual rankings by event + person:")
    counter = Counter((r['event_year'], r['username']) for r in individual_rankings)
    for key in sorted(counter):
        print(f"  {key[0]} {key[1]}: {counter[key]}")

    print("\nCombined rankings by event:")
    counter = Counter(r['event_year'] for r in combined_rankings)
    for key in sorted(counter):
        print(f"  {key}: {counter[key]}")

    films_with_metadata = sum(1 for f in unique_films if f['director'])
    print(f"\nFilms with metadata (director): {films_with_metadata}/{len(unique_films)}")
    films_with_acclaim = sum(1 for f in unique_films if f['acclaim_score'])
    print(f"Films with acclaim score:        {films_with_acclaim}/{len(unique_films)}")


if __name__ == "__main__":
    main()
