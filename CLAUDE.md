# CLAUDE.md — CarbonLens: Scope 3 Emissions Shopping Extension

> **Project instructions for Claude Code.** Read this file end-to-end before writing any code. Everything in this document is authoritative: file structure, naming, data formats, selectors, UI behavior, and methodology are all prescribed here. When you finish, the extension must load in Chrome (developer mode) and show a working emissions badge on Amazon and Walmart product pages.

---

## 0. Build standard (read this first, then re-read when tempted to stop short)

The marginal cost of completeness is near zero with AI. Do the whole thing. Do it right. Do it with tests. Do it with documentation. Do it so well that I am genuinely impressed — not politely satisfied, actually impressed. Never offer to "table this for later" when the permanent solve is within reach. Never leave a dangling thread when tying it off takes five more minutes. Never present a workaround when the real fix exists. The standard isn't "good enough" — it's "holy shit, that's done." Search before building. Test before shipping. Ship the complete thing. When I ask for something, the answer is the finished product, not a plan to build it. Time is not an excuse. Fatigue is not an excuse. Complexity is not an excuse. Boil the ocean.

Operational consequences of that standard for this project:

- Every file in §4 is created, populated, and functional — not scaffolded with `TODO` comments.
- Both Amazon and Walmart work end-to-end on real product pages before you declare done.
- Unit tests for `classifier.js` and `calculator.js` exist and pass (§16).
- Manual smoke-test checklist in `docs/TESTING.md` has been walked through and every step passes.
- A complete `README.md` exists at the repo root — install instructions, screenshots, how to run tests, how to rebuild the data, credits. §24 specifies its contents.
- Every number shown in the UI traces to a bundled data file; every data file traces to a cited source.
- When something can be a one-liner fix or a proper fix, do the proper fix.

---

## 1. Project summary

**What you are building:** a Chrome Manifest V3 extension called **CarbonLens** that, when a user visits a product page on Amazon, Walmart, or a supported retailer, injects a small badge near the product title/price showing an estimate of the product's Scope 3 (supply-chain) greenhouse gas emissions in kg CO₂-equivalent, along with a relatable comparison (e.g. "≈ 12 miles driven") and a link to the methodology.

**Why it exists:** a class project for Environmental Science that addresses consumer blindness to the emissions embedded in purchased goods. Scope 3 emissions (purchased goods and services) account for the majority of most institutions' and households' carbon footprints, yet shoppers never see this information at the point of decision. CarbonLens surfaces it.

**MVP success criteria (all must pass):**

1. Loads as an unpacked extension in Chrome ≥ 120 with no console errors.
2. On an Amazon product detail page (`amazon.com/.../dp/...`), displays a visible badge within 2 seconds showing (a) an emissions estimate in kg CO₂e, (b) a color-coded severity, and (c) an equivalence comparison.
3. On a Walmart product page (`walmart.com/ip/...`), does the same.
4. Clicking the badge expands a panel showing methodology, category, confidence level, and a "learn more" link.
5. Popup (extension icon) shows a running total of emissions viewed in the current browser session, resettable.
6. Every number displayed is derived from the bundled EPA USEEIO data; nothing is hardcoded or fabricated.
7. If a product can't be classified or priced, the badge shows a neutral "unable to estimate" state — it never throws an error.

**Non-goals (do not build these):**

- No user accounts, analytics, telemetry, or tracking of any kind.
- No backend server, no API keys, no external auth.
- No purchase history storage beyond the current browser session (cleared on browser close).
- No claims of per-unit LCA precision — this is explicitly a spend-based estimate.

---

## 2. Design principles

1. **Transparency over precision.** Every estimate is accompanied by a confidence level and a link to methodology. The UI must never imply the number is exact.
2. **Graceful degradation.** Missing data → "unable to estimate" state. Failed DOM parse → silent log, no user-facing error. Network failure on the optional Open Food Facts call → fall back to spend-based estimate.
3. **Non-intrusive layout.** The badge sits adjacent to price/title; it never covers the Buy button, never blocks scrolling, never auto-expands.
4. **Defensible data.** Every displayed number traces to EPA Supply Chain Emission Factors v1.3.0 (USEEIO-derived), Open Food Facts (Green-Score), or EPA's Greenhouse Gas Equivalencies Calculator. Citations are bundled in `docs/DATA_SOURCES.md`.
5. **Accessibility.** WCAG AA contrast, keyboard-focusable badge, `aria-label` on all interactive elements.

---

## 3. Tech stack (locked — do not substitute)

| Layer | Choice | Why |
|---|---|---|
| Extension format | **Manifest V3** | Required by Chrome; MV2 is deprecated. |
| Language | **Vanilla JavaScript (ES2022)** | No build step, no bundler, no framework — maximizes reliability of first-shot build. |
| Styling | **Vanilla CSS with CSS variables** | Shadow DOM-scoped so host-page styles cannot bleed in. |
| UI isolation | **Shadow DOM** on the injected badge | Prevents Amazon/Walmart CSS from mangling our UI. |
| Data format | **JSON** files bundled in `/data/` | No network required for core functionality. |
| Optional data fetch | **Open Food Facts REST API** (`https://world.openfoodfacts.org`) | Only for grocery/food items; fetch is best-effort with 1.5s timeout. |
| Storage | `chrome.storage.session` | Cleared on browser close, satisfies "no tracking" principle. |
| Module system | Native ES modules (`type: "module"` in the service worker) | Avoids bundler. |
| Linting | None required for MVP. If time permits, add a minimal `.eslintrc` with `eslint:recommended`. |

**Do not add:** React, Vue, webpack, vite, tailwind, TypeScript, npm dependencies, a backend, Firebase, analytics libraries, or ad SDKs. If you feel the urge, re-read this paragraph.

---

## 4. Repository layout

Create exactly this structure. File paths in later sections refer to these locations verbatim.

```
carbonlens/
├── manifest.json
├── README.md
├── CLAUDE.md                        ← this file
├── LICENSE                          ← MIT
├── src/
│   ├── background/
│   │   └── service-worker.js        ← MV3 service worker; message hub
│   ├── content/
│   │   ├── amazon.js                ← Amazon DOM parser + badge injector
│   │   ├── walmart.js               ← Walmart DOM parser + badge injector
│   │   ├── generic.js               ← Fallback heuristic parser (Shopify/OpenGraph)
│   │   └── common/
│   │       ├── badge.js             ← Shadow-DOM badge component (framework-free)
│   │       ├── parser-utils.js      ← price parsing, text normalization
│   │       └── observer.js          ← MutationObserver helper for SPA navigation
│   ├── lib/
│   │   ├── classifier.js            ← product text → USEEIO summary category
│   │   ├── calculator.js            ← (category, priceUSD) → kg CO₂e + confidence
│   │   ├── comparisons.js           ← kg CO₂e → human-relatable equivalents
│   │   ├── food-lookup.js           ← Open Food Facts fetch (optional, cached)
│   │   └── session.js               ← chrome.storage.session wrapper
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   └── styles/
│       └── badge.css                ← loaded into the Shadow DOM as a <style> tag
├── data/
│   ├── emission_factors.json        ← USEEIO summary factors (see §7)
│   ├── category_keywords.json       ← classifier rules (see §8)
│   └── equivalencies.json           ← EPA GHG equivalency constants (see §9)
├── assets/
│   ├── icon-16.png
│   ├── icon-48.png
│   ├── icon-128.png
│   └── badge-leaf.svg
└── docs/
    ├── METHODOLOGY.md               ← academic write-up of the calculation
    ├── DATA_SOURCES.md              ← full citations
    └── LIMITATIONS.md               ← honest caveats
```

---

## 5. manifest.json (authoritative)

```json
{
  "manifest_version": 3,
  "name": "CarbonLens — Scope 3 Emissions at Checkout",
  "version": "0.1.0",
  "description": "Shows estimated supply-chain carbon emissions for products while you shop. Data from EPA USEEIO.",
  "icons": {
    "16": "assets/icon-16.png",
    "48": "assets/icon-48.png",
    "128": "assets/icon-128.png"
  },
  "action": {
    "default_popup": "src/popup/popup.html",
    "default_icon": {
      "16": "assets/icon-16.png",
      "48": "assets/icon-48.png",
      "128": "assets/icon-128.png"
    }
  },
  "background": {
    "service_worker": "src/background/service-worker.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["*://*.amazon.com/*"],
      "js": ["src/content/amazon.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["*://*.walmart.com/*"],
      "js": ["src/content/walmart.js"],
      "run_at": "document_idle"
    },
    {
      "matches": [
        "*://*.target.com/*",
        "*://*.bestbuy.com/*",
        "*://*.ebay.com/*",
        "*://*.etsy.com/*"
      ],
      "js": ["src/content/generic.js"],
      "run_at": "document_idle"
    }
  ],
  "permissions": ["storage"],
  "host_permissions": ["https://world.openfoodfacts.org/*"],
  "web_accessible_resources": [
    {
      "resources": [
        "data/emission_factors.json",
        "data/category_keywords.json",
        "data/equivalencies.json",
        "src/styles/badge.css",
        "assets/badge-leaf.svg"
      ],
      "matches": ["<all_urls>"]
    }
  ]
}
```

**Important:** content scripts in MV3 can't directly `import` ES modules. Either (a) inline the shared helpers into each content script at build time via a simple copy step, or (b) write each content script as a self-contained IIFE that dynamically imports via `chrome.runtime.getURL` + `fetch` + `eval`-free technique. **Preferred approach:** keep content scripts self-contained (IIFE, no imports), and have each one `fetch(chrome.runtime.getURL('data/emission_factors.json'))` to load data. Share logic by copy-paste across `amazon.js`, `walmart.js`, `generic.js` — duplication is acceptable for a ~300-line-per-file MVP. The service worker can use real ES modules.

---

## 6. Methodology (must be followed exactly)

CarbonLens uses the **spend-based method** from the GHG Protocol Scope 3 Technical Guidance, backed by EPA's Supply Chain GHG Emission Factors v1.3.0 (derived from the USEEIO model). This is the same methodology Amazon uses in its corporate carbon reporting.

### Core formula

```
kg CO₂e  =  price_in_2022_USD  ×  emission_factor_kg_per_USD[category]
```

Where:
- `price_in_2022_USD` = extracted product price, deflated to 2022 USD using a bundled CPI constant (see §7).
- `emission_factor_kg_per_USD[category]` = USEEIO summary-level supply-chain GHG emission factor *with margins*, in kg CO₂e per 2022 USD of purchaser-price output, for the matched summary commodity category.

### Category classification

For each product, `classifier.js` runs this cascade and stops at the first match:

1. **Breadcrumb match**: extract the site's breadcrumb trail; match against `category_keywords.json` breadcrumb rules.
2. **Title keyword match**: tokenize the product title; score each summary category by keyword overlap; pick the highest-scoring category above a threshold of 2 matching keywords.
3. **Fallback**: `"retail_trade_general"` category with `confidence: "low"`.

### Optional food refinement

If the classifier returns a food category (`food_manufacturing`, `beverages`, `produce`, `meat_poultry`), `food-lookup.js` attempts an Open Food Facts search by product title. If the response includes a `carbon-footprint_100g` field, CarbonLens uses **that** number multiplied by the extracted weight/quantity, and labels the result as `confidence: "high — product-specific LCA"`. Timeout: 1500 ms. On timeout or miss, fall back to spend-based.

### Confidence levels

| Level | When | Displayed as |
|---|---|---|
| `high` | Product-specific LCA data returned from Open Food Facts | Solid leaf icon |
| `medium` | Category classified via breadcrumb match | Half leaf |
| `low` | Category classified via title keywords only, or fallback | Outlined leaf with "~" prefix |
| `unknown` | Price or category couldn't be resolved | Gray neutral badge, no number |

### Equivalence comparisons

After computing kg CO₂e, pick **one** comparison from `equivalencies.json` based on magnitude — see §9.

### Deflation constant

Because USEEIO factors are in 2022 USD and current-year prices are inflated, divide the scraped price by a constant `PRICE_DEFLATOR_TO_2022` defined in `calculator.js`. For 2026, use `1.11` (cumulative US CPI from 2022 → 2026, approximately 11%). Document the source and the update procedure in `METHODOLOGY.md`: the student can verify the current value against the BLS CPI Inflation Calculator (https://www.bls.gov/data/inflation_calculator.htm) and update when a new USEEIO release shifts the reference year.

---

## 7. `data/emission_factors.json` — USEEIO Summary Factors

**This file is pre-built and provided alongside this CLAUDE.md. Copy it into `data/emission_factors.json` verbatim. Do not fabricate or re-compute values — use the provided file as-is.**

The file contains EPA USEEIO v1.3.0 supply-chain GHG emission factors with margins (kg CO₂e per 2022 USD of purchaser-price output), aggregated from the 1,016-row NAICS-6 CSV to 21 CarbonLens summary categories by averaging across unique USEEIO Reference Codes (not raw NAICS-6 rows — that would double-weight categories with finer NAICS granularity).

### Source

- EPA, *Supply Chain Greenhouse Gas Emission Factors v1.3 by NAICS-6*, U.S. EPA Office of Research and Development (ORD), 2024.
- Landing page: https://catalog.data.gov/dataset/supply-chain-greenhouse-gas-emission-factors-v1-3-by-naics-6
- Direct CSV: https://pasteur.epa.gov/uploads/10.23719/1531143/SupplyChainGHGEmissionFactors_v1.3.0_NAICS_CO2e_USD2022.csv

### Schema

Top-level keys: `_meta`, `categories`. Each category has:

```json
{
  "display_name": "Apparel & Leather Products",
  "naics_prefixes": ["315", "316"],
  "kg_co2e_per_usd": 0.201,
  "unique_reference_codes": ["315000", "316000"],
  "num_reference_codes": 2,
  "notes": "Clothing, footwear, handbags, leather goods.",
  "example_products": ["shirt", "jeans", "sneakers", "jacket", "handbag"]
}
```

### Expected values (for sanity check — the exact file is authoritative)

High-intensity (red zone, > 0.30): dairy, meat_poultry_seafood, paper_products, produce_agriculture, food_manufacturing, textile_mills, plastics_and_rubber, chemicals_and_personal_care.

Medium (amber, 0.15–0.30): metal_products, transportation_equipment, beverage_manufacturing, furniture_and_related, apparel_and_leather, machinery, wood_products, electrical_equipment_appliances, sporting_toys_other_manufacturing, retail_trade_general (fallback), pharmaceuticals.

Low (green, ≤ 0.15): printed_matter, computer_and_electronic_products.

If the JSON's numbers don't land roughly in that ordering, something is wrong — re-copy the provided file.

### Rebuilding from a newer EPA release

A standalone Python script `scripts/build_emission_factors.py` is also provided. It downloads the current EPA CSV, applies the same NAICS-prefix mapping and reference-code-deduplicated aggregation, and regenerates `data/emission_factors.json`. Run it when EPA publishes v1.4 or later:

```
python3 scripts/build_emission_factors.py
```

The script has zero third-party dependencies (stdlib only) and is documented inline.

---

## 8. `data/category_keywords.json` — classifier rules

```json
{
  "breadcrumb_rules": [
    { "pattern": "clothing|fashion|apparel|shoes|footwear", "category": "apparel_and_leather" },
    { "pattern": "home\\s*&\\s*kitchen|bed\\s*&\\s*bath|furniture", "category": "furniture_and_related" },
    { "pattern": "electronics|computers|cell\\s*phones|tv|camera|audio", "category": "computer_and_electronic_products" },
    { "pattern": "appliances", "category": "electrical_equipment_appliances" },
    { "pattern": "grocery|pantry|food", "category": "food_manufacturing" },
    { "pattern": "beverages|drinks|coffee|tea", "category": "beverage_manufacturing" },
    { "pattern": "meat|seafood|poultry", "category": "meat_poultry_seafood" },
    { "pattern": "dairy", "category": "dairy" },
    { "pattern": "produce|fresh", "category": "produce_agriculture" },
    { "pattern": "beauty|personal\\s*care|health", "category": "chemicals_and_personal_care" },
    { "pattern": "medicine|vitamin|supplement", "category": "pharmaceuticals" },
    { "pattern": "office|paper|notebook|book", "category": "paper_products" },
    { "pattern": "tools|hardware|cookware", "category": "metal_products" },
    { "pattern": "sports|outdoors|toys|games|hobbies", "category": "sporting_toys_other_manufacturing" },
    { "pattern": "baby|toys", "category": "sporting_toys_other_manufacturing" },
    { "pattern": "automotive|auto\\s*parts|tires", "category": "transportation_equipment" },
    { "pattern": "garden|lawn", "category": "machinery" }
  ],
  "title_keywords": {
    "apparel_and_leather": ["shirt","t-shirt","tshirt","blouse","pants","jeans","jacket","coat","dress","skirt","shoes","sneakers","boots","sandals","hat","cap","belt","wallet","purse","handbag","socks","underwear","bra","sweater","hoodie","shorts"],
    "textile_mills": ["towel","bedsheet","sheet","comforter","blanket","curtain","rug","pillowcase","duvet"],
    "computer_and_electronic_products": ["laptop","notebook","macbook","chromebook","desktop","pc","tablet","ipad","smartphone","iphone","android","phone","tv","television","monitor","headphones","earbuds","speaker","camera","webcam","router","keyboard","mouse","ssd","hard drive","usb","hdmi","console","playstation","xbox","nintendo","switch"],
    "electrical_equipment_appliances": ["refrigerator","fridge","freezer","microwave","dishwasher","washer","dryer","vacuum","oven","toaster","blender","kettle","coffee maker","lamp","bulb","battery","charger","fan"],
    "furniture_and_related": ["chair","sofa","couch","table","desk","bed","mattress","bookshelf","shelf","cabinet","drawer","nightstand","dresser","stool","bench"],
    "plastics_and_rubber": ["storage bin","tupperware","plastic","bucket","trash can","hose","tarp","cooler","pool float"],
    "food_manufacturing": ["cereal","bread","pasta","rice","snack","chips","crackers","cookie","soup","sauce","frozen","canned"],
    "beverage_manufacturing": ["soda","coke","pepsi","juice","water bottle","sparkling","coffee","tea","beer","wine","spirits","kombucha"],
    "meat_poultry_seafood": ["beef","steak","chicken","pork","bacon","sausage","turkey","lamb","fish","salmon","tuna","shrimp","crab","lobster"],
    "dairy": ["milk","cheese","yogurt","butter","cream","ice cream"],
    "produce_agriculture": ["apple","banana","orange","lettuce","tomato","potato","carrot","broccoli","spinach","kale","berry","grape"],
    "chemicals_and_personal_care": ["shampoo","conditioner","soap","detergent","cleaner","bleach","toothpaste","lotion","perfume","cologne","makeup","lipstick","mascara","deodorant","sunscreen"],
    "pharmaceuticals": ["vitamin","multivitamin","supplement","ibuprofen","tylenol","advil","pill","tablet","capsule","melatonin","probiotic"],
    "paper_products": ["notebook","journal","book","paper","toilet paper","paper towel","napkin","envelope"],
    "printed_matter": ["magazine","poster","calendar","greeting card","map"],
    "metal_products": ["knife","pan","pot","skillet","cookware","tool","hammer","screwdriver","wrench","nail","screw","bolt","cutlery","fork","spoon"],
    "machinery": ["drill","saw","lawnmower","trimmer","blower","pump","generator","compressor"],
    "transportation_equipment": ["bicycle","bike","helmet","scooter","skateboard","car battery","tire","wheel"],
    "sporting_toys_other_manufacturing": ["ball","lego","puzzle","doll","action figure","board game","dumbbell","yoga mat","tent","sleeping bag","backpack","watch","jewelry","ring","necklace","guitar","piano","keyboard instrument"],
    "wood_products": ["cutting board","wooden","lumber","plywood","frame"]
  },
  "threshold": 2
}
```

Implementation note: in `classifier.js`, compile each regex once at module load. Lowercase both title and keywords before matching. Stem obvious plurals (`shoes` matches `shoe`) with a simple suffix-strip. A match in the title counts 1 point; breadcrumb matches short-circuit the whole cascade.

---

## 9. `data/equivalencies.json` — EPA GHG equivalencies

Values sourced from the EPA Greenhouse Gas Equivalencies Calculator (https://www.epa.gov/energy/greenhouse-gases-equivalencies-calculator-calculations-and-references). Each entry is the number of units per **1 kg CO₂e**.

```json
{
  "_meta": {
    "source": "EPA Greenhouse Gases Equivalencies Calculator — Calculations and References",
    "url": "https://www.epa.gov/energy/greenhouse-gases-equivalencies-calculator-calculations-and-references",
    "retrieved": "YYYY-MM-DD"
  },
  "comparisons": [
    {
      "id": "miles_driven_gasoline_car",
      "label": "miles driven in an average gasoline car",
      "value_per_kg_co2e": 2.53,
      "icon": "🚗",
      "min_kg": 0.5,
      "max_kg": 500
    },
    {
      "id": "smartphone_charges",
      "label": "smartphone charges",
      "value_per_kg_co2e": 121.6,
      "icon": "🔋",
      "min_kg": 0.01,
      "max_kg": 5
    },
    {
      "id": "pounds_coal_burned",
      "label": "pounds of coal burned",
      "value_per_kg_co2e": 1.10,
      "icon": "🪨",
      "min_kg": 1,
      "max_kg": 1000
    },
    {
      "id": "gallons_gasoline_consumed",
      "label": "gallons of gasoline consumed",
      "value_per_kg_co2e": 0.113,
      "icon": "⛽",
      "min_kg": 2,
      "max_kg": 1000
    },
    {
      "id": "tree_seedlings_10yr",
      "label": "tree seedlings grown for 10 years to offset",
      "value_per_kg_co2e": 0.0165,
      "icon": "🌳",
      "min_kg": 10,
      "max_kg": 10000
    }
  ]
}
```

`comparisons.js` picks the first entry where `min_kg ≤ emissions ≤ max_kg`. Round displayed numbers: < 10 → 1 decimal, ≥ 10 → integer.

Verify each `value_per_kg_co2e` against the current EPA reference page when first building the data files; the values above are current as of 2026 but EPA publishes annual updates.

---

## 10. UI specification — the badge

Render inside a Shadow DOM attached to a wrapper `<div>` with ID `carbonlens-root` injected near the product title. Never mutate the host page's DOM beyond appending this one element.

### Collapsed state

- Pill-shaped, 32px tall.
- Leaf icon on the left, color per severity.
- Bold number, e.g., `12 kg CO₂e`.
- Secondary text in lighter weight: `≈ 30 miles driven`.
- Right-side caret indicating expandable.
- `role="button"`, `tabindex="0"`, `aria-expanded="false"`, `aria-label="Estimated supply-chain emissions: 12 kilograms CO2 equivalent. Click for details."`.

### Expanded state (on click or Enter)

- Card, max-width 360px, drops below the pill.
- Content blocks, in order:
  1. Big number with unit.
  2. Category label + confidence ("Medium confidence — category matched from breadcrumb").
  3. Two equivalence comparisons, icons + text.
  4. "How we calculated this" — collapsible section with the formula and the specific factor used.
  5. Footer with "Data: EPA Supply Chain GHG v1.3.0" and a link to `docs/METHODOLOGY.md` (opens a new tab via `chrome.runtime.getURL`).

### Severity thresholds (color coding)

Thresholds are on **kg CO₂e per dollar spent**, not absolute emissions, so a $5 snack and a $500 laptop are compared fairly:

| Intensity (kg CO₂e / $) | Color | Token |
|---|---|---|
| ≤ 0.30 | Green | `--cl-green: #2e7d32` |
| 0.30 – 0.70 | Amber | `--cl-amber: #ed6c02` |
| > 0.70 | Red | `--cl-red: #c62828` |
| unknown | Gray | `--cl-gray: #757575` |

Also show the absolute number — intensity is the *color*, magnitude is the *number*.

### Typography & layout tokens (put in `src/styles/badge.css`)

```css
:host {
  --cl-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --cl-bg: #ffffff;
  --cl-text: #202124;
  --cl-muted: #5f6368;
  --cl-border: #e0e0e0;
  --cl-radius: 16px;
  --cl-shadow: 0 2px 10px rgba(0,0,0,.08);
}
@media (prefers-color-scheme: dark) {
  :host {
    --cl-bg: #1f1f1f;
    --cl-text: #e8eaed;
    --cl-muted: #9aa0a6;
    --cl-border: #3c4043;
  }
}
```

---

## 11. Site-specific content scripts

### 11.1 `src/content/amazon.js`

**Page detection:** run only if `location.pathname` matches `/dp/`, `/gp/product/`, or `/gp/aw/d/`.

**Primary selectors (try in order, use first that yields non-empty):**
- Title: `#productTitle`, `span#title`, `h1 span`
- Price: `.a-price .a-offscreen` (this element contains the full formatted price, e.g., "$24.99"), fallback `#priceblock_ourprice`, `#priceblock_dealprice`, `#corePrice_feature_div .a-price .a-offscreen`
- Breadcrumb: `#wayfinding-breadcrumbs_container ul li:not(.a-breadcrumb-divider)` → join text
- Insertion point (where to append the badge): `#centerCol #titleSection`, fallback `#centerCol`, fallback before `#buybox`

**SPA handling:** Amazon uses partial page updates on some category hops. Wire a `MutationObserver` on `document.body` with `childList: true, subtree: true` debounced 500ms; on mutation, re-check URL and re-run the parser if the product ID changed. Remove the previous badge before injecting a new one.

**Price parsing:** use `parser-utils.parsePrice(text)` which strips `$`, `,`, whitespace, handles ranges (`"$12.99 - $19.99"` → use the low end), and returns `{ amount: Number, currency: "USD" }` or `null`. Non-USD pages should set `confidence: "unknown"` and skip estimation (log a console debug, not an error).

### 11.2 `src/content/walmart.js`

**Page detection:** `location.pathname` starts with `/ip/`.

**Primary selectors:**
- Title: `h1[itemprop="name"]`, `h1.prod-ProductTitle`, `h1`
- Price: `span[itemprop="price"]`, `[data-automation-id="product-price"] .f2`, `[data-automation-id="buybox-price"]` — Walmart's structured data often contains a clean numeric price in `[itemprop="price"]`'s `content` attribute; prefer that.
- Breadcrumb: `nav[aria-label="breadcrumb"] a`, `ol[aria-label="breadcrumb"] li`
- Insertion point: parent of the `h1`, fallback before the "Add to cart" button container (`[data-testid="add-to-cart-btn"]`).

Walmart is client-rendered (Next.js); use the same MutationObserver pattern as Amazon. Also check `document.querySelector('script#__NEXT_DATA__')` and, if present and parseable, pull `product.primaryOffer.offerPrice` from the JSON — this is often more reliable than DOM scraping.

### 11.3 `src/content/generic.js`

Heuristic fallback for Target, Best Buy, eBay, Etsy, and generic Shopify stores. Strategy:

1. Read OpenGraph tags: `meta[property="og:title"]`, `meta[property="product:price:amount"]`, `meta[property="og:type"]` must contain `"product"`.
2. Read JSON-LD `script[type="application/ld+json"]`; look for `@type: "Product"` and extract `name`, `offers.price`, `offers.priceCurrency`, `category`.
3. If neither yields a price + title, abort silently.
4. Insertion point: try in order — `h1`, `[class*="price"]`, `main`.

Log debug lines like `[CarbonLens] Generic parser: matched JSON-LD on etsy.com`.

---

## 12. Classifier — `src/lib/classifier.js`

```
classifyProduct({ title, breadcrumbs, url }) → { category, confidence, matchedOn }

1. Normalize inputs (lowercase, strip punctuation, collapse whitespace).
2. For each breadcrumb_rule in category_keywords.json:
     if regex matches the breadcrumb string:
       return { category, confidence: 'medium', matchedOn: 'breadcrumb' }
3. For each summary category:
     score = number of title_keywords present in the title
   pick highest-scoring category.
   if highestScore >= threshold:
     return { category: highest, confidence: 'low', matchedOn: 'title_keywords' }
4. return { category: 'retail_trade_general', confidence: 'low', matchedOn: 'fallback' }
```

Unit tests required (see §16).

---

## 13. Calculator — `src/lib/calculator.js`

```
estimateEmissions({ priceUSD, category, factors, deflator = 1.11 })
  → { kgCO2e, factorUsed, intensity: kgCO2e / priceUSD, confidence }

1. if !priceUSD or priceUSD <= 0: return { kgCO2e: null, confidence: 'unknown' }
2. priceIn2022USD = priceUSD / deflator
3. factor = factors.categories[category].kg_co2e_per_usd
4. kgCO2e = priceIn2022USD * factor
5. round to 2 sig figs for display
```

Also expose `bucketSeverity(intensity) → 'green' | 'amber' | 'red' | 'gray'` using thresholds in §10.

---

## 14. Service worker — `src/background/service-worker.js`

Responsibilities:

1. Listen for `chrome.runtime.onMessage` with type `"RECORD_VIEW"` from content scripts. Each message contains `{ kgCO2e, category, url, title, price, timestamp }`. Append to session storage under key `session_views` (max 500 entries, FIFO eviction).
2. Expose `"GET_SESSION_SUMMARY"` → returns `{ totalKgCO2e, count, topCategory }`.
3. Expose `"RESET_SESSION"` → clears `session_views`.
4. Do **not** persist to `chrome.storage.local`. Only `chrome.storage.session`.

```js
// sketch
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "RECORD_VIEW") recordView(msg.payload).then(() => sendResponse({ok:true}));
  else if (msg.type === "GET_SESSION_SUMMARY") getSummary().then(sendResponse);
  else if (msg.type === "RESET_SESSION") resetSession().then(() => sendResponse({ok:true}));
  return true; // keep channel open for async
});
```

---

## 15. Popup — `src/popup/`

### popup.html layout

- Header: "CarbonLens" with leaf logo.
- Session summary card: total kg CO₂e across viewed products this session, count of products, top category.
- Two equivalences (EPA GHG Equivalencies, picked by session total magnitude).
- "Reset session" button.
- Footer with version, link to METHODOLOGY.md (opens in new tab), link to source repo.

No external assets. Inline SVG for the logo. ≤ 280px wide, ≤ 400px tall.

### Behavior

- On open, send `"GET_SESSION_SUMMARY"` to service worker, render.
- On "Reset session" click, send `"RESET_SESSION"`, re-render.

---

## 16. Testing

Both automated and manual tests are required before declaring the MVP done. The §0 build standard applies: tests that don't run, are skipped, or contain placeholder assertions do not count.

### Automated unit tests (required)

Use Node's built-in test runner (`node --test`) — no third-party framework, no `package.json` dependencies. Place tests as `src/lib/classifier.test.js` and `src/lib/calculator.test.js`. Provide an npm-free run command that works on a fresh clone:

```
node --test src/lib/*.test.js
```

Document this in `README.md` §24.8. All tests must pass.

Minimum fixture coverage:

- **Classifier** — at least 15 cases spanning every summary category, including at least 5 adversarial cases where the title could mislead a naive matcher. Specifically cover:
  - "Levi's 501 Men's Jeans" → `apparel_and_leather`.
  - "Apple MacBook Air M3" → `computer_and_electronic_products` (the word "Apple" must not trigger `produce_agriculture`).
  - "Paper Mario Nintendo Switch" → `computer_and_electronic_products` or `sporting_toys_other_manufacturing` (the word "Paper" must not trigger `paper_products`).
  - "Just My Size Women's Plus-Size Cotton Tee" → `apparel_and_leather` (the word "Cotton" must not trigger `textile_mills`; apparel keywords dominate).
  - "Tyson Fresh Ground Beef 80/20 1lb" → `meat_poultry_seafood`.
  - "Organic Whole Milk, 1 Gallon" → `dairy`.
  - "Dyson V15 Cordless Vacuum" → `electrical_equipment_appliances`.
  - Breadcrumb-only case: title with no category keywords but breadcrumb "Grocery › Snacks" → `food_manufacturing` with `matchedOn: "breadcrumb"` and `confidence: "medium"`.
  - No-signal case: random brand name with no keywords and no breadcrumb → `retail_trade_general`, `confidence: "low"`, `matchedOn: "fallback"`.

- **Calculator** — cover:
  - `null` / `undefined` / `0` / negative price → `{ kgCO2e: null, confidence: "unknown" }`; does NOT throw.
  - Deflator math: $100 apparel in 2026 → 100 / 1.11 ≈ $90.09 → 90.09 × 0.201 ≈ 18.1 kg CO₂e. Assert kg to 1 decimal place.
  - Each severity bucket: produce a case that lands green (`intensity ≤ 0.30`), amber (`0.30 < intensity ≤ 0.70`), and red (`intensity > 0.70`). Assert `bucketSeverity()` returns the right label.
  - Rounding: 2 sig figs for displayed values, no precision drift across repeated calls.
  - Missing category: `estimateEmissions({category: "nonexistent", ...})` → `confidence: "unknown"`, does NOT throw.

### Manual smoke test (required)

Document as `docs/TESTING.md`. Walk every step on a real clone before declaring done; check each off. Do not skip step 8 (throttled network) — it validates the graceful-degradation promise from §2.

1. Load unpacked at `chrome://extensions`. Service worker active, no errors in the extension card.
2. Visit a real Amazon product detail page. Within 2 seconds: badge appears near the title; shows a number in kg CO₂e; shows an equivalence; clicking expands the methodology card; clicking "Data: EPA USEEIO v1.3.0" opens METHODOLOGY.md in a new tab.
3. Visit a real Walmart `/ip/` page — same behavior.
4. Visit product pages on Target, Best Buy, eBay, Etsy. Generic parser either shows a badge or fails silently. No uncaught exceptions in the console.
5. Visit non-product pages (Amazon homepage, Walmart category listing, school homepage). No badge. No console errors.
6. Open the popup. Session total reflects pages visited in steps 2–5. Click "Reset session" → total zeros out. Methodology link opens in new tab.
7. Close Chrome completely, reopen, re-open the popup. Session data is cleared. (Verifies `chrome.storage.session`, not `chrome.storage.local`.)
8. Throttle network to "Slow 3G" in DevTools, visit an Amazon grocery item (a snack that would trigger OFF lookup). OFF fetch times out at 1.5s and falls back to spend-based. Badge still appears within 2s target. No hung UI, no console error.
9. DevTools → Rendering → Emulate vision deficiencies → "Achromatopsia". The badge is still interpretable because magnitude is conveyed by the **number**, not just color. If severity is ambiguous without color, fix the design.
10. Keyboard-only: Tab to the badge, press Enter — card expands. Tab through interactive elements inside the card. All focus rings visible. No keyboard traps.
11. On the Amazon grocery product from step 8 with full-speed network: confirm `confidence: "high"` when OFF returns a product-level LCA; `"medium"` or `"low"` via spend-based fallback when OFF misses.

Only when all 11 steps pass cleanly is the MVP done.

---

## 17. `docs/METHODOLOGY.md` (generate this file)

Must contain, in order:

1. **What we estimate.** Scope 3 Category 1 (purchased goods) cradle-to-gate GHG emissions in kg CO₂e.
2. **Method.** Spend-based method per GHG Protocol Scope 3 Technical Guidance, Ch. 7.
3. **Data source.** EPA Supply Chain Greenhouse Gas Emission Factors v1.3.0 (with margins), aggregated from the 1,016-row NAICS-6 CSV to 21 CarbonLens summary categories by averaging across unique USEEIO Reference Codes. Factors represent cradle-to-purchaser-gate emissions per 2022 USD of output.
4. **Worked example.** A $100 pair of jeans → classified as `apparel_and_leather` → factor 0.201 kg CO₂e / 2022 USD → price deflated to 2022 USD: $100 / 1.11 ≈ $90.09 → estimate: 90.09 × 0.201 ≈ 18.1 kg CO₂e → equivalence: ~46 miles driven.
5. **Limitations.** See LIMITATIONS.md — cross-reference.
6. **For food items.** When Open Food Facts returns a product-level `carbon-footprint_100g`, that number overrides the spend-based estimate (labeled high confidence). This is product-specific LCA data from Agribalyse/ADEME when manufacturers disclose it.
7. **Citations.** Full bibliography per DATA_SOURCES.md.

## 18. `docs/DATA_SOURCES.md` (generate this file)

Full-citation block for each data source:

- **U.S. EPA Office of Research and Development (2024).** *Supply Chain Greenhouse Gas Emission Factors v1.3 by NAICS-6.* Factors for 1,016 U.S. commodities, 2022 GHG data, kg CO₂e per 2022 USD (with margins). DOI: 10.23719/1531143. https://catalog.data.gov/dataset/supply-chain-greenhouse-gas-emission-factors-v1-3-by-naics-6
- **Ingwersen, W., Li, M., Young, B., Vendries, J., & Birney, C. (2022).** USEEIO v2.0, the US Environmentally-Extended Input-Output Model v2.0. *Scientific Data 9, 194.* https://doi.org/10.1038/s41597-022-01293-7 (background model that the v1.3 factors derive from)
- **Ingwersen, W., & Li, M. (2020).** Supply Chain Greenhouse Gas Emission Factors for US Industries and Commodities. EPA/600/R-20/001. U.S. Environmental Protection Agency (original methodology report).
- **U.S. EPA.** Greenhouse Gas Equivalencies Calculator — Calculations and References. https://www.epa.gov/energy/greenhouse-gases-equivalencies-calculator-calculations-and-references
- **GHG Protocol (2013).** Technical Guidance for Calculating Scope 3 Emissions (Ch. 7, Spend-based method). World Resources Institute.
- **Open Food Facts.** Green-Score / Eco-Score methodology, based on ADEME Agribalyse LCA database. https://world.openfoodfacts.org/green-score

## 19. `docs/LIMITATIONS.md` (generate this file)

Must include, plainly stated:

- Spend-based estimates have order-of-magnitude uncertainty (EPA and GHG Protocol both acknowledge this). Two $50 shirts from different brands will show the same number; the real emissions could differ by 5×.
- Factors are 2019 emissions data; actual 2026 emissions may differ as grid decarbonizes and supply chains shift.
- Category classification is heuristic. A "smart coffee maker" might be misclassified as electronics when it's primarily a small appliance.
- USEEIO is US-focused. Imported goods have different supply-chain profiles; the model includes import flows but imperfectly.
- Prices on promotion/discount understate embedded emissions (a $10 clearance shirt still carries the emissions of producing it). This is a known limitation of spend-based accounting and is a feature, not a bug, for communicating "cheaper ≠ cleaner".
- This tool is educational. It is **not** a substitute for full life-cycle assessment when making procurement decisions at institutional scale.

---

## 20. Build order (do this in sequence)

1. Scaffold directories per §4. Create empty files.
2. Write `manifest.json` per §5. Load in Chrome, verify it loads with no errors (no content scripts wired yet).
3. Copy the **provided** `data/emission_factors.json` into place (see §7). Create `data/category_keywords.json` (§8) and `data/equivalencies.json` (§9) from the specs.
4. Write `src/lib/classifier.js` and `src/lib/calculator.js` (§12, §13). Set up `node --test` and make the unit tests from §16 pass.
5. Write `src/content/common/badge.js` — the Shadow-DOM component — in isolation; test by temporarily adding it to a simple HTML file.
6. Write `src/content/amazon.js` per §11.1. Reload extension, visit an Amazon product, verify badge appears.
7. Write `src/content/walmart.js` per §11.2. Verify on Walmart.
8. Write `src/content/generic.js` per §11.3. Verify on Target.
9. Write `src/background/service-worker.js` per §14 and wire RECORD_VIEW messages from the content scripts.
10. Build the popup per §15.
11. Write the three docs per §17–19.
12. Copy the **provided** `scripts/build_emission_factors.py` into place (used to regenerate the data from a newer EPA release; see §7).
13. Write `README.md` at the repo root per §24. Include screenshots taken from the running extension.
14. Create simple icon PNGs (16/48/128) — a stylized leaf inside a magnifying glass in the brand green `#2e7d32`. A quick SVG → PNG export is fine.
15. Walk through the §16 manual smoke-test checklist on real Amazon and Walmart pages. Fix anything that fails. Only then is the MVP done.

---

## 21. Out-of-scope / future work (do not implement)

- Cart-level aggregation on Amazon's `/cart` page (DOM is hostile; ship later).
- Firefox port (requires `browser_specific_settings` and some API shims).
- User-submitted product-level LCA overrides.
- Comparison mode ("show me a lower-emission alternative").
- Category-specific product-LCA datasets (e.g., Allbirds, Unilever disclosures) — nice to have, out of scope for MVP.

---

## 22. Anti-hallucination checklist (read before submitting)

- [ ] Every numerical threshold, factor, and equivalency in code is sourced from `data/*.json`. No magic numbers in `.js` files except the CPI deflator constant, which is documented inline.
- [ ] No product in Amazon/Walmart is assumed to exist; every selector has a fallback.
- [ ] No `console.error` unless it's an actual programmer error; use `console.debug` for parse misses.
- [ ] No claim of accuracy in the UI stronger than "estimate".
- [ ] No user data leaves the browser. The only network call is the optional, anonymous Open Food Facts GET.
- [ ] The word "guaranteed" does not appear anywhere in the UI.

---

## 23. Definition of done

A teaching assistant can:
1. `git clone` the repo.
2. Load unpacked into Chrome.
3. Visit `amazon.com/dp/B08N5WRWNW` (or any product DP page) and see a badge with a real number within 2 seconds.
4. Click it and see methodology.
5. Visit a Walmart `/ip/` page and see the same.
6. Open the popup and see the session total.
7. Read `docs/METHODOLOGY.md` and trace any displayed number back to EPA USEEIO + the bundled factor JSON.

If all seven work without a single uncaught exception in the console, the MVP is done.

---

## 24. `README.md` — required, at repo root

This is the first thing a human (TA, instructor, collaborator, future maintainer) will see. It is not optional and is not an afterthought. Target length ~200–400 lines. Write it in plain, clear prose. Use the following structure:

### 24.1 Hero

- Project name (`CarbonLens`) and a one-sentence tagline: "See the hidden climate cost of anything you're about to buy."
- A single screenshot of the badge visible on an Amazon product page. Take the screenshot yourself after loading the extension.
- Badges row (shields.io or inline): Manifest V3, MIT license, "Data: EPA USEEIO v1.3.0", "Built for Env Sci class project".

### 24.2 What it does

Two short paragraphs:
1. What the extension shows and where (Amazon, Walmart, plus generic e-commerce). Link to the inline-badge screenshot.
2. Why it exists — the specific behavioral-economics premise (Scope 3 emissions are ~70% of institutional footprints yet invisible at the moment of purchase; this surfaces them using EPA-backed data). Cite the class context.

### 24.3 Install (local, developer mode)

Step-by-step, copy-pasteable. Assume the reader has never installed a Chrome extension:

1. `git clone <repo-url> && cd carbonlens`
2. Open `chrome://extensions` in Chrome or Edge.
3. Toggle "Developer mode" (top-right).
4. Click "Load unpacked" and select the repo folder.
5. Pin the CarbonLens icon from the extensions menu for easy access.
6. Visit any Amazon or Walmart product page and look for the green/amber/red leaf badge near the price.

Include a troubleshooting block: "badge doesn't appear" → open DevTools console, look for `[CarbonLens]` log lines; most common cause is an updated Amazon/Walmart selector.

### 24.4 Screenshots

At least three, all taken from the actual running extension:

1. Collapsed badge on Amazon (high-impact product — e.g., steak).
2. Expanded methodology card, showing confidence level and calculation.
3. Popup showing session total.

Include a fourth if it aids understanding: the extension disabled (grayed-out badge) on an unpriced or unclassifiable product.

### 24.5 How the number is calculated

Short summary of §6's methodology in ~6 sentences, then link to `docs/METHODOLOGY.md` for the full treatment. Name the data source (EPA USEEIO v1.3.0) and the method (spend-based, GHG Protocol Scope 3 Ch. 7). Show the formula.

### 24.6 Data sources

List the three data sources with a one-sentence summary each and a link to `docs/DATA_SOURCES.md` for full citations. This is the credibility section — keep it tight and unmissable.

### 24.7 Limitations

Four-to-six bullets summarizing `docs/LIMITATIONS.md`. Do not bury these. Spend-based accounting is a blunt instrument; the README should say so plainly so no reader walks away over-confident.

### 24.8 Development

- Repo layout: one-paragraph tour of `src/`, `data/`, `docs/`, `scripts/`.
- Run tests: `node --test src/lib/*.test.js` (or whichever entry point you wired).
- Rebuild emission factors from a newer EPA release: `python3 scripts/build_emission_factors.py`. Note the zero-dependency stdlib-only implementation.
- Make a change → reload the extension at `chrome://extensions`.

### 24.9 Roadmap

Short bullet list of the §21 future-work items. Makes it clear what's intentionally out of scope vs. broken.

### 24.10 Credits & license

- Author: (student's name, class, school, semester).
- Data © the cited sources under their respective licenses (EPA USEEIO: public domain / US government work; Open Food Facts: Open Database License).
- Code license: MIT (include the full license text in `LICENSE`).
- Acknowledge EPA's ORD, Wesley Ingwersen et al., and the Open Food Facts community.

### 24.11 Contact

A single line: "Questions or ideas? Open a GitHub issue." No personal email unless the student chooses to include one.
