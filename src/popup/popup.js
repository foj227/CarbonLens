'use strict';

// Category display names (subset for popup)
const CAT_NAMES = {
  apparel_and_leather: 'Apparel & Leather',
  computer_and_electronic_products: 'Electronics',
  electrical_equipment_appliances: 'Appliances',
  food_manufacturing: 'Packaged Food',
  meat_poultry_seafood: 'Meat & Seafood',
  dairy: 'Dairy',
  produce_agriculture: 'Fresh Produce',
  beverage_manufacturing: 'Beverages',
  furniture_and_related: 'Furniture',
  chemicals_and_personal_care: 'Personal Care',
  pharmaceuticals: 'Pharmaceuticals',
  paper_products: 'Paper Products',
  metal_products: 'Metal Products',
  machinery: 'Machinery',
  transportation_equipment: 'Transportation',
  sporting_toys_other_manufacturing: 'Sports & Toys',
  textile_mills: 'Textiles',
  plastics_and_rubber: 'Plastics',
  wood_products: 'Wood Products',
  printed_matter: 'Printed Matter',
  retail_trade_general: 'General Retail'
};

const EQUIVALENCIES = [
  { id: 'smartphone_charges', label: 'smartphone charges', icon: '🔋', value_per_kg: 121.6, min: 0.01, max: 5 },
  { id: 'miles_driven_gasoline_car', label: 'miles driven (gas car)', icon: '🚗', value_per_kg: 2.53, min: 0.5, max: 500 },
  { id: 'pounds_coal_burned', label: 'lbs of coal burned', icon: '🪨', value_per_kg: 1.10, min: 1, max: 1000 },
  { id: 'gallons_gasoline', label: 'gallons of gasoline', icon: '⛽', value_per_kg: 0.113, min: 2, max: 1000 },
  { id: 'tree_seedlings_10yr', label: 'tree seedlings (10 yr)', icon: '🌳', value_per_kg: 0.0165, min: 10, max: 10000 }
];

function pickComparisons(totalKg, maxCount = 2) {
  if (!totalKg) return [];
  const matching = EQUIVALENCIES.filter(e => totalKg >= e.min && totalKg <= e.max);
  const pool = matching.length > 0 ? matching : [EQUIVALENCIES[1]]; // fallback: miles driven
  return pool.slice(0, maxCount).map(e => {
    const v = totalKg * e.value_per_kg;
    const fmt = v < 10 ? v.toFixed(1) : Math.round(v).toString();
    return { ...e, formatted: fmt };
  });
}

function formatKg(kg) {
  if (!kg) return '0';
  if (kg < 10) return kg.toFixed(1);
  return Math.round(kg).toString();
}

async function loadSummary() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_SESSION_SUMMARY' }, (resp) => {
      resolve(resp || { totalKgCO2e: 0, count: 0, topCategory: null });
    });
  });
}

async function render() {
  const loadingEl = document.getElementById('loading');
  const summaryEl = document.getElementById('summary');
  const emptyEl = document.getElementById('empty');
  const totalKgEl = document.getElementById('total-kg');
  const countEl = document.getElementById('product-count');
  const topCatEl = document.getElementById('top-category');
  const equivEl = document.getElementById('equivalences');

  const summary = await loadSummary();

  loadingEl.classList.add('hidden');

  if (summary.count === 0) {
    emptyEl.classList.remove('hidden');
    return;
  }

  summaryEl.classList.remove('hidden');
  totalKgEl.textContent = `${formatKg(summary.totalKgCO2e)} kg CO₂e`;
  countEl.textContent = `${summary.count} product${summary.count !== 1 ? 's' : ''} viewed`;

  if (summary.topCategory) {
    topCatEl.textContent = `Top: ${CAT_NAMES[summary.topCategory] || summary.topCategory}`;
  }

  const comparisons = pickComparisons(summary.totalKgCO2e);
  equivEl.innerHTML = comparisons.map(c =>
    `<div class="equiv-row"><span aria-hidden="true">${c.icon}</span><span>≈ ${c.formatted} ${c.label}</span></div>`
  ).join('');
}

async function resetSession() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'RESET_SESSION' }, () => resolve());
  });
}

document.addEventListener('DOMContentLoaded', () => {
  render();

  document.getElementById('reset-btn').addEventListener('click', async () => {
    await resetSession();
    // Re-render from scratch
    const summaryEl = document.getElementById('summary');
    const emptyEl = document.getElementById('empty');
    const loadingEl = document.getElementById('loading');
    summaryEl.classList.add('hidden');
    emptyEl.classList.add('hidden');
    loadingEl.classList.remove('hidden');
    render();
  });

  document.getElementById('methodology-link').addEventListener('click', (e) => {
    e.preventDefault();
    window.open(chrome.runtime.getURL('docs/METHODOLOGY.md'), '_blank');
  });
});
