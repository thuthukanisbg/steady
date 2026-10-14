// Web Push without extra dependencies: payload-less pushes signed with VAPID (ES256).
// The service worker wakes up, asks /api/push?p=<hash> what to show, and displays it.
import { store, sha } from './common.mjs';

const b64u = buf => Buffer.from(buf).toString('base64url');
const fromB64u = s => Buffer.from(s, 'base64url');

export async function vapid() {
  const st = store();
  let j = await st.get('vapid', { type: 'json' });
  if (!j) {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
    j = { d: jwk.d, x: jwk.x, y: jwk.y };
    await st.setJSON('vapid', j, { onlyIfNew: true });
    j = (await st.get('vapid', { type: 'json' })) || j;
  }
  const pub = b64u(Buffer.concat([Buffer.from([4]), fromB64u(j.x), fromB64u(j.y)]));
  return { jwk: j, pub };
}

async function jwtFor(endpoint, v) {
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:alerts@steady.hourglasssolutions.co.za' }));
  const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d: v.jwk.d, x: v.jwk.x, y: v.jwk.y, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(head + '.' + body));
  return head + '.' + body + '.' + b64u(sig);
}

export const subsKey = spaceKey => 'push/' + spaceKey.slice(6);

/** send a notification to every subscribed device in a space whose role is in `roles` */
export async function pushSpace(spaceKey, msg, opts = {}) {
  const { skipEp = '', skipMe = '', onlyMe = '' } = Array.isArray(opts) ? {} : opts;
  const roles = Array.isArray(opts) ? opts : (opts.roles || ['viewer', 'owner']);
  const st = store(), rec = await st.get(subsKey(spaceKey), { type: 'json' });
  if (!rec || !rec.subs?.length) return { sent: 0, failed: 0 };
  const v = await vapid(); let sent = 0, failed = 0; const keep = [];
  for (const s of rec.subs) {
    if (!roles.includes(s.role) || s.sub.endpoint === skipEp || (skipMe && s.me === skipMe) || (onlyMe && s.me !== onlyMe)) { keep.push(s); continue; }
    try {
      const h = (await sha(s.sub.endpoint)).slice(0, 40);
      await st.setJSON('pushmsg/' + h, { ...msg, t: Date.now() });
      const r = await fetch(s.sub.endpoint, { method: 'POST', headers: { Authorization: `vapid t=${await jwtFor(s.sub.endpoint, v)}, k=${v.pub}`, TTL: '3600', Urgency: 'high', 'Content-Length': '0' } });
      if (r.status === 404 || r.status === 410) { failed++; continue; }   // subscription gone — drop it
      if (r.ok) sent++; else failed++;
      keep.push(s);
    } catch { failed++; keep.push(s); }
  }
  if (keep.length !== rec.subs.length) await st.setJSON(subsKey(spaceKey), { subs: keep });
  return { sent, failed };
}
