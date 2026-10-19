// POST /api/otp — sign in with an email one-time code (the owner invites people by email first).
//  {action:'start',  email}        -> emails a 6-digit code (always answers ok, so addresses can't be probed)
//  {action:'verify', email, otp}   -> {ok, code, tok, name}: a per-device token that signs this person in as view-only family
import { json, store, spaceKey, sha, sendMail, escHtml, validEmail, siteUrl, ehash } from './_lib/common.mjs';

const done = (o, st = 200) => { console.log('otp', JSON.stringify({ ok: o.ok, error: o.error })); return json(o, st); };
const rnd = n => [...crypto.getRandomValues(new Uint8Array(n))].map(x => x.toString(16).padStart(2, '0')).join('');

export default async (req) => {
  if (req.method !== 'POST') return done({ error: 'POST only' }, 405);
  let b; try { b = await req.json(); } catch { return done({ error: 'bad_json' }, 400); }
  const { action, otp } = b || {}, email = String((b && b.email) || '').trim().toLowerCase();
  if (!validEmail(email)) return done({ error: 'bad_request' }, 400);
  const st = store(), eh = await ehash(email), ik = 'mail/' + eh, ok = 'otp/' + eh;
  const ix = await st.get(ik, { type: 'json' });

  if (action === 'start') {
    if (!ix || !ix.codes?.length) return done({ ok: true });
    const rec = (await st.get(ok, { type: 'json' })) || {};
    if (Date.now() - (rec.at || 0) < 45e3) return done({ ok: true });
    const c = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
    await st.setJSON(ok, { at: Date.now(), h: await sha('otp:' + eh + ':' + c), exp: Date.now() + 15 * 60e3, tries: 0 });
    const link = siteUrl();
    const html = `<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:480px;margin:auto"><h2 style="margin:0 0 8px">Your Steady sign-in code</h2><p style="color:#555">Enter this code in Steady within 15 minutes:</p><p style="font-size:34px;letter-spacing:8px;font-weight:800;margin:10px 0">${c}</p><p style="color:#555">If you didn’t ask for this, ignore this email.</p>${link ? `<p style="color:#888;font-size:12px">${escHtml(link)}</p>` : ''}</div>`;
    await sendMail({ to: [email], subject: `Steady sign-in code: ${c}`, html, text: `Your Steady sign-in code is ${c} (valid 15 minutes). Ignore this if you didn't ask for it.` });
    return done({ ok: true });
  }

  if (action === 'verify') {
    if (!ix || !/^\d{6}$/.test(String(otp || ''))) return done({ error: 'bad_code' }, 400);
    const rec = await st.get(ok, { type: 'json' });
    if (!rec || Date.now() > rec.exp || rec.tries >= 5) return done({ error: 'bad_code' }, 400);
    if (rec.h !== await sha('otp:' + eh + ':' + otp)) { rec.tries++; await st.setJSON(ok, rec); return done({ error: 'bad_code' }, 400); }
    for (const code of ix.codes) {
      const key = await spaceKey(code);
      for (let i = 0; i < 4; i++) {
        const cur = await st.getWithMetadata(key, { type: 'json' });
        const d = cur && cur.data, iv = d && d.invites && d.invites[eh];
        if (!iv) break;
        const tok = rnd(16);
        iv.th = [...(iv.th || []), await sha('t:' + code + ':' + tok)].slice(-6);   // up to 6 signed-in devices per person
        const res = await st.setJSON(key, d, { onlyIfMatch: cur.etag });
        if (res && res.modified === false) continue;
        await st.delete(ok);
        return done({ ok: true, code, tok, name: iv.name });
      }
    }
    return done({ error: 'bad_code' }, 400);
  }
  return done({ error: 'bad_request' }, 400);
};
export const config = { path: '/api/otp' };
