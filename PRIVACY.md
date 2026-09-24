# Privacy policy: Word Cloud Generator

Last updated: 24 September 2026

Word Cloud Generator is a browser extension published by Maggie Mao. This
policy describes what data the extension handles, where that data goes, and
how long it is kept.

## In short

- The developer collects nothing. The extension has no server, no account,
  no analytics and no network code, and its content security policy blocks
  network requests.
- It reads a page's text only when you ask it to, and keeps your settings
  in your browser.

## What it handles

| Data | When | Where it goes | How long it is kept |
| --- | --- | --- | --- |
| The visible text of the page you are on, with its title and address | Only when you click **Get text from this page** | Handed to the studio through the browser's local extension storage | Removed as soon as the studio opens it |
| Text you paste or type into the studio | When you enter it | Stays in the studio page. It is not saved | Until you close the studio |
| Words you exclude, and your settings (colour scheme, background, word limit, shape) | When you change them | Saved by your browser with `chrome.storage.sync`. If you are signed in to your browser with sync on, your browser account syncs them to your other signed-in browsers | Until you change them or remove the extension |
| Which tab the studio is open in | When the studio opens | `chrome.storage.session`, in this browser only | Cleared when the browser closes |
| The word cloud image | When you click **Save as PNG** | Your downloads folder | It is your file |

## What it does not do

- It does not send any data to the developer or to anyone else.
- It does not sell data, show ads, or track you across sites.
- It does not read any page you have not asked it to read.

## Permissions

| Permission | Why |
| --- | --- |
| `activeTab`, `scripting` | To read the text of the page you are on, when you click **Get text from this page** |
| `storage` | To keep your settings and excluded words, and to pass page text to the studio |

## Syncing

Settings and excluded words are synced by your browser, not by this
extension. How your browser account stores synced data is covered by your
browser's own privacy policy (for Chrome,
[Google's privacy policy](https://policies.google.com/privacy)).

## Your choices

- Put back an excluded word, or change a setting, at any time in the studio.
- Remove the extension to delete what it stored in this browser.

## Contact

Questions about this policy:
[open an issue](https://github.com/anti-racist/TinyTools_WordCloudGenerator/issues).

## Changes

If this policy changes, the new version will be posted here with a new date.
