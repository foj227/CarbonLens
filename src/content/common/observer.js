// MutationObserver helper for SPA navigation detection — source reference.
// Inlined into each content script.

/**
 * Creates a debounced MutationObserver that fires the callback when the
 * page DOM changes significantly (e.g., a SPA route change).
 * @param {function} callback
 * @param {number} debounceMs
 * @returns {MutationObserver}
 */
function createSpaObserver(callback, debounceMs = 500) {
  let timer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(callback, debounceMs);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
