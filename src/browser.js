// The chrome.* surface, in one file, so every other module is testable
// without a browser.

// Pages an extension cannot script. Checked before the injection rather
// than after, so the user is told what is wrong instead of being shown a
// permission error from the platform.
export function isReadable(url) {
  if (typeof url !== 'string') return false;
  return /^https?:|^file:/.test(url);
}

export async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

export async function readPageText(tabId) {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    // innerText is already what the page renders: it leaves out script and
    // style content, leaves out anything hidden, and returns each run of
    // text once.
    func: () => document.body.innerText.replace(/\s+/g, ' ').trim()
  });
  return injection?.result || '';
}

const STUDIO = 'studio.html';
const STUDIO_TAB = 'studioTabId';

// Focus the studio if it is already open, otherwise open one.
//
// Finding it by URL would mean chrome.tabs.query({url}), and that needs the
// "tabs" permission - whose install-time warning is "Read your browsing
// history". Remembering the id costs nothing and asks for nothing:
// tabs.update on an id needs no permission, and a stale id simply throws,
// which is the signal to open a new one.
//
// The id is kept in storage.session, which is emptied when the browser
// restarts. Tab ids are only unique within a session, so an id left in
// storage.local would survive a restart and could by then belong to an
// unrelated tab - which this would then navigate to the studio, out from
// under whatever the user had open in it.
export async function openStudio() {
  const url = chrome.runtime.getURL(STUDIO);
  try {
    const got = await chrome.storage.session.get(STUDIO_TAB);
    const id = got[STUDIO_TAB];
    if (typeof id === 'number') {
      const tab = await chrome.tabs.update(id, { active: true, url });
      if (tab?.windowId !== undefined) {
        await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
      }
      return tab;
    }
  } catch {
    // Closed since, or never there. Fall through and open one.
  }
  const tab = await chrome.tabs.create({ url });
  await chrome.storage.session.set({ [STUDIO_TAB]: tab.id }).catch(() => {});
  return tab;
}

// Called by the studio itself on load, so the id is right even when the tab
// was opened from the address bar or restored with the window.
export async function claimStudioTab() {
  try {
    const tab = await chrome.tabs.getCurrent();
    if (tab?.id !== undefined) await chrome.storage.session.set({ [STUDIO_TAB]: tab.id });
  } catch {}
}
