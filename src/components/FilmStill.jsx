/**
 * FilmStill — the cinematic poster / image tile used everywhere in
 * Projector Room. Wraps a real poster URL when available, falls back to a
 * CSS gradient keyed to a stable hash of the title so each film gets a
 * consistent signature color.
 */

function hueFromString(str) {
  let h = 0;
  for (const c of str || '') h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

const STILL_COMPOSITIONS = {
  warm: (hue) => `
    radial-gradient(ellipse at 30% 40%, hsla(${hue}, 60%, 38%, 0.7) 0%, transparent 50%),
    radial-gradient(ellipse at 70% 70%, hsla(${(hue+20)%360}, 40%, 22%, 0.9) 0%, transparent 60%),
    linear-gradient(180deg, hsl(${hue}, 25%, 18%) 0%, hsl(${hue}, 35%, 6%) 100%)
  `,
  cool: (hue) => `
    radial-gradient(ellipse at 25% 50%, hsla(${hue}, 40%, 35%, 0.6) 0%, transparent 55%),
    radial-gradient(ellipse at 80% 30%, hsla(${(hue+200)%360}, 50%, 30%, 0.5) 0%, transparent 50%),
    linear-gradient(170deg, hsl(${hue}, 35%, 14%) 0%, hsl(${hue}, 45%, 5%) 100%)
  `,
  contrast: (hue) => `
    radial-gradient(ellipse at 50% 30%, hsla(${hue}, 80%, 50%, 0.55) 0%, transparent 45%),
    linear-gradient(180deg, hsl(${hue}, 30%, 22%) 0%, #060509 90%)
  `,
};

export default function FilmStill({
  src,
  title = '',
  hue,
  mood,
  className = '',
  children,
  ...rest
}) {
  const h = hue != null ? hue : hueFromString(title);
  const m = mood || (h % 2 === 0 ? 'warm' : 'cool');
  const fallbackBg = STILL_COMPOSITIONS[m](h);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: src ? '#0E0C12' : fallbackBg }}
      {...rest}
    >
      {src && (
        <img
          src={src}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}

      <div
        className="absolute inset-x-0 top-[40%] h-[20%] pointer-events-none"
        style={{
          background: `linear-gradient(180deg, transparent, hsla(${h}, 70%, 60%, 0.05) 50%, transparent)`,
        }}
      />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.18) 100%)',
        }}
      />

      {children}
    </div>
  );
}

export function StillPoster({ film, size = 'md', showRank, showTitle, className = '' }) {
  const sizeMap = {
    xs: 'w-12',  sm: 'w-16',  md: 'w-24',  lg: 'w-36',  xl: 'w-48',
  };
  const w = sizeMap[size] || sizeMap.md;
  return (
    <FilmStill
      src={film.poster_url}
      title={film.title}
      className={`${w} aspect-[2/3] rounded-md border border-white/10 shadow-still ${className}`}
    >
      {(showRank || showTitle) && (
        <div
          className="absolute inset-0 p-2 flex flex-col justify-between"
          style={{ background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.8) 100%)' }}
        >
          {showRank && film.rank ? (
            <span className="font-mono text-[9px] tracking-kicker text-white/70">
              #{String(film.rank).padStart(2, '0')}
            </span>
          ) : <span />}
          {showTitle && (
            <span className="font-display text-xs text-white leading-none tracking-wide">
              {film.title?.toUpperCase()}
            </span>
          )}
        </div>
      )}
    </FilmStill>
  );
}
