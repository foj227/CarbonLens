import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyProduct } from './classifier.js';

// Minimal keywords fixture matching data/category_keywords.json structure
const keywords = {
  breadcrumb_rules: [
    { pattern: 'grocery|pantry|food', category: 'food_manufacturing' },
    { pattern: 'clothing|fashion|apparel|shoes|footwear', category: 'apparel_and_leather' },
    { pattern: 'electronics|computers|cell\\s*phones|tv|camera|audio', category: 'computer_and_electronic_products' },
    { pattern: 'dairy', category: 'dairy' },
    { pattern: 'meat|seafood|poultry', category: 'meat_poultry_seafood' },
    { pattern: 'beauty|personal\\s*care|health', category: 'chemicals_and_personal_care' }
  ],
  title_keywords: {
    apparel_and_leather: ['shirt','t-shirt','tshirt','tee','blouse','pants','jeans','jacket','coat','dress','skirt','shoes','sneakers','boots','sandals','hat','cap','belt','wallet','purse','handbag','socks','underwear','bra','sweater','hoodie','shorts'],
    textile_mills: ['towel','bedsheet','sheet','comforter','blanket','curtain','rug','pillowcase','duvet'],
    computer_and_electronic_products: ['laptop','notebook','macbook','chromebook','desktop','pc','tablet','ipad','smartphone','iphone','android','phone','tv','television','monitor','headphones','earbuds','speaker','camera','webcam','router','keyboard','mouse','ssd','hard drive','usb','hdmi','console','playstation','xbox','nintendo','switch'],
    electrical_equipment_appliances: ['refrigerator','fridge','freezer','microwave','dishwasher','washer','dryer','vacuum','oven','toaster','blender','kettle','coffee maker','lamp','bulb','battery','charger','fan','air fryer'],
    furniture_and_related: ['chair','sofa','couch','table','desk','bed','mattress','bookshelf','shelf','cabinet','drawer','nightstand','dresser','stool','bench'],
    plastics_and_rubber: ['storage bin','tupperware','plastic','bucket','trash can','hose','tarp','cooler','pool float'],
    food_manufacturing: ['cereal','bread','pasta','rice','snack','chips','crackers','cookie','soup','sauce','frozen','canned'],
    beverage_manufacturing: ['soda','coke','pepsi','juice','water bottle','sparkling','coffee','tea','beer','wine','spirits','kombucha'],
    meat_poultry_seafood: ['beef','steak','chicken','pork','bacon','sausage','turkey','lamb','fish','salmon','tuna','shrimp','crab','lobster'],
    dairy: ['milk','cheese','yogurt','butter','cream','ice cream'],
    produce_agriculture: ['apple','banana','orange','lettuce','tomato','potato','carrot','broccoli','spinach','kale','berry','grape'],
    chemicals_and_personal_care: ['shampoo','conditioner','soap','detergent','cleaner','bleach','toothpaste','lotion','perfume','cologne','makeup','lipstick','mascara','deodorant','sunscreen'],
    pharmaceuticals: ['vitamin','multivitamin','supplement','ibuprofen','tylenol','advil','pill','tablet','capsule','melatonin','probiotic'],
    paper_products: ['notebook','journal','book','paper','toilet paper','paper towel','napkin','envelope'],
    printed_matter: ['magazine','poster','calendar','greeting card','map'],
    metal_products: ['knife','pan','pot','skillet','cookware','tool','hammer','screwdriver','wrench','nail','screw','bolt','cutlery','fork','spoon'],
    machinery: ['drill','saw','lawnmower','trimmer','blower','pump','generator','compressor'],
    transportation_equipment: ['bicycle','bike','helmet','scooter','skateboard','car battery','tire','wheel'],
    sporting_toys_other_manufacturing: ['ball','lego','puzzle','doll','action figure','board game','dumbbell','yoga mat','tent','sleeping bag','backpack','watch','jewelry','ring','necklace','guitar','piano'],
    wood_products: ['cutting board','wooden','lumber','plywood','frame']
  },
  threshold: 2
};

describe('classifyProduct — standard matches', () => {
  it('classifies jeans as apparel_and_leather', () => {
    const r = classifyProduct({ title: "Levi's 501 Men's Jeans", breadcrumbs: '' }, keywords);
    assert.equal(r.category, 'apparel_and_leather');
    assert.equal(r.matchedOn, 'title_keywords');
  });

  it('classifies vacuum as electrical_equipment_appliances', () => {
    const r = classifyProduct({ title: 'Dyson V15 Cordless Vacuum', breadcrumbs: '' }, keywords);
    assert.equal(r.category, 'electrical_equipment_appliances');
  });

  it('classifies beef as meat_poultry_seafood', () => {
    const r = classifyProduct({ title: 'Tyson Fresh Ground Beef 80/20 1lb', breadcrumbs: '' }, keywords);
    assert.equal(r.category, 'meat_poultry_seafood');
  });

  it('classifies milk as dairy', () => {
    const r = classifyProduct({ title: 'Organic Whole Milk, 1 Gallon', breadcrumbs: '' }, keywords);
    assert.equal(r.category, 'dairy');
  });

  it('classifies laptop as computer_and_electronic_products', () => {
    const r = classifyProduct({ title: 'Dell Inspiron 15 Laptop 16GB RAM', breadcrumbs: '' }, keywords);
    assert.equal(r.category, 'computer_and_electronic_products');
  });

  it('classifies sofa as furniture_and_related', () => {
    const r = classifyProduct({ title: 'IKEA KLIPPAN Compact Sofa', breadcrumbs: '' }, keywords);
    assert.equal(r.category, 'furniture_and_related');
  });

  it('classifies shampoo as chemicals_and_personal_care', () => {
    const r = classifyProduct({ title: 'Head & Shoulders Classic Clean Shampoo', breadcrumbs: '' }, keywords);
    assert.equal(r.category, 'chemicals_and_personal_care');
  });

  it('classifies vitamin as pharmaceuticals', () => {
    const r = classifyProduct({ title: 'Nature Made Vitamin D3 Supplement', breadcrumbs: '' }, keywords);
    assert.equal(r.category, 'pharmaceuticals');
  });
});

describe('classifyProduct — adversarial cases', () => {
  it('MacBook: apple brand does NOT trigger produce_agriculture; macbook wins electronics', () => {
    const r = classifyProduct({ title: 'Apple MacBook Air M3', breadcrumbs: '' }, keywords);
    assert.equal(r.category, 'computer_and_electronic_products');
    assert.notEqual(r.category, 'produce_agriculture');
  });

  it('Paper Mario Nintendo Switch: paper does NOT win; nintendo+switch scores higher', () => {
    const r = classifyProduct({ title: 'Paper Mario Nintendo Switch', breadcrumbs: '' }, keywords);
    assert.ok(
      r.category === 'computer_and_electronic_products' || r.category === 'sporting_toys_other_manufacturing',
      `Expected electronics or toys, got ${r.category}`
    );
    assert.notEqual(r.category, 'paper_products');
  });

  it('Cotton Tee: cotton does NOT trigger textile_mills; tee wins apparel', () => {
    // Requires "tee" to be in apparel_and_leather keywords
    const kwWithTee = {
      ...keywords,
      title_keywords: {
        ...keywords.title_keywords,
        apparel_and_leather: [...keywords.title_keywords.apparel_and_leather, 'tee']
      }
    };
    const r = classifyProduct({ title: "Just My Size Women's Plus-Size Cotton Tee", breadcrumbs: '' }, kwWithTee);
    assert.equal(r.category, 'apparel_and_leather');
    assert.notEqual(r.category, 'textile_mills');
  });

  it('Breadcrumb-only: no title keywords but breadcrumb "Grocery > Snacks" → food_manufacturing', () => {
    const r = classifyProduct({ title: 'Yummy Brand Z42X', breadcrumbs: 'Grocery > Snacks' }, keywords);
    assert.equal(r.category, 'food_manufacturing');
    assert.equal(r.matchedOn, 'breadcrumb');
    assert.equal(r.confidence, 'medium');
  });

  it('No-signal case: random brand name → retail_trade_general fallback', () => {
    const r = classifyProduct({ title: 'Zarvox Model XQ9 Pro Ultra', breadcrumbs: '' }, keywords);
    assert.equal(r.category, 'retail_trade_general');
    assert.equal(r.confidence, 'low');
    assert.equal(r.matchedOn, 'fallback');
  });
});

describe('classifyProduct — breadcrumb rules', () => {
  it('breadcrumb "Clothing > Tops" → apparel_and_leather', () => {
    const r = classifyProduct({ title: 'Unknown Brand Item', breadcrumbs: 'Clothing > Tops' }, keywords);
    assert.equal(r.category, 'apparel_and_leather');
    assert.equal(r.confidence, 'medium');
  });

  it('breadcrumb "Electronics > Computers" → computer_and_electronic_products', () => {
    const r = classifyProduct({ title: 'Widget 3000', breadcrumbs: 'Electronics > Computers > Laptops' }, keywords);
    assert.equal(r.category, 'computer_and_electronic_products');
    assert.equal(r.confidence, 'medium');
  });

  it('breadcrumb match short-circuits title scoring', () => {
    // Title has "beef" (meat) but breadcrumb says dairy — breadcrumb wins
    const r = classifyProduct({ title: 'Organic beef flavored item', breadcrumbs: 'Dairy Products' }, keywords);
    assert.equal(r.category, 'dairy');
    assert.equal(r.matchedOn, 'breadcrumb');
  });
});

describe('classifyProduct — plural / stem handling', () => {
  it('plural "sneakers" matches apparel keyword "sneakers"', () => {
    const r = classifyProduct({ title: 'Nike Air Max Sneakers Size 10', breadcrumbs: '' }, keywords);
    assert.equal(r.category, 'apparel_and_leather');
  });

  it('plural "headphones" matches electronics keyword', () => {
    const r = classifyProduct({ title: 'Sony WH-1000XM5 Headphones Noise Cancelling', breadcrumbs: '' }, keywords);
    assert.equal(r.category, 'computer_and_electronic_products');
  });
});
