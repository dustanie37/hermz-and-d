# Hermz & D

Two friends, a thirty-year Academy Awards guessing game, and a hand-built canon
of favourite films. React + Vite + Supabase, deployed on Vercel.

- **Live:** https://hermz-and-d.vercel.app
- **Changelog:** https://hermz-and-d.vercel.app/updates (also `src/pages/SiteUpdates.jsx`)

## Project docs live OUTSIDE this repo

This repo holds **code only**. Every project document lives one level up, in the
project folder alongside this repo — not in here:

| File | What it's for |
|---|---|
| `reference.md` | Read this first. Architecture, conventions, data rules, gotchas. |
| `updates.md` | Current build plan + the Minor Updates Log. |
| `updates-archive.md` | Detailed history, 2026-05-04 → 2026-06-10. |
| `references.md` | Data-import archive, spreadsheet layouts, deploy flow. |
| `STYLESHEET.md` | The "Projector Room" design system. |
| `*-scope.md` | Per-phase scope docs. |

⚠️ **Do not add a copy of any of those files to this repo.** There used to be a
second `updates.md` in here. It was a fork of the real one, the two drifted for
months, and because the deploy flow rsyncs this directory into a fresh clone, the
stale fork kept trying to overwrite the live file and silently delete newer
entries. It was removed 2026-07-15 (its unique history is in `updates-archive.md`
and in this repo's git history). Keep docs at the project root so there is exactly
one source of truth.

## Develop

```bash
npm install
npm run dev
```

Requires `.env` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`VITE_OMDB_API_KEY`, `VITE_TMDB_API_KEY`. Never commit it.

## Deploy

Vercel auto-deploys on push to `main`. See `references.md` § Deployment for the
fresh-clone push flow — and read the Git Safety notes in `reference.md` before
pushing. Always `git diff` after the rsync: the workspace copy can be stale and
will silently revert remote work if you commit it blind.
