// POST /api/sos — her HELP button. Emails the family at once with a map link (if she allowed location) and a call link.
// Only her PIN can trigger it; recipients come from the synced settings (never from the request).
import { json, store, spaceKey, stateKey, pinHash, validCreds, sast, sendMail, siteUrl, escHtml, recipients } from './_lib/common.mjs';
import { pushSpace } from './_lib/push.mjs';

const done = (o, st) => { console.log('sos', JSON.stringify({ ok: o.ok, sent: o.sent, error: o.error, reason: o.reason })); return json(o, st); };

export default async (req) => {
  if (req.method !== 'POST') return done({ error: 'POST only' }, 405);
  let b; try { b = await req.json(); } catch { return done({ error: 'bad_json' }, 400); }
  const { code, pin, lat, lng, acc, ep } = b || {};
  if (!validCreds(code, pin)) return done({ error: 'bad_request' }, 400);
  const st = store(), key = await spaceKey(code);
  const doc = await st.get(key, { type: 'json' });
  if (!doc) return done({ error: 'not_found' }, 404);
  if (doc.pin !== await pinHash(code, pin)) return done({ error: 'wrong_pin' }, 401);   // owner only

  // one alert per minute, but never block a genuine repeat press for long
  const sk = stateKey(key), state = (await st.get(sk, { type: 'json' })) || {};
  if (Date.now() - (state.sos || 0) < 60e3) return done({ ok: true, sent: 0, reason: 'rate_limited' });
  const pnm = doc.recs?.settings?.name || 'She';
  const pr = await pushSpace(key, { title: `🆘 ${pnm} needs help`, body: 'Open Steady — call her now', tag: 'sos', url: '/' }, { skipEp: typeof ep === 'string' ? ep : '' }).catch(() => ({ sent: 0 }));
  const to = recipients(doc).map(x => x.email);
  if (!to.length) { if (pr.sent) { state.sos = Date.now(); await st.setJSON(sk, state); } return done({ ok: pr.sent > 0, sent: 0, pushed: pr.sent, reason: pr.sent ? 'push_only' : 'no_recipients' }); }

  const s = doc.recs?.settings || {}, name = s.name || 'She';
  const hasPos = typeof lat === 'number' && typeof lng === 'number' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const map = hasPos ? `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}` : '';
  const phone = String(s.phone || '').replace(/[^\d+]/g, '').slice(0, 16);
  const when = sast(), t = `${String(when.h).padStart(2, '0')}:${String(when.m).padStart(2, '0')}`;
  const accTxt = hasPos && typeof acc === 'number' ? ` (accurate to about ${Math.round(acc)} m)` : '';
  const btn = (href, label, bg) => `<a href="${escHtml(href)}" style="display:inline-block;background:${bg};color:#fff;padding:14px 20px;border-radius:12px;text-decoration:none;font-weight:700;margin:4px 6px 4px 0">${label}</a>`;
  const link = siteUrl();
  const html = `<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:520px;margin:auto">
    <h2 style="margin:0 0 8px;color:#c0392b">🆘 ${escHtml(name)} pressed the HELP button</h2>
    <p style="margin:0 0 14px;color:#555">At ${t}. Try to reach her now.${hasPos ? '' : ' Location was not available.'}</p>
    <div>${phone ? btn('tel:' + phone, '📞 Call ' + escHtml(name), '#c0392b') : ''}${map ? btn(map, '📍 Open her location', '#0F5A50') : ''}${link ? btn(link, 'Open Steady', '#555') : ''}</div>
    ${hasPos ? `<p style="color:#555;font-size:13px">Location${accTxt}: ${escHtml(map)}</p>` : ''}
    <div style="background:#fff1f1;border:1px solid #f4b4bb;border-radius:12px;padding:12px 14px;margin-top:10px"><b>If you can't reach her</b><br>Go to her or send someone. For fainting, confusion or unresponsiveness call <b>10177</b> / <b>112</b>. If she's awake and able to swallow, give 15 g fast sugar.</div>
    <p style="color:#888;font-size:12px">Sent by Steady because she pressed her help button. Emergency: 10177 / 112.</p></div>`;
  const text = `🆘 ${name} pressed the HELP button at ${t}.${phone ? '\nCall: ' + phone : ''}${map ? '\nLocation: ' + map : ''}\nIf you cannot reach her, go to her or call 10177 / 112.`;
  const r = await sendMail({ to, subject: `🆘 ${name} needs help — please call her now`, html, text });
  if (r.ok || pr.sent) { state.sos = Date.now(); await st.setJSON(sk, state); }
  return done({ ok: r.ok || pr.sent > 0, sent: r.ok ? to.length : 0, pushed: pr.sent, reason: r.reason });
};

export const config = { path: '/api/sos' };
