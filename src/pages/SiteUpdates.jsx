// SiteUpdates.jsx — Chronological changelog of all site updates

const UPDATES = [
  {
    date: 'May 30, 2026',
    entries: [
      {
        tag: 'Design',
        color: 'cinema',
        text: 'Rankings hero — Jason Dent b&w projector photo (Unsplash) placed in the upper-right of the Rankings page hero. mix-blend-mode:screen drops the dark background and leaves the glowing metallic projector body over the cinematic gradient. Desktop only.',
      },
      {
        tag: 'Design',
        color: 'cinema',
        text: 'Rankings hero — view-aware accent colors. Combined view uses cinema cyan for the gradient, kicker, and year number. Dust uses film blue, Hermz uses gold. Previously all three views showed gold.',
      },
      {
        tag: 'System',
        color: 'gold',
        text: 'Settings page cleanup — stale "Pending Supabase Steps" SQL section removed. Non-functional dark mode toggle removed (the Projector Room design system is dark-only; light mode was never rebuilt for it).',
      },
    ],
  },
  {
    date: 'May 29, 2026',
    entries: [
      {
        tag: 'Films',
        color: 'film',
        text: 'Future Consideration — "Seen It" tab renamed to "First Watch" across the tab bar, move button, and Add Film modal.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Future Consideration — Want to Watch cards now show two move buttons on hover: "→ First Watch" (blue) and "→ Rewatch" (teal), so a film can be moved to either list in one tap.',
      },
      {
        tag: 'Podcast',
        color: 'cinema',
        text: 'Cinematrix launched — new top-level section at /podcast. Landing page lists Episode 0 (origin story) followed by all 2026 combined films ordered from last-ranked to #1 (each becomes a numbered episode). Individual episode pages pull full film data: ranking history across all editions, narrative talking points from ranking data, Oscar story, external list appearances, score breakdown by category, and a show notes scaffold. Prev/next navigation between episodes. "Cinematrix" added to desktop nav and mobile menu.',
      },
      {
        tag: 'Design',
        color: 'cinema',
        text: 'Films landing page cleanup — "No. 1 combined" subtitle removed from hero. Stats & Charts and All Films elevated to ghost buttons in the hero. "Four Editions" section header removed (redundant with the year grid). Dots removed before Combined / Dust / Hermz poster labels, label size bumped. Bottom "View Movie Stats" button eliminated.',
      },
      {
        tag: 'Design',
        color: 'cinema',
        text: 'Rankings hero redesigned — year and edition are now the dominant headline. "2026" in gold and "EDITION" in white sit side by side at the same display scale. Film count moved to the italic subtitle line.',
      },
      {
        tag: 'Design',
        color: 'cinema',
        text: 'Nomenclature unified — "The Canon" is the name of the overall ranking system. Each ranking session is now an "Edition" (2026 Edition, 2016 Edition, etc.). Replaced all instances of "ranking event/events" and "Volume I–IV" across Rankings, Films landing, Film Detail, Stats, External Lists, Future Consideration, and the home page.',
      },
      {
        tag: 'Design',
        color: 'cinema',
        text: 'Phase 6 visual overhaul — Films pages canvas alignment and readability pass. Rankings page: new mono kicker in hero, grid view upgraded to full poster cards with title/score/rank-movement overlays. Film Detail: scorecard now has a 3-way toggle — Bars (default, side-by-side dual bars per category), Radar, and Table. Future Consideration: "Added · MON YYYY" caption added to each Want to Watch card. Stats panels: all headers converted to display-title + mono subtitle format. Global readability pass across all four pages — no text smaller than 11px.',
      },
      {
        tag: 'Oscars',
        color: 'gold',
        text: 'Oscar Stats — all-time correct percentage now shown to the hundredths place (e.g. 73.24%) in the hero panel and the All-Time Correct Guesses card. Win-by-year percentages unchanged.',
      },
      {
        tag: 'Oscars',
        color: 'gold',
        text: 'Oscar Year and Stats pages redesigned — Projector Room visual system. Oscar Year: categories grouped to match Stats page (Major Awards, Acting, Writing, Craft, Music & Sound, Short Films, Discontinued), single-column layout, Winner / Hermz / Dust as text tiles with ✓/✗, full nominee field and all edit-mode functionality preserved. Oscar Stats: compact hero height, accuracy panel anchored to the hero baseline.',
      },
      {
        tag: 'Design',
        color: 'cinema',
        text: 'Site Updates page font pass — date labels, tag pills, entry text, and hero subtitle all bumped up for legibility.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Future Consideration overhaul — renamed from "Watchlist / Up Next." Seen It and Rewatched cards redesigned with a full-height flush poster on the left and all content stacked to the right. "Add notes" is now a teal dashed-border button. Grid reduced to 2-column.',
      },
    ],
  },
  {
    date: 'May 28, 2026',
    entries: [
      {
        tag: 'Films',
        color: 'film',
        text: 'Watchlist upgraded to three lists — Want to Watch (films not yet seen), Seen It (first-time views with notes for ranking consideration), and Rewatched (rewatches with ranking notes). Films can be moved between lists with one tap. Notes are click-to-edit inline.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Combined ranking color unified to teal across all Films pages — Rankings, All Films, External Lists, and Film Detail now all use consistent cinema-teal for combined-rank numbers.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Genre stats now use OMDB\'s primary genre exclusively. "Action" and "Adventure" merged into "Action/Adventure." Decade and Genre charts replaced with ranked horizontal bar displays with gradient fills.',
      },
    ],
  },
  {
    date: 'May 27, 2026',
    entries: [
      {
        tag: 'Films',
        color: 'film',
        text: 'Score History redesigned — new dumbbell chart shows Dust vs. Hermz scores side-by-side per category with a colored gap line. Perfect Scores section rebuilt as a clickable card grid: tap any category to expand a full drilldown showing every perfect-scoring film in rank order.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'All Events tab legibility improvements — year labels, rank numbers, and NR indicators made significantly more readable with higher contrast.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Film detail pages now include Ranking Insights — up to 5 podcast-ready narrative blurbs generated from live data. Stories include: divisiveness gaps, films only one of us ranked, historical rank movement, late arrivals, Oscar crossover, Sight & Sound / IMDB acclaim, perfect scores, and biggest score disagreements.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Film detail header polish — rank numbers enlarged, watchlist button moved to top-right for easier access, director/writer credits made larger.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Stats Charts tab redesigned — Decade, Genre, and Person charts rebuilt as distinct components: era cards with opacity-scaled fills, pill tag cloud sized by frequency, and a clean numbered roster list.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Stats Rivalry tab polished — Taste Face-Off moved to the top. Most Polarizing and Most Agreed-Upon films now show four-dot event presence indicators (teal dots for each of the 4 ranking events where the film appeared on both lists).',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Taste Face-Off moved into the Rivalry tab with a year toggle — browse 2001, 2007, 2016, and 2026 head-to-head comparisons all in one place.',
      },
      {
        tag: 'Design',
        color: 'cinema',
        text: 'Global font size pass across Stats pages — all small kicker labels, subtitles, film title rows, and count displays bumped up for legibility.',
      },
      {
        tag: 'Design',
        color: 'cinema',
        text: 'Contextual sub-nav strip added to the top navbar — when inside Oscars or Films, a secondary strip below the main bar shows that section\'s pages. Watchlist and New Year links live in the sub-nav right edge.',
      },
    ],
  },
  {
    date: 'May 26, 2026',
    entries: [
      {
        tag: 'Films',
        color: 'film',
        text: 'Stats page full overhaul — new Rivalry tab added with: Biggest Gaps (films Dust favors vs. Hermz favors), Most Polarizing, Most Agreed-Upon, The Flip (films where allegiance switched between events), and Solo Picks (films only one person ever ranked). All bar charts replaced with elegant cinematic leaderboard rows.',
      },
    ],
  },
  {
    date: 'May 25, 2026',
    entries: [
      {
        tag: 'Design',
        color: 'cinema',
        text: 'Projector Room visual overhaul complete — every page now uses the dark cinematic system. All 9 auxiliary pages reskinned: Login, Settings, All Films, External Lists, Acclaim, Watchlist, Backfill tools, and Stats. Unified hero heights across the entire site.',
      },
      {
        tag: 'Design',
        color: 'cinema',
        text: 'Phase 3 — Movies pages (Home, Rankings list, Film Detail) reskinned with full-bleed heroes, FilmStill poster tiles, list/grid view toggle, and floating rank panel on film detail.',
      },
      {
        tag: 'Design',
        color: 'cinema',
        text: 'Phase 2 — All Oscars pages reskinned. Best Picture winner posters added to the year wall cards (three-tier OMDB fallback so even tricky titles like Everything Everywhere All at Once show up). Larger winner labels. Cyan tiebreaker treatment.',
      },
      {
        tag: 'Mobile',
        color: 'gray',
        text: 'Responsive design pass — hamburger navigation menu on mobile with full-page slide-down showing all links. Scrollable tables added across Oscars Year, Rankings, External Lists, and New Year wizard. Event card grid stacks properly on small screens.',
      },
      {
        tag: 'Oscars',
        color: 'gold',
        text: 'Oscar nominations backfill tool upgraded — new Force Re-fetch mode clears and re-fetches all data (fixes stale sound category data and incomplete nomination sets). New ceremony-page SPARQL pass queries Wikidata Oscar ceremony entities directly for films with missing data.',
      },
      {
        tag: 'Oscars',
        color: 'gold',
        text: 'New Year wizard now auto-imports all nominees from Wikidata with one click — fetches the full ceremony entity, normalizes all 24 categories, and pre-fills every nominee input. Fully re-runnable.',
      },
      {
        tag: 'Design',
        color: 'cinema',
        text: 'Phase 1 — Projector Room foundation established: new dark theme color tokens (night/gold/film/cinema/cream), display fonts (Bebas Neue + Instrument Serif), global component classes, dark-first theming, and Home page redesign with full-bleed hero.',
      },
    ],
  },
  {
    date: 'May 5, 2026',
    entries: [
      {
        tag: 'Oscars',
        color: 'gold',
        text: 'Oscar Noms Backfill admin tool added to Settings — queries Wikidata for each film\'s Oscar nomination history and populates the database. Available under Settings → Admin Tools.',
      },
      {
        tag: 'Oscars',
        color: 'gold',
        text: 'Fix Info panel on film detail pages expanded — Oscar nominations can now be added, edited, or deleted directly from any film\'s page. Includes category dropdown (26 presets + custom), win/nom toggle, and nominee name field.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Watchlist feature complete — personal watchlist at /movies/watchlist. Add films via OMDB search, sort A–Z or by recently added, remove anytime. "Add to Watchlist" / "On My Watchlist" toggle button on every film detail page. Each person sees only their own watchlist.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Grid/list view toggle added to the Rankings page — switch between the classic list view and a large poster card grid.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Crossover tab improvements — fixed nomination counts (wins included in total), added major category filters (Picture / Director / Actor / etc.), and a year filter to see which ranking event the films appeared in.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Home page overhauled — live Oscar standings (all-time H vs D record, current leader), most recent ranking event #1 film with poster, stats strip, and explore links to all major sections.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Stats — new Crossover tab showing films we both ranked that also received Oscar nominations, with filterable table, expandable category pills, and per-event rank grid.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Film detail pages now show up to 10 cast members (up from 3). All films searchable by actor in the All Films page.',
      },
      {
        tag: 'System',
        color: 'gray',
        text: 'TMDb integration — cast data enriched to up to 10 actors per film using The Movie Database API.',
      },
      {
        tag: 'System',
        color: 'gray',
        text: 'Settings page built — accessible via gear icon in the top navbar. Includes Admin Tools (Dustin only), account info, and setup guidance.',
      },
      {
        tag: 'Design',
        color: 'cinema',
        text: 'Article-aware alphabetical sort added to Rankings and All Films — leading articles (A, An, The) are ignored when sorting, so "The Godfather" sorts under G.',
      },
    ],
  },
  {
    date: 'May 4, 2026',
    entries: [
      {
        tag: 'Design',
        color: 'cinema',
        text: 'Footer updated to "Est. 1993" — reflecting when the Oscar picks tradition actually started.',
      },
      {
        tag: 'Oscars',
        color: 'gold',
        text: 'Correct Oscar guesses now highlighted in each player\'s color — gold for Hermz, blue for Dustin — on the ceremony detail page.',
      },
    ],
  },
  {
    date: 'Earlier — Phase 10',
    isHistory: true,
    entries: [
      {
        tag: 'Oscars',
        color: 'gold',
        text: 'New Year Entry System — full 3-step wizard for entering a new Oscar year: add nominees, enter guesses, set tiebreakers. Saves directly to the database.',
      },
    ],
  },
  {
    date: 'Earlier — Phase 9.5',
    isHistory: true,
    entries: [
      {
        tag: 'Films',
        color: 'film',
        text: 'External Lists browser added at /movies/lists — browse AFI Top 100, AFI Comedies, IMDB Top 250, NYT Best of 2000s, Sight & Sound, Variety Comedies, and the National Film Registry. Films in our database are linked; others show a "Not in our database" badge.',
      },
    ],
  },
  {
    date: 'Earlier — Phase 9',
    isHistory: true,
    entries: [
      {
        tag: 'Films',
        color: 'film',
        text: 'Acclaim score editor added to every film detail page. Bulk management page at /movies/acclaim for scoring all films in one place.',
      },
    ],
  },
  {
    date: 'Earlier — Phase 8.6',
    isHistory: true,
    entries: [
      {
        tag: 'Films',
        color: 'film',
        text: 'Writer credit added to film detail pages and Stats charts — a new Top Screenwriters chart sits alongside Directors and Actors.',
      },
    ],
  },
  {
    date: 'Earlier — Phase 8.5',
    isHistory: true,
    entries: [
      {
        tag: 'Films',
        color: 'film',
        text: 'Full Oscar nomination history on every film detail page — sourced from Wikidata. Shows each category, ceremony year, and win/nomination status.',
      },
    ],
  },
  {
    date: 'Earlier — Phase 8',
    isHistory: true,
    entries: [
      {
        tag: 'Films',
        color: 'film',
        text: 'Stats & Charts page built — bump chart showing rank movement across events, risers/fallers, score analysis, and a Podcast Prep tab.',
      },
    ],
  },
  {
    date: 'Earlier — Phase 7',
    isHistory: true,
    entries: [
      {
        tag: 'Films',
        color: 'film',
        text: 'Individual film detail pages built — rank history across all events, score history per category, Oscar panel, and an interactive rank movement chart.',
      },
    ],
  },
  {
    date: 'Earlier — Phase 6',
    isHistory: true,
    entries: [
      {
        tag: 'Films',
        color: 'film',
        text: 'Rankings list views built — sort by rank/title/score, movement indicators (▲▼) vs. prior event, vs-prior-event comparison columns.',
      },
    ],
  },
  {
    date: 'Earlier — Phase 5',
    isHistory: true,
    entries: [
      {
        tag: 'Films',
        color: 'film',
        text: 'Movie database imported — 305 films, 979 individual rankings, and 191 combined rankings across all 4 ranking events (2001, 2007, 2016, 2026).',
      },
    ],
  },
  {
    date: 'Earlier — Phase 4',
    isHistory: true,
    entries: [
      {
        tag: 'Oscars',
        color: 'gold',
        text: 'Oscars Stats dashboard built — charts, win/loss streaks, category accuracy breakdown, and a drilldown table.',
      },
    ],
  },
  {
    date: 'Earlier — Phases 2 & 3',
    isHistory: true,
    entries: [
      {
        tag: 'Oscars',
        color: 'gold',
        text: 'Oscars data imported — 19 ceremonies (2008–2026), 2,260 nominees, and 902 guesses. Ceremony detail pages, year grid, and tiebreaker display all built.',
      },
    ],
  },
  {
    date: 'Earlier — Phase 1',
    isHistory: true,
    entries: [
      {
        tag: 'System',
        color: 'gray',
        text: 'Site launched — React + Vite frontend, Supabase PostgreSQL database, Vercel hosting, Tailwind CSS styling. The Hermz & D project goes digital.',
      },
    ],
  },
]

const TAG_STYLES = {
  gold:   'bg-gold-500/15 text-gold-400 border border-gold-500/20',
  film:   'bg-film-500/15 text-film-400 border border-film-500/20',
  cinema: 'bg-cinema-500/15 text-cinema-400 border border-cinema-500/20',
  gray:   'bg-white/[0.06] text-gray-400 border border-white/[0.08]',
}

export default function SiteUpdates() {
  return (
    <div className="min-h-screen bg-night-950">

      {/* ── Hero ── */}
      <div className="relative h-[220px] sm:h-[260px] overflow-hidden bg-night-900 flex items-end">
        {/* Background texture */}
        <div className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(212,175,55,0.08) 0%, transparent 70%)',
          }}
        />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.3) 2px, rgba(255,255,255,0.3) 3px)', backgroundSize: '100% 6px' }}
        />
        <div className="relative max-w-4xl mx-auto px-5 sm:px-8 pb-8 w-full">
          <p className="font-mono text-[10px] tracking-kicker text-gold-500/70 uppercase mb-2">Hermz &amp; D</p>
          <h1 className="font-display text-5xl sm:text-6xl tracking-wide text-cream-100 leading-none mb-3">
            SITE UPDATES
          </h1>
          <p className="text-gray-400 text-base max-w-md">
            Everything that's been built — newest first. A running record of features, fixes, and improvements.
          </p>
        </div>
      </div>

      {/* ── Timeline ── */}
      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-10">
        <div className="space-y-0">
          {UPDATES.map((group, gi) => (
            <div key={gi} className="relative">

              {/* Vertical line */}
              {gi < UPDATES.length - 1 && (
                <div className="absolute left-[7px] top-9 bottom-0 w-px bg-white/[0.06]" />
              )}

              {/* Date header */}
              <div className="flex items-center gap-3 mb-4 pt-8">
                <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 z-10 ${
                  group.isHistory
                    ? 'border-white/20 bg-night-950'
                    : gi === 0
                    ? 'border-gold-500 bg-gold-500/20'
                    : 'border-white/30 bg-night-950'
                }`} />
                <span className={`font-mono text-xs tracking-kicker uppercase ${
                  group.isHistory
                    ? 'text-gray-600'
                    : gi === 0
                    ? 'text-gold-400'
                    : 'text-gray-500'
                }`}>
                  {group.date}
                  {gi === 0 && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-gold-500/20 text-gold-400 border border-gold-500/20 normal-case tracking-normal">
                      Latest
                    </span>
                  )}
                </span>
              </div>

              {/* Entries */}
              <div className="ml-6 space-y-2.5 pb-2">
                {group.entries.map((entry, ei) => (
                  <div
                    key={ei}
                    className="bg-night-900/60 border border-white/[0.05] rounded-xl px-4 py-3.5 flex items-start gap-3 hover:border-white/[0.08] transition-colors"
                  >
                    <span className={`mt-0.5 flex-shrink-0 font-mono text-[10px] tracking-kicker uppercase px-2 py-0.5 rounded-md ${TAG_STYLES[entry.color]}`}>
                      {entry.tag}
                    </span>
                    <p className="text-gray-300 text-base leading-relaxed">{entry.text}</p>
                  </div>
                ))}
              </div>

            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-12 pt-8 border-t border-white/[0.05] text-center">
          <p className="font-mono text-[10px] tracking-kicker text-gray-700 uppercase">
            Est. 1993 · Hermz &amp; D
          </p>
        </div>
      </div>
    </div>
  )
}
