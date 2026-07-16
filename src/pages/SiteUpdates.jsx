// SiteUpdates.jsx — "What the site does" tour, grouped by theme (not by date).
// Rewritten 2026-07-16 (b0676f3+): consolidated for Matt — stats/visuals/features
// front and center, behind-the-scenes/bug-fix/data-cleanup noise dropped.

const SECTIONS = [
  {
    kicker: 'The numbers behind the rivalry',
    title: 'Stats & Insights',
    accent: 'text-gold-400',
    rule: 'bg-gold-500',
    items: [
      { tag: 'Films', color: 'film', isNew: true, name: 'Rank Trajectory',
        text: 'On the rankings list, every film shows a sparkline of where it placed in each edition — hover any point to see how far it climbed or fell into that year, no math required.' },
      { tag: 'Films', color: 'film', isNew: true, name: 'The Podium',
        text: 'Every edition’s combined top three with each of your personal #1s beneath, plus the films that have landed on the podium the most.' },
      { tag: 'Films', color: 'film', isNew: true, name: 'Edition Trends',
        text: 'The Nostalgia Index (is the Canon aging along with us?) and Score Inflation (are we becoming softer graders over time?).' },
      { tag: 'Films', color: 'film', isNew: true, name: 'The Grading Curve',
        text: 'Where each of you runs generous or stingy across the scoring categories — and who’s the softer grader overall.' },
      { tag: 'Films', color: 'film', isNew: true, name: 'Guilty Pleasures & Homework',
        text: 'The confession card: the low-acclaim films you rank anyway, and the certified classics you rank lowest.' },
      { tag: 'Oscars', color: 'gold', isNew: true, name: 'The Deciders',
        text: 'In every Oscar year decided by a category or two, the split picks the champion actually won — where flipping one call flips the whole title.' },
      { tag: 'Oscars', color: 'gold', isNew: true, name: 'The Upset Board',
        text: 'The winners that beat you both: your all-time shock rate, the categories that blindside you most, and the most chaotic ceremonies.' },
      { tag: 'Oscars', color: 'gold', name: 'Agreement',
        text: 'How often you two land on the same nominee, category by category, crowned by your most-alike and least-alike calls.' },
      { tag: 'Oscars', color: 'gold', name: 'Category Heatmap',
        text: 'Every category × every year, color-coded (both right, Hermz only, Dust only, neither) with tap-to-filter chips to isolate any pattern.' },
      { tag: 'Oscars', color: 'gold', name: 'Era Split & Difficulty',
        text: 'The 19 ceremonies cut in half to see who’s getting better, plus every year ranked hardest to easiest by how well you both did.' },
      { tag: 'Oscars', color: 'gold', name: 'Category Streaks',
        text: 'Who’s currently hot, who’s currently cold, and the longest correct streaks of all time.' },
      { tag: 'Films', color: 'film', name: 'Rivalry & Taste Face-Off',
        text: 'Biggest gaps, most polarizing, most agreed-upon, and the films where your allegiance flipped between editions.' },
      { tag: 'Films', color: 'film', name: 'Score History',
        text: 'Dust vs. Hermz per category as a side-by-side dumbbell chart, plus a perfect-scores drilldown you can tap open.' },
    ],
  },
  {
    kicker: 'The things you do here',
    title: 'Features & Functions',
    accent: 'text-film-400',
    rule: 'bg-film-500',
    items: [
      { tag: 'Rankings', color: 'film', name: 'Build an Edition, end to end',
        text: 'A full guided flow for the next Canon edition: gather a private pool of candidates, cultivate it down to your list, score every film, then reveal.' },
      { tag: 'Rankings', color: 'film', name: 'Solo scoring, sealed',
        text: 'Score one film at a time with nothing historical showing — and while you’re scoring, the rankings and rank histories lock so every film gets judged fresh.' },
      { tag: 'Rankings', color: 'film', name: 'The Reveal Ceremony',
        text: 'Once both lists lock, they unseal from the bottom up to #1, two films per rank, live and in sync across both phones — ending with the new combined list you both see for the first time.' },
      { tag: 'Rankings', color: 'film', name: 'Your Waiting Room',
        text: 'Lock your list and a private stats room opens: your biggest risers and fallers, first-time appearances, and drop-offs versus last edition.' },
      { tag: 'Oscars', color: 'gold', name: 'Private ballots',
        text: 'Each of you fills your own secret ballot — picks and tiebreakers save as you tap, and the other side stays a 🔒 until the reveal.' },
      { tag: 'Oscars', color: 'gold', isNew: true, name: 'The Oscar Reveal',
        text: 'Ceremony night, categories come up one at a time from the shorts to Best Picture — and now each of your picks is its own sealed card you tap to unseal, so Hermz and Dust never flip at the same moment. The "same pick" or "split" flourish only lands once both cards are open. Syncs live across both phones.' },
      { tag: 'Oscars', color: 'gold', name: 'Live ceremony night',
        text: 'Enter winners during the broadcast and the other phone updates within seconds — each win folds into the all-time stats as it lands.' },
      { tag: 'Oscars', color: 'gold', name: 'Manage nominees & categories',
        text: 'Re-fetch a year’s nominees anytime, add / rename / remove by hand, and manage the Oscar category list from a simple form.' },
      { tag: 'Podcast', color: 'cinema', name: 'Cinematrix',
        text: 'The whole podcast section: all 47 episodes with a production dashboard, a per-episode prep workbench (talking points, logistics, chapters), and embedded YouTube with clickable chapters.' },
      { tag: 'Films', color: 'film', name: 'Future Consideration',
        text: 'A three-list watchlist — Want to Watch, First Watch, and Rewatch — with click-to-edit notes on every film.' },
      { tag: 'Films', color: 'film', name: 'External acclaim lists',
        text: 'Browse AFI, Sight & Sound, IMDB Top 250, the National Film Registry and more; every film links straight to its placements.' },
      { tag: 'Films', color: 'film', name: 'Film pages',
        text: 'Each film’s full Oscar record, 10-actor cast, ranking history and movement, acclaim placements, and podcast-ready story blurbs.' },
    ],
  },
  {
    kicker: 'How it all looks',
    title: 'Look & Feel',
    accent: 'text-cinema-400',
    rule: 'bg-cinema-500',
    items: [
      { tag: 'Design', color: 'cinema', name: 'Projector Room',
        text: 'The whole site runs on one dark, cinematic design system — warm gold, film blue, and teal accents over deep black.' },
      { tag: 'Design', color: 'cinema', name: 'View-aware color',
        text: 'Combined reads teal, Dust reads blue, Hermz reads gold — consistently across the rankings, the stats, and the posters.' },
      { tag: 'Oscars', color: 'gold', name: 'Redesigned ceremony pages',
        text: 'Every nominee listed with its film, the winner highlighted in gold with a full poster, and your picks badged right on the nominee each of you chose.' },
      { tag: 'Films', color: 'film', name: 'Poster-first browsing',
        text: 'Film-still poster tiles, list / grid toggles, and full-size posters across the rankings and the acclaim lists.' },
      { tag: 'Design', color: 'cinema', name: 'Readable everywhere',
        text: 'A site-wide pass brought every label up to a comfortable size, brightened dim text, and fixed the layouts down to phone width.' },
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
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(212,175,55,0.08) 0%, transparent 70%)' }}
        />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.3) 2px, rgba(255,255,255,0.3) 3px)', backgroundSize: '100% 6px' }}
        />
        <div className="relative max-w-4xl mx-auto px-5 sm:px-8 pb-8 w-full">
          <p className="font-mono text-xs tracking-kicker text-gold-500/70 uppercase mb-2">Hermz &amp; D</p>
          <h1 className="font-display text-5xl sm:text-6xl tracking-wide text-cream-100 leading-none mb-3">
            THE SITE, AT A GLANCE
          </h1>
          <p className="text-gray-400 text-base max-w-lg">
            Everything built into Hermz &amp; D — the stats, the features, and the design. Grouped by what it is; the newest additions are flagged <span className="text-gold-400 font-medium">New</span>.
          </p>
        </div>
      </div>

      {/* ── Themed sections ── */}
      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-12 space-y-14">
        {SECTIONS.map((section, si) => (
          <section key={si}>
            {/* Section header */}
            <div className="mb-6">
              <div className={`flex items-center gap-2.5 mb-2 font-mono text-xs tracking-cinema uppercase ${section.accent}`}>
                <span className={`w-7 h-px ${section.rule}`} />
                {section.kicker}
              </div>
              <h2 className="font-display not-italic text-3xl sm:text-4xl tracking-wide text-white leading-none">
                {section.title}
              </h2>
            </div>

            {/* Items */}
            <div className="grid sm:grid-cols-2 gap-3">
              {section.items.map((item, ii) => (
                <div key={ii}
                  className="bg-night-900/60 border border-white/[0.05] rounded-xl px-4 py-4 hover:border-white/[0.10] transition-colors">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`flex-shrink-0 font-mono text-xs tracking-kicker uppercase px-2 py-0.5 rounded-md ${TAG_STYLES[item.color]}`}>
                      {item.tag}
                    </span>
                    {item.isNew && (
                      <span className="flex-shrink-0 font-mono text-xs tracking-kicker uppercase px-2 py-0.5 rounded-md bg-gold-500/20 text-gold-300 border border-gold-500/30">
                        New
                      </span>
                    )}
                  </div>
                  <h3 className="font-display not-italic text-xl tracking-wide text-white leading-snug mb-1">
                    {item.name}
                  </h3>
                  <p className="text-gray-300 text-base leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Footer note */}
        <div className="pt-8 border-t border-white/[0.05] text-center">
          <p className="font-mono text-xs tracking-kicker text-gray-500 uppercase">
            Est. 1993 · Hermz &amp; D
          </p>
        </div>
      </div>
    </div>
  )
}
