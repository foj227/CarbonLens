// Shadow DOM badge component — source reference.
// This file is NOT loaded directly by content scripts (MV3 can't import modules in content scripts).
// Its logic is inlined verbatim into amazon.js, walmart.js, and generic.js.
//
// To update the badge, edit here first, then propagate changes to each content script.

// Leaf SVG path (single path, leaf shape)
const LEAF_PATH = 'M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 008 20C19 20 22 3 22 3c-1 2-8 2-8 2v-1h-1z';
const LEAF_PATH_HALF = 'M12 2C8 2 4 6 4 10c0 3.1 1.7 5.8 4.3 7.3L12 22l3.7-4.7C18.3 15.8 20 13.1 20 10c0-4-4-8-8-8zm0 14l-2.5-3.2C8.1 11.7 8 10.9 8 10c0-2.2 1.8-4 4-4s4 1.8 4 4c0 .9-.1 1.7-.5 2.8L12 16z';

function buildLeafSvg(severity, style = 'solid') {
  const path = style === 'half' ? LEAF_PATH_HALF : LEAF_PATH;
  return `<svg class="cl-leaf cl-${severity}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`;
}

/**
 * Creates and returns a Shadow DOM badge element.
 * @param {object} data
 * @param {number|null} data.kgCO2e
 * @param {number|null} data.intensity
 * @param {string} data.category
 * @param {string} data.confidence  'high'|'medium'|'low'|'unknown'
 * @param {string} data.matchedOn
 * @param {number|null} data.price
 * @param {Array} data.comparisons  from pickComparisons()
 * @param {object} data.factors     full factors JSON
 * @param {function} data.formatSigFigs
 * @param {function} data.bucketSeverity
 * @param {string} data.badgeCSS    inlined CSS string
 * @returns {HTMLElement}  the wrapper div (id="carbonlens-root")
 */
function createBadge(data) {
  const {
    kgCO2e, intensity, category, confidence, price,
    comparisons, factors, formatSigFigs, bucketSeverity, badgeCSS
  } = data;

  const severity = bucketSeverity(intensity);
  const catData = factors?.categories?.[category];
  const catName = catData?.display_name || 'General Retail';
  const factor = catData?.kg_co2e_per_usd;
  const displayKg = kgCO2e != null ? formatSigFigs(kgCO2e) : null;
  const firstComp = comparisons?.[0];

  const wrapper = document.createElement('div');
  wrapper.id = 'carbonlens-root';
  Object.assign(wrapper.style, {
    display: 'block',
    margin: '8px 0',
    position: 'relative',
    zIndex: '9999'
  });

  const shadow = wrapper.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = badgeCSS;

  // --- Pill ---
  const pill = document.createElement('div');
  pill.className = `cl-pill cl-badge-${severity}`;
  pill.setAttribute('role', 'button');
  pill.setAttribute('tabindex', '0');
  pill.setAttribute('aria-expanded', 'false');

  const leafStyle = confidence === 'high' ? 'solid' : confidence === 'medium' ? 'half' : 'solid';

  if (kgCO2e != null) {
    pill.setAttribute('aria-label',
      `Estimated supply-chain emissions: ${displayKg} kilograms CO2 equivalent.${firstComp ? ` Approximately ${firstComp.formatted} ${firstComp.label}.` : ''} Click for details.`
    );
    pill.innerHTML = `
      ${buildLeafSvg(severity, leafStyle)}
      <span class="cl-number cl-${severity}">${displayKg} kg CO₂e</span>
      ${firstComp ? `<span class="cl-compare">≈ ${firstComp.formatted} ${firstComp.label}</span>` : ''}
      <span class="cl-caret" aria-hidden="true">▾</span>
    `;
  } else {
    pill.setAttribute('aria-label', 'Unable to estimate supply-chain emissions. Click for details.');
    pill.innerHTML = `
      ${buildLeafSvg('gray', 'solid')}
      <span class="cl-number cl-gray">Unable to estimate</span>
      <span class="cl-caret" aria-hidden="true">▾</span>
    `;
  }

  // --- Expanded card ---
  const card = document.createElement('div');
  card.className = 'cl-card';
  card.setAttribute('aria-live', 'polite');

  const confLabel = confidence === 'high' ? 'High confidence — product-specific LCA data'
    : confidence === 'medium' ? 'Medium confidence — category matched from breadcrumb'
    : confidence === 'low' ? 'Low confidence — matched from title keywords'
    : 'Unable to estimate — price or category not resolved';

  const methodologyUrl = chrome.runtime.getURL('docs/METHODOLOGY.md');

  const compHTML = (comparisons || []).map(c =>
    `<div class="cl-comparison-row"><span aria-hidden="true">${c.icon}</span><span>${c.formatted} ${c.label}</span></div>`
  ).join('');

  const detailsContent = kgCO2e != null && price != null
    ? `($${price.toFixed(2)} ÷ ${1.11}) × ${factor} = ${displayKg} kg CO₂e<br>category: ${catName}<br>factor: ${factor} kg CO₂e / 2022 USD<br>source: EPA USEEIO v1.3.0 (with margins)`
    : 'Price or category unavailable — cannot compute';

  card.innerHTML = `
    ${kgCO2e != null
      ? `<p class="cl-big-number cl-${severity}">${displayKg} <span class="cl-unit">kg CO₂e</span></p>`
      : `<p class="cl-big-number cl-gray">Unable to estimate</p>`
    }
    <p class="cl-confidence">${confLabel}</p>
    <p class="cl-confidence" style="margin-top:-8px">${catName}</p>
    <div class="cl-comparisons">${compHTML}</div>
    <div class="cl-details">
      <button class="cl-details-toggle" aria-expanded="false">How we calculated this ▾</button>
      <div class="cl-details-content">${detailsContent}</div>
    </div>
    <div class="cl-footer">
      <a href="${methodologyUrl}" target="_blank" rel="noopener noreferrer">Data: EPA Supply Chain GHG v1.3.0</a>
      &nbsp;·&nbsp;estimate only, ±order of magnitude
    </div>
  `;

  // Event: expand/collapse pill
  function toggleBadge() {
    const expanded = pill.getAttribute('aria-expanded') === 'true';
    pill.setAttribute('aria-expanded', String(!expanded));
    card.classList.toggle('cl-open', !expanded);
  }
  pill.addEventListener('click', toggleBadge);
  pill.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleBadge(); }
  });

  // Event: details collapsible
  const detailsToggle = card.querySelector('.cl-details-toggle');
  const detailsContentEl = card.querySelector('.cl-details-content');
  if (detailsToggle) {
    detailsToggle.addEventListener('click', () => {
      const open = detailsContentEl.classList.toggle('cl-open');
      detailsToggle.setAttribute('aria-expanded', String(open));
      detailsToggle.textContent = `How we calculated this ${open ? '▴' : '▾'}`;
    });
  }

  shadow.appendChild(style);
  shadow.appendChild(pill);
  shadow.appendChild(card);

  return wrapper;
}
