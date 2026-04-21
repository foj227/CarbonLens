import { appendView, getSummary, resetSession } from '../lib/session.js';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'RECORD_VIEW') {
    appendView(msg.payload).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === 'GET_SESSION_SUMMARY') {
    getSummary().then(sendResponse).catch(() => sendResponse({ totalKgCO2e: 0, count: 0, topCategory: null }));
    return true;
  }
  if (msg.type === 'RESET_SESSION') {
    resetSession().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
});
