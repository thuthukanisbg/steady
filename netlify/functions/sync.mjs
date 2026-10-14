// POST /api/sync — merge-based sync of one family "space" (all records in a single JSON doc).
// Each record: { id, type, ts, u (updated ms), del?, ...fields }. Newest `u` wins; deletes are tombstones.
import { json, store, spaceKey, pinHash, validCreds } from './_lib/common.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const { code, pin, create = false, since = 0, records = [] } = b || {};
  if (!validCreds(code, pin)) return json({ error: 'bad_credentials' }, 400);

  const st = store(), key = await spaceKey(code), ph = await pinHash(code, pin);

  for (let attempt = 0; attempt < 4; attempt++) {
    const cur = await st.getWithMetadata(key, { type: 'json' }); // null when missing
    let doc = cur ? cur.data : null;
    if (!doc) {
      if (!create) return json({ error: 'not_found' }, 404);
      doc = { v: 1, pin: ph, seq: 0, recs: {}, created: Date.now() };
    } else if (doc.pin !== ph) {
      return json({ error: 'wrong_pin' }, 401);
    }

    let changed = false;
    for (const r of (Array.isArray(records) ? records : []).slice(0, 600)) {
      if (!r || typeof r.id !== 'string' || r.id.length > 40 || typeof r.type !== 'string' || typeof r.u !== 'number') continue;
      if (JSON.stringify(r).length > 6000) continue;
      const ex = doc.recs[r.id];
      if (!ex || r.u >= ex.u) { const { s, ...rest } = r; doc.recs[r.id] = { ...rest, s: ++doc.seq }; changed = true; }
    }

    if (changed || !cur) {
      const res = await st.setJSON(key, doc, cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
      if (res && res.modified === false) continue; // someone else wrote first — retry on fresh data
    }
    const out = Object.values(doc.recs).filter(r => r.s > since);
    return json({ ok: true, seq: doc.seq, records: out, now: Date.now() });
  }
  return json({ error: 'busy' }, 409);
};

export const config = { path: '/api/sync' };
