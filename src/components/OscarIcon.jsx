/**
 * OscarIcon — a clean SVG silhouette of the Academy Award statuette.
 * Uses currentColor so it inherits text colour from its parent.
 *
 * Props:
 *   size      — height in px (width is proportional, ~0.56 ratio)
 *   className — any extra Tailwind / CSS classes
 */
export default function OscarIcon({ size = 28, className = '' }) {
  const w = Math.round(size * 0.56)
  return (
    <svg
      width={w}
      height={size}
      viewBox="0 0 20 36"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Oscar statuette"
    >
      {/* Head */}
      <circle cx="10" cy="3.8" r="2.9" />

      {/* Neck */}
      <rect x="9" y="6.5" width="2" height="1.4" rx="0.5" />

      {/* Shoulders / upper body — broad at top, tapers to waist */}
      <path d="M4.5,8 C4.5,8 3,9.5 3.5,13 L5,19 L15,19 L16.5,13 C17,9.5 15.5,8 15.5,8
               C13.5,7 11.5,7.8 10,7.8 C8.5,7.8 6.5,7 4.5,8 Z" />

      {/* Sword crosspiece */}
      <rect x="5.5" y="10.2" width="9" height="1.3" rx="0.65" />

      {/* Sword blade — runs down centre through the body */}
      <rect x="9.25" y="8" width="1.5" height="10" rx="0.5" />

      {/* Base tier 1 (narrowest, just below body) */}
      <rect x="7.5" y="19" width="5" height="2.2" rx="0.4" />

      {/* Base tier 2 */}
      <rect x="5.5" y="21.2" width="9" height="2.4" rx="0.4" />

      {/* Base tier 3 (widest, bottom) */}
      <rect x="3"   y="23.6" width="14" height="3.2" rx="0.5" />
    </svg>
  )
}
