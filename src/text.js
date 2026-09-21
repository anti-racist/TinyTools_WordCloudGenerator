// Text to a ranked word list. Pure: no DOM, no chrome.*, no options read
// off a <select>. Everything it needs arrives as an argument, which is what
// makes it testable without a browser.
//
// It also has to stay cheap. The studio never edits a cloud in place - every
// exclusion re-ranks the whole text - so this runs again on each click, and
// anything cached across calls would have to be invalidated by a caller that
// does not know it exists.

import { stopwords } from './stopwords.js';

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[‘’']s\b/g, '')       // possessives
    .replace(/[“”‘’]/g, '')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .replace(/\s{2,}/g, ' ');
}

function keep(word) {
  return word.length > 1 &&
         !stopwords.has(word) &&
         !/^\d+$/.test(word) &&
         /[a-z]/.test(word);
}

// The forms `word` might be an inflection OF. Order matters: the first
// candidate that turns out to be present in the document wins.
//
// This replaces 1.x's stemWord(), which rewrote every word by regular
// expression and then displayed the result. It printed `runn` for running,
// `busines` for business and `nat` for nation - words that do not exist, on
// a picture whose whole job is to show the words that do.
function candidates(word) {
  const out = [];
  const n = word.length;

  if (n > 4 && /ies$/.test(word))                 out.push(word.slice(0, -3) + 'y');
  if (n > 4 && /(ch|sh|s|x|z)es$/.test(word))     out.push(word.slice(0, -2));
  if (n > 3 && /s$/.test(word) && !/ss$/.test(word)) out.push(word.slice(0, -1));
  if (n > 4 && /ed$/.test(word)) { out.push(word.slice(0, -2)); out.push(word.slice(0, -1)); }
  if (n > 5 && /ing$/.test(word)) { out.push(word.slice(0, -3)); out.push(word.slice(0, -3) + 'e'); }

  // A doubled final consonant is put back to one: running -> runn -> run.
  const bare = word.replace(/(ing|ed)$/, '');
  if (bare !== word && bare.length > 2 && /([bdfglmnprt])\1$/.test(bare)) {
    out.push(bare.slice(0, -1));
  }
  return out;
}

// Inflections are merged only where the base form is itself in the document.
//
// That is the whole rule, and it is why nothing invented can reach the
// canvas: every label drawn is a string that was read off the page. If a
// text says "designed" and never says "design", the cloud says "designed" -
// which is true of the text, and is what the reader would have written.
function group(counts) {
  const base = new Map();
  for (const word of counts.keys()) {
    for (const candidate of candidates(word)) {
      if (candidate !== word && counts.has(candidate)) {
        base.set(word, candidate);
        break;
      }
    }
  }

  // Chains resolve (runs -> run, running -> run), and a cycle cannot hang
  // this: `seen` stops it and leaves the word where it was.
  const root = word => {
    const seen = new Set([word]);
    let at = word;
    while (base.has(at)) {
      const next = base.get(at);
      if (seen.has(next)) break;
      seen.add(next);
      at = next;
    }
    return at;
  };

  const totals = new Map();
  for (const [word, n] of counts) {
    const key = root(word);
    totals.set(key, (totals.get(key) || 0) + n);
  }
  return totals;
}

// `excluded` is applied after grouping, on the form the cloud would have
// drawn - which is the form the user clicked. Applying it to raw tokens
// instead would let "designs" survive a click on "design".
export function rank(text, { limit, excluded = new Set() } = {}) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('empty-text');
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('bad-limit');
  }

  const counts = new Map();
  for (const word of normalize(text).split(/\s+/)) {
    if (keep(word)) counts.set(word, (counts.get(word) || 0) + 1);
  }

  const totals = group(counts);
  const ranked = [...totals]
    .filter(([word]) => !excluded.has(word))
    // Frequency, then alphabetically, so the same text always ranks the
    // same way and a re-render does not reshuffle words that tie.
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  if (ranked.length === 0) throw new Error('no-words');
  return ranked.slice(0, limit);
}
