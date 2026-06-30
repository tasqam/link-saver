# Link Saver

A tiny single-page link saver. Paste a URL, it fetches the page's real title
automatically, saves it with a timestamp, lists everything, lets you delete a
link, and lets you mark links as favourites and filter to favourites only.
Data is persisted to a JSON file, so it survives a restart.

## How to run

Requires Node 18+ (uses the built-in global `fetch`; developed on Node 24).

```bash
npm install
npm start
```

Then open <http://localhost:3000>.

## Stack & structure

Plain **Node + Express** serving a single static `public/index.html` with
vanilla JS — no build step, no framework, nothing to learn before you can read
it. Title fetching happens **on the server** because the browser can't fetch a
third-party page directly (CORS). Persistence is a **JSON file** via `node:fs`:
zero extra dependencies and it runs from this README as-is, with no native
modules to compile.

If this had to grow I'd swap the JSON file for **SQLite** (`better-sqlite3`) —
it removes the read-modify-write race on the file and gives indexed queries —
and split `server.js` into a route layer and a storage layer behind a small
repository interface, so the storage swap is a one-file change.

## Files I touched for the "favourite" feature

- `server.js` — added the `PATCH /links/:id` route that toggles `favourite`.
- `public/index.html` — added the ★/☆ toggle button per link, the
  "Show favourites only" checkbox, and the client-side `toggleFav` + filter.

## Assumptions I made

- **Single user, no auth** — the brief asks for a small focused tool, so I
  left out accounts and login.
- **Bad/unreachable URLs still save**, using the URL itself as the title
  rather than failing. A non-`http(s)` string is rejected with a 400.
- **`id` is `Date.now()`** — fine for a single-user local tool; not
  collision-safe under concurrency.
- Storage is a flat JSON file written atomically (temp file + rename) so a
  crash mid-write can't corrupt it.

## Deliberately left out (could do, skipped for time)

All noted here rather than silently dropped:

- **URL de-duplication** — saving the same URL twice creates two entries. Easy
  to add (check before insert) but not essential for the exercise.
- **Pages with no `<title>` / non-HTML responses** — handled only with a
  simple fallback to the URL; no content-type sniffing or richer extraction.
- **SSRF protection** — the server fetches whatever URL it's given, so it could
  be pointed at internal addresses. A real deployment needs an allowlist /
  private-IP block; out of scope for a local single-user tool.
- **Tests** — covered each step with a manual curl smoke check rather than a
  test suite, to stay within the time box.
- **Polish** — minimal styling, no pagination, no edit.

## What I'd improve with more time

SQLite + repository layer (above), the SSRF allowlist, de-dup, a real test
suite, and request-level error logging.

## Key AI prompts

The prompts that did the most work (I directed and reviewed each output):

1. *"Build a minimal Express link saver: `POST /links` validates the URL, fetches
   the page server-side and extracts the `<title>` with a fallback to the URL on
   failure; `GET /links` lists them; persist to a JSON file with a default of `[]`
   when the file is missing and an atomic write. Keep it to the smallest code that
   works, no extra dependencies."*
2. *"Review this DELETE handler — `links.filter(l => l.id === req.params.id)` —
   for correctness. Identify every bug, say what input breaks each, and rank by
   severity."* (drove the Part B `REVIEW.md`.)
3. *"Add a favourite toggle: a `PATCH /links/:id` route that flips a boolean, plus
   a star button and a 'favourites only' filter in the single-page UI. Tell me
   exactly which files changed."*

## If I could have asked questions first

I'd have asked whether de-duplication of identical URLs is expected; how the
tool should behave when a page has no title or returns non-HTML (fall back to
the URL, as I did, or reject?); whether the fetch needs SSRF protection given it
hits arbitrary user-supplied URLs; and whether single-user with no auth is
acceptable. Lacking answers, I made the reasonable call on each and documented
it above rather than guessing silently.
