import assert from 'node:assert/strict';
const real = globalThis.fetch;
globalThis.fetch = async (u) => {
  u = String(u);
  if (u.includes('openfoodfacts')) return new Response(JSON.stringify({ products: [{ product_name: 'Amasi Full Cream', brands: 'Clover,X', nutriments: { carbohydrates_100g: '4,5' }, serving_quantity: 200, serving_size: '200 ml' }, { product_name: '', nutriments: {} }, { product_name: 'No carbs data', nutriments: {} }] }));
  if (u.includes('nal.usda.gov')) return new Response(JSON.stringify({ foods: [{ description: 'SAMP, COOKED', foodNutrients: [{ nutrientId: 1005, value: 21.3 }] }, { description: 'NO NUTRIENTS', foodNutrients: [] }] }));
  throw new Error('unexpected ' + u);
};
const { default: h } = await import('../netlify/functions/food.mjs');
let r = await h(new Request('http://x/api/food?q=amasi')); let j = await r.json();
assert.equal(j.items.length, 2); assert.deepEqual(j.items[0], { n: 'Amasi Full Cream', brand: 'Clover', per100: 4.5, serv: { g: 200, label: '200 ml', c: 9 }, src: 'Open Food Facts' });
assert.equal(j.items[1].n, 'Samp, Cooked'); assert.equal(j.items[1].per100, 21.3);
assert.equal((await h(new Request('http://x/api/food?q=a'))).status, 400);
globalThis.fetch = async () => { throw new Error('offline'); };
j = await (await h(new Request('http://x/api/food?q=samp'))).json(); assert.deepEqual(j, { items: [], ok: { off: false, usda: false } });
console.log('food proxy ok');
