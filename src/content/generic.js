(async function carbonlensGeneric() {
  'use strict';

  const PRICE_DEFLATOR = 1.11;
  const DEBUG = '[CarbonLens:Generic]';
  const BADGE_ID = 'carbonlens-root';

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

  // === CLASSIFIER ===
  function clNormalize(str){return String(str).toLowerCase().replace(/-/g,'').replace(/[^\w\s]/g,' ').replace(/\s+/g,' ').trim();}
  function clStem(w){if(w.length<=3)return w;if(w.endsWith('ies'))return w.slice(0,-3)+'y';if(w.endsWith('ves'))return w.slice(0,-3)+'f';if(w.endsWith('es')&&w.length>4)return w.slice(0,-2);if(w.endsWith('s')&&!w.endsWith('ss'))return w.slice(0,-1);return w;}
  function clTitleHas(nt,kw){const nk=clNormalize(kw);if(nk.includes(' '))return nt.includes(nk);const ws=nt.split(' '),ks=clStem(nk);return ws.some(w=>w===nk||w===ks||clStem(w)===nk||clStem(w)===ks);}
  function classifyProduct({title='',breadcrumbs=''},keywords){
    const nt=clNormalize(title),nb=clNormalize(breadcrumbs);
    for(const r of keywords.breadcrumb_rules)if(new RegExp(r.pattern,'i').test(nb))return{category:r.category,confidence:'medium',matchedOn:'breadcrumb'};
    const sc={};
    for(const[cat,kws]of Object.entries(keywords.title_keywords)){let s=0;for(const kw of kws)if(clTitleHas(nt,kw))s++;if(s>0)sc[cat]=s;}
    if(Object.keys(sc).length>0){const mx=Math.max(...Object.values(sc));const top=Object.entries(sc).filter(([,s])=>s===mx).map(([c])=>c);top.sort((a,b)=>(CATEGORY_PRIORITY.indexOf(a)===-1?999:CATEGORY_PRIORITY.indexOf(a))-(CATEGORY_PRIORITY.indexOf(b)===-1?999:CATEGORY_PRIORITY.indexOf(b)));return{category:top[0],confidence:'low',matchedOn:'title_keywords'};}
    return{category:'retail_trade_general',confidence:'low',matchedOn:'fallback'};
  }

  // === CALCULATOR ===
  function estimateEmissions({priceUSD,category,factors}){
    if(!priceUSD||priceUSD<=0)return{kgCO2e:null,factorUsed:null,intensity:null,confidence:'unknown'};
    if(!category||!factors?.categories?.[category])return{kgCO2e:null,factorUsed:null,intensity:null,confidence:'unknown'};
    const cat=factors.categories[category],kgCO2e=(priceUSD/PRICE_DEFLATOR)*cat.kg_co2e_per_usd;
    return{kgCO2e,factorUsed:cat.kg_co2e_per_usd,intensity:kgCO2e/priceUSD,confidence:null};
  }
  function bucketSeverity(i){if(i==null||isNaN(i))return'gray';return i<=0.30?'green':i<=0.70?'amber':'red';}
  function formatSigFigs(n,sf=2){if(n==null||isNaN(n))return null;if(n===0)return'0';const p=Math.floor(Math.log10(Math.abs(n)))-(sf-1),f=Math.pow(10,p),r=Math.round(n/f)*f;return p>=0?Math.round(r).toString():r.toFixed(-p);}

  // === COMPARISONS ===
  function pickComparisons(kgCO2e,eq,mx=2){if(kgCO2e==null)return[];const m=eq.comparisons.filter(e=>kgCO2e>=e.min_kg&&kgCO2e<=e.max_kg);const r=m.length>0?m.slice(0,mx):[eq.comparisons.find(e=>e.id==='miles_driven_gasoline_car')||eq.comparisons[0]];return r.map(e=>{const v=kgCO2e*e.value_per_kg_co2e;return{...e,value:v,formatted:v<10?v.toFixed(1):Math.round(v).toString()};});}

  // === PRICE PARSER ===
  function parsePrice(t){if(!t)return null;const s=String(t).trim();const rng=s.match(/\$?([\d,]+\.?\d*)\s*[-–—]\s*\$?([\d,]+\.?\d*)/);if(rng){const l=parseFloat(rng[1].replace(/,/g,''));if(!isNaN(l)&&l>0)return{amount:l,currency:'USD'};}if(/[£€¥₹₩]/.test(s))return null;const sg=s.match(/\$?\s*([\d,]+\.?\d*)/);if(sg){const a=parseFloat(sg[1].replace(/,/g,''));if(!isNaN(a)&&a>0)return{amount:a,currency:'USD'};}return null;}

  // === BADGE CSS ===
  const BADGE_CSS=`:host{--cl-font:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;--cl-bg:#fff;--cl-text:#202124;--cl-muted:#5f6368;--cl-border:#e0e0e0;--cl-radius:16px;--cl-shadow:0 2px 10px rgba(0,0,0,.08);--cl-green:#2e7d32;--cl-amber:#ed6c02;--cl-red:#c62828;--cl-gray:#757575;--cl-link:#1a73e8}@media(prefers-color-scheme:dark){:host{--cl-bg:#1f1f1f;--cl-text:#e8eaed;--cl-muted:#9aa0a6;--cl-border:#3c4043}}*,*::before,*::after{box-sizing:border-box}.cl-pill{display:inline-flex;align-items:center;gap:6px;padding:5px 12px 5px 8px;background:var(--cl-bg);border:1.5px solid var(--cl-border);border-radius:var(--cl-radius);box-shadow:var(--cl-shadow);cursor:pointer;font-family:var(--cl-font);font-size:13px;color:var(--cl-text);outline:none;user-select:none;max-width:400px;transition:border-color .15s}.cl-pill:focus-visible{outline:2px solid var(--cl-link);outline-offset:2px}.cl-pill:hover{box-shadow:0 2px 14px rgba(0,0,0,.14)}.cl-leaf{width:18px;height:18px;flex-shrink:0}.cl-number{font-weight:700;font-size:14px}.cl-compare{color:var(--cl-muted);font-size:12px}.cl-caret{margin-left:4px;color:var(--cl-muted);font-size:10px;transition:transform .2s;flex-shrink:0}.cl-pill[aria-expanded="true"] .cl-caret{transform:rotate(180deg)}.cl-green{color:var(--cl-green)}.cl-amber{color:var(--cl-amber)}.cl-red{color:var(--cl-red)}.cl-gray{color:var(--cl-gray)}.cl-badge-green{border-color:var(--cl-green)}.cl-badge-amber{border-color:var(--cl-amber)}.cl-badge-red{border-color:var(--cl-red)}.cl-badge-gray{border-color:var(--cl-gray)}.cl-card{display:none;padding:16px;background:var(--cl-bg);border:1.5px solid var(--cl-border);border-radius:8px;box-shadow:var(--cl-shadow);font-family:var(--cl-font);color:var(--cl-text);font-size:13px;max-width:360px;margin-top:6px}.cl-card.cl-open{display:block}.cl-big-number{font-size:26px;font-weight:700;margin:0 0 2px 0;line-height:1.1}.cl-unit{font-size:14px;font-weight:400;color:var(--cl-muted)}.cl-confidence{font-size:12px;color:var(--cl-muted);margin:0 0 12px 0}.cl-comparisons{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}.cl-comparison-row{display:flex;align-items:center;gap:8px;font-size:13px}.cl-details{border-top:1px solid var(--cl-border);margin-top:10px;padding-top:10px}.cl-details-toggle{background:none;border:none;padding:0;cursor:pointer;font-size:12px;color:var(--cl-link);font-family:var(--cl-font);text-decoration:underline}.cl-details-toggle:focus-visible{outline:2px solid var(--cl-link);border-radius:2px}.cl-details-content{display:none;font-size:11px;color:var(--cl-muted);margin-top:8px;font-family:monospace;background:var(--cl-border);padding:8px 10px;border-radius:4px;line-height:1.6}.cl-details-content.cl-open{display:block}.cl-footer{margin-top:12px;font-size:11px;color:var(--cl-muted);border-top:1px solid var(--cl-border);padding-top:8px;line-height:1.5}.cl-footer a{color:var(--cl-link);text-decoration:none}.cl-footer a:hover{text-decoration:underline}.cl-footer a:focus-visible{outline:2px solid var(--cl-link);border-radius:2px}`;

  // === BADGE COMPONENT ===
  const LP='M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 008 20C19 20 22 3 22 3c-1 2-8 2-8 2v-1h-1z';
  const LH='M12 2C8 2 4 6 4 10c0 3.1 1.7 5.8 4.3 7.3L12 22l3.7-4.7C18.3 15.8 20 13.1 20 10c0-4-4-8-8-8zm0 14l-2.5-3.2C8.1 11.7 8 10.9 8 10c0-2.2 1.8-4 4-4s4 1.8 4 4c0 .9-.1 1.7-.5 2.8L12 16z';
  function leafSvg(sv,h=false){return`<svg class="cl-leaf cl-${sv}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="${h?LH:LP}"/></svg>`;}
  function createBadge({kgCO2e,intensity,category,confidence,price,comparisons,factors}){
    const sv=bucketSeverity(intensity),cd=factors?.categories?.[category],cn=cd?.display_name||'General Retail',fc=cd?.kg_co2e_per_usd,dp=kgCO2e!=null?formatSigFigs(kgCO2e):null,c1=comparisons?.[0],h=confidence==='medium';
    const wr=document.createElement('div');wr.id=BADGE_ID;Object.assign(wr.style,{display:'block',margin:'8px 0',position:'relative',zIndex:'9999'});
    const sh=wr.attachShadow({mode:'open'}),st=document.createElement('style');st.textContent=BADGE_CSS;
    const pl=document.createElement('div');pl.className=`cl-pill cl-badge-${sv}`;pl.setAttribute('role','button');pl.setAttribute('tabindex','0');pl.setAttribute('aria-expanded','false');
    if(kgCO2e!=null){pl.setAttribute('aria-label',`Estimated supply-chain emissions: ${dp} kilograms CO2 equivalent.${c1?` Approximately ${c1.formatted} ${c1.label}.`:''}Click for details.`);pl.innerHTML=`${leafSvg(sv,h)}<span class="cl-number cl-${sv}">${dp} kg CO₂e</span>${c1?`<span class="cl-compare">≈ ${c1.formatted} ${c1.label}</span>`:''}<span class="cl-caret" aria-hidden="true">▾</span>`;}
    else{pl.setAttribute('aria-label','Unable to estimate supply-chain emissions. Click for details.');pl.innerHTML=`${leafSvg('gray')}<span class="cl-number cl-gray">Unable to estimate</span><span class="cl-caret" aria-hidden="true">▾</span>`;}
    const ca=document.createElement('div');ca.className='cl-card';ca.setAttribute('aria-live','polite');
    const cl2=confidence==='high'?'High confidence — product-specific LCA data':confidence==='medium'?'Medium confidence — breadcrumb matched':confidence==='low'?'Low confidence — title keywords':'Unable to estimate';
    const mu=chrome.runtime.getURL('docs/METHODOLOGY.md');
    const ch=(comparisons||[]).map(c=>`<div class="cl-comparison-row"><span aria-hidden="true">${c.icon}</span><span>${c.formatted} ${c.label}</span></div>`).join('');
    const dt=kgCO2e!=null&&price!=null?`($${price.toFixed(2)} ÷ ${PRICE_DEFLATOR}) × ${fc} = ${dp} kg CO₂e\ncategory: ${cn}\nfactor: ${fc} kg CO₂e / 2022 USD\nsource: EPA USEEIO v1.3.0`:'Price or category unavailable';
    ca.innerHTML=`${kgCO2e!=null?`<p class="cl-big-number cl-${sv}">${dp} <span class="cl-unit">kg CO₂e</span></p>`:`<p class="cl-big-number cl-gray">Unable to estimate</p>`}<p class="cl-confidence">${cl2}</p><p class="cl-confidence" style="margin-top:-8px">${cn}</p><div class="cl-comparisons">${ch}</div><div class="cl-details"><button class="cl-details-toggle" aria-expanded="false">How we calculated this ▾</button><div class="cl-details-content" style="white-space:pre-line">${dt}</div></div><div class="cl-footer"><a href="${mu}" target="_blank" rel="noopener noreferrer">Data: EPA Supply Chain GHG v1.3.0</a>&nbsp;·&nbsp;estimate only, ±order of magnitude</div>`;
    function tg(){const e=pl.getAttribute('aria-expanded')==='true';pl.setAttribute('aria-expanded',String(!e));ca.classList.toggle('cl-open',!e);}
    pl.addEventListener('click',tg);pl.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tg();}});
    const dbt=ca.querySelector('.cl-details-toggle'),dbc=ca.querySelector('.cl-details-content');
    if(dbt)dbt.addEventListener('click',()=>{const o=dbc.classList.toggle('cl-open');dbt.setAttribute('aria-expanded',String(o));dbt.textContent=`How we calculated this ${o?'▴':'▾'}`;});
    sh.appendChild(st);sh.appendChild(pl);sh.appendChild(ca);
    return wr;
  }

  // === GENERIC PARSER ===
  function getMeta(prop) {
    return document.querySelector(`meta[property="${prop}"]`)?.getAttribute('content')
      || document.querySelector(`meta[name="${prop}"]`)?.getAttribute('content')
      || '';
  }

  function extractJsonLd() {
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const json = JSON.parse(script.textContent);
        const items = Array.isArray(json) ? json : [json];
        for (const item of items) {
          if (item['@type'] === 'Product' || item['@type']?.includes?.('Product')) {
            const priceRaw = item.offers?.price || item.offers?.[0]?.price;
            const currency = item.offers?.priceCurrency || item.offers?.[0]?.priceCurrency || 'USD';
            if (currency !== 'USD') continue;
            return {
              title: item.name || '',
              price: priceRaw ? Number(priceRaw) : null,
              breadcrumbs: item.category || ''
            };
          }
        }
      } catch { continue; }
    }
    return null;
  }

  function extractProduct() {
    // Try JSON-LD first
    const ld = extractJsonLd();
    if (ld?.title && ld.price) {
      console.debug(DEBUG, `Generic parser: matched JSON-LD on ${location.hostname}`);
      return ld;
    }

    // Try OpenGraph — requires og:type = "product"
    const ogType = getMeta('og:type');
    if (ogType.includes('product')) {
      const title = getMeta('og:title') || document.querySelector('h1')?.textContent?.trim() || '';
      const priceStr = getMeta('product:price:amount');
      const currency = getMeta('product:price:currency') || 'USD';
      if (currency !== 'USD') return null;
      const price = priceStr ? Number(priceStr) : null;
      if (title && price) {
        console.debug(DEBUG, `Generic parser: matched OpenGraph on ${location.hostname}`);
        return { title, price, breadcrumbs: '' };
      }
    }

    // If we have JSON-LD with title but no price, still try
    if (ld?.title) {
      const priceText = document.querySelector('[class*="price"]')?.textContent || '';
      const priceResult = parsePrice(priceText);
      if (priceResult?.amount) return { title: ld.title, price: priceResult.amount, breadcrumbs: ld.breadcrumbs || '' };
    }

    return null;
  }

  function findInsertionPoint(title) {
    if (title) {
      const h1 = Array.from(document.querySelectorAll('h1')).find(el => el.textContent.includes(title.slice(0, 20)));
      if (h1?.parentElement) return h1.parentElement;
    }
    return document.querySelector('h1')?.parentElement || document.querySelector('main') || document.body;
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
  async function run() {
    const product = extractProduct();
    if (!product) return; // silent: not a product page or no structured data

    let data;
    try { data = await loadData(); } catch(err) { console.debug(DEBUG,'Load error:',err); return; }

    const classification = classifyProduct(product, data.keywords);
    const result = estimateEmissions({ priceUSD: product.price, category: classification.category, factors: data.factors });
    const comparisons = pickComparisons(result.kgCO2e, data.equivalencies);
    const finalConf = result.confidence === 'unknown' ? 'unknown' : classification.confidence;

    const badge = createBadge({ kgCO2e: result.kgCO2e, intensity: result.intensity, category: classification.category, confidence: finalConf, price: product.price, comparisons, factors: data.factors });

    const insertPoint = findInsertionPoint(product.title);
    if (!insertPoint) return;
    insertPoint.insertBefore(badge, insertPoint.firstChild);

    if (result.kgCO2e != null) {
      chrome.runtime.sendMessage({ type:'RECORD_VIEW', payload:{ kgCO2e:result.kgCO2e, category:classification.category, url:location.href, title:product.title, price:product.price, timestamp:Date.now() } }).catch(()=>{});
    }
    console.debug(DEBUG, `"${product.title}" → ${classification.category}, ${result.kgCO2e?.toFixed(2)} kg CO₂e`);
  }

  run();
})();
