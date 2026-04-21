# Limitations

CarbonLens is an educational tool built for an Environmental Science class project. The estimates it displays are **order-of-magnitude approximations**, not precise life-cycle assessments. Read this document before drawing any conclusions from the numbers.

---

## 1. Spend-Based Estimates Have Inherent Order-of-Magnitude Uncertainty

The spend-based method assigns emissions based on how much money is spent and the average emissions intensity of the product category — not based on the actual manufacturing, transport, or end-of-life profile of the specific item you are looking at. Two $50 shirts from different brands could have real-world emissions that differ by 5× or more depending on material sourcing, manufacturing country, factory energy mix, and logistics.

The EPA and GHG Protocol both acknowledge this limitation explicitly. Spend-based accounting is appropriate for screening-level assessments and corporate Scope 3 reporting when better data is unavailable — it is not a substitute for full life-cycle assessment (LCA) at the product level.

---

## 2. Emission Factors Reflect 2019 Emissions Intensity

The USEEIO v1.3.0 factors are derived from 2019 economic and emissions data (the most recent available as of the EPA's 2024 publication). Actual 2026 supply-chain emissions intensity may differ as:
- The electricity grid decarbonizes (reducing manufacturing emissions)
- Supply chains shift geographically
- Material efficiencies improve or worsen

The factors are updated when EPA publishes a new USEEIO release; run `scripts/build_emission_factors.py` to regenerate `data/emission_factors.json` from the latest CSV.

---

## 3. Category Classification Is Heuristic

CarbonLens classifies products using keyword matching against the product title and breadcrumb trail. This is imperfect:

- A "smart coffee maker" might be classified as `computer_and_electronic_products` (matching "smart") when its emissions profile is closer to `electrical_equipment_appliances`.
- Brand names can collide with category keywords (e.g., the brand "Apple" vs. the fruit "apple").
- Products that span multiple categories (e.g., a "fitness tracker watch") receive a single category assignment.

When classification falls back to `retail_trade_general` (displayed as "Low confidence — fallback"), the estimate uses the average blended factor for general merchandise retail, which may be significantly wrong for any specific product.

---

## 4. USEEIO Is US-Focused; Imports Are Imperfectly Modeled

The USEEIO model is built on U.S. economic accounts and covers U.S. domestic production plus imports. Imported goods are included via import adjustment factors, but a shirt made in Bangladesh, a phone assembled in China, and a car built in Germany all have supply-chain profiles that differ substantially from equivalent U.S.-produced goods. The model partially accounts for this but cannot fully capture the diversity of global supply chains.

---

## 5. Discounted Prices Understate Embedded Emissions

The spend-based method uses the price paid, not the cost of production. A $10 clearance shirt still carries the environmental cost of producing it — the emissions are in the supply chain, not in the selling price. When a product is heavily discounted, CarbonLens will underestimate its embedded emissions. This is a known, structural limitation of spend-based accounting.

Conversely, premium pricing (e.g., luxury goods, branded pharmaceuticals) may overstate emissions relative to a generic equivalent.

---

## 6. This Tool Is Educational — Not for Institutional Procurement Decisions

CarbonLens was built as a class project to raise consumer awareness of Scope 3 emissions. It is **not** a suitable substitute for:

- Full LCA commissioned by a procurement team
- Supplier-disclosed Scope 3 data
- Certified environmental product declarations (EPDs)
- Third-party verified emissions inventories

For institutional procurement decisions, consult a qualified environmental consultant and use primary data from suppliers wherever available.

---

## 7. Session Data Is Not Retained

CarbonLens uses `chrome.storage.session` — all viewed-product data is cleared when the browser closes. There is no cumulative tracking across sessions by design (privacy preservation). This means the popup's "session total" resets with every browser restart.
