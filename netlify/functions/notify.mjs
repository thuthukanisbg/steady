// POST /api/notify — emails the family when a reading is low / very low / very high.
// Recipients are read from the *synced settings* (never from the request) so this can't be used as an open mail relay.
import { json, store, spaceKey, stateKey, pinHash, validCreds, status, LABEL, fmt, sast, sendMail, siteUrl, escHtml, recipients } from './_lib/common.mjs';

const TIPS = {
  'crit-low': 'Give 15–20 g fast sugar (½ cup juice / regular cooldrink / 3–4 glucose tablets) and recheck in 15 minutes. If drowsy, confused or unresponsive call 10177 / 112 — nothing in the mouth, recovery position.',
  low: 'Give 15 g fast sugar (½ cup juice / regular cooldrink / 3–4 glucose tablets), recheck in 15 minutes, repeat if still low.',
  'crit-high': 'Water, no exercise if unwell, check ketones if available and follow the sick-day plan. Emergency care for vomiting, stomach pain, fast breathing, fruity breath or drowsiness.'
};

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const { code, pin, v, ts, ctx = '', by = '' } = b || {};
  if (!validCreds(code, pin) || typeof v !== 'number' || !(v > 0 && v < 50)) return json({ error: 'bad_request' }, 400);

  const st = store(), key = await spaceKey(code);
  const doc = await st.get(key, { type: 'json' });
  if (!doc) return json({ error: 'not_found' }, 404);
  if (doc.pin !== await pinHash(code, pin)) return json({ error: 'wrong_pin' }, 401);

  const s = doc.recs?.settings || {};
  if (s.email_alerts === false) return json({ ok: true, sent: 0, reason: 'alerts_off' });
  const level = status(v, s);
  if (level === 'ok' || level === 'high') return json({ ok: true, sent: 0, reason: 'not_alert_worthy' });
  const to = recipients(doc).map(x => x.email);
  if (!to.length) return json({ ok: true, sent: 0, reason: 'no_recipients' });

  // rate limit: one email per level per 30 minutes
  const sk = stateKey(key), state = (await st.get(sk, { type: 'json' })) || {};
  const last = state.alert?.[level] || 0;
  if (Date.now() - last < 30 * 60e3) return json({ ok: true, sent: 0, reason: 'rate_limited' });

  const name = s.name || 'She';
  const when = sast(typeof ts === 'number' ? ts : Date.now());
  const subject = `${level.includes('crit') ? '🚨' : '⚠️'} ${name}'s sugar is ${LABEL[level]} (${v.toFixed(1)})`;
  const link = siteUrl();
  const html = `<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:520px;margin:auto">
    <h2 style="margin:0 0 8px">${escHtml(name)}'s sugar is ${LABEL[level]}</h2>
    <p style="font-size:28px;margin:6px 0"><b>${escHtml(fmt(v))}</b></p>
    <p style="color:#555;margin:0 0 14px">Logged at ${String(when.h).padStart(2, '0')}:${String(when.m).padStart(2, '0')}${ctx ? ' · ' + escHtml(ctx) : ''}${by ? ' · by ' + escHtml(by) : ''}</p>
    <div style="background:#fff1f1;border:1px solid #f4b4bb;border-radius:12px;padding:12px 14px"><b>What to do</b><br>${escHtml(TIPS[level])}</div>
    ${link ? `<p><a href="${escHtml(link)}" style="display:inline-block;background:#0F5A50;color:#fff;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:700">Open Steady</a></p>` : ''}
    <p style="color:#888;font-size:12px">General guidance only — follow her doctor's plan. Emergency: 10177 / 112.</p></div>`;
  const text = `${name}'s sugar is ${LABEL[level]}: ${fmt(v)}.\n${TIPS[level]}\nEmergency: 10177 / 112.`;

  const r = await sendMail({ to, subject, html, text });
  if (r.ok) { state.alert = { ...(state.alert || {}), [level]: Date.now() }; await st.setJSON(sk, state); }
  return json({ ok: r.ok, sent: r.ok ? to.length : 0, reason: r.reason });
};

export const config = { path: '/api/notify' };
