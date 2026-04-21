# Data Sources

## Primary: EPA USEEIO Supply Chain Emission Factors

**U.S. EPA Office of Research and Development (2024).** *Supply Chain Greenhouse Gas Emission Factors v1.3 by NAICS-6.* Factors for 1,016 U.S. commodities, 2022 GHG data, kg CO₂e per 2022 USD of purchaser-price output (with margins). DOI: 10.23719/1531143.

- Landing page: https://catalog.data.gov/dataset/supply-chain-greenhouse-gas-emission-factors-v1-3-by-naics-6
- Direct CSV: https://pasteur.epa.gov/uploads/10.23719/1531143/SupplyChainGHGEmissionFactors_v1.3.0_NAICS_CO2e_USD2022.csv
- License: U.S. Government Work (public domain)

This dataset provides the 21 emission factors in `data/emission_factors.json`. They are aggregated from the raw NAICS-6 CSV by averaging across unique USEEIO Reference Codes within each CarbonLens summary category, using `scripts/build_emission_factors.py`.

---

## Background Model

**Ingwersen, W., Li, M., Young, B., Vendries, J., & Birney, C. (2022).** USEEIO v2.0, the US Environmentally-Extended Input-Output Model v2.0. *Scientific Data 9*, 194. https://doi.org/10.1038/s41597-022-01293-7

The USEEIO model is the underlying input-output framework from which the v1.3 supply-chain emission factors are derived. It combines the U.S. Bureau of Economic Analysis input-output accounts with EPA emissions inventories.

---

## Methodology Report

**Ingwersen, W., & Li, M. (2020).** Supply Chain Greenhouse Gas Emission Factors for US Industries and Commodities. EPA/600/R-20/001. U.S. Environmental Protection Agency.

The original peer-reviewed methodology report describing how supply-chain (Scope 3) factors are computed from the USEEIO model, including the treatment of margins.

---

## GHG Equivalency Constants

**U.S. EPA.** *Greenhouse Gas Equivalencies Calculator — Calculations and References.* https://www.epa.gov/energy/greenhouse-gases-equivalencies-calculator-calculations-and-references

Source of all values in `data/equivalencies.json`:
- Miles driven in average gasoline car: 2.53 miles per kg CO₂e
- Smartphone charges: 121.6 charges per kg CO₂e
- Pounds of coal burned: 1.10 lbs per kg CO₂e
- Gallons of gasoline consumed: 0.113 gallons per kg CO₂e
- Tree seedlings grown for 10 years: 0.0165 seedlings per kg CO₂e

These values are updated annually by EPA; verify at the link above before any release.

---

## Spend-Based Methodology

**GHG Protocol (2013).** *Technical Guidance for Calculating Scope 3 Emissions, Version 1.0*, Chapter 7: Spend-based method. World Resources Institute. https://ghgprotocol.org/sites/default/files/standards/Scope3_Calculation_Guidance_0.pdf

This guidance document defines the spend-based method that CarbonLens implements. It describes when spend-based estimates are appropriate (early-stage assessments, categories where physical data is unavailable) and their inherent limitations.

---

## Optional Food Data

**Open Food Facts.** Green-Score / Eco-Score methodology, based on the ADEME Agribalyse LCA database. https://world.openfoodfacts.org/green-score

When a food product includes `carbon-footprint_100g` in the Open Food Facts API response, CarbonLens uses that value in place of the spend-based estimate. This data originates from the Agribalyse database maintained by ADEME (France's ecological transition agency) and includes manufacturer-reported LCA data where available.

- Open Food Facts data license: Open Database License (ODbL)
- Agribalyse: https://agribalyse.ademe.fr

---

## CPI Deflation

The `PRICE_DEFLATOR_TO_2022 = 1.11` constant (cumulative US CPI inflation 2022–2026) is derived from the **U.S. Bureau of Labor Statistics CPI Inflation Calculator**: https://www.bls.gov/data/inflation_calculator.htm

Update this constant when EPA publishes a new USEEIO reference year. See `METHODOLOGY.md` for the update procedure.
