// SiteUpdates.jsx — Chronological changelog of all site updates

const UPDATES = [
  {
    date: 'July 12, 2026',
    entries: [
      {
        tag: 'Oscars',
        color: 'gold',
        text: 'Ceremony pages, redesigned around the field. Every category card now lists all its nominees as proper rows — the winner sits highlighted in gold with a poster beside it, and your picks appear as HERMZ/DUST badges right on the nominee each of you chose, with a chip in the corner calling the category (Both Correct, Both Missed, or Split Pick). And every nominee finally carries its film: directors and actors show what they were nominated for, songs show their movie (plus songwriters behind the scenes), screenplays name their writers, and International Feature shows the country.',
      },
      {
        tag: 'Oscars',
        color: 'gold',
        text: 'The great nominee cleanup. All 2,280 nominee entries across 19 ceremonies were verified against the real Oscar record. 236 names were corrected — typos (Hugp → Hugo, Mosferatu → Nosferatu, Christopher → Christoph Waltz), shortcut titles expanded (HP 8, PotC, Benjamin Button ×10, PTA), accents restored (Penélope, Timothée, Tár, Emilia Pérez), and one nominee that a spreadsheet had eaten and turned into a date: "2025-09-05" is once again September 5. Every correction carried through to both players\' historical picks, and all scores were verified unchanged. Also recovered: 1917 was missing from all nine of its 2020 nominations including its three wins, the entire 2013 Production Design field was absent (Lincoln\'s win included — thanks Dust for the catch on the winner), and 12 (Russia) joined 2008 International Feature. After all of it, every pick in the record was re-audited against every winner flag: zero contradictions across all 19 ceremonies.',
      },
    ],
  },
  {
    date: 'July 11, 2026',
    entries: [
      {
        tag: 'Oscars',
        color: 'gold',
        text: 'The Reveal Ceremony. Once both ballots lock, a new ceremony page opens: your picks unseal one category at a time, building from the shorts and crafts up through writing, acting, and directing to Best Picture last. One tap flips both cards at once — a flourish when you picked the same, a split badge when you didn\'t — while a running board collects every category in gold and blue. It syncs live across both phones (either of you can drive), survives closed tabs, and after Best Picture the finale unseals the tiebreaker guesses: runtimes side by side, monologues beneath. Finishing the reveal is what makes all picks public and unlocks winner entry on the ceremony page.',
      },
      {
        tag: 'Oscars',
        color: 'gold',
        text: 'Ceremony night goes live, and the stats got honest. While winners are being entered during the broadcast, the year page now updates on the other phone within seconds — no refreshing between speeches — and the Stats page refreshes itself every time you flick back to its tab. Two long-standing stats quirks fixed along the way: category accuracy no longer counts picks whose category hasn\'t been decided yet (previously a fresh year\'s ballot dragged every percentage down for weeks before the ceremony), and as each winner lands during the show, that category joins the all-time stats immediately.',
      },
      {
        tag: 'Oscars',
        color: 'gold',
        text: 'Nominees, unfrozen. The field is no longer set in stone the day a year is created. On any pre-reveal ceremony page, a new Manage Nominees mode lets you re-fetch from Wikidata at any time — it merges what\'s new and never duplicates or removes what\'s there, perfect for when Wikidata catches up a week after the nominations announcement — plus add, rename, or remove nominees by hand. Renames automatically carry through to any ballot picks that reference them (both players\', safely), and a nominee that someone has picked simply refuses to be deleted. Settings also gained an Oscar Categories admin: when the Academy debuts a category (Stunt Design lands in 2028) or retires one, it\'s a form now, not a database chore.',
      },
      {
        tag: 'Oscars',
        color: 'gold',
        text: 'Private ballots arrive. From now on, Oscar picks are truly secret: each of you fills your own ballot on the new My Ballot page (it appears in the Oscars menu whenever a ceremony has open ballots), picks save as you tap, and the tiebreaker guesses — ceremony runtime and monologue length — moved into the ballot too. Lock it when you\'re done; until the reveal, the other side shows only a 🔒 and a progress chip, and the seal is enforced by the database itself, not just the page. The New Year wizard slimmed down to two steps (ceremony + nominees) since guesses no longer belong there — saving nominees now opens both ballots automatically. Ceremony pages for an in-season year show a "ballots sealed" banner, and the season card on the Oscars home tracks the year\'s new journey: Ballots Open → Locked → Revealed → Complete.',
      },
    ],
  },
  {
    date: 'July 10, 2026',
    entries: [
      {
        tag: 'Design',
        color: 'film',
        text: 'Rankings grid tidy-up. On the Films rankings page, the grid view had film titles printed back over the bottom of each poster. Those are gone again — posters now show just the rank badge, movement arrow, and the year/score line, letting the artwork breathe.',
      },
      {
        tag: 'Design',
        color: 'cinema',
        text: 'Cinematrix readability pass. The podcast section\'s tiny labels are gone — every 9–11px kicker, badge, and table header now renders at a minimum of 12px, talking points and chapter labels read at full body size (16px), and episode titles on the countdown grew a step. Contrast got the same treatment after a second look: form-field titles (Record Date, YouTube, Notes…) went from murky gray to light gray, section kickers and table headers came up two shades, and the Planned status chip brightened. The whole section is now comfortably readable at a glance instead of squint-first.',
      },
      {
        tag: 'Podcast',
        color: 'cinema',
        text: 'Cinematrix becomes real. The podcast section is no longer a mock-up — all 47 episodes (the intro plus the full 2026 countdown from #46 Office Space to #1 Saving Private Ryan) now live in the database with a status that travels from Planned → Prepped → Recorded → Published. The podcast home page gained a production dashboard: what\'s next up, how many episodes are recorded and published, and a progress bar across the whole Canon. Every episode page now carries a full prep workbench — editable talking points you can check off mid-recording (with a one-tap "+ point" button to pull in any of the auto-generated insights), a logistics panel for record dates, runtime, and YouTube/Spotify/Apple links, and a chapter/timestamp editor. And once an episode has a YouTube link, the video embeds right on the page with clickable chapters that jump the player. Built ahead of the August 19 video test.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Under the hood: acclaim lists now have a single source of truth. Which external lists a film belongs to is read in one place — the External Lists data — everywhere it appears (the film page, the Acclaim scoring screen, and the podcast pages). Previously that information lived in two separate places that had to be kept in sync by hand, which is exactly why films like Star Wars went missing. Now there is nothing to keep in sync: edit a list once and every page reflects it. This quietly retires a whole class of "why isn\'t this showing up" bugs.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Acclaim now shows on the film pages too. A film\'s own page (and the Acclaim overview) reads its list memberships from a separate set of fields than the External Lists browser does — so even after the linking fix, a film like Star Wars wasn\'t showing its AFI Top 100 placement on its page. Those fields are now synced from the lists across the whole library, so every film\'s Acclaim panel reflects exactly which lists it\'s on. While cleaning this up, nine duplicate entries were found in the National Film Registry list (the same film imported twice under two spellings — a straight vs. curly apostrophe in "Schindler\'s List," "WALL*E" vs "Wall-E," and a few franchise titles) and removed, so each film appears once.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'External Lists — films that were hiding. Many entries on the acclaim lists were showing "Not in DB" even though the film is in our database and on our own lists — the original import only matched on an exact title, so anything with a comma, colon, capitalization quirk, or subtitle slipped through (Star Wars was really "Star Wars: Episode IV – A New Hope"; "North By Northwest" vs "North by Northwest"; "WALL-E" vs "WALL*E"), along with films we added after the lists were first imported. Forty-five entries across the AFI, IMDB Top 250, NFR, NYT and Variety lists are now correctly linked, so their posters, acclaim scores, and edition dots light up.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'External Lists polish. The acclaim/external-list tables now match the primary Canon rankings in scale — larger rank numbers, full-size posters, bigger film titles and metadata — so browsing AFI, Sight & Sound and the rest feels consistent with the rest of the Films section. Publish dates were also verified and made specific where possible: AFI Top 100 (the 10th Anniversary edition) → June 20, 2007; AFI Comedies → June 13, 2000; Sight & Sound → December 1, 2022; and Variety Comedies corrected to its actual release, November 24, 2025. The AFI Top 100 data was confirmed rank-for-rank as the correct 2007 10th Anniversary edition.',
      },
    ],
  },
  {
    date: 'July 9, 2026',
    entries: [
      {
        tag: 'Films',
        color: 'film',
        text: 'Phase 12g — Publish, and the workflow is complete. After the ceremony, one gold button finalizes everything: draft scores become permanent individual rankings (with totals and tiebreaker counts computed), the combined list writes to the record books with its full column set, published films can optionally clear from Future Consideration, and the edition appears across the entire site. Under the hood, the biggest cleanup of the project: the Rankings, Stats, Films home, and site Home pages no longer hardcode "2001, 2007, 2016, 2026" anywhere — edition lists, "latest edition" defaults, movement-chart pairs, and all the copy now come straight from the database. When the next real edition publishes, every page updates itself. Test events, of course, can never publish. The Canon machine is fully built — from "create event" to a published edition, every stage now exists.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Phase 12f — The Reveal Ceremony. The page this whole build has been marching toward. Once both lists are locked, the ceremony opens: a countdown from the bottom of the list to #1, two reveals per rank, alternating who goes first. Each reveal shows the full picture — poster, all nine category scores with the /100 total, and a trajectory sparkline tracing that film\'s journey across every edition ("rising, was #31" or "★ first appearance"). Films on both lists link up on the running board the moment their second appearance lands ("⇄ also H #61"), with a flourish for the rare same-rank match. Everything writes to the database as you go: screens stay in sync in real time across devices, either player can press reveal, and the countdown survives closed tabs and multiple sittings. The Top Ten gets the glow treatment. And when #1 falls, the finale: the new combined list, generated live, seen by both of you for the very first time.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Phase 12e — The Waiting Room. The moment you lock your list, your own blackout lifts and a private stats room opens: your new Canon measured against your own history. Biggest risers and fallers versus your last edition, first-time appearances, films that dropped off, a score-distribution comparison (this edition vs. last), and your full ranked list with movement badges on every film. The other list stays completely sealed until the reveal ceremony — if one of you locks weeks early, this is where you pace.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Phase 12d — Scoring, the centerpiece. When the event advances to Scoring, each player presses Begin — the list becomes truly final and gets shuffled into a personal random order that never changes (leave and come back any day). One film at a time: poster, title, director, top cast, and nothing historical. Seven categories plus Influence scored 0–10 with tap-pills, Personal Impact 0–20, and Acclaim rides along pre-filled and locked from the agreed value. Every tap saves instantly; Skip sends a film to the back of the queue. And the blackout: while you\'re mid-scoring, the Rankings pages seal shut and film pages hide their ranking history — for you only — so every film gets judged fresh. After the last film: your full ranked list with the classic tiebreakers (Impact, then most 10s, most 9s…), tap any film to adjust, then Lock. Next up: the post-lock stats room, then the reveal ceremony.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Phase 12c — Acclaim, together. Two new stages after the roster reveal. Acclaim Sources: agree which external lists count for this event (AFI, Sight & Sound, IMDB Top 250, and the rest) — confirming freezes a snapshot of each list\'s data so every film is judged against identical evidence, even if a list gets re-imported later. Acclaim Workspace: the union of both locked lists, each film carrying a "Both lists / D only / Hermz only" badge, its appearances on the confirmed sources (with rank), and its Oscar record — with the jointly-agreed score (/10) editable inline. Plus: one-for-one swaps are live on the cultivation page — hover your locked list, swap a film out for one from your leftover pool or a fresh search, open until scoring begins. Auto-suggested acclaim scores arrive once the rules questionnaire is settled.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Phase 12b — Cultivation. The pool builder\'s companion is here: sort every candidate into In, Maybe, or Out with one tap, watch the live counter ("In: 8/10 · 2 spots left"), and the Lock button only arms when In hits the event\'s exact list size. After locking, your list is read-only and hidden; the moment both players lock, the roster reveal shows the two lists side by side — titles only, shared films flagged, no ranks in existence yet. One-for-one swaps arrive with the acclaim stage.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Ranking events now carry their own target list size. Real editions default to the traditional 125; the Test Run is set to just 10 films, so the whole workflow — pooling, cultivating, scoring, the reveal — can be proven end-to-end in an evening instead of a marathon. The size is set when creating an event and shows on the event card.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Fix: unpublished ranking events no longer leak into the public pages. Creating the test event revealed that the Films home, Rankings, Stats, All Films, External Lists, Acclaim, film detail, and site Home all listed every ranking event — including unpublished ones — so a brand-new event showed up as a phantom empty edition. All eight pages now show published editions only; in-progress and test events stay behind the curtain until publish.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Test runs — the ranking-event workflow now has a sandbox mode. When creating an event, Dustin can choose "Test Run" instead of "The Real Thing": a test event runs through the exact same pages and rules (pooling, cultivation, scoring, the reveal) but wears an amber TEST badge everywhere, can never be published to the site, and can be deleted along with all of its data at any time. Perfect for trying out each new stage of the workflow as it\'s built, without any risk to the real Canon.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'The next Canon edition begins — Phase 12a of the new ranking-event workflow is live. Dustin can now create a ranking event and open pooling (Settings → Ranking Events), and each player gets a private Pool Builder (Films → Next Edition, appears once pooling opens) with three ways to gather candidates: pull every film from your own past editions in one click, import from your Future Consideration watchlist, or search OMDB for anything new. Films added by search or watchlist that aren\'t in the database yet are created and fully enriched on the spot — poster and credits, full 10-actor cast, and complete Oscar record — so no cleanup debt later. Pools are fully private: neither player can see the other\'s candidates. Next up: cultivating the pool down to exactly 125 (triage buckets).',
      },
    ],
  },
  {
    date: 'July 7, 2026',
    entries: [
      {
        tag: 'Films',
        color: 'film',
        text: 'Scoring correction — Superman: The Movie (2026 Edition): Dustin\'s acclaim score was recorded as 8, but the jointly agreed acclaim was 7. Corrected, with the full ripple applied: Dustin\'s total drops 84→83, moving Superman from #39 to #40 on his list (it stays ahead of Avengers: Infinity War on the nines tiebreaker; Good Will Hunting moves up to #39). On the combined list, Superman\'s average rank moves to 24.00, so Indiana Jones and the Last Crusade takes #16 and Superman is now #17. Both lists verified with no duplicate ranks.',
      },
    ],
  },
  {
    date: 'July 3, 2026',
    entries: [
      {
        tag: 'Mobile',
        color: 'cinema',
        text: 'Mobile QA pass at phone width (390px), tested live in-browser. Fixed: Oscar Stats accuracy bars were completely invisible on phones (fixed-width labels left no room — now they shrink and the bars render); the Category Heatmap gained a "swipe for more years" hint; the Stats bump chart now scrolls horizontally instead of squeezing unreadably; film page hero no longer collides with the Fix Info/Watchlist buttons (taller mobile hero, tighter type, genre pills move below); Home\'s Top Six posters are now a proper 3×2 grid on phones instead of six tiny thumbnails; Cinematrix episode tables scroll instead of cramming. Verified clean: ceremony pages, tiebreaker panel, rankings, watchlist, Data Health.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Oscar nomination data fix — 27 films were showing a phantom extra acting nomination (e.g. The Silence of the Lambs listed 9 nominations instead of 7). Wikidata stores both a "nominated" and a "won" record for the same winner, and the import kept both. 30 phantom rows and 8 duplicate rows with missing ceremony years were removed, each verified against actual Oscar history. Legitimate double nominations (Amadeus, Bullets Over Broadway, Chicago) preserved. The backfill tools were corrected so re-running them can\'t reintroduce the bug.',
      },
      {
        tag: 'Films',
        color: 'film',
        text: 'Oscar nomination data completed — 66 films with missing or incomplete category breakdowns filled in, each verified against actual Academy Awards history: The Holdovers, Banshees of Inisherin, 1917, The Favourite, La La Land, The Godfather (all three Supporting Actor noms now named), Rocky (Meredith + Young), The Lion King (all three songs), Skyfall, every Star Trek and Star Wars nomination, and 50 more. Every film in the canon now shows its full, accurate Oscar record. Also corrected five factual errors in the recorded totals (Superman II actually received zero nominations — the 1978 Superman got those).',
      },
      {
        tag: 'System',
        color: 'gold',
        text: 'New admin tool: Oscar Data Health (Settings → Admin Tools). Reconciles every film\'s recorded nomination and win totals against its category rows and flags phantom, missing, or miscounted data — the check that would have caught the phantom-nomination bug the day it happened. Currently reads ALL CLEAR.',
      },
      {
        tag: 'System',
        color: 'gold',
        text: 'Under the hood: shared code consolidation. The Wikidata category normalization table (previously duplicated in two pages — the reason the phantom-nomination fix had to be applied twice), the article-aware title sort (five slightly different copies), and the Dust/Hermz/Combined color constants (eight files) now each live in one shared module. No visible changes; future fixes land everywhere at once.',
      },
    ],
  },
  {
    date: 'June 10, 2026',
    entries: [
      {
        tag: 'Films',
        color: 'film',
        text: 'Future Consideration — Add Film modal no longer closes unexpectedly while searching.',
      },
    ],
  },
  {
    date: 'May 30, 2026',
    entries: [
      {
        tag: 'Oscars',
        color: 'gold',
        text: 'Oscar Stats — Category Streaks section added: three sub-sections showing currently hot (active correct streaks of 3+ years), currently cold (active miss streaks of 3+ years), and all-time records (longest correct streaks ever, top 12). Each entry shows the count, category name, person, and year range.',
      },
      {
        tag: 'Oscars',
        color: 'gold',
        text: 'Oscar Stats — major overhaul. Category Heatmap: color-coded grid of every category × every year (cyan = both, gold = Hermz, blue = Dust, dark = neither; each cell links to the ceremony). Streak Tracker: visual year-block timeline in the Win Streaks card. Annual Difficulty: all 19 years ranked hardest→easiest by combined accuracy with Chalk/Average/Tough/Brutal tier labels. Category Ownership Cards: per-category leader grid grouped by section. Agreement Rate: merged into the Peak & Valley card — shows agree %, when-agreed accuracy, and each player\'s edge when they diverge.',
      },
      {
        tag: 'Design',
        color: 'cinema',
        text: 'Oscars page heroes — Oscar trophy photo (Hunter Scott / Unsplash, free license) added to the Ceremonies, Year, and Stats page headers. mix-blend-mode:screen blends the photo into the cinematic gradient. Desktop only.',
      },
      {
        tag: 'Design',
        color: 'cinema',
        text: 'Navbar — OscarIcon removed from the Oscars nav link on desktop and mobile.',
      },
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
