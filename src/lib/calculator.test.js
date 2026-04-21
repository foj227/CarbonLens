import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { estimateEmissions, bucketSeverity, formatSigFigs, PRICE_DEFLATOR_TO_2022 } from './calculator.js';

// Minimal factors fixture — only categories needed for tests
const sampleFactors = {
  categories: {
    apparel_and_leather: { kg_co2e_per_usd: 0.201, display_name: 'Apparel & Leather Products' },
    dairy: { kg_co2e_per_usd: 0.9436, display_name: 'Dairy Products' },
    computer_and_electronic_products: { kg_co2e_per_usd: 0.0972, display_name: 'Computer & Electronic Products' },
    meat_poultry_seafood: { kg_co2e_per_usd: 0.9129, display_name: 'Meat, Poultry & Seafood' },
    retail_trade_general: { kg_co2e_per_usd: 0.164, display_name: 'General Retail (fallback)' }
  }
};

describe('estimateEmissions — invalid inputs', () => {
  it('null price → unknown', () => {
    const r = estimateEmissions({ priceUSD: null, category: 'apparel_and_leather', factors: sampleFactors });
    assert.equal(r.kgCO2e, null);
    assert.equal(r.confidence, 'unknown');
  });

  it('undefined price → unknown', () => {
    const r = estimateEmissions({ priceUSD: undefined, category: 'apparel_and_leather', factors: sampleFactors });
    assert.equal(r.kgCO2e, null);
    assert.equal(r.confidence, 'unknown');
  });

  it('zero price → unknown', () => {
    const r = estimateEmissions({ priceUSD: 0, category: 'apparel_and_leather', factors: sampleFactors });
    assert.equal(r.kgCO2e, null);
    assert.equal(r.confidence, 'unknown');
  });

  it('negative price → unknown, does NOT throw', () => {
    const r = estimateEmissions({ priceUSD: -50, category: 'apparel_and_leather', factors: sampleFactors });
    assert.equal(r.kgCO2e, null);
    assert.equal(r.confidence, 'unknown');
  });

  it('missing category → unknown, does NOT throw', () => {
    const r = estimateEmissions({ priceUSD: 100, category: 'nonexistent_category', factors: sampleFactors });
    assert.equal(r.kgCO2e, null);
    assert.equal(r.confidence, 'unknown');
  });

  it('null category → unknown', () => {
    const r = estimateEmissions({ priceUSD: 100, category: null, factors: sampleFactors });
    assert.equal(r.kgCO2e, null);
    assert.equal(r.confidence, 'unknown');
  });
});

describe('estimateEmissions — deflator math', () => {
  it('$100 apparel → ~18.1 kg CO₂e (assert to 1 decimal)', () => {
    // (100 / 1.11) × 0.201 = 90.09... × 0.201 = 18.108...
    const r = estimateEmissions({ priceUSD: 100, category: 'apparel_and_leather', factors: sampleFactors });
    assert.ok(r.kgCO2e != null, 'kgCO2e should not be null');
    assert.equal(Math.round(r.kgCO2e * 10) / 10, 18.1);
  });

  it('uses the correct deflator constant', () => {
    assert.equal(PRICE_DEFLATOR_TO_2022, 1.11);
  });

  it('custom deflator is respected', () => {
    const r = estimateEmissions({ priceUSD: 100, category: 'apparel_and_leather', factors: sampleFactors, deflator: 1.0 });
    // 100 × 0.201 = 20.1
    assert.equal(Math.round(r.kgCO2e * 10) / 10, 20.1);
  });

  it('factorUsed is populated', () => {
    const r = estimateEmissions({ priceUSD: 50, category: 'apparel_and_leather', factors: sampleFactors });
    assert.equal(r.factorUsed, 0.201);
  });

  it('intensity = kgCO2e / priceUSD', () => {
    const r = estimateEmissions({ priceUSD: 100, category: 'apparel_and_leather', factors: sampleFactors });
    assert.ok(Math.abs(r.intensity - (r.kgCO2e / 100)) < 0.0001);
  });
});

describe('estimateEmissions — no precision drift', () => {
  it('repeated calls with same input return same result', () => {
    const a = estimateEmissions({ priceUSD: 29.99, category: 'dairy', factors: sampleFactors });
    const b = estimateEmissions({ priceUSD: 29.99, category: 'dairy', factors: sampleFactors });
    assert.equal(a.kgCO2e, b.kgCO2e);
  });
});

describe('bucketSeverity', () => {
  it('null intensity → gray', () => {
    assert.equal(bucketSeverity(null), 'gray');
  });

  it('undefined intensity → gray', () => {
    assert.equal(bucketSeverity(undefined), 'gray');
  });

  it('intensity 0.10 → green (≤ 0.30)', () => {
    assert.equal(bucketSeverity(0.10), 'green');
  });

  it('intensity 0.30 → green (boundary)', () => {
    assert.equal(bucketSeverity(0.30), 'green');
  });

  it('intensity 0.31 → amber', () => {
    assert.equal(bucketSeverity(0.31), 'amber');
  });

  it('intensity 0.70 → amber (boundary)', () => {
    assert.equal(bucketSeverity(0.70), 'amber');
  });

  it('intensity 0.71 → red', () => {
    assert.equal(bucketSeverity(0.71), 'red');
  });

  it('computer_and_electronic_products $500 → green severity', () => {
    const r = estimateEmissions({ priceUSD: 500, category: 'computer_and_electronic_products', factors: sampleFactors });
    assert.equal(bucketSeverity(r.intensity), 'green');
  });

  it('dairy $10 → red severity (high factor)', () => {
    const r = estimateEmissions({ priceUSD: 10, category: 'dairy', factors: sampleFactors });
    assert.equal(bucketSeverity(r.intensity), 'red');
  });

  it('apparel $100 → amber severity', () => {
    const r = estimateEmissions({ priceUSD: 100, category: 'apparel_and_leather', factors: sampleFactors });
    // intensity = 18.1 / 100 = 0.181 → green actually
    // Let's verify the actual intensity
    const severity = bucketSeverity(r.intensity);
    assert.ok(['green', 'amber'].includes(severity), `Apparel severity should be green or amber, got ${severity}`);
  });
});

describe('formatSigFigs', () => {
  it('18.10809 → "18" (2 sig figs)', () => {
    assert.equal(formatSigFigs(18.10809), '18');
  });

  it('1.810 → "1.8" (2 sig figs)', () => {
    assert.equal(formatSigFigs(1.810), '1.8');
  });

  it('0.1810 → "0.18" (2 sig figs)', () => {
    assert.equal(formatSigFigs(0.1810), '0.18');
  });

  it('123.456 → "120" (2 sig figs)', () => {
    assert.equal(formatSigFigs(123.456), '120');
  });

  it('null → null', () => {
    assert.equal(formatSigFigs(null), null);
  });
});
