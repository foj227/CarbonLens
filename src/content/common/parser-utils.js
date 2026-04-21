// Price parsing utilities — source reference.
// Inlined into each content script (amazon.js, walmart.js, generic.js).

/**
 * Parses a price string into a numeric USD amount.
 * Handles: "$24.99", "$1,299.00", "$12.99 - $19.99" (uses low end), "24.99".
 * Returns null for non-USD or unparseable input.
 * @param {string|null|undefined} text
 * @returns {{ amount: number, currency: 'USD' }|null}
 */
function parsePrice(text) {
  if (!text) return null;
  const str = String(text).trim();

  // Range: use the lower end
  const rangeMatch = str.match(/\$?([\d,]+\.?\d*)\s*[-–—]\s*\$?([\d,]+\.?\d*)/);
  if (rangeMatch) {
    const lo = parseFloat(rangeMatch[1].replace(/,/g, ''));
    if (!isNaN(lo) && lo > 0) return { amount: lo, currency: 'USD' };
  }

  // Non-USD currencies — skip estimation
  if (/[£€¥₹₩]/.test(str)) return null;

  // Single price
  const singleMatch = str.match(/\$?\s*([\d,]+\.?\d*)/);
  if (singleMatch) {
    const amount = parseFloat(singleMatch[1].replace(/,/g, ''));
    if (!isNaN(amount) && amount > 0) return { amount, currency: 'USD' };
  }

  return null;
}
