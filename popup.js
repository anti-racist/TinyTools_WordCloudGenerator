// Popup entry point. Two ways into the studio, and nothing else.
//
// 1.x generated, edited and exported in a 340px popup. 2.0 moves all of
// that into a tab, so the popup is left with the one thing a tab cannot do
// for itself: read the page the user is standing on.

import { getActiveTab, isReadable, readPageText, openStudio } from './src/browser.js';
import { putHandoff } from './src/store.js';

const statusElement = document.getElementById('status');

function say(text, tone) {
  statusElement.textContent = text;
  statusElement.className = text ? `status ${tone}` : 'status';
}

async function grabAndOpen() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    say('Cannot read this tab. Try reloading the page.', 'error');
    return;
  }
  // Checked before the injection, so the user is told what is wrong rather
  // than shown the platform's own permission error.
  if (!isReadable(tab.url)) {
    say('Browser pages cannot be read. Open the studio and paste your text.', 'notice');
    return;
  }

  let text = '';
  try {
    text = await readPageText(tab.id);
  } catch {
    say('Cannot read this tab. Try reloading the page.', 'error');
    return;
  }

  if (!text) {
    say('This page has no text to read.', 'notice');
    return;
  }

  await putHandoff({ text, title: tab.title || '', url: tab.url || '' });
  await openStudio();
  window.close();
}

function wire(id, handler) {
  const button = document.getElementById(id);
  let running = false;
  button.addEventListener('click', async () => {
    // The popup stays open while the page is read. Without this, a second
    // click queues a second injection and a second handoff write.
    if (running) return;
    running = true;
    button.disabled = true;
    try {
      await handler();
    } catch (error) {
      console.error(error);
      say('Something went wrong. Please try again.', 'error');
    } finally {
      running = false;
      button.disabled = false;
    }
  });
}

wire('grab', grabAndOpen);
wire('open', async () => { await openStudio(); window.close(); });
