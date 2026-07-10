# Updates — Hermz & D Project Build Plan

Status key: 🔲 Pending · 🔄 In Progress · ✅ Complete

> ⚠️ **After every change:** Add an entry to the Minor Updates Log below AND update `src/pages/SiteUpdates.jsx` so the live changelog at `/updates` reflects the work.

---

## Completed Phases (1–10)

| Phase | Description |
|-------|-------------|
| 1 | Foundation: Vite/React, Tailwind, Supabase, Vercel deploy |
| 2 | Oscars: data model + historical import (2008–2026, 19 years) |
| 3 | Oscars: core display UI (year grid, ceremony detail, tiebreakers) |
| 4 | Oscars: stats dashboard (charts, streaks, category accuracy, drilldown) |
| Pre-5 | Light mode fixes, category accuracy redesign, edit mode |
| 5 | Movies: data model + import (305 films, 979 individual, 191 combined rankings) |
| 6 | Movies: list views (rankings, sort, movement indicators, vs-prior-event columns) |
| 7 | Movies: detail pages (rank history, score history, Oscar panel, rank chart) |
| 8 | Movies: stats & charts (bump chart, risers/fallers, score analysis, podcast prep) |
| 8.5 | Movie detail: full Oscar nomination breakdown via Wikidata SPARQL |
| 8.6 | Writer credit, hero sizing, score history UX, Oscar data accuracy fixes |
| 9 | Acclaim: inline editor on film pages + bulk management page (`/movies/acclaim`) |
| 9.5b | External Lists Browser: `/movies/lists` with 7 tabs, `external_list_entries` table |
| 10 | Oscars: New Year Entry System (3-step wizard, tiebreaker edit, RLS fix) |

**Notable additions within completed phases:**
- `writer` column on `films`; "Written by" shown on film detail pages and in stats charts
- Stats Charts tab: Top Screenwriters chart alongside Directors and Actors
- All Films page (`/movies/all`): all 305 films, all event ranks, sortable, searchable by title/director/actor/writer
- Rankings list (`/movies/list`): search by title/director/actor/writer
- External lists support films not yet in our DB (shown with "Not in our database" badge; auto-populates when film_id is linked)
- `film_oscar_noms` updated: `nominee_name` column added; unique indexes fixed so win + nomination rows coexist for acting categories
- OscarsYear: correct guesses colored in player's individual color — gold for Hermz, film blue for Dust
- Footer updated: Est. 1993
- Navbar: contextual sub-nav strip (2026-05-27) — removed standalone Stats top-level link; Oscars and Films are now direct links; a secondary strip renders below the main bar when inside either section, showing that section's pages; Watchlist and New Year links pushed to sub-nav right with cyan accent

---

## Tier 1 — Easy Wins
*Each item is a single focused session. Low risk, high immediate value.*

### 1A · Score History Color Scale Update ✅
- Already implemented: `>= 8` emerald, `>= 4` yellow, else red (matches spec)

### 1B · Expand Actors Display: 3 → 10 ✅
- Already implemented: `MovieDetail.jsx` pulls `actor_1` through `actor_10`

### 1C · Remove Redundant Sort Option ✅
- Already implemented: "Score (High→Low)" not in `sortOptions` in `MoviesList.jsx`

### 1D · Remove Bar Graph from Acclaim Scores Page ✅
- Already implemented: `ScoreBar` removed from `MoviesAcclaim.jsx`

### 1E · Alphabetical Sort: Ignore Leading Articles ✅
- `sortTitle()` helper added to `MoviesList.jsx` and `MoviesAll.jsx`; strips "A/An/The" before `.localeCompare()`

---

## Tier 2 — Small-Medium
*1–2 sessions each. Meaningful upgrades with moderate complexity.*

### 2A · Unified Home / Landing Page (Phase 11) ✅
**New page or overhaul of current home**
- ✅ Single landing page linking both Oscars and Movies sections
- ✅ Live Oscar standings (all-time H vs D record, current leader, most recent winner)
- ✅ Most recent ranking event #1 combined film with poster
- ✅ Quick stats strip: ceremonies, record, events, films ranked
- ✅ Bottom explore strip: links to All Films, External Lists, Crossover Stats, Oscar Stats

### 2B · Cross-Section Stats (Phase 11) ✅
**File:** `MoviesStats.jsx` — new "🔀 Crossover" tab
- ✅ Summary cards: total films on lists, with Oscar noms, with Oscar wins
- ✅ Filterable table: Winners / Noms Only / All
- ✅ Per-film: poster, best combined rank, wins count, noms count, per-event rank grid
- ✅ Expandable row: full list of win and nomination categories as pills
- ✅ Link from home page → `/movies/stats?tab=crossover`

### 2C · Oscar Wins / Nominations / Categories (incomplete) 🔄
**Files:** `supabase/oscar_noms_fetch.py`, `MoviesOscarBackfill.jsx`, film detail pages

**Problem:** ~120 films show nomination/win *counts* but no category breakdown. Wikidata film-page queries miss films not linked back from their own pages.

**Part A: Ceremony-page backfill tool** ✅
- Two-pass browser backfill live at `/movies/oscar-backfill`
- Pass 1 = film-page SPARQL; Pass 2 = ceremony-page SPARQL (queries Oscar ceremony entities via P805 qualifier)
- Force Re-fetch mode clears + re-fetches all, fixing stale data and sound category collapse
- QID_OVERRIDE distinguishes pre-2021 Sound Mixing/Editing correctly

**Remaining work:**
- 🔲 Audit films that still show incomplete or missing category breakdowns after backfill tool runs
- 🔲 Verify wins vs. nominations display accurately across all film detail pages
- 🔲 Part B (auto-fetch on new film add) — deferred to Phase 12

**How to run current backfill:**
1. Settings → Admin Tools → Oscar Noms Backfill
2. Switch to **Force Re-fetch** mode
3. After Pass 1 completes, click **Run Pass 2** for any amber films

### 2F · Known Issue — Oscar History Incomplete Categories ✅
- Fixed via the ceremony-page SPARQL pass in the enhanced backfill tool (2026-05-25)
- Use **Force Re-fetch + Pass 2** in Settings → Oscar Noms Backfill to re-populate affected films

### 2G · Known Issue — Sound Category Collapse in Oscar History ✅
- QID_OVERRIDE already correctly distinguishes pre-2021 sound categories in both the Python script and the browser backfill JS
- Fixed in practice by running **Force Re-fetch** in the backfill tool (clears stale data and re-applies QID_OVERRIDE correctly)

### 2E · Shareable Links (Deferred)
**Files:** `MovieDetail.jsx`, `OscarsYear.jsx`
- 🔲 Deep links to individual film pages or Oscar year results
- 🔲 Already route-based; may just need canonical URL display + copy-link button
- *Deprioritized — build after mobile QA and Phase 12*

---

## Tier 3 — Medium
*Multi-session. High value; some decisions or data work required.*

### 3A · Oscar Auto-Import Nominees (Wikidata) ✅
**Implemented 2026-05-25 — no Edge Function required; runs browser-side**

- ✅ `OscarsNewYear.jsx` Step 2: "Fetch from Wikidata" button → spinner → queries Wikidata ceremony entity by year → normalizes all categories via CATEGORY_NORM + QID_OVERRIDE → pre-fills all nominee inputs
- ✅ Clear success/empty/error feedback: success shows count of categories filled; empty message explains Wikidata lag (~1–2 weeks post-announcement); error shows the failure and falls back to manual entry
- ✅ Nominee counts shown as green badges on each category card after import
- ✅ Fully re-runnable — button always available, import overwrites current inputs

### 3B · "Future Consideration" Watchlist ✅
**Files:** `MoviesWatchlist.jsx`, `MovieDetail.jsx`, `Navbar.jsx`, `App.jsx`, `supabase/watchlist_schema.sql`, `lib/omdb.js`
- ✅ `watchlist` DB table with RLS (users see only their own rows); `film_id` nullable FK to `films`
- ✅ `/movies/watchlist` page — poster card grid, A–Z (article-aware) / Recent sort toggle
- ✅ Add Film modal — OMDB multi-result search (`?s=` endpoint via `searchFilmsByQuery`), duplicate detection, auto-links `film_id` if title already in `films` DB
- ✅ Remove button per card
- ✅ "Add to Watchlist" / "On My Watchlist" toggle button on every `MovieDetail.jsx` page
- ✅ Movies nav item converted to dropdown (Overview, Rankings, All Films, Stats, External Lists + divider + 🔖 My Watchlist for authenticated users)
- ✅ Will feed into Phase 12 nominations workspace (import from watchlist button — future build)

### 3C · Mobile Responsiveness (Phase 13) ✅ (initial pass 2026-05-25)

#### 13a — Layout & Navigation ✅
- ✅ Navbar: hamburger menu (☰/✕) on sm and below; full-page slide-down menu with all nav links, Movies section, Settings, sign-out, dark mode toggle
- ✅ Body scroll locked when mobile menu is open
- ✅ Page containers: existing `px-4 sm:px-6 lg:px-8` carries through correctly

#### 13b — Tables ✅
- ✅ `OscarsYear.jsx` category table: `overflow-x-auto` + `min-w-[480px]`
- ✅ `MoviesList.jsx` ranking table: `overflow-x-auto` + `min-w-[560px]`
- ✅ `MoviesLists.jsx` external list table: `overflow-x-auto` + `min-w-[480px]`
- ✅ `OscarsStats.jsx` drilldown table: `overflow-x-auto`
- ✅ `MoviesAll.jsx`: already had `overflow-x-auto` on card
- ✅ `OscarsNewYear.jsx` Step 3 guesses table: `overflow-x-auto` + `min-w-[480px]`

#### 13c — Charts & Stats ✅
- All Recharts components already use `ResponsiveContainer` — no changes needed

#### 13d — Film Detail Pages ✅
- `MovieDetail.jsx` hero: already `flex-col md:flex-row` (stacks on mobile)
- Score history table: already had `overflow-x-auto`
- Score/rank chart: ResponsiveContainer already in place

#### 13e — Forms & Wizards ✅
- `OscarsNewYear.jsx`: Step 3 table now scrollable on mobile

#### 13f — Grid fixes ✅
- `MoviesHome.jsx` event cards: fixed from `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`

#### Remaining (deferred)
- 🔲 QA pass at 375px/390px/768px: do a full visual test before next Oscar season
- 🔲 OscarsYear tiebreaker 3-col grid: functional but may be tight at 375px
- 🔲 Bump chart: horizontal scroll on narrow viewports still TODO

---

## Visual Overhaul — "Projector Room" (Dark Cinematic System)
*Delivered via Claude Design handoff docs, applied + deployed by Cowork*

### Phase 1 — Foundation + Home ✅ (2026-05-25)
- ✅ New Tailwind tokens: `night-950/900/800/700/600`, `gold-*` (warm vintage), `film-*` (cobalt), `cinema-*` (signal cyan), `cream-*`
- ✅ New fonts: Bebas Neue (display), Instrument Serif (italic accent), Geist/Geist Mono (UI)
- ✅ Global CSS: `.card`, `.card-hover`, `.btn-gold/film/ghost/cinema`, `.kicker`, `.pill`, `.input`, `.table-*`, movement indicators, `.scrim-bottom`
- ✅ ThemeContext: dark-first default (was light-first)
- ✅ Layout: simplified footer with EST. 1993 · HERMZ & D
- ✅ Navbar: new HERMZ & D logo in display type, gold/film colors; desktop dropdown redesign; mobile hamburger retained
- ✅ FilmStill component: cinematic poster tile with CSS gradient fallbacks keyed to title hash
- ✅ Home page: full-bleed hero with HERMZ & D headline + tagline; Top Six poster carousel (no overlays); ceremony winner ribbon replacing bar chart; score cards
- ✅ Hero height tightened; film poster title/year overlays removed
- ✅ Oscar Picks card: year-dot ribbon with gold/blue/cyan tiebreaker indicators + hover tooltips; larger text throughout

### Phase 2 — Oscars Pages ✅ (2026-05-25)
- ✅ OscarsHome
- ✅ OscarsYear
- ✅ OscarsStats
- ✅ OscarsNewYear

**Post-handoff refinements (2026-05-25):**
- ✅ Hero heights normalized to `h-[300px] sm:h-[340px]` across all Oscar pages (override any future handoff that shows taller heroes)
- ✅ Hero heights normalized to `h-[300px] sm:h-[340px]` across all Movies pages; no poster/src image in hero — gradient fallback only (override any future handoff that shows tall aspect-ratio heroes or poster-backed headers)
- ✅ Best Picture winner posters on OscarsHome year wall cards — three-tier fallback: DB `films.poster_url` → OMDB `?t=` with `year-1` → OMDB `?s=` fuzzy search (catches edge cases like *Everything Everywhere All at Once*)
- ✅ Winner label enlarged (`text-[11px] font-semibold`) and colored in player accent (gold/film/cyan)
- ✅ Tiebreaker indicator: top color strip turns cyan, `◆ TB` badge with cyan border, winner label appends `· TB`
- ✅ Year wall grid: `lg:grid-cols-4 xl:grid-cols-5` (was 5 cols at lg); cards bigger, gap `gap-4`; bottom scrim tightened to lower third so poster shows more; score chips slightly shorter (`py-1`)

### Phase 3 — Movies Pages ✅ (2026-05-25)
- ✅ MoviesHome — full-bleed hero keyed to current #1 combined film, 2×2 event grid with 3 poster tiles each
- ✅ MoviesList — FilmStill hero, event/view pill selectors, list & grid display modes, sort/search
- ✅ MovieDetail — full-bleed poster-backed hero, floating rank panel, recharts movement chart, score history table, OscarNomsList

### Phase 2 — Known Issue ✅ (resolved 2026-05-29)
- ✅ OscarsYear and OscarsStats visual regression investigated and resolved

### Phase 4 — Auxiliary ✅ (2026-05-25)
- ✅ Login, Settings, Admin/backfill tools (MoviesBackfill, MoviesOscarBackfill)
- ✅ MoviesWatchlist, MoviesLists, MoviesAcclaim, MoviesAll, MoviesStats

**Post-Phase-4 fixes and enhancements (2026-05-25 / 2026-05-26):**
- ✅ MovieDetail hero: poster thumbnail restored — `film.poster_url` rendered as `130×193px` in hero bottom-left, beside title block; desktop-only; conditional on poster existing
- ✅ MovieDetail hero: removed kicker label above title ("No. X · YEAR Combined")
- ✅ MovieDetail acclaim: removed "AGREED · OUT OF TEN" label under score
- ✅ Score History: replaced standalone table with `ScoreSection` — Chart/Table toggle; Chart view = Recharts RadarChart (Dust + Hermz overlaid, event year selector, Personal Impact ÷2 for display); Table view = original columns preserved
- ✅ Fun Facts card: new section at bottom of film detail page consolidating three sub-sections — Head to Head (gap + visual bar chart history), Director filmography (peer tiles with all 3 ranks), Also From [year] (same); always-render with empty state copy when no other canon films found; peer tiles show Dust/Hermz/Combined rank from latest event
- ✅ Fun Facts — Ranking Insights (2026-05-27): `generateInsights()` function produces up to 5 narrative blurbs (2–3 sentences each, podcast-ready) from live DB data. Insight types: gap/divisiveness, solo ranker, historical movement, late arrival, combined list placement, Oscar story, Sight & Sound / IMDB acclaim, perfect scores, biggest score disagreement. Displayed as left-border paragraph strip below head-to-head. Director/year peer tiles moved to separate `FilmPeers` component below Fun Facts (two distinct cards).
- ✅ MovieDetail header polish (2026-05-27): rank numbers increased to `text-5xl`; year removed from RankBig; watchlist button relocated to top-right header area below Fix Info; director/writer credit font increased to `text-lg sm:text-xl`; FunFacts peer tiles alphabetized with article-aware sort (`A/An/The` stripped before sort)

---

## Tier 4 — Large
*Phase 12: New Ranking Event Workflow*
*End-to-end in-app experience: nominate → acclaim → score → rank*
*Build when the next ranking event is approaching.*

### 12a — Event Creation
- 🔲 Create event (year, name, description); status field: `nominations` → `acclaim` → `scoring` → `complete`
- 🔲 Event appears in selectors across all Movies views once created

### 12b — Nomination Phase
- 🔲 Per-user workspace at `/events/[year]/nominate` (each person sees only their own)
- 🔲 Type-ahead OMDB film search with existing-film detection and duplicate guard
- 🔲 New film addition: populate from OMDB, manual override, custom genre assignment
- 🔲 Auto-fetch Oscar data on film addition (Wikidata SPARQL, single-film, real-time)
- 🔲 Running nomination list (poster grid or compact list); progress counter (X / 125)
- 🔲 Lock nominations independently; advance to Acclaim once both locked

### 12c — Acclaim Workspace
- 🔲 Combined pool view (union of both nomination lists, deduped)
- 🔲 Inline acclaim score editing; algorithm auto-suggest button per film
- 🔲 Context panel: poster, Oscar data, external list appearances, prior acclaim score
- 🔲 Completion tracking; bulk tools (confirm existing, apply suggestions with review step)
- 🔲 Lock acclaim; advance to Scoring

### 12d — Individual Scoring Phase
- 🔲 Per-user scoring workspace (other person's scores hidden until both locked)
- 🔲 Film-by-film scoring across all categories; live running total; live rank preview
- 🔲 Auto-save; resume where left off; progress indicator

### 12e — Final Ranking & Results
- 🔲 Individual rankings: sorted by total score; tiebreaker: Personal Impact → most 10s → most 9s…
- 🔲 Combined ranking: combined score = both individual scores + acclaim; tiebreaker: avg rank → total score → total 10s → total Personal Impact
- 🔲 Results view (mirrors existing list views); sort controls; seal event (marks `complete`, read-only)
- 🔲 Overlap stats on completion

### 12f — Automated List Import
- 🔲 IMDB Top 250 auto-fetch via TSV at `https://datasets.imdbws.com/title.ratings.tsv.gz` — cross-reference against `films.omdb_id`, generate update SQL (`supabase/imdb_top250_update.py`)
- 🔲 IMDB snapshot captured on a specific date for ranking purposes (since it fluctuates)

### 12g — Acclaim Algorithm Rule Overrides
*(Don't build until Dustin provides full rule spec)*
- 🔲 Hard override rules (e.g. Best Picture win → suggestion = 10)
- 🔲 Config UI for reviewing/adjusting rules without code changes
- 🔲 "Why this score?" explainer on the suggestion panel

---

## Open Decisions Needed

| Topic | Question |
|-------|----------|
| Acclaim algorithm | Should Best Picture win hard-floor at 10? Should NFR carry more weight? Revisit `suggestAcclaim()` before next ranking event |
| Genre strategy | ✅ Resolved: OMDB primary genre only; custom taxonomy stored but not used; Action+Adventure merged into Action/Adventure via `normalizeGenre()` |
| Acclaim snapshots | For variable lists (IMDB Top 250, Variety): snapshot at a fixed date vs. live-updating? |
| Oscar auto-import | Should Wikidata fetch be re-runnable after initial import, or lock once saved? |
| Watchlist storage | Dedicated DB table vs. `profiles` JSONB column for Future Consideration films? |

---

## ⚠️ Git Safety Rules (DO NOT SKIP)

**What happened on 2026-05-28:** A force-push from a stale repo copy wiped 8+ commits from GitHub. Vercel deployed the old code. The site appeared to roll back a week. Recovery required GitHub API tricks and took hours.

**Never do this again:**
1. **Always `git pull origin main` before ANY push.** If the remote is ahead, stop and sync first.
2. **Never `git push --force` without explicitly confirming the local commit is newer than the remote.** Run `git log --oneline -5` and `git ls-remote origin main` to compare SHAs before force-pushing.
3. **The hermz-work working dir (`~/hermz-work`) can go stale between sessions.** Always pull at the start of every session.
4. **A backup zip lives at:** `/Users/dustin/Documents/Claude/Projects/Hermz and D Movies/hermz-and-d-backup-2026-05-28.zip` — update it after major sessions.

---

## Minor Updates Log

 - **2026-07-10** Poster title overlays removed in two spots: MoviesHome `PosterTile` (top-film tiles on the landing page) and the MoviesList grid view. Titles were printed over the posters; now poster-only (labels/badges remain). SiteUpdates entry updated.

 - **2026-07-10** Rankings grid — removed film-title overlay that had reappeared over posters in the grid view (`MoviesList.jsx`); kept rank badge, movement arrow, year/score line, softened gradient. SiteUpdates entry added.

- **2026-06-10** Watchlist — Add Film modal no longer closes unexpectedly while searching. Fixed fragile `e.target === e.currentTarget` pattern on outer wrapper; replaced with `onClick={onClose}` on the backdrop div + `stopPropagation()` on the modal panel.

- **2026-05-30** Oscar Stats — Category Streaks section added (`OscarsStats.jsx`). Three sub-sections: Currently Hot (active correct streaks ≥3 on live categories), Currently Cold (active miss streaks ≥3), All-Time Records (longest correct streaks ever, top 12). `buildCatStreaks()` computes current and all-time streaks with year ranges for each category × person pair.
- **2026-05-30** Oscar Stats overhaul (`OscarsStats.jsx`). Championship Race chart removed. Added: Category Heatmap (year × category grid — cyan=both/gold=Hermz/blue=Dust/dark=neither, each cell links to ceremony); Streak Tracker (visual year-block timeline in Win Streaks card); Annual Difficulty Rating (full-width ranked list, Chalk/Average/Tough/Brutal tiers); Category Ownership Cards (per-category leader grid grouped by section); Agreement Rate stats merged into Peak & Valley card (agree %, when-agreed accuracy, each player's edge when disagreeing). Radar tab added then removed per feedback. Font sizes increased throughout Difficulty and Ownership sections.

- **2026-05-30** Oscars heroes — Hunter Scott Oscar trophy photo (Unsplash, free license) added to OscarsHome, OscarsYear, and OscarsStats. mix-blend-mode:screen, desktop only. (Note: photo swap candidate — replace when a better dark/dramatic shot is found.) mix-blend-mode:screen on black bg drops the dark areas, leaving the gold statuette glowing in the hero gradient. Desktop only.
- **2026-05-30** Navbar — OscarIcon removed from the Oscars nav link (desktop and mobile menu).
- **2026-05-30** Settings page cleanup — stale "Pending Supabase Steps" SQL section removed, visual tightening pass. Dark mode toggle removed (Projector Room is dark-only; light mode was never rebuilt for the new design system).
- **2026-05-30** Rankings hero: Jason Dent b&w projector photo (Unsplash, free license). mix-blend-mode:screen drops the dark background, leaving glowing metallic projector body over the hero gradient. No beam overlay — photo stands alone. to upper-right of hero (desktop only). SVG with two film reels, lens barrel, legs, and bright aperture center. Conic + radial gradients create a light beam cone from the lens toward the lower-left text area. Beam color matches view accent (cinema cyan / gold / film blue).
- **2026-05-30** Rankings hero: view-aware accent colors. Combined → cinema cyan gradient + cyan text; Dust → film blue; Hermz → gold. Combined hue fixed from 220 (indigo) to 178 (cinema cyan).
- **2026-05-29** Future Consideration — "Seen It" tab renamed to "First Watch" across tab label, move button, and Add Film modal.
- **2026-05-29** Future Consideration — Want to Watch cards now show two move buttons on hover: "→ First Watch" (blue) and "→ Rewatch" (teal), replacing the single "→ First Watch" button.
- **2026-05-29** Cinematrix podcast section launched. New top-level nav item "Cinematrix" (teal accent) at `/podcast`. `PodcastHome.jsx` — episode grid pulling live 2026 combined rankings, ordered worst-to-best (Ep 1 = last-ranked, Ep N = #1). Episode 0 pinned as the intro episode. `PodcastEpisode.jsx` — per-episode page: film hero with blurred poster backdrop, In The Canon ranking history table, Talking Points (narrative insights from ranking data), Oscar Story, On The Lists, full 2026 Score Breakdown, Show Notes scaffold (auto-filled header/stats/links + placeholder talking points/timestamps/synopsis). Prev/next episode navigation. Routed at `/podcast/:episodeNum`. Show notes template to be expanded later with user-provided structure.

- **2026-05-05** Oscar Noms Backfill page added at `/movies/oscar-backfill`. Settings → Admin Tools → Oscar Noms Backfill. Queries Wikidata film-page SPARQL for each film with zero rows in film_oscar_noms, inserts category-level results. Full CATEGORY_NORM + QID_OVERRIDE from oscar_noms_fetch.py ported to JS.
- **2026-05-05** Fix Info panel expanded: Oscar nomination editor — add/delete film_oscar_noms entries per film directly from detail page. Category dropdown (26 presets + custom), won/nom toggle, optional nominee + ceremony year. Fixes the 120-film incomplete Oscar data issue without needing to re-run Wikidata script.
- **2026-05-05** Les Misérables (2012, film id=241) had wrong OMDB data (was matched to *The Score* tt0227445). Added override `"les miserables:2012": "tt1707380"` to `omdb_fetch.py`, cleared bad cache entry. Run SQL fix in Supabase + re-run `omdb_fetch.py` to restore correct poster.
- **2026-05-05** 3B Watchlist complete. `watchlist` table + RLS, `/movies/watchlist` page (poster grid, OMDB search modal, A–Z/Recent sort, remove), "Add to Watchlist" button on all film detail pages, Movies nav converted to dropdown with Watchlist link. Run `watchlist_schema.sql` in Supabase to activate.
- **2026-05-25** 2C/2F/2G complete. `MoviesOscarBackfill.jsx` overhauled: Force Re-fetch mode (clears + re-fetches all, fixes sound category collapse and incomplete sets), ceremony-page SPARQL pass (queries Oscar ceremony entities via P805 qualifier for amber films), parallel film-side + actor-side queries per ceremony year. Run from Settings → Admin Tools → Oscar Noms Backfill.
- **2026-05-25** 3A complete. `OscarsNewYear.jsx` Step 2: "Fetch from Wikidata" button auto-populates all nominee inputs from Wikidata ceremony entity for the given year. CATEGORY_NORM + QID_OVERRIDE applied; success/empty/error feedback; fully re-runnable.
- **2026-05-27** Scores tab redesign. Average Scores section replaced with dumbbell chart — one horizontal track per category with a colored dot for Dust (blue) and Hermz (gold) connected by a tinted gap line; scores and colored diff label on right. Diff label bumped to `text-sm font-semibold`. Category labels now `text-gray-100` (near white). Perfect Scores section replaced with category card grid — each category is a clickable card showing Dust/Hermz counts as display-font numbers; cards highlight on active selection. Clicking a card expands a full-width film drilldown panel below the grid: two columns (Dust · Hermz) listing every film that earned that perfect score in rank order, with rank, title (links to film detail), and score value. Results cached per event+category; panel collapses on re-click or ✕. `ScoreAnalysisTab` now receives `profiles` and `events` props from parent. Perfect score card category labels and section subtitle updated to white.
- **2026-05-27** All Events tab legibility pass. `AlwaysPresentSection` and `InAndOutSection` year/rank labels redesigned: year abbreviation (`'01` etc.) in small dim text stacked above rank number in `text-sm font-semibold text-gray-200`. `NR` entries now `text-gray-600` (was near-invisible `text-gray-700`). `MovementCard` year/rank subtitle upgraded from `text-xs text-gray-500` to `text-sm text-gray-400` with rank numbers in `text-gray-200 font-semibold`. Bump chart Y-axis tick font bumped from 11px → 12px.
- **2026-05-29** Films landing page cleanup — "No. 1 combined" subtitle removed from hero; Stats & Charts and All Films elevated to ghost buttons in hero; "Four Editions" kicker removed; poster label dots removed, size bumped to 13px; bottom "View Movie Stats" button removed.
- **2026-05-29** Rankings hero redesigned — year (gold) and "EDITION" (white) are now the dominant headline at display scale; film count demoted to subtitle.
- **2026-05-29** Nomenclature unified — "The Canon" is the system name; each ranking session (2001, 2007, 2016, 2026) is an "Edition." Replaced "ranking event/events" → "edition/editions" and removed Volume I–IV across MoviesList, MoviesHome, MoviesLists, MoviesWatchlist, MovieDetail, and Home.jsx.
- **2026-05-29** Phase 6 — Films Deep canvas alignment. MoviesList: mono kicker + volume headline in hero ("X FILMS, RANKED."), grid-view poster cards with title/score/movement overlays. MovieDetail: scorecard 3-way toggle — Bars (default, side-by-side category bars) · Radar · Table. MoviesWatchlist: "ADDED · MON YYYY" caption on Want to Watch cards. MoviesStats: all panel headers converted to PanelHeader (display title + mono subtitle). Global readability pass — no text below 11px in all four Files pages.
- **2026-05-29** Oscar Stats: all-time correct percentage now to hundredths (e.g. 73.24%) in hero panel and All-Time Correct card. `pctFull` + `pctStrFull` helpers added.
- **2026-05-29** Oscar Year + Stats pages: Phase 5 redesign. Year page: categories grouped to match Stats (Major Awards / Acting / Writing / Craft / Music & Sound / Short Films / Discontinued), single column, text tiles with ✓/✗, nominee field + edit mode fully preserved. Stats: compact hero, accuracy panel at baseline.
- **2026-05-29** Site Updates page font pass — date labels, tag pills, entry text, and hero subtitle all bumped up for legibility.
- **2026-05-29** Future Consideration UI polish. Renamed from "Watchlist / Up Next" to "Future Consideration" throughout. Seen It and Rewatched cards redesigned — poster now flush left filling full card height (same visual weight as Want to Watch tiles), all content stacks to the right. Grid reduced to 2-column so cards have room to breathe. Poster/font sizes increased across all three tabs. "Add notes" CTA changed from invisible gray text to a teal dashed-border pill button. Existing notes text bumped to `text-sm text-gray-300`.
- **2026-05-28** Site Updates changelog page added at `/updates`. Clock icon added to navbar right side (left of gear). Lists all updates chronologically, newest first, grouped by date with tag pills (Oscars/Films/Design/Mobile/System). Covers all updates back to Phase 1 launch. Mobile menu includes a "Site Updates" link too.
- **2026-05-28** Watchlist overhauled: three-list system — Want to Watch (unseen), Seen It (first_time), Rewatched (rewatch). First Watch and Rewatch tabs show notes cards (poster + click-to-edit notes textarea). Unseen tab keeps the original poster grid with a quick "→ Seen It" action. Add Film modal has a list-type selector defaulting to the active tab. Move-between-tabs actions on every card. Run `watchlist_add_columns.sql` in Supabase to activate (`list_type` column + `notes` column + UPDATE RLS policy).
- **2026-05-28** Combined ranking color normalized to cinema-500 (`#00E0D9`) across all Movies pages. `MovieDetail` CC was wrong (emerald `#10b981`) — corrected. `MoviesAll` `RankCell` combined variant was uncolored — now uses CC. `MoviesLists` Combined column header now styled CC. `MoviesList` combined-view rank number now styled CC. `CC` constant added to all files that lacked it.
- **2026-05-28** Genre stats use OMDB primary genre only. Custom genres (`custom_genre_1`) removed from `primaryGenre()` in `MoviesStats.jsx` — OMDB first genre is sole source. `normalizeGenre()` helper added: maps "Action" and "Adventure" → "Action/Adventure". Decade and genre charts on Charts tab replaced with `HBarChart` — ranked horizontal bars with proportional gradient fills, subtle glow, and display-font counts.
- **2026-05-27** MoviesStats Charts tab redesign. `LeaderboardBar` replaced on Charts tab with three distinct components: `DecadeChart` = horizontal era cards with opacity-scaled fill/border; `GenreChart` = pill tag cloud sized by frequency; `PersonChart` = clean `RosterList` (numbered divider rows, no fill). Actors limited to `actor_1–3` (top-billed only) to eliminate ensemble noise.
- **2026-05-27** MoviesStats Rivalry tab polish. Taste Face-Off moved to top of Rivalry tab. "spots" and "avg gap" labels removed. The Flip text sizes increased (year full form, gap `text-base bold`, ranks `text-xs`). Four-dot event presence indicators added to Most Polarizing (teal) and Most Agreed-Upon (emerald) — dots keyed to all 4 years, filled when shared ranking exists that year. `mostPolarizing` / `mostAgreed` useMemo now includes `years: Set` of shared event years.
- **2026-05-27** MoviesStats Taste Face-Off moved to Rivalry tab with year toggle. `TasteComparisonSection` refactored to accept `{ allH2HFilms, loading }` with internal `selectedYear` state and pill selectors for 2001/2007/2016/2026. New `allH2HFilms` state + useEffect loads all 4 years' H2H data in parallel on profiles/events load. Charts tab Face-Off block removed. `RivalryTab` accepts and renders Face-Off at top.
- **2026-05-27** MoviesStats global font size pass. All `text-[9px/10px/11px]` kicker labels bumped. Subtitle text `text-sm → text-base`. Film title rows `text-sm → text-base`. LeaderboardBar count `text-xl → text-2xl`. QuickStats values `text-base → text-xl`.
- **2026-05-26** MoviesStats.jsx full overhaul. Bar charts (Decade, Genre, Directors, Actors, Screenwriters) replaced with elegant `LeaderboardBar` component — cinematic leaderboard rows with subtle background fill, rank numbers, and display-font counts. New Rivalry tab: Biggest Gaps (Dust Favors / Hermz Favors, event filter), Most Polarizing, Most Agreed-Upon, The Flip (allegiance switches), Solo Picks (films only one person ever ranked). All Events tab: new All-Time Arc section. Scores tab: new Perfect Scores section. Tabs reordered: Charts | All Events | Rivalry | Scores | Podcast Prep | Crossover.
- **2026-05-25** Phase 4 Projector Room visual overhaul complete. All 9 auxiliary pages reskinned: Login (cinematic backdrop card), Settings (dark admin tool cards), MoviesAll (hero + sortable archive table), MoviesLists (hero + tab strip + dot-grid overlap), MoviesAcclaim (hero + stats strip + inline editor), MoviesWatchlist (hero + poster grid + add modal), MoviesBackfill (dark admin UI), MoviesOscarBackfill (dark admin UI, all SPARQL preserved), MoviesStats (hero + all 5 tabs dark). Hero heights normalized to `h-[300px] sm:h-[340px]`. Projector Room migration complete — every route is on the dark cinema system.
- **2026-05-25** Phase 3 visual overhaul (Projector Room) applied to Movies pages: MoviesHome, MoviesList, MovieDetail. All Supabase queries, edit logic, OMDB refresh, watchlist toggling, and recharts behaviour preserved. Pages: `/movies`, `/movies/list`, `/movies/:filmId`.
- **2026-05-25** Phase 2 visual overhaul (Projector Room) applied to all Oscar pages. Post-handoff: hero heights locked to `h-[300px] sm:h-[340px]` (override future handoffs if different), BP winner posters on year wall (3-tier OMDB fallback), larger winner label, cyan tiebreaker treatment, larger year wall cards.
- **2026-05-25** 3C mobile pass. Navbar: hamburger + full-page mobile menu (all links, Settings, sign-out). Tables: `overflow-x-auto` added to OscarsYear, MoviesList, MoviesLists, OscarsStats. MoviesHome event grid: `grid-cols-1 sm:grid-cols-2`. OscarsNewYear Step 3 table: scrollable on mobile.
- **2026-05-05** Grid/list view toggle added to `MoviesList.jsx`. List is default. Grid shows large poster cards (auto-fill responsive grid) with rank badge + title overlay only — no scores, no prior-year comparisons, sort hidden. Toggle sits in the toolbar row.
- **2026-05-05** Crossover tab refined: fixed noms count (wins included in total), added major category "Won:" filter buttons (Picture/Director/Actor etc.), added "List:" year filter (All/2001/2007/2016/2026), year-aware sorting and rank column header, removed Events column.
- **2026-05-05** 2A + 2B complete. Home.jsx overhauled: live Oscar standings, recent event #1 film, stats strip, explore links. MoviesStats.jsx: new Crossover tab with Oscar × rankings data, filterable table, expandable category pills.
- **2026-05-05** Actor stats updated: QuickStats top actor card (5-card grid), ActorChart now uses actor_1–10, subtitles cleaned up. Git remote fixed — direct push from sandbox working again.
- **2026-05-05** All changes pushed and deployed to Vercel (force push resolved stale remote). Settings, TMDb backfill, article-aware sort, actor x10 all live.
- **2026-05-05** Settings page built at `/settings` — gear icon in navbar, Admin Tools section (Dustin only), Pending SQL steps, Account info. Backfill NaN error fixed (removed actor_6–10 from SELECT; those columns may not exist until migration is run). Backfill back-link now points to /settings.
- **2026-05-05** TMDb integration built: `src/lib/tmdb.js`, `/movies/backfill` admin page, route added to App.jsx. OMDB normalise updated to slice 10. `.env.example` updated with `VITE_TMDB_API_KEY`. To activate: (1) get free TMDb key at themoviedb.org/settings/api, (2) add to `.env` + Vercel, (3) run `add_actor_columns.sql` in Supabase, (4) visit `/movies/backfill`.
- **2026-05-05** All Tier 1 easy wins complete. Article-aware sort added to MoviesList + MoviesAll. Actor columns extended to 10 in schema, omdb_fetch.py, omdb_update.sql, and MoviesAll query. Migration SQL: `add_actor_columns.sql`.
- **2026-05-05** updates.md reorganized into priority tiers (Tier 1 easy wins → Tier 4 large)
- **2026-05-04** Footer updated: Est. 1993 (was 1995)
- **2026-05-04** OscarsYear: correct guesses now colored in player's individual color — gold for Hermz, film blue for Dust (both text and ✓ checkmark)
