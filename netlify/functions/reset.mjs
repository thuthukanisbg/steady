// POST /api/reset — forgot-PIN by email.
//  {action:'request', code, kind:'owner'|'family', name?}  -> emails a 6-digit code (always answers ok, so codes can't be probed)
//  {action:'confirm', code, kind, name?, rcode, newPin}     -> sets the new PIN
// owner  : code goes to the recovery email (settings.recovery_email), else her email (settings.my_email); sets HER main PIN and logs every device out
// family : code goes to the email saved for that name under Notifications (else to her email); sets that person's own PIN
import { json, store, spaceKey, stateKey, sha, pinHash, sendMail, escHtml, validEmail, siteUrl } from './_lib/common.mjs';

const nkey = n => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40);
const rkey = key => 'reset/' + key.slice(6);
const done = (o, st = 200) => { console.log('reset', JSON.stringify({ ok: o.ok, error: o.error })); return json(o, st); };

export default async (req) => {
  if (req.method !== 'POST') return done({ error: 'POST only' }, 405);
  let b; try { b = await req.json(); } catch { return done({ error: 'bad_json' }, 400); }
  const { action, code, kind, name, rcode, newPin } = b || {};
  if (typeof code !== 'string' || code.length < 8 || code.length > 40 || !['owner', 'family'].includes(kind)) return done({ error: 'bad_request' }, 400);
  const st = store(), key = await spaceKey(code), rk = rkey(key);
  const doc = await st.get(key, { type: 'json' });
  const nk = nkey(name);
  if (kind === 'family' && !nk) return done({ error: 'bad_request' }, 400);

  if (action === 'request') {
    if (!doc) return done({ ok: true });                                   // same answer whether or not the space exists
    const rec = (await st.get(rk, { type: 'json' })) || {};
    if (Date.now() - (rec.at || 0) < 60e3) return done({ ok: true });      // 1 per minute
    const s = doc.recs?.settings || {};
    let to = '';
    if (kind === 'family') {
      const own = doc.people?.[nk]?.email;
      const f = validEmail(own) ? { email: own } : Object.values(doc.recs).find(r => r.type === 'follower' && !r.del && nkey(r.name) === nk && validEmail(r.email));
      to = f ? f.email : (validEmail(s.my_email) ? s.my_email : '');
    } else to = validEmail(s.recovery_email) ? s.recovery_email : (validEmail(s.my_email) ? s.my_email : '');
    if (!to) return done({ ok: true });
    const c = String(100000 + Math.floor(Math.random() * 900000));
    await st.setJSON(rk, { at: Date.now(), kind, nk, h: await sha('r:' + code + ':' + c), exp: Date.now() + 15 * 60e3, tries: 0 });
    const who = kind === 'owner' ? 'her main PIN' : `the personal PIN for “${escHtml(String(name).trim().slice(0, 40))}”`;
    const link = siteUrl();
    const html = `<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:480px;margin:auto"><h2 style="margin:0 0 8px">Reset ${who}</h2><p style="color:#555">Use this code in Steady within 15 minutes:</p><p style="font-size:34px;letter-spacing:8px;font-weight:800;margin:10px 0">${c}</p><p style="color:#555">If you didn’t ask for this, ignore this email — nothing changes unless the code is used.</p>${link ? `<p style="color:#888;font-size:12px">${escHtml(link)}</p>` : ''}</div>`;
    await sendMail({ to: [to], subject: `Steady reset code: ${c}`, html, text: `Your Steady reset code is ${c} (valid 15 minutes). Ignore this if you didn't ask for it.` });
    return done({ ok: true });
  }

  if (action === 'confirm') {
    if (!doc || !/^\d{4,8}$/.test(String(newPin || '')) || !/^\d{6}$/.test(String(rcode || ''))) return done({ error: 'bad_code' }, 400);
    const rec = await st.get(rk, { type: 'json' });
    if (!rec || rec.kind !== kind || rec.nk !== nk || Date.now() > rec.exp || rec.tries >= 5) return done({ error: 'bad_code' }, 400);
    if (rec.h !== await sha('r:' + code + ':' + rcode)) { rec.tries++; await st.setJSON(rk, rec); return done({ error: 'bad_code' }, 400); }
    for (let i = 0; i < 4; i++) {
      const cur = await st.getWithMetadata(key, { type: 'json' }), d = cur.data;
      if (kind === 'owner') {
        const nh = await pinHash(code, String(newPin));
        if (nh === d.vpin) return done({ error: 'same_pin' }, 400);
        d.pin = nh; d.epoch = (d.epoch || 0) + 1;                            // every device must log in again
      } else {
        d.people = d.people || {};
        d.people[nk] = { h: await sha('q:' + code + ':' + nk + ':' + newPin), name: (d.people[nk]?.name || String(name).trim()).slice(0, 40) };
      }
      const res = await st.setJSON(key, d, { onlyIfMatch: cur.etag });
      if (res && res.modified === false) continue;
      await st.delete(rk);
      return done({ ok: true });
    }
    return done({ error: 'busy' }, 409);
  }
  return done({ error: 'bad_request' }, 400);
};

export const config = { path: '/api/reset' };
