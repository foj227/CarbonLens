(async function carbonlensAmazon() {
  'use strict';

  // === CONSTANTS ===
  const PRICE_DEFLATOR = 1.11;
  const DEBUG = '[CarbonLens:Amazon]';
  const BADGE_ID = 'carbonlens-root';

  // Category priority for tie-breaking (lower index = higher priority)
  const CATEGORY_PRIORITY = [
    'computer_and_electronic_products','electrical_equipment_appliances',
    'transportation_equipment','machinery','apparel_and_leather',
    'furniture_and_related','metal_products','wood_products',
    'sporting_toys_other_manufacturing','pharmaceuticals',
    'chemicals_and_personal_care','plastics_and_rubber',
    'printed_matter','paper_products','beverage_manufacturing',
    'textile_mills','food_manufacturing','meat_poultry_seafood',
    'dairy','produce_agriculture','retail_trade_general'
  ];

  // === CLASSIFIER (inlined from src/lib/classifier.js) ===
  function clNormalize(str) {
    return String(str).toLowerCase().replace(/-/g,'').replace(/[^\w\s]/g,' ').replace(/\s+/g,' ').trim();
  }
  function clStem(word) {
    if (word.length <= 3) return word;
    if (word.endsWith('ies')) return word.slice(0,-3)+'y';
    if (word.endsWith('ves')) return word.slice(0,-3)+'f';
    if (word.endsWith('es') && word.length > 4) return word.slice(0,-2);
    if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0,-1);
    return word;
  }
  function clTitleHas(normTitle, keyword) {
    const nk = clNormalize(keyword);
    if (nk.includes(' ')) return normTitle.includes(nk);
    const words = normTitle.split(' ');
    const ks = clStem(nk);
    return words.some(w => w===nk||w===ks||clStem(w)===nk||clStem(w)===ks);
  }
  function classifyProduct({ title='', breadcrumbs='' }, keywords) {
    const nt = clNormalize(title);
    const nb = clNormalize(breadcrumbs);
    for (const rule of keywords.breadcrumb_rules) {
      if (new RegExp(rule.pattern,'i').test(nb))
        return { category: rule.category, confidence: 'medium', matchedOn: 'breadcrumb' };
    }
    const scores = {};
    for (const [cat, kws] of Object.entries(keywords.title_keywords)) {
      let s = 0;
      for (const kw of kws) if (clTitleHas(nt, kw)) s++;
      if (s > 0) scores[cat] = s;
    }
    if (Object.keys(scores).length > 0) {
      const max = Math.max(...Object.values(scores));
      const top = Object.entries(scores).filter(([,s])=>s===max).map(([c])=>c);
      top.sort((a,b)=>{
        const pa=CATEGORY_PRIORITY.indexOf(a), pb=CATEGORY_PRIORITY.indexOf(b);
        return (pa===-1?999:pa)-(pb===-1?999:pb);
      });
      return { category: top[0], confidence: 'low', matchedOn: 'title_keywords' };
    }
    return { category: 'retail_trade_general', confidence: 'low', matchedOn: 'fallback' };
  }

  // === CALCULATOR (inlined from src/lib/calculator.js) ===
  function estimateEmissions({ priceUSD, category, factors }) {
    if (!priceUSD || priceUSD <= 0) return { kgCO2e: null, factorUsed: null, intensity: null, confidence: 'unknown' };
    if (!category || !factors?.categories?.[category]) return { kgCO2e: null, factorUsed: null, intensity: null, confidence: 'unknown' };
    const cat = factors.categories[category];
    const kgCO2e = (priceUSD / PRICE_DEFLATOR) * cat.kg_co2e_per_usd;
    return { kgCO2e, factorUsed: cat.kg_co2e_per_usd, intensity: kgCO2e / priceUSD, confidence: null };
  }
  function bucketSeverity(intensity) {
    if (intensity == null || isNaN(intensity)) return 'gray';
    if (intensity <= 0.30) return 'green';
    if (intensity <= 0.70) return 'amber';
    return 'red';
  }
  function formatSigFigs(n, sf=2) {
    if (n==null||isNaN(n)) return null;
    if (n===0) return '0';
    const pow = Math.floor(Math.log10(Math.abs(n)))-(sf-1);
    const f = Math.pow(10,pow);
    const r = Math.round(n/f)*f;
    return pow>=0 ? Math.round(r).toString() : r.toFixed(-pow);
  }

  // === COMPARISONS (inlined from src/lib/comparisons.js) ===
  function pickComparisons(kgCO2e, equivalencies, maxCount=2) {
    if (kgCO2e==null) return [];
    const matching = equivalencies.comparisons.filter(e=>kgCO2e>=e.min_kg&&kgCO2e<=e.max_kg);
    const results = matching.length>0 ? matching.slice(0,maxCount)
      : [equivalencies.comparisons.find(e=>e.id==='miles_driven_gasoline_car')||equivalencies.comparisons[0]];
    return results.map(e=>{
      const v=kgCO2e*e.value_per_kg_co2e;
      return { ...e, value:v, formatted: v<10?v.toFixed(1):Math.round(v).toString() };
    });
  }

  // === PRICE PARSER (inlined from src/content/common/parser-utils.js) ===
  function parsePrice(text) {
    if (!text) return null;
    const s = String(text).trim();
    const range = s.match(/\$?([\d,]+\.?\d*)\s*[-–—]\s*\$?([\d,]+\.?\d*)/);
    if (range) { const lo=parseFloat(range[1].replace(/,/g,'')); if(!isNaN(lo)&&lo>0) return {amount:lo,currency:'USD'}; }
    if (/[£€¥₹₩]/.test(s)) return null;
    const single = s.match(/\$?\s*([\d,]+\.?\d*)/);
    if (single) { const a=parseFloat(single[1].replace(/,/g,'')); if(!isNaN(a)&&a>0) return {amount:a,currency:'USD'}; }
    return null;
  }

  // === BADGE CSS (inlined from src/styles/badge.css) ===
  const BADGE_CSS = `:host{--cl-font:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;--cl-bg:#fff;--cl-text:#202124;--cl-muted:#5f6368;--cl-border:#e0e0e0;--cl-radius:16px;--cl-shadow:0 2px 10px rgba(0,0,0,.08);--cl-green:#2e7d32;--cl-amber:#ed6c02;--cl-red:#c62828;--cl-gray:#757575;--cl-link:#1a73e8}@media(prefers-color-scheme:dark){:host{--cl-bg:#1f1f1f;--cl-text:#e8eaed;--cl-muted:#9aa0a6;--cl-border:#3c4043}}*,*::before,*::after{box-sizing:border-box}.cl-pill{display:inline-flex;align-items:center;gap:6px;padding:5px 12px 5px 8px;background:var(--cl-bg);border:1.5px solid var(--cl-border);border-radius:var(--cl-radius);box-shadow:var(--cl-shadow);cursor:pointer;font-family:var(--cl-font);font-size:13px;color:var(--cl-text);outline:none;user-select:none;max-width:400px;transition:border-color .15s}.cl-pill:focus-visible{outline:2px solid var(--cl-link);outline-offset:2px}.cl-pill:hover{box-shadow:0 2px 14px rgba(0,0,0,.14)}.cl-leaf{width:18px;height:18px;flex-shrink:0}.cl-number{font-weight:700;font-size:14px}.cl-compare{color:var(--cl-muted);font-size:12px}.cl-caret{margin-left:4px;color:var(--cl-muted);font-size:10px;transition:transform .2s;flex-shrink:0}.cl-pill[aria-expanded="true"] .cl-caret{transform:rotate(180deg)}.cl-green{color:var(--cl-green)}.cl-amber{color:var(--cl-amber)}.cl-red{color:var(--cl-red)}.cl-gray{color:var(--cl-gray)}.cl-badge-green{border-color:var(--cl-green)}.cl-badge-amber{border-color:var(--cl-amber)}.cl-badge-red{border-color:var(--cl-red)}.cl-badge-gray{border-color:var(--cl-gray)}.cl-card{display:none;padding:16px;background:var(--cl-bg);border:1.5px solid var(--cl-border);border-radius:8px;box-shadow:var(--cl-shadow);font-family:var(--cl-font);color:var(--cl-text);font-size:13px;max-width:360px;margin-top:6px}.cl-card.cl-open{display:block}.cl-big-number{font-size:26px;font-weight:700;margin:0 0 2px 0;line-height:1.1}.cl-unit{font-size:14px;font-weight:400;color:var(--cl-muted)}.cl-confidence{font-size:12px;color:var(--cl-muted);margin:0 0 12px 0}.cl-comparisons{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}.cl-comparison-row{display:flex;align-items:center;gap:8px;font-size:13px}.cl-details{border-top:1px solid var(--cl-border);margin-top:10px;padding-top:10px}.cl-details-toggle{background:none;border:none;padding:0;cursor:pointer;font-size:12px;color:var(--cl-link);font-family:var(--cl-font);text-decoration:underline}.cl-details-toggle:focus-visible{outline:2px solid var(--cl-link);border-radius:2px}.cl-details-content{display:none;font-size:11px;color:var(--cl-muted);margin-top:8px;font-family:monospace;background:var(--cl-border);padding:8px 10px;border-radius:4px;line-height:1.6}.cl-details-content.cl-open{display:block}.cl-footer{margin-top:12px;font-size:11px;color:var(--cl-muted);border-top:1px solid var(--cl-border);padding-top:8px;line-height:1.5}.cl-footer a{color:var(--cl-link);text-decoration:none}.cl-footer a:hover{text-decoration:underline}.cl-footer a:focus-visible{outline:2px solid var(--cl-link);border-radius:2px}`;

  // === BADGE COMPONENT (inlined from src/content/common/badge.js) ===
  const LEAF_PATH = 'M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 008 20C19 20 22 3 22 3c-1 2-8 2-8 2v-1h-1z';
  const LEAF_HALF = 'M12 2C8 2 4 6 4 10c0 3.1 1.7 5.8 4.3 7.3L12 22l3.7-4.7C18.3 15.8 20 13.1 20 10c0-4-4-8-8-8zm0 14l-2.5-3.2C8.1 11.7 8 10.9 8 10c0-2.2 1.8-4 4-4s4 1.8 4 4c0 .9-.1 1.7-.5 2.8L12 16z';

  function leafSvg(sev, half=false) {
    return `<svg class="cl-leaf cl-${sev}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="${half?LEAF_HALF:LEAF_PATH}"/></svg>`;
  }

  function createBadge({ kgCO2e, intensity, category, confidence, price, comparisons, factors }) {
    const sev = bucketSeverity(intensity);
    const catData = factors?.categories?.[category];
    const catName = catData?.display_name || 'General Retail';
    const factor = catData?.kg_co2e_per_usd;
    const disp = kgCO2e != null ? formatSigFigs(kgCO2e) : null;
    const firstComp = comparisons?.[0];
    const half = confidence === 'medium';

    const wrap = document.createElement('div');
    wrap.id = BADGE_ID;
    Object.assign(wrap.style, { display:'block', margin:'8px 0', position:'relative', zIndex:'9999' });
    const shadow = wrap.attachShadow({ mode:'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = BADGE_CSS;

    const pill = document.createElement('div');
    pill.className = `cl-pill cl-badge-${sev}`;
    pill.setAttribute('role','button');
    pill.setAttribute('tabindex','0');
    pill.setAttribute('aria-expanded','false');

    if (kgCO2e != null) {
      pill.setAttribute('aria-label',
        `Estimated supply-chain emissions: ${disp} kilograms CO2 equivalent.${firstComp?` Approximately ${firstComp.formatted} ${firstComp.label}. `:''}Click for details.`
      );
      pill.innerHTML = `${leafSvg(sev,half)}<span class="cl-number cl-${sev}">${disp} kg CO₂e</span>${firstComp?`<span class="cl-compare">≈ ${firstComp.formatted} ${firstComp.label}</span>`:''}<span class="cl-caret" aria-hidden="true">▾</span>`;
    } else {
      pill.setAttribute('aria-label','Unable to estimate supply-chain emissions. Click for details.');
      pill.innerHTML = `${leafSvg('gray')}<span class="cl-number cl-gray">Unable to estimate</span><span class="cl-caret" aria-hidden="true">▾</span>`;
    }

    const card = document.createElement('div');
    card.className = 'cl-card';
    card.setAttribute('aria-live','polite');

    const confLabel = confidence==='high'?'High confidence — product-specific LCA data'
      :confidence==='medium'?'Medium confidence — category matched from breadcrumb'
      :confidence==='low'?'Low confidence — matched from title keywords'
      :'Unable to estimate';

    const methodUrl = chrome.runtime.getURL('docs/METHODOLOGY.md');
    const compHTML = (comparisons||[]).map(c=>`<div class="cl-comparison-row"><span aria-hidden="true">${c.icon}</span><span>${c.formatted} ${c.label}</span></div>`).join('');
    const detailText = kgCO2e!=null&&price!=null
      ? `($${price.toFixed(2)} ÷ ${PRICE_DEFLATOR}) × ${factor} = ${disp} kg CO₂e\ncategory: ${catName}\nfactor: ${factor} kg CO₂e / 2022 USD\nsource: EPA USEEIO v1.3.0`
      : 'Price or category unavailable';

    card.innerHTML = `
      ${kgCO2e!=null?`<p class="cl-big-number cl-${sev}">${disp} <span class="cl-unit">kg CO₂e</span></p>`:`<p class="cl-big-number cl-gray">Unable to estimate</p>`}
      <p class="cl-confidence">${confLabel}</p>
      <p class="cl-confidence" style="margin-top:-8px">${catName}</p>
      <div class="cl-comparisons">${compHTML}</div>
      <div class="cl-details">
        <button class="cl-details-toggle" aria-expanded="false">How we calculated this ▾</button>
        <div class="cl-details-content" style="white-space:pre-line">${detailText}</div>
      </div>
      <div class="cl-footer">
        <a href="${methodUrl}" target="_blank" rel="noopener noreferrer">Data: EPA Supply Chain GHG v1.3.0</a>
        &nbsp;·&nbsp;estimate only, ±order of magnitude
      </div>`;

    function toggle() {
      const exp = pill.getAttribute('aria-expanded')==='true';
      pill.setAttribute('aria-expanded',String(!exp));
      card.classList.toggle('cl-open',!exp);
    }
    pill.addEventListener('click',toggle);
    pill.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();} });

    const dt = card.querySelector('.cl-details-toggle');
    const dc = card.querySelector('.cl-details-content');
    if(dt) dt.addEventListener('click',()=>{
      const o=dc.classList.toggle('cl-open');
      dt.setAttribute('aria-expanded',String(o));
      dt.textContent=`How we calculated this ${o?'▴':'▾'}`;
    });

    shadow.appendChild(styleEl);
    shadow.appendChild(pill);
    shadow.appendChild(card);
    return wrap;
  }

  // === AMAZON-SPECIFIC LOGIC ===
  function isProductPage() {
    return /\/(dp|gp\/product|gp\/aw\/d)\/[A-Z0-9]/.test(location.pathname);
  }

  function getAsin() {
    const m = location.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([\w]+)/);
    return m?.[1] || null;
  }

  function trySelectors(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const text = el?.textContent?.trim() || el?.getAttribute('content') || '';
      if (text) return text;
    }
    return '';
  }

  function extractProduct() {
    const title = trySelectors([
      '#productTitle', 'span#title', 'h1.a-size-large span', 'h1 span'
    ]);
    const priceText = trySelectors([
      '.a-price .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '#corePrice_feature_div .a-price .a-offscreen',
      '#price_inside_buybox',
      '#newBuyBoxPrice'
    ]);
    const breadcrumbs = Array.from(
      document.querySelectorAll('#wayfinding-breadcrumbs_container ul li:not(.a-breadcrumb-divider)')
    ).map(el=>el.textContent.trim()).filter(Boolean).join(' > ');

    const priceResult = parsePrice(priceText);
    if (!title && !priceResult) return null;

    return {
      title: title || '',
      price: priceResult?.amount || null,
      breadcrumbs
    };
  }

  function findInsertionPoint() {
    return document.querySelector('#centerCol #titleSection')
      || document.querySelector('#titleSection')
      || document.querySelector('#centerCol')
      || document.querySelector('#buybox')?.parentElement
      || document.querySelector('#dp-container');
  }

  // === DATA LOADER ===
  let _data = null;
  async function loadData() {
    if (_data) return _data;
    const [factors, keywords, equivalencies] = await Promise.all([
      fetch(chrome.runtime.getURL('data/emission_factors.json')).then(r=>r.json()),
      fetch(chrome.runtime.getURL('data/category_keywords.json')).then(r=>r.json()),
      fetch(chrome.runtime.getURL('data/equivalencies.json')).then(r=>r.json()),
    ]);
    _data = { factors, keywords, equivalencies };
    return _data;
  }

  // === MAIN ===
  let lastAsin = null;

  async function run() {
    if (!isProductPage()) return;
    const asin = getAsin();
    if (!asin || asin === lastAsin) return;
    lastAsin = asin;

    document.getElementById(BADGE_ID)?.remove();

    let data;
    try { data = await loadData(); }
    catch (err) { console.debug(DEBUG, 'Failed to load data:', err); return; }

    const product = extractProduct();
    if (!product) { console.debug(DEBUG, 'No product data extracted'); return; }

    const classification = classifyProduct(product, data.keywords);
    const result = estimateEmissions({ priceUSD: product.price, category: classification.category, factors: data.factors });
    const comparisons = pickComparisons(result.kgCO2e, data.equivalencies);
    const finalConf = result.confidence === 'unknown' ? 'unknown' : classification.confidence;

    const badge = createBadge({
      kgCO2e: result.kgCO2e,
      intensity: result.intensity,
      category: classification.category,
      confidence: finalConf,
      price: product.price,
      comparisons,
      factors: data.factors
    });

    const insertPoint = findInsertionPoint();
    if (insertPoint) {
      insertPoint.insertBefore(badge, insertPoint.firstChild);
    } else {
      console.debug(DEBUG, 'No insertion point found');
      return;
    }

    if (result.kgCO2e != null) {
      chrome.runtime.sendMessage({
        type: 'RECORD_VIEW',
        payload: {
          kgCO2e: result.kgCO2e,
          category: classification.category,
          url: location.href,
          title: product.title,
          price: product.price,
          timestamp: Date.now()
        }
      }).catch(() => {});
    }

    console.debug(DEBUG, `Classified "${product.title}" → ${classification.category} (${finalConf}), ${result.kgCO2e?.toFixed(2)} kg CO₂e`);
  }

  // SPA navigation: re-run when ASIN changes
  let spaTimer = null;
  const spaObserver = new MutationObserver(() => {
    clearTimeout(spaTimer);
    spaTimer = setTimeout(() => {
      const asin = getAsin();
      if (asin && asin !== lastAsin) run();
    }, 500);
  });
  spaObserver.observe(document.body, { childList: true, subtree: true });

  run();
})();
