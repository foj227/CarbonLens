// Spend-based emissions calculator using EPA USEEIO v1.3.0 factors.
// Core formula: kg CO₂e = (priceUSD / deflator) × kg_co2e_per_usd[category]

/** CPI deflation constant: cumulative US CPI 2022→2026 (~11%).
 *  Update when EPA publishes a new USEEIO reference year.
 *  Verify against https://www.bls.gov/data/inflation_calculator.htm */
export const PRICE_DEFLATOR_TO_2022 = 1.11;

/**
 * @param {{ priceUSD: number, category: string, factors: object, deflator?: number }} opts
 * @returns {{ kgCO2e: number|null, factorUsed: number|null, intensity: number|null, confidence: string }}
 */
export function estimateEmissions({ priceUSD, category, factors, deflator = PRICE_DEFLATOR_TO_2022 }) {
  if (!priceUSD || priceUSD <= 0) {
    return { kgCO2e: null, factorUsed: null, intensity: null, confidence: 'unknown' };
  }
  if (!category || !factors?.categories?.[category]) {
    return { kgCO2e: null, factorUsed: null, intensity: null, confidence: 'unknown' };
  }

  const catData = factors.categories[category];
  const factor = catData.kg_co2e_per_usd;
  const priceIn2022USD = priceUSD / deflator;
  const kgCO2e = priceIn2022USD * factor;
  const intensity = kgCO2e / priceUSD;

  return { kgCO2e, factorUsed: factor, intensity, confidence: null };
}

/**
 * Severity bucket based on kg CO₂e per dollar spent.
 * Using intensity (per-dollar) keeps $5 snacks and $500 laptops comparable.
 * @param {number|null} intensity
 * @returns {'green'|'amber'|'red'|'gray'}
 */
export function bucketSeverity(intensity) {
  if (intensity == null || isNaN(intensity)) return 'gray';
  if (intensity <= 0.30) return 'green';
  if (intensity <= 0.70) return 'amber';
  return 'red';
}

/**
 * Format a number to N significant figures for display.
 * @param {number|null} n
 * @param {number} sigFigs
 * @returns {string|null}
 */
export function formatSigFigs(n, sigFigs = 2) {
  if (n == null || isNaN(n)) return null;
  if (n === 0) return '0';
  const power = Math.floor(Math.log10(Math.abs(n))) - (sigFigs - 1);
  const factor = Math.pow(10, power);
  const rounded = Math.round(n / factor) * factor;
  if (power >= 0) return Math.round(rounded).toString();
  return rounded.toFixed(-power);
}
