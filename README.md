# YouTube Stat Eliminator

A Chrome extension (Manifest V3) that hides view counts, like counts, subscriber
counts, and comment counts across YouTube — so you can watch videos without
the numbers shaping what you click.

## What it hides

| Category | Where |
|---|---|
| View counts | Homepage, search results, channel pages, watch page, Up Next, Shorts shelves, livestream "watching now" counts |
| Like counts | Watch page like button, Shorts |
| Subscriber counts | Video pages, channel pages, search results |
| Comment counts | Comment section header, per-comment like counts |

Each category can be toggled independently from the toolbar popup. Buttons stay
functional — only the numbers disappear. Settings sync across your Chrome
profile via `chrome.storage.sync`.

## Install (load unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select this folder
4. Open YouTube — the numbers should be gone. Click the toolbar icon to toggle categories.

## How it works

- `content/content.css` — structural hiding rules driven by per-category classes
  on `<html>` (e.g. `yse-hide-views`)
- `content/content.js` — runs at `document_start`; reads settings, sets the
  classes, and uses a batched `MutationObserver` to hide stat text inside
  shared containers (e.g. `28M` inside `#metadata-line` next to `6y ago`) by
  full-string pattern match. Only `storage` permission is requested.
- `popup/` — toolbar popup with per-category toggles; changes apply live to
  open YouTube tabs via `chrome.storage.onChanged` (no background worker needed)

No remote code, no analytics, no data collection. See [PRIVACY.md](PRIVACY.md).

## Development

Edit the files, then reload the extension at `chrome://extensions`. YouTube's
DOM changes often — if a stat reappears, the selectors in
`content/content.css` and the candidate lists in `content/content.js` are the
place to look. Verified against the live YouTube DOM in October 2026.

## Submitting to the Chrome Web Store

1. Zip the extension: `zip -r youtube-stat-eliminator-1.0.0.zip manifest.json content/ popup/ icons/`
   (a ready-made zip is attached to the GitHub release)
2. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole),
   pay the one-time $5 developer fee, and upload the zip
3. Fill in the listing from [STORE_LISTING.md](STORE_LISTING.md) (description,
   category, screenshots in `store-assets/`)
4. Privacy tab: declare **no data collection** (see [PRIVACY.md](PRIVACY.md));
   single purpose: "Hides YouTube engagement statistics"
5. Submit for review (typically a few days)

## License

MIT — see [LICENSE](LICENSE).
