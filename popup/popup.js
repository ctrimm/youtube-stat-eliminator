/* YouTube Stat Eliminator — popup logic.
 * Reads/writes chrome.storage.sync; the content script picks up changes
 * live via chrome.storage.onChanged, so no messaging is needed. */

(() => {
  'use strict';

  const DEFAULTS = { views: true, likes: true, subs: true, comments: true };
  const LABELS = {
    views: 'view counts',
    likes: 'like counts',
    subs: 'subscriber counts',
    comments: 'comment counts',
  };

  const boxes = {};
  for (const key of Object.keys(DEFAULTS)) {
    boxes[key] = document.getElementById(key);
  }
  const status = document.getElementById('status');

  function renderStatus(values) {
    const hidden = Object.keys(DEFAULTS).filter((k) => values[k]);
    if (hidden.length === Object.keys(DEFAULTS).length) {
      status.textContent = 'All stats hidden';
      status.classList.remove('hidden-none');
    } else if (hidden.length === 0) {
      status.textContent = 'Nothing hidden';
      status.classList.add('hidden-none');
    } else {
      status.textContent = `Hiding: ${hidden.map((k) => LABELS[k]).join(', ')}`;
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
