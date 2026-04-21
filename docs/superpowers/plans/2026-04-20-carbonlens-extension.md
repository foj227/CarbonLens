# CarbonLens Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete Chrome MV3 extension that shows EPA USEEIO spend-based CO₂e estimates on Amazon/Walmart product pages.

**Architecture:** Self-contained IIFEs for content scripts (no module imports); ES modules for service worker + lib/; Shadow DOM badge isolation; chrome.storage.session for ephemeral tracking.

**Tech Stack:** Vanilla JS ES2022, Vanilla CSS, Chrome MV3, Node.js built-in test runner

---

### Task 1: Scaffold + manifest.json + LICENSE
- [ ] Create all directories per §4
- [ ] Write manifest.json per §5 (add docs/METHODOLOGY.md to web_accessible_resources)
- [ ] Write LICENSE (MIT)
- [ ] Load unpacked in Chrome, verify no errors

### Task 2: Data files
- [ ] Copy emission_factors.json from root → data/
- [ ] Write data/category_keywords.json (§8, add "tee" to apparel_and_leather)
- [ ] Write data/equivalencies.json (§9)

### Task 3: classifier.js TDD
- [ ] Write src/lib/classifier.test.js with 15+ cases (all §16 fixtures)
- [ ] Run `node --test src/lib/*.test.js` — verify tests FAIL (classifier not written yet)
- [ ] Write src/lib/classifier.js (ES module export)
- [ ] Run tests — all pass

### Task 4: calculator.js TDD
- [ ] Write src/lib/calculator.test.js with all §16 fixtures
- [ ] Run tests — verify FAIL
- [ ] Write src/lib/calculator.js (ES module export)
- [ ] Run tests — all pass

### Task 5: Shared lib files
- [ ] Write src/lib/comparisons.js
- [ ] Write src/lib/session.js
- [ ] Write src/lib/food-lookup.js

### Task 6: Badge component + CSS
- [ ] Write src/styles/badge.css (§10 tokens)
- [ ] Write src/content/common/badge.js (Shadow DOM component, source reference)

### Task 7: Common content script utilities
- [ ] Write src/content/common/parser-utils.js (parsePrice)
- [ ] Write src/content/common/observer.js (MutationObserver helper)

### Task 8: amazon.js content script (IIFE)
- [ ] Write src/content/amazon.js (inline all shared logic)
- [ ] Load in Chrome, verify badge on amazon.com/dp/ page

### Task 9: walmart.js content script (IIFE)
- [ ] Write src/content/walmart.js
- [ ] Verify badge on walmart.com/ip/ page

### Task 10: generic.js content script (IIFE)
- [ ] Write src/content/generic.js
- [ ] Test on Target/eBay product page

### Task 11: service-worker.js
- [ ] Write src/background/service-worker.js (RECORD_VIEW, GET_SESSION_SUMMARY, RESET_SESSION)

### Task 12: Popup
- [ ] Write src/popup/popup.html + popup.css + popup.js
- [ ] Verify popup shows session total

### Task 13: Assets
- [ ] Write assets/badge-leaf.svg
- [ ] Generate assets/icon-16.png, icon-48.png, icon-128.png via Python script

### Task 14: Documentation
- [ ] Write docs/METHODOLOGY.md (§17)
- [ ] Write docs/DATA_SOURCES.md (§18)
- [ ] Write docs/LIMITATIONS.md (§19)
- [ ] Write docs/TESTING.md (§16 manual checklist)

### Task 15: README + scripts
- [ ] Move build_emission_factors.py → scripts/build_emission_factors.py
- [ ] Write README.md (§24)
- [ ] Run all unit tests, confirm pass
