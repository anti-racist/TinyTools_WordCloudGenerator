// The studio: a tab with room for the cloud, the text behind it, and the
// list of words that ended up in it.
//
// The one rule that shapes everything below: the cloud is always re-ranked
// from the full text, never edited in place. Taking a word out therefore
// promotes the next word into the top N instead of leaving a hole, and
// putting it back is the same operation with one fewer exclusion.

import { rank } from './src/text.js';
import { draw, toPng } from './src/render.js';
import { schemes, grounds } from './src/palette.js';
import { forms, formOf, defaultForm } from './src/shapes.js';
import {
  loadExcluded, saveExcluded, loadSettings, saveSettings,
  takeHandoff, EXCLUDED_LIMIT
} from './src/store.js';
import { claimStudioTab } from './src/browser.js';

const el = id => document.getElementById(id);
const textInput = el('text');
const canvas = el('canvas');
const stage = el('stage');
const emptyNote = el('empty');
const statusElement = el('status');
const saveButton = el('save');
const wordList = el('words');
const excludedList = el('excluded');
const wordCount = el('wordCount');
const excludedCount = el('excludedCount');
const clearButton = el('clearExcluded');
const clearTextButton = el('clearText');
const toast = el('toast');
const toastText = el('toastText');

const state = {
  excluded: new Set(),
  settings: null,
  words: [],
  drawn: false,
  lastBox: null,
  // The title of the page the text came from, when it came from one. Kept
  // for the saved file's name, so a cloud of a page is not called the same
  // thing as a cloud of anything else.
  source: ''
};

// ---------------------------------------------------------------- status

function say(text, tone = 'notice') {
  statusElement.textContent = text;
  statusElement.className = text ? `status ${tone}` : 'status';
}

// ------------------------------------------------------------ the cloud

function stageBox() {
  // 16px of padding on each side; the dashed border sits outside
  // clientWidth already.
  return {
    width: Math.max(80, stage.clientWidth - 32),
    height: Math.max(80, stage.clientHeight - 32)
  };
}

function render() {
  noteShape();
  if (!state.words.length) {
    canvas.classList.remove('drawn');
    emptyNote.hidden = false;
    saveButton.disabled = true;
    state.drawn = false;
    return;
  }
  if (typeof WordCloud !== 'function') {
    say('The drawing library did not load. Reload this tab.', 'error');
    return;
  }

  const box = stageBox();
  state.lastBox = box;
  emptyNote.hidden = true;
  canvas.classList.add('drawn');

  draw(canvas, {
    words: state.words,
    box,
    scheme: state.settings.scheme,
    ground: state.settings.ground,
    orientation: formOf(state.settings.form).orientation,
    shape: formOf(state.settings.form).shape,
    onPick: word => exclude(word, 'cloud')
  });

  state.drawn = true;
  saveButton.disabled = false;
}

// Re-rank and redraw. `announce` is false for the redraws that follow a
// click, because the toast already said what happened and two messages
// about one action read as two actions.
function build({ announce = true } = {}) {
  const text = textInput.value;
  if (!text.trim()) {
    state.words = [];
    render();
    renderWords();
    if (announce) {
      say('Paste some text first, or get a page with the Word Cloud icon in your toolbar.', 'notice');
    }
    return;
  }

  try {
    state.words = rank(text, {
      limit: Number(state.settings.limit),
      excluded: state.excluded
    });
  } catch (error) {
    state.words = [];
    render();
    renderWords();
    if (error.message === 'no-words') {
      say(state.excluded.size
        ? 'Every word in this text is excluded.'
        : 'No countable words in this text.', 'notice');
    } else {
      say('This text could not be read.', 'error');
    }
    return;
  }

  render();
  renderWords();
  if (announce) {
    const n = state.words.length;
    say(n + ' ' + (n === 1 ? 'word' : 'words') + ' in the cloud.', 'success');
  }
}

// ------------------------------------------------------------- the lists

// Rows are built as DOM nodes, never innerHTML: the words come off whatever
// page the user was standing on.
function row(word, count, buttonLabel, glyph, onClick) {
  const li = document.createElement('li');

  const span = document.createElement('span');
  span.className = 'word';
  span.textContent = word;
  span.title = word;
  li.appendChild(span);

  if (count !== null) {
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = String(count);
    li.appendChild(n);
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = glyph;
  button.setAttribute('aria-label', buttonLabel + ' ' + word);
  button.title = buttonLabel;
  button.addEventListener('click', onClick);
  li.appendChild(button);

  return li;
}

function renderWords() {
  wordList.replaceChildren(
    ...state.words.map(([word, count]) =>
      row(word, count, 'Exclude', '✕', () => exclude(word, 'list')))
  );
  wordCount.textContent = state.words.length ? String(state.words.length) : '';

  const excluded = [...state.excluded].sort((a, b) => a.localeCompare(b));
  excludedList.replaceChildren(
    ...excluded.map(word =>
      row(word, null, 'Put back', '↩', () => restore(word)))
  );
  excludedCount.textContent = excluded.length ? String(excluded.length) : '';
  clearButton.hidden = excluded.length === 0;
}

// ------------------------------------------------------- exclude / undo

let toastTimer = null;

// Seven seconds, as in the rest of the series.
function offerUndo(message, undo) {
  clearTimeout(toastTimer);
  toastText.textContent = message;
  toast.hidden = false;
  el('undo').onclick = () => { hideToast(); undo(); };
  toastTimer = setTimeout(hideToast, 7000);
}

function hideToast() {
  clearTimeout(toastTimer);
  toast.hidden = true;
  el('undo').onclick = null;
}

function exclude(word, from) {
  if (!word || state.excluded.has(word)) return;

  if (state.excluded.size >= EXCLUDED_LIMIT) {
    say('The excluded list holds ' + EXCLUDED_LIMIT +
        ' words. Put some back to add more.', 'notice');
    return;
  }

  state.excluded.add(word);
  saveExcluded(state.excluded);
  say('');
  build({ announce: false });
  offerUndo('Excluded "' + word + '".', () => restore(word, { quiet: true }));

  // A click on the canvas moves the cloud under the pointer, so the word
  // that replaced it is where the eye already is. A click in the list does
  // not move the cloud, and the list has just reordered under the cursor.
  if (from === 'list') wordList.scrollTop = 0;
}

function restore(word, { quiet = false } = {}) {
  if (!state.excluded.delete(word)) return;
  saveExcluded(state.excluded);
  if (!quiet) hideToast();
  build({ announce: false });
  if (!quiet) say('"' + word + '" is back.', 'success');
}

function clearExcluded() {
  if (!state.excluded.size) return;
  const previous = new Set(state.excluded);
  state.excluded.clear();
  saveExcluded(state.excluded);
  build({ announce: false });
  offerUndo('Put back ' + previous.size + ' ' +
            (previous.size === 1 ? 'word' : 'words') + '.', () => {
    // A union, not an assignment: the seven seconds are long enough to
    // exclude something new, and undoing the clear must not throw that away.
    state.excluded = new Set([...previous, ...state.excluded]);
    saveExcluded(state.excluded);
    build({ announce: false });
  });
}

// -------------------------------------------------------------- the text

function noteText() {
  clearTextButton.hidden = !textInput.value;
}

// Clears the text and what was drawn from it, and nothing else. The excluded
// list survives on purpose: it belongs to the person rather than to this
// text, and "Put every word back" is its own control. Undoable for the same
// seven seconds as everything else here, because a pane of pasted text is
// the most expensive thing on screen to lose.
function clearText() {
  if (!textInput.value) return;
  const text = textInput.value;
  const shown = el('source').textContent;
  const source = state.source;

  textInput.value = '';
  state.source = '';
  el('source').textContent = '';
  chrome.storage.local.set({ draft: '', draftSource: '' }).catch(() => {});
  noteText();
  say('');
  build({ announce: false });

  offerUndo('Text cleared.', () => {
    textInput.value = text;
    state.source = source;
    el('source').textContent = shown;
    chrome.storage.local.set({ draft: text, draftSource: source })
      .catch(() => {});
    noteText();
    build({ announce: false });
  });
}

// ------------------------------------------------------- the saved file

// Windows refuses these as filenames whatever the extension, and has since
// DOS. A page called "CON" is unlikely and entirely possible.
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

// Illegal on Windows. The two slashes matter everywhere else too, because
// either would be read as a path separator.
const ILLEGAL = /[\\/:*?"<>|\u0000-\u001f\u007f]/;

// The picture is of a particular page, so it is named after that page. A
// title is an arbitrary string off the web and this one becomes a filename,
// so it is cleaned rather than trusted.
function fileName(title) {
  const name = Array.from(title || '')
    .map(ch => (ILLEGAL.test(ch) ? ' ' : ch))
    // Cut as code points rather than as UTF-16 units, so a title that runs
    // past the limit cannot be cut through the middle of a surrogate pair.
    .slice(0, 60)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    // Windows drops trailing dots and spaces silently: "Report." saves as
    // "Report", and a title of "..." saves as nothing at all.
    .replace(/[. ]+$/, '');

  return !name || RESERVED.test(name) ? 'word-cloud.png' : name + '.png';
}

// -------------------------------------------------------------- settings

// An outline is a locus, not a mask: words fill outwards from the middle and
// stop when they run out, so a shape only reads once there are enough words
// for the outline to be what stopped the cloud growing. Saying so beats
// letting someone conclude the heart is broken.
// A circle or a heart is drawn by its smallest words, and under 75 of them
// the outline does not come through. That happens with a low Word limit or
// with a page that simply has few words, so the cloud's own word count
// decides. With no cloud there is nothing to advise on.
function noteShape() {
  const shaped = formOf(state.settings.form).shape !== 'rectangle';
  const words = state.words.length;
  el('shapeNote').hidden = !(shaped && words > 0 && words < 75);
}

function fillSelect(select, entries, selected) {
  select.replaceChildren(...entries.map(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
  }));
  select.value = selected;
}

function wireSetting(id, key, cast) {
  el(id).addEventListener('change', event => {
    state.settings[key] = cast ? cast(event.target.value) : event.target.value;
    saveSettings(state.settings);
    noteShape();
    // A setting is about how the cloud looks, so it redraws what is already
    // there rather than waiting for Generate to be pressed again.
    if (state.words.length || textInput.value.trim()) build({ announce: false });
  });
}

// ------------------------------------------------------------------ boot

async function main() {
  claimStudioTab();

  const [settings, excluded] = await Promise.all([loadSettings(), loadExcluded()]);
  state.settings = settings;
  state.excluded = excluded;
  // A form that no longer exists - one saved by an older version, or the two
  // settings this replaced - would otherwise leave the control blank.
  if (!forms[state.settings.form]) state.settings.form = defaultForm;

  fillSelect(el('scheme'),
    Object.entries(schemes).map(([key, scheme]) => [key, scheme.label]), settings.scheme);
  fillSelect(el('ground'),
    Object.entries(grounds).map(([key, ground]) => [key, ground.label]), settings.ground);
  fillSelect(el('form'),
    Object.entries(forms).map(([key, form]) => [key, form.label]), settings.form);
  el('limit').value = String(settings.limit);

  wireSetting('scheme', 'scheme');
  wireSetting('ground', 'ground');
  wireSetting('form', 'form');
  wireSetting('limit', 'limit', Number);
  noteShape();

  el('generate').addEventListener('click', () => build());
  clearButton.addEventListener('click', clearExcluded);
  clearTextButton.addEventListener('click', clearText);

  el('excludeForm').addEventListener('submit', event => {
    event.preventDefault();
    const input = el('excludeInput');
    // Typed words are lower-cased because that is the only form the counter
    // ever produces; "Design" typed here would otherwise match nothing and
    // look broken.
    const word = input.value.trim().toLowerCase();
    if (!word) return;
    input.value = '';
    if (state.excluded.has(word)) {
      say('"' + word + '" is already excluded.', 'notice');
      return;
    }
    exclude(word, 'form');
  });

  saveButton.addEventListener('click', async () => {
    if (!state.drawn) return;
    try {
      await toPng(canvas, fileName(state.source));
      say('Saved.', 'success');
    } catch {
      say('The image could not be saved.', 'error');
    }
  });

  // The text survives a reload of this tab. It is kept in local rather than
  // sync because a page of text does not fit in a sync item.
  // The title rides along with it. The text surviving a reload while the name
  // the file would be saved under does not would be a difference nobody can
  // see until they press Save.
  let draftTimer = null;
  textInput.addEventListener('input', () => {
    noteText();
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      chrome.storage.local
        .set({ draft: textInput.value, draftSource: state.source })
        .catch(() => {});
    }, 400);
  });

  // A handoff from the popup wins over the draft: it is the thing the user
  // just asked for.
  const handoff = await takeHandoff();
  if (handoff && handoff.text) {
    textInput.value = handoff.text;
    // The title alone, not the URL: a URL makes a poor filename, and what is
    // left of one after the illegal characters go is worse than none.
    state.source = handoff.title || '';
    el('source').textContent = handoff.title || handoff.url || '';
    chrome.storage.local
      .set({ draft: handoff.text, draftSource: state.source })
      .catch(() => {});
    build();
  } else {
    const got = await chrome.storage.local
      .get(['draft', 'draftSource']).catch(() => ({}));
    if (got.draft) {
      textInput.value = got.draft;
      state.source = got.draftSource || '';
      el('source').textContent = state.source;
      build({ announce: false });
    }
  }
  noteText();

  // Redraw on resize, but only when the box actually changed - setting the
  // canvas size inside the observer would otherwise feed itself.
  let resizeTimer = null;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!state.words.length) return;
      const box = stageBox();
      if (state.lastBox &&
          box.width === state.lastBox.width &&
          box.height === state.lastBox.height) return;
      render();
    }, 150);
  }).observe(stage);
}

main().catch(error => {
  console.error('Studio failed to start:', error);
  say('Something went wrong. Reload this tab.', 'error');
});
