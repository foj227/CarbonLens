#!/usr/bin/env python3
"""
build_emission_factors.py
─────────────────────────
Transforms the EPA's NAICS-6 Supply Chain GHG Emission Factors (v1.3.0) into
the summary-category JSON consumed by the CarbonLens Chrome extension.

Source dataset
──────────────
"Supply Chain Greenhouse Gas Emission Factors v1.3 by NAICS-6"
U.S. EPA Office of Research and Development (2024).
https://catalog.data.gov/dataset/supply-chain-greenhouse-gas-emission-factors-v1-3-by-naics-6
Direct file:
https://pasteur.epa.gov/uploads/10.23719/1531143/SupplyChainGHGEmissionFactors_v1.3.0_NAICS_CO2e_USD2022.csv

Values are in kg CO2e per 2022 USD of purchaser-price output, using the
"Supply Chain Emission Factors with Margins" column (SEF + MEF). Margins
are included because a consumer's price at a retailer is a purchaser price.

Aggregation
───────────
EPA publishes at NAICS-6 resolution, but multiple NAICS-6 rows share a single
USEEIO Reference Code and therefore carry identical factors. Averaging raw
rows would mis-weight categories that happen to have more 6-digit
subcategories. Instead, this script:

  1. Filters rows whose NAICS code begins with one of the prefixes defined
     for a summary category.
  2. Deduplicates to unique (Reference USEEIO Code, factor) pairs.
  3. Takes the arithmetic mean of the unique reference-code factors.

That yields one aggregated factor per summary category with no hidden
weighting by NAICS granularity.

Usage
─────
    python3 build_emission_factors.py \\
        --csv SupplyChainGHGEmissionFactors_v1.3.0_NAICS_CO2e_USD2022.csv \\
        --out emission_factors.json

If --csv is not provided, the script attempts to download the file from
EPA's pasteur.epa.gov bucket.
"""
from __future__ import annotations
import argparse
import csv
import json
import os
import sys
import urllib.request
from datetime import date
from statistics import mean
from typing import Iterable

EPA_CSV_URL = (
    "https://pasteur.epa.gov/uploads/10.23719/1531143/"
    "SupplyChainGHGEmissionFactors_v1.3.0_NAICS_CO2e_USD2022.csv"
)

# ─────────────────────────────────────────────────────────────────────────────
# Mapping: CarbonLens summary category → list of NAICS-6 prefixes to include.
# Prefix matching is "startswith" against the 6-digit NAICS string. Ordered
# from most-specific to most-general so the first match wins in a single pass.
# ─────────────────────────────────────────────────────────────────────────────
# Note: some 3xx codes are surgically excluded from broader groupings to avoid
# double-counting (e.g. food_manufacturing excludes dairy/meat/beverages which
# have their own categories).
CATEGORY_MAP: list[dict] = [
    {
        "key": "apparel_and_leather",
        "display_name": "Apparel & Leather Products",
        "naics_prefixes": ["315", "316"],
        "notes": "Clothing, footwear, handbags, leather goods.",
        "example_products": ["shirt", "jeans", "sneakers", "jacket", "handbag"],
    },
    {
        "key": "textile_mills",
        "display_name": "Textile & Textile Product Mills",
        "naics_prefixes": ["313", "314"],
        "notes": "Yarn, fabric, linens, rugs, curtains, towels.",
        "example_products": ["towels", "bedsheets", "rug", "curtains", "blanket"],
    },
    {
        "key": "computer_and_electronic_products",
        "display_name": "Computer & Electronic Products",
        "naics_prefixes": ["334"],
        "notes": "Computers, phones, TVs, audio, semiconductors, instruments.",
        "example_products": ["laptop", "smartphone", "tv", "headphones", "monitor", "tablet"],
    },
    {
        "key": "electrical_equipment_appliances",
        "display_name": "Electrical Equipment & Appliances",
        "naics_prefixes": ["335"],
        "notes": "Lighting, household appliances, batteries, wiring devices.",
        "example_products": ["refrigerator", "microwave", "vacuum", "blender", "lamp", "battery"],
    },
    {
        "key": "furniture_and_related",
        "display_name": "Furniture & Related Products",
        "naics_prefixes": ["337"],
        "notes": "Household, office, institutional furniture and mattresses.",
        "example_products": ["chair", "sofa", "mattress", "desk", "bookshelf"],
    },
    {
        "key": "plastics_and_rubber",
        "display_name": "Plastics & Rubber Products",
        "naics_prefixes": ["326"],
        "notes": "Plastic containers, bags, bottles, hoses, tires.",
        "example_products": ["storage bin", "plastic bottle", "garden hose", "tire"],
    },
    # Food categories (carve-outs before the general food_manufacturing bucket).
    {
        "key": "meat_poultry_seafood",
        "display_name": "Meat, Poultry & Seafood",
        "naics_prefixes": ["3116", "3117", "1121", "1122", "1123", "1124", "1125", "1141"],
        "notes": (
            "Animal slaughtering, meat processing, seafood, and the upstream animal "
            "production/fishing that supplies them. Typically the highest-intensity "
            "consumer category."
        ),
        "example_products": ["beef", "chicken", "pork", "bacon", "fish", "shrimp"],
    },
    {
        "key": "dairy",
        "display_name": "Dairy Products",
        "naics_prefixes": ["3115", "11212"],
        "notes": "Milk, cheese, butter, yogurt, ice cream, and dairy cattle operations.",
        "example_products": ["milk", "cheese", "yogurt", "butter", "ice cream"],
    },
    {
        "key": "beverage_manufacturing",
        "display_name": "Beverage Manufacturing",
        "naics_prefixes": ["3121"],
        "notes": "Soft drinks, bottled water, beer, wine, spirits, coffee/tea drinks.",
        "example_products": ["soda", "juice", "beer", "wine", "bottled water"],
    },
    {
        "key": "produce_agriculture",
        "display_name": "Fresh Produce & Agriculture",
        "naics_prefixes": ["1112", "1113", "1114"],
        "notes": "Fruits, vegetables, melons, nursery, greenhouse produce.",
        "example_products": ["apple", "lettuce", "tomato", "banana", "strawberry"],
    },
    {
        "key": "food_manufacturing",
        "display_name": "Food Manufacturing (packaged)",
        "naics_prefixes": ["3111", "3112", "3113", "3114", "3118", "3119"],
        "notes": (
            "Packaged/processed food: cereal, snacks, canned goods, baked goods, "
            "confectionery, coffee & tea manufacturing. Excludes meat, dairy, "
            "beverages which have their own categories."
        ),
        "example_products": ["cereal", "canned soup", "chips", "cookies", "pasta"],
    },
    # Chemicals subdivided: pharmaceuticals separate from personal care.
    {
        "key": "pharmaceuticals",
        "display_name": "Pharmaceuticals & Medicine",
        "naics_prefixes": ["3254"],
        "notes": "OTC and prescription drugs, vitamins, supplements, biologicals.",
        "example_products": ["vitamin", "supplement", "ibuprofen", "melatonin"],
    },
    {
        "key": "chemicals_and_personal_care",
        "display_name": "Chemicals & Personal Care",
        "naics_prefixes": ["3256", "32562", "3255"],
        "notes": (
            "Soaps, detergents, cosmetics, toiletries, paints, adhesives. Retail "
            "cleaning and personal-care products."
        ),
        "example_products": ["shampoo", "detergent", "toothpaste", "lotion", "makeup"],
    },
    {
        "key": "paper_products",
        "display_name": "Paper & Paper Products",
        "naics_prefixes": ["322"],
        "notes": "Books, notebooks, toilet paper, paper towels, stationery, packaging.",
        "example_products": ["notebook", "toilet paper", "paper towels", "envelope"],
    },
    {
        "key": "printed_matter",
        "display_name": "Printing & Publishing",
        "naics_prefixes": ["323", "5111"],
        "notes": "Magazines, posters, calendars, greeting cards, books as published works.",
        "example_products": ["magazine", "poster", "calendar", "greeting card"],
    },
    {
        "key": "metal_products",
        "display_name": "Fabricated Metal Products",
        "naics_prefixes": ["332"],
        "notes": "Tools, cookware, cutlery, hardware, fasteners, metal containers.",
        "example_products": ["knife", "pan", "hammer", "screwdriver", "cutlery"],
    },
    {
        "key": "machinery",
        "display_name": "Machinery",
        "naics_prefixes": ["333"],
        "notes": "Power tools, lawn equipment, HVAC, industrial machinery.",
        "example_products": ["drill", "lawnmower", "saw", "pump"],
    },
    {
        "key": "transportation_equipment",
        "display_name": "Transportation Equipment",
        "naics_prefixes": ["336"],
        "notes": "Bicycles, motor vehicle parts, boats, aerospace equipment.",
        "example_products": ["bicycle", "scooter", "helmet", "car battery"],
    },
    {
        "key": "sporting_toys_other_manufacturing",
        "display_name": "Sporting Goods, Toys & Misc. Manufacturing",
        "naics_prefixes": ["339"],
        "notes": "Sports equipment, toys, jewelry, musical instruments, medical supplies.",
        "example_products": ["ball", "toy", "lego", "watch", "guitar", "yoga mat"],
    },
    {
        "key": "wood_products",
        "display_name": "Wood Products",
        "naics_prefixes": ["321"],
        "notes": "Lumber, plywood, wood containers, wood decor.",
        "example_products": ["cutting board", "wooden shelf", "picture frame"],
    },
    {
        "key": "retail_trade_general",
        "display_name": "General Retail (fallback)",
        "naics_prefixes": ["452"],  # General merchandise / warehouse clubs / dept stores
        "notes": (
            "Fallback for unclassified products. Uses the general-merchandise "
            "retail factor (dept stores / warehouse clubs), which represents the "
            "blended mix a typical retailer sells."
        ),
        "example_products": [],
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# CSV loading
# ─────────────────────────────────────────────────────────────────────────────
NAICS_COL = "2017 NAICS Code"
TITLE_COL = "2017 NAICS Title"
SEF_MARGIN_COL = "Supply Chain Emission Factors with Margins"
REF_COL = "Reference USEEIO Code"


def load_rows(path: str) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = [r for r in reader]
    required = {NAICS_COL, SEF_MARGIN_COL, REF_COL}
    missing = required - set(rows[0].keys()) if rows else required
    if missing:
        raise SystemExit(
            f"CSV is missing required columns: {missing}. Got: {list(rows[0].keys()) if rows else []}"
        )
    # Normalize NAICS to zero-padded 6-digit strings.
    for r in rows:
        code = r[NAICS_COL].strip()
        # Some rows may have numeric NAICS codes; keep them as-is, string-typed.
        r[NAICS_COL] = code
    return rows


def download_csv(dest: str) -> None:
    print(f"Downloading EPA CSV → {dest}", file=sys.stderr)
    urllib.request.urlretrieve(EPA_CSV_URL, dest)


def rows_for_prefixes(rows: list[dict], prefixes: Iterable[str]) -> list[dict]:
    prefs = tuple(prefixes)
    return [r for r in rows if r[NAICS_COL].startswith(prefs)]


def aggregate_factor(category_rows: list[dict]) -> tuple[float | None, list[str]]:
    """
    Average the 'with margins' factor across UNIQUE Reference USEEIO Codes,
    not raw NAICS-6 rows. Returns (mean_factor, sorted_unique_reference_codes).
    """
    by_ref: dict[str, float] = {}
    for r in category_rows:
        ref = r[REF_COL].strip()
        try:
            v = float(r[SEF_MARGIN_COL])
        except ValueError:
            continue
        # All rows sharing a ref code carry identical factors; taking the first
        # (or overwriting with the same value) is equivalent.
        by_ref[ref] = v
    if not by_ref:
        return None, []
    return round(mean(by_ref.values()), 4), sorted(by_ref.keys())


# ─────────────────────────────────────────────────────────────────────────────
# Build
# ─────────────────────────────────────────────────────────────────────────────
def build(csv_path: str, out_path: str) -> None:
    rows = load_rows(csv_path)
    categories: dict[str, dict] = {}

    for cat in CATEGORY_MAP:
        relevant = rows_for_prefixes(rows, cat["naics_prefixes"])
        factor, refs = aggregate_factor(relevant)
        if factor is None:
            raise SystemExit(
                f"No rows matched NAICS prefixes {cat['naics_prefixes']} for "
                f"category '{cat['key']}'. Check the CSV integrity."
            )
        categories[cat["key"]] = {
            "display_name": cat["display_name"],
            "naics_prefixes": cat["naics_prefixes"],
            "kg_co2e_per_usd": factor,
            "source_rows_count": len(relevant),
            "unique_reference_codes": refs,
            "notes": cat["notes"],
            "example_products": cat["example_products"],
        }

    output = {
        "_meta": {
            "source": (
                "EPA Supply Chain Greenhouse Gas Emission Factors v1.3.0 "
                "(NAICS-6, CO2e, USD 2022), with margins (SEF+MEF)."
            ),
            "source_url": EPA_CSV_URL,
            "landing_page": (
                "https://catalog.data.gov/dataset/"
                "supply-chain-greenhouse-gas-emission-factors-v1-3-by-naics-6"
            ),
            "methodology": (
                "Spend-based method per GHG Protocol Scope 3 Technical Guidance, Ch. 7. "
                "Factors aggregated from NAICS-6 to CarbonLens summary categories by "
                "averaging across unique USEEIO Reference Codes to avoid weighting by "
                "arbitrary NAICS granularity."
            ),
            "factor_year": 2022,
            "currency_year": 2022,
            "unit": "kg CO2e per 2022 USD of purchaser-price output (with margins)",
            "aggregation": "arithmetic mean over unique USEEIO Reference Codes",
            "generated_on": date.today().isoformat(),
            "status": "production — derived from EPA v1.3.0 CSV",
        },
        "categories": categories,
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"Wrote {out_path} ({len(categories)} categories)")

    # Summary to stderr for sanity-checking.
    width = max(len(k) for k in categories) + 2
    print("\nSummary:", file=sys.stderr)
    for k, v in sorted(categories.items(), key=lambda kv: kv[1]["kg_co2e_per_usd"], reverse=True):
        print(
            f"  {k.ljust(width)} {v['kg_co2e_per_usd']:.3f} kg CO2e/$   "
            f"(n={v['source_rows_count']} rows, {len(v['unique_reference_codes'])} ref codes)",
            file=sys.stderr,
        )


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--csv",
        default=None,
        help="Path to SupplyChainGHGEmissionFactors CSV. If omitted, downloads from EPA.",
    )
    ap.add_argument(
        "--out",
        default="emission_factors.json",
        help="Destination JSON path (default: ./emission_factors.json)",
    )
    args = ap.parse_args()

    csv_path = args.csv
    if csv_path is None:
        csv_path = "SupplyChainGHGEmissionFactors_v1.3.0_NAICS_CO2e_USD2022.csv"
        if not os.path.exists(csv_path):
            download_csv(csv_path)

    build(csv_path, args.out)


if __name__ == "__main__":
    main()
