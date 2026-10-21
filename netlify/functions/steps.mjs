// POST /api/steps — automatic step counts from an iPhone Shortcut (reads Apple Health, runs without opening the app).
//  {code, key, steps, day?}  -> stores today's step count in her family space. `key` is the secret she creates under Profile.
import { json, store, spaceKey, sha } from './_lib/common.mjs';

const sast = ms => new Date(ms + 2 * 3600e3).toISOString().slice(0, 10);   // South Africa date
export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const { code, key } = b || {}, n = Math.round(Number(String(b && b.steps).replace(/[^\d.]/g, '')));
  if (typeof code !== 'string' || code.length < 8 || code.length > 40 || typeof key !== 'string' || !/^[a-f0-9]{24}$/.test(key) || !(n >= 0 && n <= 100000) || /-/.test(String(b.steps))) return json({ error: 'bad_request' }, 400);
  const st = store(), k = await spaceKey(code);
  const today = sast(Date.now());
  let day = typeof b.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.day) ? b.day : today;
  if (Math.abs(Date.parse(day) - Date.parse(today)) > 2 * 864e5) day = today;
  for (let i = 0; i < 4; i++) {
    const cur = await st.getWithMetadata(k, { type: 'json' }), d = cur && cur.data;
    if (!d || !d.stepsKh || d.stepsKh !== await sha('sk:' + code + ':' + key)) return json({ error: 'wrong_key' }, 401);
    const id = 'st_' + day, ex = d.recs[id], total = Math.max(n, ex && !ex.del ? ex.n || 0 : 0);
    d.recs[id] = { id, type: 'steps', day, n: total, ts: Date.parse(day + 'T12:00:00+02:00'), u: Date.now(), s: ++d.seq, a: (await sha('o:' + code)).slice(0, 16), by: 'Health', src: 'health' };
    const res = await st.setJSON(k, d, { onlyIfMatch: cur.etag });
    if (res && res.modified === false) continue;
    return json({ ok: true, day, steps: total });
  }
  return json({ error: 'busy' }, 409);
};
export const config = { path: '/api/steps' };
