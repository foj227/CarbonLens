// Classifies a product into a USEEIO summary category using spend-based keyword matching.
// Used by the service worker (ES module import) and inlined into content scripts.

// Priority order for tie-breaking when multiple categories score equally.
// Electronics/appliances > apparel/home > food/agricultural categories.
const CATEGORY_PRIORITY = [
  'computer_and_electronic_products',
  'electrical_equipment_appliances',
  'transportation_equipment',
  'machinery',
  'apparel_and_leather',
  'furniture_and_related',
  'metal_products',
  'wood_products',
  'sporting_toys_other_manufacturing',
  'pharmaceuticals',
  'chemicals_and_personal_care',
  'plastics_and_rubber',
  'printed_matter',
  'paper_products',
  'beverage_manufacturing',
  'textile_mills',
  'food_manufacturing',
  'meat_poultry_seafood',
  'dairy',
  'produce_agriculture',
  'retail_trade_general'
];

/**
 * @param {{ title: string, breadcrumbs?: string, url?: string }} product
 * @param {object} keywords  — parsed data/category_keywords.json
 * @returns {{ category: string, confidence: 'high'|'medium'|'low', matchedOn: string }}
 */
export function classifyProduct({ title = '', breadcrumbs = '', url = '' }, keywords) {
  const normTitle = normalize(title);
  const normBreadcrumb = normalize(breadcrumbs);

  // Step 1: Breadcrumb rules — short-circuit, highest confidence for keyword match
  for (const rule of keywords.breadcrumb_rules) {
    const re = new RegExp(rule.pattern, 'i');
    if (re.test(normBreadcrumb)) {
      return { category: rule.category, confidence: 'medium', matchedOn: 'breadcrumb' };
    }
  }

  // Step 2: Title keyword scoring
  const scores = {};
  for (const [cat, kws] of Object.entries(keywords.title_keywords)) {
    let score = 0;
    for (const kw of kws) {
      if (titleContainsKeyword(normTitle, kw)) score++;
    }
    if (score > 0) scores[cat] = score;
  }

  if (Object.keys(scores).length > 0) {
    const maxScore = Math.max(...Object.values(scores));

    // All categories that share the top score
    const topCats = Object.entries(scores)
      .filter(([, s]) => s === maxScore)
      .map(([cat]) => cat);

    // Break ties with priority order; prefer lower index (higher priority)
    topCats.sort((a, b) => {
      const pa = CATEGORY_PRIORITY.indexOf(a);
      const pb = CATEGORY_PRIORITY.indexOf(b);
      // Categories not in priority list go last
      return (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb);
    });

    return { category: topCats[0], confidence: 'low', matchedOn: 'title_keywords' };
  }

  // Step 3: Fallback
  return { category: 'retail_trade_general', confidence: 'low', matchedOn: 'fallback' };
}

/** Lowercase, strip hyphens, collapse punctuation/whitespace. */
function normalize(str) {
  return String(str)
    .toLowerCase()
    .replace(/-/g, '')        // "t-shirt" → "tshirt", "plus-size" → "plussize"
    .replace(/[^\w\s]/g, ' ') // strip remaining punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/** Check if a keyword (possibly multi-word) appears in the normalized title. */
function titleContainsKeyword(normTitle, keyword) {
  // Normalize the keyword the same way as the title
  const normKw = normalize(keyword);

  if (normKw.includes(' ')) {
    // Multi-word keyword: substring match in the title
    return normTitle.includes(normKw);
  }

  // Single-word keyword: check against each word (and its stem) in the title
  const titleWords = normTitle.split(' ');
  const kwStem = stem(normKw);
  return titleWords.some(w => w === normKw || w === kwStem || stem(w) === normKw || stem(w) === kwStem);
}

/** Strip simple plural/possessive suffixes to help with sneakers→sneaker, etc. */
function stem(word) {
  if (word.length <= 3) return word;
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('ves')) return word.slice(0, -3) + 'f';
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

// Export internal helpers for testing
export { normalize, stem, titleContainsKeyword };
