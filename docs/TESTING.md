# Manual Smoke-Test Checklist

Walk every step on a real clone before declaring the MVP done. Check off each item as you confirm it passes. Do not skip step 8.

---

## Setup

- [ ] `git clone <repo-url> && cd carbonlens`
- [ ] Open `chrome://extensions` in Chrome ≥ 120
- [ ] Toggle "Developer mode" on (top-right switch)
- [ ] Click "Load unpacked" → select the repo folder
- [ ] Confirm: extension card shows "CarbonLens — Scope 3 Emissions at Checkout", no error badge
- [ ] Click the "Service Worker" link on the extension card → DevTools opens with no red console errors

---

## Step 1: Load Unpacked

- [ ] Extension card is visible at `chrome://extensions`
- [ ] Status shows "Active" (service worker running)
- [ ] No yellow warnings or red errors on the card

---

## Step 2: Amazon Product Page

Visit a real Amazon product detail page (e.g., `amazon.com/dp/B08N5WRWNW` or any `/dp/` URL).

- [ ] Badge appears near the product title within 2 seconds
- [ ] Badge shows a number in **kg CO₂e** (not "Unable to estimate")
- [ ] Badge shows an equivalence line (e.g., "≈ 30 miles driven")
- [ ] Badge leaf icon color matches severity (green / amber / red)
- [ ] Clicking the badge expands the methodology card
- [ ] Expanded card shows: big number, confidence level, category name, 1–2 equivalences, formula details
- [ ] Clicking "How we calculated this ▾" expands the formula section
- [ ] Clicking "Data: EPA Supply Chain GHG v1.3.0" opens `docs/METHODOLOGY.md` in a new tab
- [ ] Clicking the badge again collapses it
- [ ] DevTools console shows `[CarbonLens:Amazon]` debug line, no uncaught exceptions

---

## Step 3: Walmart Product Page

Visit a real Walmart product page (e.g., `walmart.com/ip/...`).

- [ ] Same badge behavior as Step 2
- [ ] Price and title are correctly extracted
- [ ] DevTools shows `[CarbonLens:Walmart]` debug line, no errors

---

## Step 4: Generic Parser (Target / Best Buy / eBay / Etsy)

Visit product pages on Target, Best Buy, eBay, and Etsy.

- [ ] If the page has OpenGraph or JSON-LD product data: badge appears
- [ ] If the page lacks structured product data: **no badge, no console errors** (silent fail)
- [ ] DevTools shows `[CarbonLens:Generic]` debug line when the parser fires

---

## Step 5: Non-Product Pages — No Badge

- [ ] Amazon homepage (`amazon.com`) → no badge, no console errors
- [ ] Walmart category listing → no badge
- [ ] A non-shopping site (e.g., your school homepage) → no badge, no errors

---

## Step 6: Popup

- [ ] Click the CarbonLens icon in the toolbar (pin it if needed)
- [ ] Popup shows "Session total" reflecting products visited in Steps 2–4
- [ ] Product count and top category are shown
- [ ] Equivalences are shown
- [ ] Click "Reset session" → total zeros out, shows "No products viewed yet"
- [ ] "Methodology" link opens METHODOLOGY.md in a new tab

---

## Step 7: Session Clears on Browser Close

- [ ] Close Chrome completely (not just the tab)
- [ ] Reopen Chrome and the extension popup
- [ ] Session data is cleared — total shows 0 / "No products viewed yet"
- [ ] This confirms `chrome.storage.session`, not `chrome.storage.local`

---

## Step 8: Network Throttle (Graceful Degradation)

DevTools → Network → Throttle → "Slow 3G". Visit an Amazon grocery item (e.g., search for cereal or snacks).

- [ ] Open Food Facts lookup times out at ~1.5s
- [ ] Badge **still appears** using the spend-based fallback within ~2s total
- [ ] Confidence shows "Low confidence" or "Medium confidence" (NOT "high"), confirming OFF miss
- [ ] No hung UI, no spinner stuck, no console error
- [ ] Restore network to "No throttling" after this step

---

## Step 9: Accessibility — Color Blindness Check

DevTools → Rendering → Emulate vision deficiencies → "Achromatopsia" (all gray).

- [ ] The badge is still readable — the kg CO₂e **number** is visible regardless of color
- [ ] Severity is not communicated by color alone (magnitude is the number)
- [ ] Badge text contrast is still sufficient
- [ ] Restore "No emulation" after this step

---

## Step 10: Keyboard Navigation

Tab around the badge using only the keyboard.

- [ ] Tab to the badge pill → focus ring is visible
- [ ] Press Enter or Space → card expands
- [ ] Tab through all interactive elements in the expanded card (details toggle, methodology link)
- [ ] All focus rings are visible
- [ ] No keyboard trap (Tab eventually moves out of the badge)
- [ ] Press Enter again on the pill → card collapses

---

## Step 11: Open Food Facts High-Confidence Path

With full-speed network, visit an Amazon grocery item whose title appears in Open Food Facts (e.g., a name-brand cereal or yogurt).

- [ ] If OFF returns a match with `carbon-footprint_100g`:
  - Badge shows `confidence: "high"` ("High confidence — product-specific LCA data")
  - Badge leaf is solid (not half)
- [ ] If OFF misses:
  - Badge shows `confidence: "medium"` or `"low"` (spend-based fallback)
  - No error in console

---

## All Steps Complete

When all 11 steps above are checked off, the MVP is done per the §23 definition of done.
