const express = require('express');
const { readLinks, writeLinks } = require('./storage');

const app = express();
app.use(express.json());

// Pull the <title> out of an HTML string. Case-insensitive, spans newlines.
// No <title> -> null, and the caller falls back to the URL.
function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : null;
}

// GET /links - list everything, newest first.
app.get('/links', (req, res) => {
  res.json(readLinks());
});

// POST /links - save a URL, auto-fetching the page title.
app.post('/links', async (req, res) => {
  const { url } = req.body || {};

  // Validate at the boundary: must be a real http(s) URL.
  let parsed;
  try {
    parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('not http(s)');
    }
  } catch {
    return res.status(400).json({ error: 'Please provide a valid http(s) URL.' });
  }

  // Fetch the page and read its title. If the fetch fails (bad/unreachable
  // URL) we still save the link, falling back to the URL as the title.
  let title = url;
  try {
    const html = await fetch(url).then((r) => r.text());
    title = extractTitle(html) || url;
  } catch {
    // ponytail: network/parse failure -> keep URL as title, don't 500.
  }

  const link = { id: Date.now(), url, title, favourite: false, savedAt: new Date().toISOString() };
  const links = readLinks();
  links.unshift(link);
  writeLinks(links);
  res.status(201).json(link);
});

// DELETE /links/:id - remove one link by id. Keep everyone whose id does
// NOT match; compare as strings since the route param is always a string.
app.delete('/links/:id', (req, res) => {
  const links = readLinks();
  const remaining = links.filter((l) => String(l.id) !== req.params.id);
  if (remaining.length === links.length) {
    return res.status(404).json({ error: 'Link not found.' });
  }
  writeLinks(remaining);
  res.sendStatus(204);
});

app.listen(3000, () => console.log('Link saver running on http://localhost:3000'));
