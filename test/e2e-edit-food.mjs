import { createRequire } from 'node:module'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = '/home/claude/steady/public';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => { let f = path.join(root, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }); fs.createReadStream(f).pipe(r); }).listen(8877);
const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 400, height: 800 }, serviceWorkers: 'block' }); const p = await c.newPage();
p.on('pageerror', e => console.log('PAGEERR', e.message));
let n = 0; const ok = (x, m) => { assert.ok(x, m); n++; console.log('✓', m); };
await p.route('**/api/food?q=*', r => { const q = new URL(r.request().url()).searchParams.get('q'); if (q.startsWith('zzz')) return r.fulfill({ json: { items: [], ok: { off: true, usda: true } } }); if (q.startsWith('boom')) return r.abort(); r.fulfill({ json: { items: [{ n: 'Amasi Full Cream', brand: 'Clover', per100: 4.5, serv: { g: 200, label: '200 ml', c: 9 }, src: 'Open Food Facts' }, { n: 'Samp, Cooked', brand: '', per100: 21.3, serv: null, src: 'USDA' }], ok: { off: true, usda: true } } }); });
await p.route('**/api/**', r => r.request().url().includes('/api/food') ? r.fallback() : r.fulfill({ status: 404, json: { error: 'x' } }));
await p.addInitScript(() => { if (!localStorage.getItem('steady.meta')) localStorage.setItem('steady.meta', JSON.stringify({ onboarded: true, role: 'patient', who: 'Thembeka', device: 'd1', dev: 'abcdef0123456789abcdef' })); });
await p.goto('http://localhost:8877/'); await p.waitForSelector('#nav');
// log insulin wrongly
await p.click('[data-act=add][data-v=insulin]').catch(async () => { await p.click('.fab'); await p.click('#sheet [data-v=insulin]'); });
await p.waitForSelector('#iu'); await p.fill('#iu', '40'); await p.click('[data-act=save-insulin]'); await p.waitForFunction(() => document.querySelector('#sheet').innerHTML === '');
ok((await p.textContent('#view')).includes('40'), 'insulin 40 u logged (wrong on purpose)');
// edit from home recent insulin
await p.click('[data-act=edit]'); await p.waitForSelector('#iu'); ok((await p.inputValue('#iu')) === '40', 'edit form prefilled with 40');
ok((await p.textContent('#sheet')).includes('Edit entry'), 'edit title shown');
await p.fill('#iu', '4'); await p.click('[data-act=save-insulin]'); await p.waitForFunction(() => document.querySelector('#sheet').innerHTML === '');
const recs = await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('steady.recs'))).filter(r => r.type === 'insulin' && !r.del));
ok(recs.length === 1 && recs[0].units === 4 && recs[0].ed, 'same record updated to 4 u and marked edited (no duplicate)');
// sugar edit
await p.click('.fab'); await p.waitForSelector('#gv'); await p.fill('#gv', '25'); await p.click('[data-act=save-glucose]'); await p.waitForSelector('[data-act=close]'); await p.click('#sheet [data-act=close].btn');
await p.click('[data-act=go][data-v=progress]'); await p.waitForSelector('[data-act=edit]');
const gEdit = p.locator('.item:has-text("mmol") [data-act=edit], .item:has-text("🩸") [data-act=edit]').first(); await gEdit.click(); await p.waitForSelector('#gv');
ok((await p.inputValue('#gv')) === '25.0' || (await p.inputValue('#gv')) === '25', 'sugar edit prefilled'); await p.fill('#gv', '5,5'); await p.click('[data-act=save-glucose]'); await p.waitForFunction(() => document.querySelector('#sheet').innerHTML === '');
const g = await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('steady.recs'))).filter(r => r.type === 'glucose' && !r.del));
ok(g.length === 1 && Math.abs(g[0].v - 5.5) < 0.01, 'sugar corrected 25 -> 5.5 with comma decimal');
// meal + online food
await p.click('.fab'); await p.click('#sheet [data-v=meal]'); await p.waitForSelector('#mq');
await p.fill('#mq', 'quinoa'); await p.waitForSelector('#mweb [data-act=web-pick]', { timeout: 8000 }); ok(true, 'online results appear automatically when not in the list');
ok((await p.textContent('#mweb')).includes('9 g carbs per 200 ml'), 'serving carbs shown');
await p.click('[data-act=web-pick][data-i="0"]'); await p.waitForSelector('#wg'); ok((await p.textContent('#wc')).includes('9 g'), 'portion default 200ml -> 9 g'); await p.fill('#wg', '100'); ok((await p.textContent('#wc')).includes('4.5 g'), 'portion recalculates'); await p.click('[data-act=web-add]');
ok((await p.textContent('#msel')).includes('Amasi Full Cream'), 'online food added to the meal');
await p.fill('#mq', 'zzzfood'); await p.waitForSelector('#mweb a[href*="google.com"]', { timeout: 8000 }); ok(true, 'nothing found -> Google link offered');
ok((await p.inputValue('#cname')) === 'zzzfood', 'manual add prefilled with search');
await p.fill('#mq', 'boomfood'); await p.waitForSelector('#mweb a[href*="google.com"]', { timeout: 8000 }); ok((await p.textContent('#mweb')).includes('Couldn’t reach') || (await p.textContent('#mweb')).includes('offline'), 'network failure handled');
await p.click('[data-act=save-meal]'); await p.waitForFunction(() => document.querySelector('#sheet').innerHTML === '');
const m = await p.evaluate(() => ({ meal: Object.values(JSON.parse(localStorage.getItem('steady.recs'))).find(r => r.type === 'meal'), foods: JSON.parse(localStorage.getItem('steady.meta')).foods }));
console.log(JSON.stringify(m)); ok(m.meal && m.meal.carbs === 5 && m.foods[0].n.includes('Amasi'), 'meal saved with online carbs and remembered for next time');
// edit meal
await p.click('[data-act=go][data-v=progress]'); await p.locator('.item:has-text("🍽️") [data-act=edit]').first().click(); await p.waitForSelector('#msel'); ok((await p.textContent('#msel')).includes('Amasi'), 'meal edit shows its foods'); await p.click('[data-act=meal-q][data-d="0.5"]'); await p.click('[data-act=save-meal]'); await p.waitForFunction(() => document.querySelector('#sheet').innerHTML === '');
const m2 = await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('steady.recs'))).filter(r => r.type === 'meal' && !r.del)); ok(m2.length === 1 && m2[0].carbs === 7, 'meal portion edited in place (' + m2[0].carbs + ')');
console.log('\nSteady e2e passed:', n);
await b.close(); srv.close();
