// Scheduled every 15 min. (1) emails her due reminders when the app is closed, (2) alerts family if no sugar check for too long.
import { store, stateKey, sast, sendMail, siteUrl, escHtml, validEmail } from './_lib/common.mjs';

export default async () => {
  const st = store(), { blobs } = await st.list({ prefix: 'space/' });
  const now = sast(), link = siteUrl();
  let sent = 0;

  for (const { key } of blobs) {
    try {
      const doc = await st.get(key, { type: 'json' });
      const s = doc?.recs?.settings; if (!s) continue;
      const sk = stateKey(key), state = (await st.get(sk, { type: 'json' })) || {};
      state.sent = state.sent || {};
      let dirty = false;

      // 1) reminders -> her email
      if (s.email_reminders !== false && validEmail(s.my_email)) {
        const due = (s.reminders || []).filter(r => {
          if (!r.on || !/^\d\d:\d\d$/.test(r.t || '')) return false;
          const m = +r.t.slice(0, 2) * 60 + +r.t.slice(3, 5);
          return now.mins >= m && now.mins < m + 15 && !state.sent[r.id + '|' + now.date];
        });
        if (due.length) {
          const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto"><h2>⏰ ${due.map(r => escHtml(r.l)).join(' · ')}</h2><p>A gentle nudge from Steady.</p>${link ? `<p><a href="${escHtml(link)}" style="background:#0F5A50;color:#fff;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:700">Open Steady</a></p>` : ''}</div>`;
          const r = await sendMail({ to: [s.my_email], subject: `⏰ ${due[0].l}${due.length > 1 ? ' +' + (due.length - 1) : ''}`, html, text: due.map(x => x.l).join(', ') });
          if (r.ok) { due.forEach(x => state.sent[x.id + '|' + now.date] = 1); dirty = true; sent++; }
        }
      }

      // 2) missed-check alert -> family
      const carers = (s.carers || []).filter(validEmail).slice(0, 5);
      if (s.email_alerts !== false && carers.length && now.h >= 8 && now.h <= 20) {
        const lastTs = Math.max(0, ...Object.values(doc.recs).filter(r => r.type === 'glucose' && !r.del).map(r => r.ts || 0));
        const hrs = lastTs ? (Date.now() - lastTs) / 36e5 : null;
        const limit = +s.miss_hours || 8;
        if (hrs !== null && hrs >= limit && Date.now() - (state.missAt || 0) > 6 * 36e5) {
          const name = s.name || 'She';
          const r = await sendMail({ to: carers, subject: `⏰ No sugar check from ${name} for ${Math.floor(hrs)}h`,
            html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto"><h2>No sugar reading for ${Math.floor(hrs)} hours</h2><p>${escHtml(name)} hasn't logged a reading since this morning's check. A friendly call or message might help.</p>${link ? `<p><a href="${escHtml(link)}">Open Steady</a></p>` : ''}</div>`,
            text: `${name} has not logged a sugar reading for ${Math.floor(hrs)} hours.` });
          if (r.ok) { state.missAt = Date.now(); dirty = true; sent++; }
        }
      }

      // prune old "sent" markers
      for (const k of Object.keys(state.sent)) if (!k.endsWith(now.date)) { delete state.sent[k]; dirty = true; }
      if (dirty) await st.setJSON(sk, state);
    } catch (e) { console.error('reminders error', key, e?.message); }
  }
  console.log('reminders done, emails sent:', sent);
};

export const config = { schedule: '*/15 * * * *' };
