// Optional Open Food Facts lookup for food products.
// Returns product-specific LCA data (carbon-footprint_100g) when available.
// Times out after 1500ms and returns null on any failure.

const OFF_SEARCH = 'https://world.openfoodfacts.org/cgi/search.pl';
const TIMEOUT_MS = 1500;

const FOOD_CATEGORIES = new Set([
  'food_manufacturing',
  'beverage_manufacturing',
  'produce_agriculture',
  'meat_poultry_seafood',
  'dairy'
]);

export function isFoodCategory(category) {
  return FOOD_CATEGORIES.has(category);
}

/**
 * Searches Open Food Facts by product title.
 * @param {string} title
 * @returns {Promise<{kgCo2Per100g: number, productName: string}|null>}
 */
export async function lookupFoodEmissions(title) {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const params = new URLSearchParams({
      search_terms: title,
      search_simple: '1',
      action: 'process',
      json: '1',
      page_size: '1'
    });

    const res = await fetch(`${OFF_SEARCH}?${params}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) return null;

    const data = await res.json();
    const product = data?.products?.[0];
    if (!product) return null;

    const co2Per100g = product['carbon-footprint_100g'];
    if (!co2Per100g || isNaN(Number(co2Per100g))) return null;

    return {
      kgCo2Per100g: Number(co2Per100g),
      productName: product.product_name || title
    };
  } catch {
    return null; // timeout, network error, or JSON parse failure
  } finally {
    clearTimeout(timerId);
  }
}
