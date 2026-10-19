// POST /api/call — signalling for in-app voice/video calls (WebRTC, one-to-one). The audio/video itself goes phone-to-phone.
//  actions: start {to,kind,offer} | poll {id?} | answer {id,answer} | ice {id,cand} | end {id} | turn
// auth: same as /api/push (code + pin | tok, plus who/ppin/dev) -> `me`. A call is only ever visible to its two people.
import { json, store, spaceKey, pinHash, validCreds, roleOf, identify, inviteByTok, nameKey } from './_lib/common.mjs';
import { pushSpace } from './_lib/push.mjs';

const RING_MS = 45e3;
const ck = key => 'call/' + key.slice(6);
/* same name = same person (older identities of the same name also count) */
function aliases(doc, me) {
  const s = new Set([me]), ms = Object.values(doc.recs || {}).filter(x => x.type === 'member' && !x.del), mine = ms.find(x => x.id === 'mb_' + me);
  if (mine && nameKey(mine.name)) ms.forEach(x => { if (nameKey(x.name) === nameKey(mine.name) && /^mb_[a-f0-9]{16}$/.test(x.id)) s.add(x.id.slice(3)); });
  return s;
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const { code, pin, tok, dev, who, ppin, action, id, to, kind, offer, answer, cand } = b || {};
  if (!validCreds(code, tok ? '0000' : pin)) return json({ error: 'bad_request' }, 400);
  const st = store(), key = await spaceKey(code), doc = await st.get(key, { type: 'json' });
  if (!doc) return json({ error: 'not_found' }, 404);
  const role = tok ? ((await inviteByTok(doc, code, tok)) ? 'viewer' : null) : roleOf(doc, await pinHash(code, pin));
  if (!role) return json({ error: 'wrong_pin' }, 401);
  const me = await identify(doc, role, code, { dev, who, ppin, tok });
  if (!me) return json({ error: 'need_identity' }, 403);

  if (action === 'turn') {   // optional relay servers for strict networks: set TURN_URLS (comma list), TURN_USER, TURN_CRED in Netlify
    const urls = (process.env.TURN_URLS || '').split(',').map(s => s.trim()).filter(Boolean);
    return json({ ice: urls.length ? [{ urls, username: process.env.TURN_USER || '', credential: process.env.TURN_CRED || '' }] : [] });
  }

  const k = ck(key), mine = aliases(doc, me);
  for (let attempt = 0; attempt < 4; attempt++) {
    const cur = await st.getWithMetadata(k, { type: 'json' });
    let c = cur ? cur.data : null;
    if (c && (c.state === 'ended' && Date.now() - c.t > 15e3 || (c.state === 'ringing' && Date.now() - c.t > RING_MS + 5e3))) c = null;
    const write = async nc => {
      const res = await st.setJSON(k, nc, cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
      return !(res && res.modified === false);
    };
    const inCall = c && (mine.has(c.from) || mine.has(c.to));
    const side = c && (mine.has(c.from) ? 'a' : 'b');
    const view = x => ({ id: x.id, state: x.state, kind: x.kind, fromName: x.fromName, answer: x.answer || null, ice: x.ice, t: x.t });

    if (action === 'start') {
      if (typeof to !== 'string' || !/^[a-f0-9]{16}$/.test(to) || mine.has(to) || typeof offer !== 'string' || offer.length > 20000) return json({ error: 'bad_request' }, 400);
      if (c && c.state !== 'ended' && !(mine.has(c.from))) return json({ error: 'busy' }, 409);
      const member = Object.values(doc.recs).find(x => x.id === 'mb_' + me && !x.del);
      const nid = crypto.randomUUID().slice(0, 12);
      const nc = { id: nid, from: me, to, kind: kind === 'video' ? 'video' : 'voice', fromName: (member && member.name) || 'Someone', offer, answer: null, state: 'ringing', t: Date.now(), ice: { a: [], b: [] } };
      if (!await write(nc)) continue;
      const toAll = aliases(doc, to);
      await Promise.race([Promise.all([...toAll].map(t => pushSpace(key, { title: (nc.kind === 'video' ? '🎥 ' : '📞 ') + nc.fromName + ' is calling', body: 'Open Steady to answer', tag: 'crit-call', url: '/' }, { onlyMe: t }).catch(() => null))), new Promise(r => setTimeout(r, 2500))]);
      return json({ ok: true, id: nid });
    }
    if (action === 'poll') {
      if (!c) return json({ ok: true, call: null });
      if (!inCall) return json({ ok: true, call: null });
      if (id && c.id !== id) return json({ ok: true, call: null });
      if (!id) {   // idle phone asking "is someone ringing me?"
        if (c.state !== 'ringing' || mine.has(c.from) || Date.now() - c.t > RING_MS) return json({ ok: true, call: null });
        return json({ ok: true, call: { id: c.id, kind: c.kind, fromName: c.fromName, offer: c.offer, state: c.state } });
      }
      if (c.state === 'ringing' && Date.now() - c.t > RING_MS) { c.state = 'ended'; c.t = Date.now(); c.why = 'noanswer'; await write(c); return json({ ok: true, call: { ...view(c), why: 'noanswer' } }); }
      return json({ ok: true, call: { ...view(c), why: c.why || '' } });
    }
    if (!c || !inCall || c.id !== id) return json({ error: 'no_call' }, 404);
    if (action === 'answer') {
      if (side !== 'b' || typeof answer !== 'string' || answer.length > 20000 || c.state !== 'ringing') return json({ error: 'bad_request' }, 400);
      c.answer = answer; c.state = 'active'; c.t = Date.now();
    } else if (action === 'ice') {
      if (typeof cand !== 'string' || cand.length > 1500 || c.ice[side].length >= 80) return json({ ok: true });
      c.ice[side].push(cand);
    } else if (action === 'end') {
      c.state = 'ended'; c.t = Date.now(); c.why = c.why || (side === 'a' && !c.answer ? 'cancelled' : (!c.answer ? 'declined' : 'hangup'));
    } else return json({ error: 'bad_request' }, 400);
    if (!await write(c)) continue;
    return json({ ok: true });
  }
  return json({ error: 'busy' }, 409);
};
export const config = { path: '/api/call' };
