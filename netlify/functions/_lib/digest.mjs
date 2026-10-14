// Morning "how is she doing" email: yesterday's numbers + simple bar charts built from HTML tables (works in Gmail/Outlook, no images).
import { status, sast, escHtml, siteUrl } from './common.mjs';

const COL = { 'crit-low': '#B3261E', low: '#E0752B', ok: '#2E9A6B', high: '#E0A82B', 'crit-high': '#B3261E' };
const MG = 18.016;
const day = ts => sast(ts).date;
const hhmm = ts => { const x = sast(ts); return String(x.h).padStart(2, '0') + ':' + String(x.m).padStart(2, '0'); };
const addDays = (date, n) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const mmol = v => v.toFixed(1);

export function buildDigest(doc, s, todayDate, greetName) {
  const recs = Object.values(doc.recs || {}).filter(r => !r.del);
  const yd = addDays(todayDate, -1), name = s.name || 'She', link = siteUrl();
  const on = (type, d) => recs.filter(r => r.type === type && day(r.ts) === d).sort((a, b) => a.ts - b.ts);
  const g = on('glucose', yd).filter(r => typeof r.v === 'number');
  const vals = g.map(r => r.v), st = vals.map(v => status(v, s));
  const inr = st.filter(x => x === 'ok').length;
  const tir = vals.length ? Math.round(inr / vals.length * 100) : null;
  const lows = st.filter(x => x === 'low' || x === 'crit-low').length, highs = st.filter(x => x === 'high' || x === 'crit-high').length;
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  const mn = vals.length ? Math.min(...vals) : null, mx = vals.length ? Math.max(...vals) : null;

  const ins = on('insulin', yd), meals = on('meal', yd), walks = on('walk', yd), treats = on('treat', yd);
  const insBy = {}; ins.forEach(r => { const k = r.name || 'Insulin'; (insBy[k] = insBy[k] || { n: 0, u: 0 }); insBy[k].n++; insBy[k].u += +r.units || 0; });
  const carbs = meals.reduce((a, r) => a + (+r.carbs || 0), 0), walkMin = walks.reduce((a, r) => a + (+r.min || 0), 0);
  const mood = on('mood', yd).slice(-1)[0];

  // headline
  let head, tone;
  if (!g.length) { head = `No sugar readings were logged yesterday`; tone = '#E0752B'; }
  else if (lows || st.includes('crit-high')) { head = `A bumpy day — ${lows ? lows + ' low reading' + (lows > 1 ? 's' : '') : 'a very high reading'}`; tone = '#E0752B'; }
  else if (tir >= 70) { head = `A steady day — ${tir}% of readings in range`; tone = '#2E9A6B'; }
  else { head = `${tir}% of readings in range yesterday`; tone = '#E0A82B'; }

  // chart 1: yesterday's readings (up to 14), table bars
  const shown = g.slice(-14), TOP = 20, H = 110;
  const bars = shown.map(r => {
    const h = Math.max(6, Math.round(Math.min(r.v, TOP) / TOP * H)), c = COL[status(r.v, s)];
    return `<td valign="bottom" align="center" style="padding:0 2px;font-size:11px;color:#444"><div style="font-weight:700;margin-bottom:2px">${mmol(r.v)}</div><div style="height:${h}px;background:${c};border-radius:5px 5px 0 0"></div></td>`;
  }).join('');
  const labels = shown.map(r => `<td align="center" style="font-size:10px;color:#777;padding-top:3px">${hhmm(r.ts)}</td>`).join('');
  const chart1 = shown.length ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed;margin-top:8px"><tr style="height:${H + 22}px">${bars}</tr><tr>${labels}</tr></table>
    <div style="font-size:11px;color:#777;margin-top:6px">Target ${mmol(s.low ?? 3.9)}–${mmol(s.high ?? 10)} mmol/L &nbsp;·&nbsp; <span style="color:${COL.ok}">■</span> in range <span style="color:${COL.high}">■</span> high <span style="color:${COL.low}">■</span> low</div>` : '';

  // chart 2: last 7 days time-in-range
  const days = Array.from({ length: 7 }, (_, i) => addDays(todayDate, i - 7));
  const wk = days.map(d => { const gv = recs.filter(r => r.type === 'glucose' && typeof r.v === 'number' && day(r.ts) === d).map(r => r.v); const p = gv.length ? Math.round(gv.filter(v => status(v, s) === 'ok').length / gv.length * 100) : null; return { d, p, n: gv.length }; });
  const wd = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-ZA', { weekday: 'short', timeZone: 'UTC' });
  const wkRows = wk.map(x => `<tr><td style="width:42px;font-size:12px;color:#555;padding:3px 0">${wd(x.d)}</td><td style="padding:3px 0"><div style="background:#eef2f1;border-radius:6px;height:14px"><div style="width:${x.p ?? 0}%;background:${x.p == null ? '#eef2f1' : x.p >= 70 ? COL.ok : x.p >= 50 ? COL.high : COL.low};height:14px;border-radius:6px"></div></div></td><td style="width:78px;text-align:right;font-size:12px;color:#555;padding:3px 0">${x.p == null ? 'no data' : x.p + '% · ' + x.n}</td></tr>`).join('');
  const wkVals = wk.filter(x => x.p != null), wkAvg = wkVals.length ? Math.round(wkVals.reduce((a, b) => a + b.p, 0) / wkVals.length) : null;

  const stat = (l, v) => `<td style="padding:10px 6px;text-align:center;background:#f4f8f7;border-radius:10px"><div style="font-size:18px;font-weight:800;color:#0F3F38">${v}</div><div style="font-size:11px;color:#667">${l}</div></td><td style="width:6px"></td>`;
  const insLine = Object.keys(insBy).length ? Object.entries(insBy).map(([k, v]) => `${escHtml(k)} ×${v.n}${v.u ? ' (' + v.u + ' u)' : ''}`).join(', ') : 'none logged';
  const noteLines = [];
  if (lows) noteLines.push(`${lows} low reading${lows > 1 ? 's' : ''} — lowest ${mmol(mn)} mmol/L.`);
  if (st.includes('crit-high')) noteLines.push(`A very high reading of ${mmol(mx)} mmol/L.`);
  if (g.length && g.length < 3) noteLines.push('Fewer than 3 checks — a gentle nudge to test more today could help.');
  if (treats.length) noteLines.push(`${treats.length} treat${treats.length > 1 ? 's' : ''} logged: ${treats.map(r => escHtml(r.what || 'treat')).join(', ')}.`);
  if (walkMin >= (+s.walk_goal || 20)) noteLines.push(`Walk goal met — ${walkMin} min. 🌿`);
  else if (!walkMin) noteLines.push('No walk logged yesterday.');
  if (mood?.mood) noteLines.push(`Mood: ${escHtml(String(mood.mood))}${mood.sleep ? ' · slept ' + mood.sleep + 'h' : ''}.`);

  const html = `<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:560px;margin:auto;color:#12302b">
  <div style="font-size:12px;color:#667;letter-spacing:.06em;text-transform:uppercase">Good morning${greetName ? ', ' + escHtml(greetName) : ''}</div>
  <h2 style="margin:4px 0 2px;font-size:22px">How ${escHtml(name)} is doing</h2>
  <div style="display:inline-block;margin:6px 0 12px;padding:6px 12px;border-radius:999px;background:${tone};color:#fff;font-weight:700;font-size:14px">${escHtml(head)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${stat('Readings', g.length)}${stat('In range', tir == null ? '–' : tir + '%')}${stat('Average', avg == null ? '–' : mmol(avg))}${stat('Low / High', lows + ' / ' + highs)}</tr></table>
  <h3 style="margin:18px 0 0;font-size:15px">Yesterday’s readings <span style="font-weight:400;color:#777;font-size:12px">(mmol/L)</span></h3>
  ${chart1 || '<p style="color:#777;font-size:13px">Nothing logged.</p>'}
  <h3 style="margin:20px 0 4px;font-size:15px">Last 7 days — time in range${wkAvg != null ? ` <span style="font-weight:400;color:#777;font-size:12px">(avg ${wkAvg}%)</span>` : ''}</h3>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${wkRows}</table>
  <h3 style="margin:20px 0 6px;font-size:15px">The day in short</h3>
  <div style="font-size:14px;line-height:1.6">💉 Insulin: ${insLine}<br>🍽️ Meals: ${meals.length}${carbs ? ' · ' + carbs + ' g carbs' : ''}<br>🚶 Walks: ${walkMin ? walkMin + ' min' : 'none'}<br>🍬 Treats: ${treats.length}</div>
  ${noteLines.length ? `<div style="margin-top:12px;background:#fff8ec;border:1px solid #f0d9a8;border-radius:12px;padding:10px 14px;font-size:14px"><b>Worth knowing</b><br>${noteLines.join('<br>')}</div>` : ''}
  ${link ? `<p style="margin-top:18px"><a href="${escHtml(link)}" style="display:inline-block;background:#0F5A50;color:#fff;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:700">Open Steady</a></p>` : ''}
  <p style="color:#888;font-size:12px">You get this because you’re in ${escHtml(name)}’s family circle. General information only — follow her doctor’s plan. Emergency: 10177 / 112.</p></div>`;
  const text = `How ${name} is doing — ${head}\nReadings: ${g.length}, in range: ${tir == null ? '-' : tir + '%'}, average: ${avg == null ? '-' : mmol(avg)} mmol/L, lows: ${lows}, highs: ${highs}.\nWalks: ${walkMin} min, treats: ${treats.length}.${link ? '\n' + link : ''}`;
  return { subject: `☀️ How ${name} is doing — ${head}`, html, text, yd };
}
