// GET /api/food?q=amasi  -> carb info for foods that are not in the built-in list.
// Sources (both free): Open Food Facts (packaged / SA brands) and USDA FoodData Central (generic foods).
// Either source can fail; the app falls back to "search Google" when nothing comes back.
import { json } from './_lib/common.mjs';

const num = x => { const n = typeof x === 'string' ? parseFloat(x.replace(',', '.')) : x; return Number.isFinite(n) && n >= 0 ? n : null; };
const r1 = x => Math.round(x * 10) / 10;
const timeout = (ms) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };

export async function fromOFF(q) {
  const u = 'https://world.openfoodfacts.org/cgi/search.pl?' + new URLSearchParams({ search_terms: q, search_simple: '1', action: 'process', json: '1', page_size: '14', sort_by: 'unique_scans_n', fields: 'product_name,brands,nutriments,serving_size,serving_quantity,quantity' });
  const r = await fetch(u, { headers: { 'user-agent': 'Steady/1.0 (diabetes diary; contact via site)' }, signal: timeout(6000) });
  if (!r.ok) throw new Error('off ' + r.status);
  const j = await r.json(), out = [];
  for (const p of j.products || []) {
    const name = String(p.product_name || '').trim(); if (!name) continue;
    const n = p.nutriments || {}, per100 = num(n.carbohydrates_100g), sg = num(p.serving_quantity), sc = num(n.carbohydrates_serving);
    if (per100 === null && sc === null) continue;
    out.push({ n: name.slice(0, 70), brand: String(p.brands || '').split(',')[0].trim().slice(0, 40), per100: per100 === null ? null : r1(per100), serv: sg && (sc !== null || per100 !== null) ? { g: Math.round(sg), label: String(p.serving_size || sg + ' g').slice(0, 30), c: r1(sc !== null ? sc : per100 * sg / 100) } : null, src: 'Open Food Facts' });
  }
  return out;
}
export async function fromUSDA(q) {
  const key = process.env.FDC_API_KEY || 'DEMO_KEY';
  const u = 'https://api.nal.usda.gov/fdc/v1/foods/search?' + new URLSearchParams({ query: q, pageSize: '10', api_key: key, dataType: 'Foundation,SR Legacy,Survey (FNDDS)' });
  const r = await fetch(u, { signal: timeout(6000) });
  if (!r.ok) throw new Error('usda ' + r.status);
  const j = await r.json(), out = [];
  for (const f of j.foods || []) {
    const c = (f.foodNutrients || []).find(x => x.nutrientId === 1005 || /^carbohydrate, by difference/i.test(x.nutrientName || ''));
    const per100 = c ? num(c.value) : null; if (per100 === null) continue;
    const name = String(f.description || '').trim().toLowerCase().replace(/(^|[\s,(])\w/g, m => m.toUpperCase()); if (!name) continue;
    out.push({ n: name.slice(0, 70), brand: '', per100: r1(per100), serv: null, src: 'USDA' });
  }
  return out;
}
export default async (req) => {
  const q = (new URL(req.url).searchParams.get('q') || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (q.length < 2) return json({ error: 'bad_request' }, 400);
  const [a, b] = await Promise.allSettled([fromOFF(q), fromUSDA(q)]);
  const items = [...(a.status === 'fulfilled' ? a.value.slice(0, 8) : []), ...(b.status === 'fulfilled' ? b.value.slice(0, 6) : [])];
  const seen = new Set(), uniq = items.filter(i => { const k = (i.n + '|' + i.brand).toLowerCase(); return seen.has(k) ? false : seen.add(k); });
  const res = json({ items: uniq, ok: { off: a.status === 'fulfilled', usda: b.status === 'fulfilled' } });
  res.headers.set('cache-control', uniq.length ? 'public, max-age=86400' : 'no-store');
  return res;
};
export const config = { path: '/api/food' };
