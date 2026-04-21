// Thin wrapper around chrome.storage.session for ephemeral session tracking.
// Data is cleared automatically when the browser closes (MV3 session storage guarantee).

const SESSION_KEY = 'session_views';
const MAX_ENTRIES = 500;

export async function appendView(payload) {
  const result = await chrome.storage.session.get(SESSION_KEY);
  const views = result[SESSION_KEY] || [];
  views.push(payload);
  if (views.length > MAX_ENTRIES) views.shift(); // FIFO eviction
  await chrome.storage.session.set({ [SESSION_KEY]: views });
}

export async function getSummary() {
  const result = await chrome.storage.session.get(SESSION_KEY);
  const views = result[SESSION_KEY] || [];

  const totalKgCO2e = views.reduce((sum, v) => sum + (v.kgCO2e || 0), 0);
  const count = views.length;

  const categoryCounts = {};
  for (const v of views) {
    if (v.category) categoryCounts[v.category] = (categoryCounts[v.category] || 0) + 1;
  }
  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return {
    totalKgCO2e: Math.round(totalKgCO2e * 100) / 100,
    count,
    topCategory
  };
}

export async function resetSession() {
  await chrome.storage.session.set({ [SESSION_KEY]: [] });
}
