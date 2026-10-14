import { getStore } from '@netlify/blobs';

const enc = new TextEncoder();
export async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export const store = () => getStore({ name: 'steady', consistency: 'strong' });
export const spaceKey = async code => 'space/' + (await sha('c:' + code)).slice(0, 40);
export const stateKey = key => 'state/' + key.slice(6);
export const pinHash = (code, pin) => sha('p:' + code + ':' + pin);

export function validCreds(code, pin) {
  return typeof code === 'string' && code.length >= 8 && code.length <= 40 &&
         typeof pin === 'string' && /^\d{4,8}$/.test(pin);
}

/* ---- glucose helpers (mirrors the app) ---- */
export const DEF = { crit_low: 3.0, low: 3.9, high: 10.0, crit_high: 13.9, miss_hours: 8 };
export function status(v, s) {
  const c = { ...DEF, ...s };
  if (v < c.crit_low) return 'crit-low';
  if (v < c.low) return 'low';
  if (v <= c.high) return 'ok';
  if (v <= c.crit_high) return 'high';
  return 'crit-high';
}
export const LABEL = { 'crit-low': 'VERY LOW', low: 'LOW', ok: 'in range', high: 'high', 'crit-high': 'VERY HIGH' };
export const fmt = v => `${v.toFixed(1)} mmol/L (${Math.round(v * 18.016)} mg/dL)`;

/* ---- Africa/Johannesburg clock ---- */
export function sast(ts = Date.now()) {
  const p = new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short'
  }).formatToParts(new Date(ts)).reduce((a, x) => (a[x.type] = x.value, a), {});
  const h = +p.hour % 24, m = +p.minute;
  return { date: `${p.year}-${p.month}-${p.day}`, h, m, mins: h * 60 + m, wd: p.weekday };
}

/* ---- email via Resend ---- */
export async function sendMail({ to, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, reason: 'RESEND_API_KEY not set' };
  const from = process.env.MAIL_FROM || 'Steady <onboarding@resend.dev>';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html, text })
  });
  if (!r.ok) return { ok: false, reason: `Resend ${r.status}: ${(await r.text()).slice(0, 200)}` };
  return { ok: true };
}
export const siteUrl = () => process.env.URL || process.env.DEPLOY_PRIME_URL || '';
export const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const validEmail = e => typeof e === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && e.length < 120;
