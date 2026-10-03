/* YouTube Stat Eliminator — content script (Manifest V3).
 *
 * Strategy: per-category classes on <html> drive the pure-CSS rules in
 * content.css for elements that are unambiguously stats. Elements that share
 * a container with non-stat text (e.g. "28M" inside #metadata-line next to
 * "6y ago") are matched by text pattern here and hidden via [data-yse-hide].
 *
 * YouTube is a single-page app, so a MutationObserver re-scans added
 * subtrees. Scans are batched on requestAnimationFrame to stay cheap, and
 * candidate selectors are kept narrow on purpose.
 */

(() => {
  'use strict';

  const DEFAULTS = {
    // Stat hiding (on by default: the extension's original purpose)
    views: true, likes: true, subs: true, comments: true,
    // Declutter (opt-in: each hides a whole section of the page)
    shorts: false, upnext: false, homefeed: false, commentsSection: false,
  };

  const CLASSES = {
    views: 'yse-hide-views',
    likes: 'yse-hide-likes',
    subs: 'yse-hide-subs',
    comments: 'yse-hide-comments',
    shorts: 'yse-no-shorts',
    upnext: 'yse-no-upnext',
    homefeed: 'yse-no-homefeed',
    commentsSection: 'yse-no-comments-section',
  };

  // Full-string matches only (English YouTube UI), so a video titled
  // "10 views of the ocean" is never touched.
  const VIEW_RE = /^\s*(?:[\d][\d,.\s]*[KMB]?\s+views?|no views)\s*$/i;
  const WATCHING_RE = /^\s*[\d][\d,.\s]*[KMB]?\s+watching\s*$/i;
  const SUB_RE = /^\s*[\d][\d,.\s]*[KMB]?\s+subscribers?\s*$/i;
  const COMMENT_COUNT_RE = /^\s*[\d][\d,.\s]*[KMB]?\s+comments?\s*$/i;
  // Thumbnail metadata lines show the view count as a bare short number
  // ("28M", "106K") in the first span, next to the age ("6y ago").
  const BARE_COUNT_RE = /^\s*[\d][\d,.\s]*[KMB]?\s*$/i;

  // Candidate containers whose text we inspect.
  const VIEW_TEXT_CANDIDATES =
    '#metadata-line span, #metadata-line yt-formatted-string,' +
    'ytm-shorts-lockup-view-model span, ytd-reel-item-renderer #meta span';
  const SUB_CANDIDATES =
    '#subscriber-count, [id="subscriber-count"], #owner-sub-count,' +
    'yt-content-metadata-view-model span';
  const COMMENT_CANDIDATES = 'ytd-comments-header-renderer #count';

  let settings = { ...DEFAULTS };
  let scheduled = false;
  const pending = [];

  const rootEl = () => document.documentElement;

  function applyClasses() {
    const el = rootEl();
    if (!el) return;
    for (const [key, cls] of Object.entries(CLASSES)) {
      el.classList.toggle(cls, !!settings[key]);
    }
  }

  function hide(el, category) {
    if (!(el instanceof Element)) return;
    if (el.dataset.yseHide) return;
    el.dataset.yseHide = category;
  }

  function unhideCategory(category) {
    document
      .querySelectorAll(`[data-yse-hide="${category}"]`)
      .forEach((el) => delete el.dataset.yseHide);
  }

  function collect(scope, selector) {
    const out = [];
    if (scope instanceof Element && scope.matches(selector)) out.push(scope);
    out.push(...scope.querySelectorAll(selector));
    return out;
  }

  function scanViews(scope) {
    if (!settings.views) return;
    for (const el of collect(scope, VIEW_TEXT_CANDIDATES)) {
      if (el.dataset.yseHide) continue;
      const t = el.textContent || '';
      if (VIEW_RE.test(t) || WATCHING_RE.test(t)) hide(el, 'views');
    }
    // Bare short numbers ("28M", "1.8B") in legacy metadata lines.
    for (const line of collect(scope, '#metadata-line')) {
      if (line.dataset.yseScanned) continue;
      line.dataset.yseScanned = '1';
      const first = [...line.querySelectorAll(':scope > span, :scope > yt-formatted-string')]
        .find((s) => (s.textContent || '').trim().length > 0);
      if (first && !first.dataset.yseHide && BARE_COUNT_RE.test(first.textContent || '')) {
        hide(first, 'views');
      }
    }
    // New lockup view-model metadata rows (search, channel pages, home):
    // spans like "1.8B" next to "16 years ago" inside yt-content-metadata-view-model.
    for (const meta of collect(scope, 'yt-content-metadata-view-model')) {
      if (meta.dataset.yseScanned) continue;
      meta.dataset.yseScanned = '1';
      for (const s of meta.querySelectorAll('span.ytContentMetadataViewModelMetadataText')) {
        if (s.dataset.yseHide) continue;
        const t = (s.textContent || '').trim();
        if (t && (BARE_COUNT_RE.test(t) || VIEW_RE.test(t) || WATCHING_RE.test(t))) {
          hide(s, 'views');
        }
      }
    }
  }

  function scanSubs(scope) {
    if (!settings.subs) return;
    for (const el of collect(scope, SUB_CANDIDATES)) {
      if (el.dataset.yseHide) continue;
      const t = (el.textContent || '').trim();
      if (t && SUB_RE.test(t)) hide(el, 'subs');
    }
  }

  function scanComments(scope) {
    if (!settings.comments) return;
    for (const el of collect(scope, COMMENT_CANDIDATES)) {
      if (el.dataset.yseHide) continue;
      const t = (el.textContent || '').trim();
      if (t && COMMENT_COUNT_RE.test(t)) hide(el, 'comments');
    }
  }

  function scan(scope) {
    if (!scope || scope.nodeType !== 1) return;
    scanViews(scope);
    scanSubs(scope);
    scanComments(scope);
  }

  function scheduleScan(nodes) {
    pending.push(...nodes);
    if (scheduled) return;
    scheduled = true;
    const run = () => {
      if (!scheduled) return; // already ran via the other trigger
      scheduled = false;
      const batch = pending.splice(0, pending.length);
      for (const n of batch) scan(n);
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    // Fallback: rAF never fires in background tabs.
    setTimeout(run, 1000);
  }

  function observe() {
    const target = document.documentElement || document;
    const observer = new MutationObserver((mutations) => {
      const added = [];
      for (const m of mutations) {
        if (m.type === 'childList') {
          for (const n of m.addedNodes) {
            if (n.nodeType === 1) added.push(n);
          }
        } else if (m.type === 'characterData') {
          const parent = m.target.parentElement;
          if (parent) added.push(parent);
        }
      }
      if (added.length) scheduleScan(added);
    });
    observer.observe(target, { childList: true, subtree: true, characterData: true });

    // YouTube fires this on SPA navigation; re-scan in case nodes were reused.
    document.addEventListener('yt-navigate-finish', () => {
      scheduleScan([document.documentElement]);
    });
  }

  async function loadSettings() {
    try {
      const stored = await chrome.storage.sync.get(DEFAULTS);
      settings = { ...DEFAULTS, ...stored };
    } catch (e) {
      settings = { ...DEFAULTS };
    }
  }

  function onSettingsChanged(changes) {
    let needRescan = false;
    for (const key of Object.keys(DEFAULTS)) {
      if (!(key in changes)) continue;
      const nowOn = !!changes[key].newValue;
      settings[key] = nowOn;
      const el = rootEl();
      if (el) el.classList.toggle(CLASSES[key], nowOn);
      if (!nowOn) {
        // Restore anything this category hid via JS.
        unhideCategory(key);
        // Metadata containers may need re-evaluation when re-enabled.
        if (key === 'views') {
          document.querySelectorAll('[data-yse-scanned]')
            .forEach((l) => delete l.dataset.yseScanned);
        }
      } else {
        needRescan = true;
      }
    }
    if (needRescan && document.documentElement) {
      scheduleScan([document.documentElement]);
    }
  }

  async function init() {
    await loadSettings();
    applyClasses();
    const start = () => {
      applyClasses();
      if (document.documentElement) {
        scan(document.documentElement);
        observe();
      }
    };
    if (document.documentElement) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
    chrome.storage.onChanged.addListener(onSettingsChanged);
  }

  init();
})();
