// GET  /api/push?key        -> VAPID public key
// GET  /api/push?p=<hash>   -> the message waiting for that device (used by the service worker)
// POST /api/push {code,pin,sub,action} -> subscribe / unsubscribe this device (either PIN)
import { json, store, spaceKey, pinHash, validCreds, roleOf, identify } from './_lib/common.mjs';
import { vapid, subsKey } from './_lib/push.mjs';

export default async (req) => {
  const u = new URL(req.url), st = store();
  if (req.method === 'GET') {
    if (u.searchParams.has('key')) return json({ key: (await vapid()).pub });
    const p = u.searchParams.get('p') || '';
    if (/^[a-f0-9]{40}$/.test(p)) { const m = await st.get('pushmsg/' + p, { type: 'json' }); return json(m && Date.now() - m.t < 3600e3 ? m : { title: 'Steady', body: 'Open Steady to see an update', tag: 'steady' }); }
    return json({ error: 'bad_request' }, 400);
  }
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const { code, pin, sub, action = 'sub', dev, who, ppin } = b || {};
  if (!validCreds(code, pin) || !sub || typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('https://') || sub.endpoint.length > 600) return json({ error: 'bad_request' }, 400);
  const key = await spaceKey(code), doc = await st.get(key, { type: 'json' });
  if (!doc) return json({ error: 'not_found' }, 404);
  const role = roleOf(doc, await pinHash(code, pin));
  if (!role) return json({ error: 'wrong_pin' }, 401);
  const me = await identify(doc, role, code, { dev, who, ppin });
  const sk = subsKey(key), rec = (await st.get(sk, { type: 'json' })) || { subs: [] };
  rec.subs = rec.subs.filter(s => s.sub.endpoint !== sub.endpoint);
  if (action === 'sub') rec.subs.push({ sub: { endpoint: sub.endpoint }, role, me, at: Date.now() });
  rec.subs = rec.subs.slice(-30);
  await st.setJSON(sk, rec);
  return json({ ok: true, role, devices: rec.subs.length });
};
export const config = { path: '/api/push' };
