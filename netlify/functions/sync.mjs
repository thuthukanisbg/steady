// POST /api/sync — merge-based sync of one family "space" (all records in a single JSON doc).
// Each record: { id, type, ts, u (updated ms), del?, ...fields }. Newest `u` wins; deletes are tombstones.
import { json, store, spaceKey, pinHash, validCreds, roleOf, FAMILY_WRITE, REACTIONS, MAX_PHOTOS, MAX_MSGS, sha, validEmail } from './_lib/common.mjs';
import { pushSpace } from './_lib/push.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const { code, pin, create = false, since = 0, records = [], vpin, newPin, dev, epoch, who, ppin, join = false, email } = b || {};
  if (!validCreds(code, pin)) return json({ error: 'bad_credentials' }, 400);
  if (vpin !== undefined && vpin !== null && !/^\d{4,8}$/.test(String(vpin))) return json({ error: 'bad_family_pin' }, 400);

  if (newPin !== undefined && newPin !== null && !/^\d{4,8}$/.test(String(newPin))) return json({ error: 'bad_pin' }, 400);
  const st = store(), key = await spaceKey(code), ph = await pinHash(code, pin);
  // per-device author id (hash of a secret kept on the device) so people can delete only their own posts
  let me = typeof dev === 'string' && /^[a-f0-9]{16,64}$/.test(dev) ? (await sha('d:' + code + ':' + dev)).slice(0, 16) : null;

  for (let attempt = 0; attempt < 4; attempt++) {
    const cur = await st.getWithMetadata(key, { type: 'json' }); // null when missing
    let doc = cur ? cur.data : null;
    if (!doc) {
      if (!create) return json({ error: 'not_found' }, 404);
      doc = { v: 1, pin: ph, vpin: null, seq: 0, epoch: 0, recs: {}, created: Date.now() };
    }
    const role = roleOf(doc, ph);
    if (!role) return json({ error: 'wrong_pin' }, 401);
    doc.epoch = doc.epoch || 0;
    // a PIN was changed since this device logged in, so it must log in again
    if (typeof epoch === 'number' && epoch !== doc.epoch) return json({ error: 'session_expired' }, 401);

    let changed = false, bump = false;
    // WHO is posting: her = one fixed identity on every device; family = their name + own PIN, so the same person on any phone/browser
    if (role === 'owner') me = (await sha('o:' + code)).slice(0, 16);
    else if (typeof who === 'string' && who.trim()) {
      const nk = who.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40);
      if (!/^\d{4,8}$/.test(String(ppin || ''))) return json({ error: 'need_identity' }, 400);
      doc.people = doc.people || {};
      const h = await sha('q:' + code + ':' + nk + ':' + ppin), px = doc.people[nk];
      if (px && px.h !== h) return json({ error: 'name_taken' }, 403);
      const em = typeof email === 'string' ? email.trim().toLowerCase() : '';
      if (!px) {
        if (Object.keys(doc.people).length >= 30) return json({ error: 'too_many' }, 400);
        if (!validEmail(em)) return json({ error: 'need_email' }, 400);
        doc.people[nk] = { h, name: who.trim().slice(0, 40), email: em }; changed = true;
      } else if (validEmail(em) && px.email !== em) { px.email = em; changed = true; }
      else if (join && !validEmail(px.email)) return json({ error: 'need_email' }, 400);
      me = (await sha('u:' + code + ':' + nk)).slice(0, 16);
    } else if (join) return json({ error: 'need_identity' }, 400);
    if (role === 'owner' && newPin) {
      const nh = await pinHash(code, String(newPin));
      if (nh === doc.vpin) return json({ error: 'same_pin' }, 400);
      if (nh !== doc.pin) { doc.pin = nh; changed = true; bump = true; }
    }
    if (role === 'owner' && vpin) {
      const vh = await pinHash(code, String(vpin));
      if (vh === doc.pin) return json({ error: 'same_pin' }, 400);
      if (doc.vpin !== vh) { doc.vpin = vh; changed = true; if (cur) bump = true; }
    }
    if (bump) doc.epoch++;
    const newMsgs = [];
    let followers = Object.values(doc.recs).filter(x => x.type === 'follower' && !x.del).length;
    for (const r of (Array.isArray(records) ? records : []).slice(0, 600)) {
      if (!r || typeof r.id !== 'string' || r.id.length > 40 || typeof r.type !== 'string' || typeof r.u !== 'number') continue;
      if (JSON.stringify(r).length > (r.type === 'post' ? 150000 : 6000)) continue;
      if (r.type === 'post' && !r.del && !(typeof r.img === 'string' && r.img.startsWith('data:image/jpeg;base64,') && r.img.length < 140000)) continue;
      if (r.type === 'react' && !r.del && (!REACTIONS.includes(r.e) || typeof r.t !== 'string' || r.t.length > 40)) continue;
      if (r.type === 'msg' && !r.del) {
        if (!me || typeof r.text !== 'string' || !r.text.trim() || r.text.length > 1000) continue;
        if (r.room === 'd') { if (typeof r.to !== 'string' || !/^[a-f0-9]{16}$/.test(r.to) || r.to === me) continue; }
        else if (r.room !== 'g') continue; else delete r.to;
      }
      if (r.type === 'member' && !r.del && (!me || r.id !== 'mb_' + me || typeof r.name !== 'string' || r.name.length > 40)) continue;
      const ex = doc.recs[r.id];
      if (role === 'viewer') {                       // view-only: family can add notes, photos, reactions and their own email follow
        if (!FAMILY_WRITE.has(r.type) || (ex && ex.type !== r.type)) continue;
        if (ex && (!me || ex.a !== me)) continue;    // ...and can only change or delete what they posted themselves
      }
      if (me) r.a = me; else delete r.a;
      if (r.type === 'follower' && !r.del && (!ex || ex.del)) { if (followers >= 10) continue; followers++; }
      if (!ex || r.u >= ex.u) { const { s, ...rest } = r; doc.recs[r.id] = { ...rest, s: ++doc.seq }; changed = true; if (r.type === 'msg' && !r.del && !ex) newMsgs.push(r); }
    }

    // keep storage bounded: only the newest MAX_PHOTOS photos keep their image
    const withImg = Object.values(doc.recs).filter(x => x.type === 'post' && !x.del && x.img).sort((a, b) => b.ts - a.ts);
    for (const x of withImg.slice(MAX_PHOTOS)) { doc.recs[x.id] = { ...x, img: '', pruned: 1, u: Date.now(), s: ++doc.seq }; changed = true; }

    // chat history is bounded too: oldest messages beyond the cap are dropped
    const msgs = Object.values(doc.recs).filter(x => x.type === 'msg' && !x.del).sort((a, b) => b.ts - a.ts);
    for (const x of msgs.slice(MAX_MSGS)) { doc.recs[x.id] = { id: x.id, type: 'msg', del: 1, ts: x.ts, u: Date.now(), s: ++doc.seq }; changed = true; }

    if (changed || !cur) {
      const res = await st.setJSON(key, doc, cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
      if (res && res.modified === false) continue; // someone else wrote first — retry on fresh data
    }
    // private 1:1 messages are only ever sent to the two people in them (owner included — no one else can read them)
    // phone alerts for new chat messages: group -> everyone else; private -> only the person it is for (no text in the alert)
    if (newMsgs.length) await Promise.race([Promise.all(newMsgs.slice(0, 3).map(m => pushSpace(key, m.room === 'g'
      ? { title: '💬 ' + (m.by || 'Family'), body: String(m.text).slice(0, 90), tag: 'chat-g', url: '/' }
      : { title: '🔒 ' + (m.by || 'Family'), body: 'sent you a private message', tag: 'chat-' + (m.by || ''), url: '/' },
      m.room === 'g' ? { skipMe: me || '' } : { onlyMe: m.to }).catch(() => null))), new Promise(r => setTimeout(r, 2500))]);
    const out = Object.values(doc.recs).filter(r => r.s > since && !(r.type === 'msg' && r.room === 'd' && !r.del && r.a !== me && r.to !== me));
    return json({ ok: true, seq: doc.seq, records: out, now: Date.now(), role, hasFamilyPin: !!doc.vpin, epoch: doc.epoch, me });
  }
  return json({ error: 'busy' }, 409);
};

export const config = { path: '/api/sync' };
