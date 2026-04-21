// Maps a kg CO₂e value to human-relatable equivalences from data/equivalencies.json.

/**
 * Returns up to maxCount comparisons whose min_kg/max_kg range contains kgCO2e.
 * Falls back to miles_driven if no range matches.
 * @param {number|null} kgCO2e
 * @param {object} equivalencies — parsed data/equivalencies.json
 * @param {number} maxCount
 * @returns {Array<{id, label, icon, formatted, value}>}
 */
export function pickComparisons(kgCO2e, equivalencies, maxCount = 2) {
  if (kgCO2e == null) return [];

  const matching = equivalencies.comparisons.filter(
    e => kgCO2e >= e.min_kg && kgCO2e <= e.max_kg
  );

  const results = matching.length > 0
    ? matching.slice(0, maxCount)
    : [equivalencies.comparisons.find(e => e.id === 'miles_driven_gasoline_car') || equivalencies.comparisons[0]];

  return results.map(entry => {
    const value = kgCO2e * entry.value_per_kg_co2e;
    const formatted = value < 10 ? value.toFixed(1) : Math.round(value).toString();
    return { id: entry.id, label: entry.label, icon: entry.icon, formatted, value };
  });
}
