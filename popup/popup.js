/* YouTube Stat Eliminator — popup logic.
 * Reads/writes chrome.storage.sync; the content script picks up changes
 * live via chrome.storage.onChanged, so no messaging is needed. */

(() => {
  'use strict';

  const DEFAULTS = {
    views: true, likes: true, subs: true, comments: true,
    shorts: false, upnext: false, homefeed: false, commentsSection: false,
  };

  const boxes = {};
  for (const key of Object.keys(DEFAULTS)) {
    boxes[key] = document.getElementById(key);
  }
  const status = document.getElementById('status');

  function renderStatus(values) {
    const keys = Object.keys(DEFAULTS);
    const hidden = keys.filter((k) => values[k]);
    if (hidden.length === keys.length) {
      status.textContent = 'Everything hidden';
      status.classList.remove('hidden-none');
    } else if (hidden.length === 0) {
      status.textContent = 'Nothing hidden';
      status.classList.add('hidden-none');
    } else {
      status.textContent = `Hiding ${hidden.length} of ${keys.length}`;
      status.classList.remove('hidden-none');
    }
  }

  async function init() {
    let values;
    try {
      values = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
    } catch (e) {
      values = { ...DEFAULTS };
    }
    for (const key of Object.keys(DEFAULTS)) {
      boxes[key].checked = !!values[key];
      boxes[key].addEventListener('change', async () => {
        const next = { ...values, [key]: boxes[key].checked };
        values = next;
        try {
          await chrome.storage.sync.set({ [key]: boxes[key].checked });
        } catch (e) {
          /* storage unavailable; content script keeps its own copy */
        }
        renderStatus(next);
      });
    }
    renderStatus(values);
  }

  init();
})();
