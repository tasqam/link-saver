const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'links.json');

// Read all links. Missing/empty/corrupt file -> [] instead of crashing.
function readLinks() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Atomic write: write a temp file then rename, so a crash mid-write
// can't leave links.json truncated/corrupt.
function writeLinks(links) {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(links, null, 2), 'utf8');
  fs.renameSync(tmp, FILE);
}

module.exports = { readLinks, writeLinks };
