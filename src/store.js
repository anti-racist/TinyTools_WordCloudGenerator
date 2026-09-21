// Everything that outlives the tab.
//
// Two areas, for two different reasons.
//
// sync holds the exclusion list and the settings: small, worth carrying
// between a user's own signed-in machines, and cheap enough that neither
// comes near QUOTA_BYTES_PER_ITEM. sync also limits writes to 120 a minute,
// so both are debounced - clicking five words off a cloud in five seconds
// is one write, not five.
//
// local holds the handoff from the popup to the studio, which is a page of
// text: 8 KB would not hold an article, and there is nothing to gain from
// carrying one machine's open tab to another.

const SYNC_EXCLUDED = 'excluded';
const SYNC_SETTINGS = 'settings';
const LOCAL_HANDOFF = 'handoff';

// QUOTA_BYTES_PER_ITEM is 8192. A stored word averages well under 10 bytes
// with its JSON quoting, so 500 leaves room to spare rather than sailing
// close and failing on somebody's vocabulary.
export const EXCLUDED_LIMIT = 500;

const defaultSettings = {
  scheme: 'indigo',
  ground: 'paper',
  limit: 30,
  form: 'square'
};

export async function loadExcluded() {
  try {
    const got = await chrome.storage.sync.get(SYNC_EXCLUDED);
    const list = got[SYNC_EXCLUDED];
    return new Set(Array.isArray(list) ? list.filter(w => typeof w === 'string') : []);
  } catch {
    // A cloud is still worth drawing without the list, so a storage failure
    // is not allowed to stop one being drawn.
    return new Set();
  }
}

export async function loadSettings() {
  try {
    const got = await chrome.storage.sync.get(SYNC_SETTINGS);
    return { ...defaultSettings, ...(got[SYNC_SETTINGS] || {}) };
  } catch {
    return { ...defaultSettings };
  }
}

// One debounce per key, so a burst of exclusions and a burst of setting
// changes do not cancel each other.
const pending = new Map();
function debounced(key, write, ms = 400) {
  clearTimeout(pending.get(key));
  pending.set(key, setTimeout(() => { pending.delete(key); write(); }, ms));
}

export function saveExcluded(set) {
  const list = [...set].slice(0, EXCLUDED_LIMIT);
  debounced(SYNC_EXCLUDED, () => {
    chrome.storage.sync.set({ [SYNC_EXCLUDED]: list }).catch(() => {});
  });
}

export function saveSettings(settings) {
  debounced(SYNC_SETTINGS, () => {
    chrome.storage.sync.set({ [SYNC_SETTINGS]: settings }).catch(() => {});
  });
}

export async function putHandoff(payload) {
  await chrome.storage.local.set({ [LOCAL_HANDOFF]: { ...payload, at: Date.now() } });
}

// Read once and removed in the same breath. The studio is a long-lived tab;
// leaving the text behind would mean a reload silently replacing whatever
// the user had typed in the meantime with a page they grabbed an hour ago.
export async function takeHandoff() {
  try {
    const got = await chrome.storage.local.get(LOCAL_HANDOFF);
    const payload = got[LOCAL_HANDOFF];
    if (!payload) return null;
    await chrome.storage.local.remove(LOCAL_HANDOFF);
    return payload;
  } catch {
    return null;
  }
}
