# Part B — Code Review

Review of the planted-bug `server.js`. I treated it as a read-only review
(didn't run it). Bugs are ordered by severity — the destructive ones first.

## Bugs found

| # | Severity | Bug | What it breaks | On what input |
|---|----------|-----|----------------|---------------|
| 1 | 🔴 Critical | `links.filter(l => l.id === req.params.id)` in DELETE | Two bugs at once: `===` keeps the matched item and drops the rest (inverted condition), **and** `l.id` is a Number while `req.params.id` is a String, so the strict compare never matches. Net effect: **every DELETE wipes the entire database** down to `[]`. | Any `DELETE /links/:id` |
| 2 | 🟠 High | `JSON.parse(fs.readFileSync('links.json'))` at module load | No file / empty file / corrupt JSON throws at startup, so **the server won't even boot**. No encoding, no default. | First run (file doesn't exist yet) or a truncated file |
| 3 | 🟠 High | `html.match(/<title>(.*)<\/title>/)[1]` | `.match` returns `null` when there's no `<title>`; indexing `[1]` on `null` throws `TypeError` and **crashes the request handler**. `.*` also won't span newlines and is case-sensitive. | A page with no title, a multi-line/`<TITLE>` tag, or a non-HTML response |
| 4 | 🟡 Medium | `await fetch(url)` with no validation or try/catch | Missing/garbage `url`, or an unreachable host, rejects. The async handler has no catch, so it surfaces as an unhandled rejection / hanging request instead of a clean 4xx/5xx. | `POST /links` with no body, a non-URL string, or a dead host |
| 5 | 🟢 Low | `new Date()` stored raw + `JSON.stringify` with no error handling on `writeFileSync` | `savedAt` serializes inconsistently; a failed write is silently lost. Cosmetic/robustness, not destructive. | Disk full / serialization edge cases |
| 6 | 🟢 Low | No `GET /links` route, no `.gitignore` for `links.json` | Can't list links via the API shown; data file risks being committed. | n/a (omission) |

The ones that actually matter are **#1 (data loss)**, **#2 (won't start)** and
**#3 (crash on ordinary input)**. The rest are hygiene.

## Corrected code

```js
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const FILE = path.join(__dirname, 'links.json');

// Fix #2: missing/corrupt file -> [] instead of crashing at startup.
function readLinks() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeLinks(links) {
  fs.writeFileSync(FILE, JSON.stringify(links, null, 2), 'utf8');
}

// Fix #3: tolerate missing/multiline/cased <title>, fall back to the URL.
function extractTitle(html, url) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : url;
}

app.get('/links', (req, res) => {
  res.json(readLinks());
});

app.post('/links', async (req, res) => {
  const { url } = req.body || {};

  // Fix #4: validate the URL at the boundary.
  let parsed;
  try {
    parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error();
  } catch {
    return res.status(400).json({ error: 'Please provide a valid http(s) URL.' });
  }

  // Fix #4: don't let a bad fetch crash the handler.
  let title = url;
  try {
    const html = await fetch(url).then((r) => r.text());
    title = extractTitle(html, url);
  } catch {
    /* keep URL as title */
  }

  const link = { id: Date.now(), url, title, savedAt: new Date().toISOString() };
  const links = readLinks();
  links.push(link);
  writeLinks(links);
  res.status(201).json(link);
});

app.delete('/links/:id', (req, res) => {
  const links = readLinks();
  // Fix #1: keep everyone whose id does NOT match, comparing as strings.
  const remaining = links.filter((l) => String(l.id) !== req.params.id);
  writeLinks(remaining);
  res.sendStatus(204);
});

app.listen(3000);
```
