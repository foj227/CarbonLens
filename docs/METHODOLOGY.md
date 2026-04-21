# CarbonLens Methodology

## What We Estimate

CarbonLens estimates **Scope 3 Category 1 (Purchased Goods and Services)** greenhouse gas emissions — the cradle-to-purchaser-gate GHG emissions embedded in products you're about to buy. Results are expressed in kilograms of CO₂-equivalent (kg CO₂e).

---

## Method

CarbonLens uses the **spend-based method** described in the GHG Protocol's *Technical Guidance for Calculating Scope 3 Emissions*, Chapter 7. This is the same methodology Amazon, Microsoft, and other large corporations use for their Scope 3 Category 1 disclosures.

The core formula is:

```
kg CO₂e  =  price_in_2022_USD  ×  emission_factor_kg_per_USD[category]
```

Where:

- **`price_in_2022_USD`** = the scraped product price divided by a CPI deflation constant (`1.11` for 2026, representing ~11% cumulative inflation from 2022 to 2026). To update this constant, use the BLS CPI Inflation Calculator at https://www.bls.gov/data/inflation_calculator.htm.

- **`emission_factor_kg_per_USD[category]`** = the EPA USEEIO supply-chain GHG emission factor *with margins* for the matched commodity category, in kg CO₂e per 2022 USD of purchaser-price output.

---

## Data Source

Emission factors are drawn from:

> **U.S. EPA, *Supply Chain Greenhouse Gas Emission Factors v1.3.0 by NAICS-6***, U.S. EPA Office of Research and Development, 2024.
> DOI: 10.23719/1531143
> https://catalog.data.gov/dataset/supply-chain-greenhouse-gas-emission-factors-v1-3-by-naics-6

The 1,016-row NAICS-6 CSV is aggregated to 21 CarbonLens summary categories by averaging across unique USEEIO Reference Codes (not raw NAICS-6 rows, which would double-weight categories with finer granularity). This aggregation is reproducible via `scripts/build_emission_factors.py`.

---

## Category Classification

When you visit a product page, CarbonLens runs the following cascade to assign a category:

1. **Breadcrumb match** — extract the site breadcrumb trail, match against regex rules in `data/category_keywords.json`. Returns with `confidence: "medium"`.

2. **Title keyword scoring** — tokenize the product title; score each of 21 summary categories by keyword overlap; pick the highest-scoring category. Returns with `confidence: "low"`.

3. **Fallback** — `retail_trade_general` (blended big-box retail factor, 0.164 kg CO₂e/USD). Returns with `confidence: "low"`.

---

## Worked Example

> A **$100 pair of jeans** (2026 price)

1. Classified as `apparel_and_leather` via title keyword "jeans" → `confidence: low`
2. Price deflated to 2022 USD: $100 ÷ 1.11 ≈ $90.09
3. Factor for `apparel_and_leather`: **0.201 kg CO₂e / 2022 USD**
4. Estimate: 90.09 × 0.201 ≈ **18 kg CO₂e**
5. Equivalence: 18 kg CO₂e × 2.53 miles/kg ≈ **~46 miles driven**

---

## Optional Food Refinement

When the classifier returns a food category (`food_manufacturing`, `beverage_manufacturing`, `produce_agriculture`, `meat_poultry_seafood`, or `dairy`), CarbonLens attempts a product lookup via the **Open Food Facts API** (`https://world.openfoodfacts.org`). If the response includes a `carbon-footprint_100g` field, that product-specific LCA value (sourced from Agribalyse/ADEME) overrides the spend-based estimate and is labelled `confidence: "high"`. The lookup has a 1500 ms timeout; on miss or timeout, the spend-based estimate is used.

---

## Confidence Levels

| Level | Trigger | Badge icon |
|---|---|---|
| `high` | Product-specific LCA from Open Food Facts | Solid leaf |
| `medium` | Category matched from breadcrumb trail | Half leaf |
| `low` | Category matched from title keywords, or fallback | Outlined leaf with `~` prefix |
| `unknown` | Price or category not resolved | Gray neutral badge |

---

## Limitations

See [LIMITATIONS.md](LIMITATIONS.md) for full caveats. In brief: spend-based estimates have order-of-magnitude uncertainty; factors reflect 2019 emissions intensity; category classification is heuristic; USEEIO is US-focused; and discounted prices understate embedded emissions.

---

## Citations

See [DATA_SOURCES.md](DATA_SOURCES.md) for full bibliography.
