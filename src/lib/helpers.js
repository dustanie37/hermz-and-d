// helpers.js — Shared UI constants and utilities
//
// Person color system (see STYLESHEET.md / references.md — never hardcode these):
//   DC — Dust / Dustin   (film-500)
//   HC — Hermz / Matt    (gold-500)
//   CC — Combined        (cinema-500)
// Extracted 2026-07-03 from per-page duplicates.

export const DC = '#5B6CFF'   // film-500   — Dust
export const HC = '#E0A22F'   // gold-500   — Hermz
export const CC = '#00E0D9'   // cinema-500 — Combined

/** Article-aware sort key: strips leading "A", "An", "The" for alphabetizing. */
export function sortTitle(t) {
  return (t || '').replace(/^(the|a|an)\s+/i, '').trim()
}
