/* Steady — core: state, rules, sync, achievements, insights. No DOM rendering here. */
(function(){
'use strict';
const A = window.A = {};
const SD = window.SD;

/* ---------- tiny utils ---------- */
const MIN=6e4, HOUR=36e5, DAY=864e5, MG=18.016;
const esc = s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = ()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const now = ()=>Date.now();
const pad = n=>String(n).padStart(2,'0');
const dayKey = ts=>{const d=new Date(ts);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const startOfDay = ts=>{const d=new Date(ts);d.setHours(0,0,0,0);return d.getTime()};
const addDays = (ts,n)=>{const d=new Date(ts);d.setDate(d.getDate()+n);return d.getTime()};
const hhmm = ts=>{const d=new Date(ts);return pad(d.getHours())+':'+pad(d.getMinutes())};
const toLocalInput = ts=>{const d=new Date(ts);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes())};
const WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function ago(ts){
  const m=Math.max(0,Math.round((now()-ts)/MIN));
  if(m<1) return 'just now'; if(m<60) return m+' min ago';
  const h=Math.floor(m/60), r=m%60; if(h<24) return h+'h'+(r?' '+r+'m':'')+' ago';
  const d=Math.floor(h/24); return d+(d===1?' day':' days')+' ago';
}
function dur(ms){const m=Math.max(0,Math.round(ms/MIN)); if(m<60) return m+' min'; const h=Math.floor(m/60),r=m%60; return h+'h'+(r?' '+r+'m':'');}
function dayLabel(ts){
  const t=startOfDay(now()), s=startOfDay(ts);
  if(s===t) return 'Today'; if(s===addDays(t,-1)) return 'Yesterday';
  const d=new Date(ts); return WD[d.getDay()]+' '+d.getDate()+' '+MON[d.getMonth()];
}
Object.assign(A,{MIN,HOUR,DAY,MG,esc,uid,now,pad,dayKey,startOfDay,addDays,hhmm,toLocalInput,WD,MON,ago,dur,dayLabel});

/* ---------- storage ---------- */
const LS = {
  get(k,d){try{const v=localStorage.getItem('steady.'+k);return v?JSON.parse(v):d}catch(e){return d}},
  set(k,v){try{localStorage.setItem('steady.'+k,JSON.stringify(v));return true}catch(e){return false}}
};
let recs = LS.get('recs',{});
let meta = Object.assign({role:'patient',who:'',code:'',pin:'',seq:0,pending:{},onboarded:false,device:uid(),dev:'',me:'',ro:false,vpin:'',hasFamilyPin:false,fired:{},recheck:0,pause:0,notified:{},installSeen:0},LS.get('meta',{}));
A.meta = meta;
function persist(){LS.set('recs',recs);LS.set('meta',meta)}
A.persist = persist;

/* ---------- settings ---------- */
const DEF = {
  name:'', avatar:'🌸', units:'mmol',
  crit_low:3.0, low:3.9, high:10.0, crit_high:13.9,
  carb_meal:45, carb_snack:15, walk_goal:30, walk_week:150, treats_week:2, stack_hours:3,
  insulins:[{n:'Rapid-acting (mealtime)',c:'rapid'},{n:'Long-acting (basal)',c:'long'}],
  plan_note:'', carers:[], my_email:'', email_alerts:true, email_reminders:true, email_digest:true, miss_hours:8,
  reminders:[
    {id:'r1',l:'Check sugar (fasting)',t:'07:00',k:'sugar',on:true},
    {id:'r2',l:'Breakfast',t:'07:30',k:'meal',on:true},
    {id:'r3',l:'Morning insulin (per plan)',t:'07:30',k:'insulin',on:false},
    {id:'r4',l:'Snack',t:'10:00',k:'meal',on:true},
    {id:'r5',l:'Lunch + check sugar',t:'12:30',k:'meal',on:true},
    {id:'r6',l:'Time for a walk',t:'16:30',k:'walk',on:true},
    {id:'r7',l:'Dinner',t:'18:30',k:'meal',on:true},
    {id:'r8',l:'Evening insulin (per plan)',t:'18:30',k:'insulin',on:false},
    {id:'r9',l:'Bedtime sugar check',t:'21:30',k:'sugar',on:true}
  ]
};
const cfg = ()=>Object.assign({},DEF,recs.settings||{});
function saveSettings(patch){
  if(meta.ro){ if(A.toast) A.toast('View-only — only she can change this'); return; }
  const cur=recs.settings||{id:'settings',type:'settings',ts:0};
  recs.settings=Object.assign({},cur,patch,{id:'settings',type:'settings',u:now(),by:meta.who||'me'});
  meta.pending.settings=1; persist(); A.scheduleSync();
}
Object.assign(A,{cfg,saveSettings,DEF});

/* ---------- records ---------- */
const RO_OK=['note','follower','post','react','msg','member'];
if(!meta.dev){const b=new Uint8Array(12);crypto.getRandomValues(b);meta.dev=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');LS.set('meta',meta);}
function put(r){
  if(meta.ro&&!RO_OK.includes(r.type)){ if(A.toast) A.toast('View-only — family can look but not edit'); return r; }
  r.id=r.id||uid(); r.u=now(); r.ts=r.ts||now();
  r.by=r.by||meta.who||(meta.role==='carer'?'Family':(cfg().name||'Me'));
  if(meta.me) r.a=meta.me;
  recs[r.id]=r; meta.pending[r.id]=1; persist(); A.scheduleSync(); return r;
}
function del(id){
  const r=recs[id]; if(!r) return;
  if(meta.ro&&!RO_OK.includes(r.type)){ if(A.toast) A.toast('View-only — family can look but not edit'); return; }
  if(meta.ro&&(!meta.me||r.a!==meta.me)){ if(A.toast) A.toast('You can only delete what you posted yourself'); return; }
  recs[id]={id,type:r.type,del:1,ts:r.ts,u:now()}; if(meta.me) recs[id].a=meta.me; meta.pending[id]=1; persist(); A.scheduleSync();
}
const list = (type)=>Object.values(recs).filter(r=>r.type===type&&!r.del).sort((a,b)=>b.ts-a.ts);
const since = (arr,ms)=>arr.filter(r=>r.ts>=ms);
Object.assign(A,{put,del,list,since,recs:()=>recs});

/* ---------- glucose units + status ---------- */
const isMg = ()=>cfg().units==='mg';
const fmtG = v=>isMg()?String(Math.round(v*MG)):(Math.round(v*10)/10).toFixed(1);
const fromIn = x=>isMg()?x/MG:x;
const unitL = ()=>isMg()?'mg/dL':'mmol/L';
function gstat(v){
  const c=cfg();
  if(v<c.crit_low) return 'crit-low'; if(v<c.low) return 'low';
  if(v<=c.high) return 'ok'; if(v<=c.crit_high) return 'high'; return 'crit-high';
}
const SL = {
  'crit-low':{t:'Very low',e:'🚨',pill:'bad'},
  'low':{t:'Low',e:'⚠️',pill:'bad'},
  'ok':{t:'In range',e:'✅',pill:'ok'},
  'high':{t:'High',e:'⬆️',pill:'warn'},
  'crit-high':{t:'Very high',e:'🚨',pill:'bad'}
};
Object.assign(A,{isMg,fmtG,fromIn,unitL,gstat,SL});

/* What-now guidance (general safety info; not personalised medical advice) */
function guidance(st,ctx){
  const c=cfg();
  const steps = {
    'crit-low':{lvl:'crit',h:'Very low — act now',ol:[
      'Take <b>15–20 g fast sugar</b> right away: ½ cup juice or regular cooldrink, 3–4 glucose tablets, or 1 Tbsp sugar/honey.',
      'If she is confused, can’t swallow or is unresponsive: <b>call 10177 (or 112 from a cell)</b>. Don’t put food or drink in her mouth; lay her on her side. Use glucagon only if prescribed and you’ve been trained.',
      'Recheck in <b>15 minutes</b>. If still under '+fmtG(c.low)+', repeat the sugar.',
      'Once up, have a small snack with slow carbs (e.g. bread + peanut butter) if the next meal is more than an hour away.'],rescue:true},
    'low':{lvl:'crit',h:'Low sugar — treat it now',ol:[
      'Take <b>15 g fast sugar</b>: ½ cup juice/regular cooldrink, 3–4 glucose tablets or 1 Tbsp sugar/honey. Sit down.',
      'Wait and <b>recheck in 15 minutes</b>. Repeat if still under '+fmtG(c.low)+'.',
      'When back in range, eat a small snack or your meal if it is due.',
      'Tell someone. Don’t drive. Note what caused it (late meal, extra insulin, exercise) so we can spot patterns.'],rescue:true},
    'ok':{lvl:'good',h:'In range — nicely done',ol:[
      ctx==='before'?'Good to eat. Aim for your usual plate: ½ veg, ¼ protein, ¼ starch.':
      ctx==='bed'?'Check your bedtime target with your care team. If you’re unsure, keep fast sugar next to the bed.':
      'Keep going with your plan — water, balanced meals and a daily walk keep this steady.',
      'Take insulin only as your doctor’s plan says.'],rescue:false},
    'high':{lvl:'warn',h:'A bit high — steady it down',ol:[
      'Drink a glass or two of <b>water</b>. Skip sugary drinks and extra carbs for now.',
      'If you feel well, a <b>10–15 minute walk</b> usually helps.',
      'Follow your doctor’s plan for insulin. <b>Don’t double up</b> or guess a dose.',
      'Recheck in about <b>2 hours</b>.'],rescue:false},
    'crit-high':{lvl:'crit',h:'Very high — be careful',ol:[
      'Drink water. <b>No exercise</b> if you feel unwell or have ketones.',
      'If you have ketone strips (especially with type 1), <b>test ketones</b> now.',
      'Follow your doctor’s sick-day/correction plan. Don’t guess doses.',
      'Call your doctor if it stays this high on a recheck. <b>Go to emergency care</b> for vomiting, stomach pain, fast breathing, fruity breath or drowsiness.'],rescue:false}
  };
  return steps[st];
}
A.guidance=guidance;

/* ---------- today stats ---------- */
function today(){
  const s=startOfDay(now());
  const g=since(list('glucose'),s), ins=since(list('insulin'),s), meals=since(list('meal'),s), walks=since(list('walk'),s), treats=since(list('treat'),s);
  return {g,ins,meals,walks,treats,carbs:meals.reduce((a,m)=>a+(m.carbs||0),0),walkMin:walks.reduce((a,w)=>a+(w.min||0),0)};
}
function weekTreats(){ // Monday-start week
  const d=new Date(); const dow=(d.getDay()+6)%7; const s=addDays(startOfDay(now()),-dow);
  return {n:since(list('treat'),s).length, start:s};
}
function lastRapid(){return list('insulin').find(i=>i.cat==='rapid')}
Object.assign(A,{today,weekTreats,lastRapid});

/* ---------- range stats ---------- */
function rangeStats(days){
  const s=now()-days*DAY, g=since(list('glucose'),s);
  const cnt={'crit-low':0,low:0,ok:0,high:0,'crit-high':0};
  let sum=0; g.forEach(r=>{cnt[gstat(r.v)]++;sum+=r.v});
  const n=g.length;
  return {g,n,cnt,avg:n?sum/n:0,tir:n?Math.round(cnt.ok/n*100):0,
    lows:cnt.low+cnt['crit-low'],highs:cnt.high+cnt['crit-high']};
}
A.rangeStats=rangeStats;

/* ---------- game: points, streaks, badges ---------- */
function streakOf(set){
  let d=startOfDay(now()); if(!set.has(dayKey(d))) d=addDays(d,-1);
  let n=0; while(set.has(dayKey(d))){n++; d=addDays(d,-1);} return n;
}
function bounceBacks(g){
  const asc=g.slice().sort((a,b)=>a.ts-b.ts); let n=0;
  for(let i=0;i<asc.length-1;i++){
    if(gstat(asc[i].v).includes('low')){
      const nx=asc.slice(i+1).find(x=>x.ts-asc[i].ts<=2*HOUR);
      if(nx&&gstat(nx.v)==='ok') n++;
    }
  }
  return n;
}
function maxRun(g){ // longest run of consecutive in-range readings
  const asc=g.slice().sort((a,b)=>a.ts-b.ts); let best=0,run=0;
  asc.forEach(r=>{ if(gstat(r.v)==='ok'){run++;best=Math.max(best,run)} else run=0; }); return best;
}
function bestWeekWalk(walks){
  let best=0; walks.forEach(w=>{const s=w.ts-6*DAY; const t=walks.filter(x=>x.ts>=s&&x.ts<=w.ts+0).reduce((a,x)=>a+(x.min||0),0); best=Math.max(best,t);}); return best;
}
function treatFreeRun(){
  const gDays=new Set(list('glucose').map(r=>dayKey(r.ts))), tDays=new Set(list('treat').map(r=>dayKey(r.ts)));
  let d=startOfDay(now()),n=0; if(!gDays.has(dayKey(d))) d=addDays(d,-1);
  while(gDays.has(dayKey(d))&&!tDays.has(dayKey(d))){n++;d=addDays(d,-1);} return n;
}
function game(){
  const g=list('glucose'),ins=list('insulin'),meals=list('meal'),walks=list('walk'),moods=list('mood'),res=list('resist');
  const bb=bounceBacks(g), inr=g.filter(r=>gstat(r.v)==='ok').length;
  const points = g.length*5+inr*2+ins.length*3+meals.length*4+walks.reduce((a,w)=>a+10+Math.floor((w.min||0)/5),0)+moods.length*3+res.length*15+bb*20;
  const set=new Set(g.map(r=>dayKey(r.ts))); const streak=streakOf(set);
  const insDays=new Set(ins.map(r=>dayKey(r.ts))).size;
  const r7=rangeStats(7);
  const B=(id,e,n,d,p,m)=>({id,e,n,d,p:Math.min(p,m),m,got:p>=m});
  const badges=[
    B('first','🌱','First Step','Log your first sugar reading',g.length,1),
    B('s3','🔥','3-Day Streak','Log sugar 3 days in a row',streak,3),
    B('s7','⚡','Week Warrior','7-day logging streak',streak,7),
    B('s30','👑','Unstoppable','30-day logging streak',streak,30),
    B('run5','🎯','Steady Hand','5 in-range readings in a row',maxRun(g),5),
    B('tir','📈','Target Territory','70%+ in range this week (10+ readings)',r7.n>=10?r7.tir:0,70),
    B('bounce','💪','Bounce Back','Recover from a low within 2 hours',bb,1),
    B('walk5','👟','Happy Feet','Log 5 walks',walks.length,5),
    B('walk150','🏃','150 Club','150 active minutes in a week',bestWeekWalk(walks),150),
    B('plate','🍽️','Plate Pro','Log 10 meals',meals.length,10),
    B('res3','🍫','Sweet Resistance','Beat 3 sugar cravings',res.length,3),
    B('res10','🛡️','Craving Crusher','Beat 10 sugar cravings',res.length,10),
    B('tf7','🍎','Treat-Free Week','7 logged days with no treats',treatFreeRun(),7),
    B('ins7','💉','Dose Discipline','Insulin logged on 7 different days',insDays,7),
    B('mood7','🧠','Self-Aware','Log mood 7 times',moods.length,7),
    B('early5','🌅','Early Bird','5 fasting readings',g.filter(r=>r.ctx==='fasting').length,5)
  ];
  const per=120, level=1+Math.floor(points/per);
  const names=['Seedling','Sprout','Bloom','Glow','Radiant','Champion','Legend'];
  return {points,level,levelName:names[Math.min(names.length-1,level-1)],toNext:per-(points%per),pct:Math.round((points%per)/per*100),streak,badges,got:badges.filter(b=>b.got).length,resisted:res.length};
}
A.game=game;

/* ---------- insights ---------- */
function insights(){
  const out=[], c=cfg();
  const g14=since(list('glucose'),now()-14*DAY);
  if(g14.length<4) return [{i:'🌱',t:'Keep logging',x:'A few more readings and Steady will start spotting your patterns.',tone:'info'}];
  const r7=rangeStats(7);
  const prev=since(list('glucose'),now()-14*DAY).filter(r=>r.ts<now()-7*DAY);
  const ptir=prev.length?Math.round(prev.filter(r=>gstat(r.v)==='ok').length/prev.length*100):null;
  if(r7.n>=3){
    if(ptir!=null&&r7.tir>ptir) out.push({i:'📈',t:'Trending the right way',x:`In range ${r7.tir}% this week, up from ${ptir}% the week before. Keep doing what you’re doing.`,tone:'good'});
    else if(ptir!=null&&r7.tir<ptir) out.push({i:'📉',t:'Slipped a little',x:`In range ${r7.tir}% this week vs ${ptir}% last week. Small tweaks below can help.`,tone:'warn'});
  }
  // post-meal
  const meals=since(list('meal'),now()-14*DAY), g=list('glucose'), bySlot={};
  meals.forEach(m=>{
    const nr=g.filter(r=>r.ts>=m.ts+60*MIN&&r.ts<=m.ts+190*MIN)[0];
    if(nr){(bySlot[m.slot]=bySlot[m.slot]||[]).push(nr.v)}
  });
  let worst=null; Object.entries(bySlot).forEach(([s,a])=>{ if(a.length>=2){const av=a.reduce((x,y)=>x+y,0)/a.length; if(!worst||av>worst.av) worst={s,av,n:a.length,hi:a.filter(v=>v>c.high).length};}});
  if(worst&&worst.av>c.high-1) out.push({i:'🍽️',t:`${worst.s} lifts your sugar most`,x:`Readings after ${worst.s.toLowerCase()} average ${fmtG(worst.av)} ${unitL()} (${worst.hi} of ${worst.n} above range). Try a smaller starch portion, add protein/veg, and take a 10-minute walk afterwards.`,tone:'warn'});
  // fasting
  const fast=g14.filter(r=>r.ctx==='fasting');
  if(fast.length>=3){const av=fast.reduce((a,r)=>a+r.v,0)/fast.length; if(av>c.high) out.push({i:'🌅',t:'Mornings run high',x:`Fasting readings average ${fmtG(av)} ${unitL()}. Worth raising with your doctor — it may relate to evening food or basal insulin.`,tone:'warn'});
    else out.push({i:'🌅',t:'Good mornings',x:`Fasting readings average ${fmtG(av)} ${unitL()}.`,tone:'good'});}
  // lows after rapid insulin
  const lows=g14.filter(r=>r.v<c.low); let linked=0;
  lows.forEach(l=>{ if(list('insulin').some(i=>i.cat==='rapid'&&l.ts-i.ts>=45*MIN&&l.ts-i.ts<=5*HOUR)) linked++; });
  if(lows.length>=2&&linked>=2) out.push({i:'💉',t:'Lows follow mealtime insulin',x:`${linked} of ${lows.length} lows came within 5 hours of a rapid-acting dose. Show this to your doctor — dose or timing may need adjusting. Don’t change doses on your own.`,tone:'bad'});
  else if(lows.length>=2) out.push({i:'⚠️',t:`${lows.length} lows in 2 weeks`,x:'Keep fast sugar with you, don’t skip meals, and tell your care team about the pattern.',tone:'warn'});
  // walk effect
  const walks=since(list('walk'),now()-14*DAY), diffs=[];
  walks.forEach(w=>{
    const before=g.find(r=>r.ts<=w.ts&&w.ts-r.ts<=3*HOUR); const after=g.slice().reverse().find(r=>r.ts>=w.ts+(w.min||0)*MIN&&r.ts-w.ts<=4*HOUR);
    if(before&&after) diffs.push(after.v-before.v);
  });
  if(diffs.length>=2){const av=diffs.reduce((a,b)=>a+b,0)/diffs.length; if(av<-0.5) out.push({i:'🚶',t:'Walks bring your sugar down',x:`On average your sugar dropped ${fmtG(Math.abs(av))} ${unitL()} after a walk. A great tool when you’re a little high.`,tone:'good'});}
  // treats
  const tr=since(list('treat'),now()-14*DAY), post=[];
  tr.forEach(t=>{const nr=g.find(r=>r.ts>=t.ts+45*MIN&&r.ts<=t.ts+180*MIN); if(nr) post.push(nr.v);});
  if(post.length>=2){const av=post.reduce((a,b)=>a+b,0)/post.length; const hi=post.filter(v=>v>c.high).length;
    out.push({i:'🍫',t:'How treats affect you',x:`After treats your sugar averages ${fmtG(av)} ${unitL()} (${hi} of ${post.length} above range). ${hi>post.length/2?'Smaller portions straight after a meal tend to help.':'Your treat timing is working well.'}`,tone:hi>post.length/2?'warn':'good'});}
  // mood
  const moods=since(list('mood'),now()-14*DAY); const lowDays=new Set(moods.filter(m=>m.mood<=2||m.stress==='high').map(m=>dayKey(m.ts)));
  if(lowDays.size>=3){const a=g14.filter(r=>lowDays.has(dayKey(r.ts))), b=g14.filter(r=>!lowDays.has(dayKey(r.ts)));
    if(a.length>=3&&b.length>=3){const aa=a.reduce((x,r)=>x+r.v,0)/a.length, bb=b.reduce((x,r)=>x+r.v,0)/b.length; if(aa-bb>1) out.push({i:'🧠',t:'Stress shows in your sugar',x:`On low-mood/stressed days your sugar averages ${fmtG(aa)} vs ${fmtG(bb)} on calm days. A walk, breathing or a chat helps.`,tone:'warn'});}}
  return out.slice(0,5);
}
A.insights=insights;

/* ---------- attention (nudges for her, alerts for family) ---------- */
function attention(){
  const a=[], c=cfg(), g=list('glucose'), last=g[0], hr=new Date().getHours(), t=today();
  if(!last) a.push({lvl:'info',i:'🩸',t:'No sugar readings yet',x:'Log the first reading to get started.'});
  else{
    const st=gstat(last.v);
    if(now()-last.ts<3*HOUR){
      if(st==='crit-low'||st==='low') a.push({lvl:'crit',i:SL[st].e,t:`Last reading ${fmtG(last.v)} — ${SL[st].t.toLowerCase()}`,x:`${ago(last.ts)}. Make sure she has treated it and rechecked after 15 minutes.`});
      else if(st==='crit-high') a.push({lvl:'crit',i:'🚨',t:`Last reading ${fmtG(last.v)} — very high`,x:`${ago(last.ts)}. Water, ketone check if available, follow the doctor’s plan.`});
      else if(st==='high') a.push({lvl:'warn',i:'⬆️',t:`Last reading ${fmtG(last.v)} — high`,x:`${ago(last.ts)}. Water + a short walk, recheck in ~2 hours.`});
    }
    if(hr>=7&&hr<=21&&now()-last.ts>c.miss_hours*HOUR) a.push({lvl:'warn',i:'⏰',t:`No sugar check for ${dur(now()-last.ts)}`,x:'Time to check and log a reading.'});
    if(meta.recheck&&meta.recheck>now()) a.push({lvl:'info',i:'⏱️',t:'Recheck timer running',x:'Recheck due at '+hhmm(meta.recheck)+'.'});
  }
  if(hr>=11&&!t.meals.length) a.push({lvl:'info',i:'🍽️',t:'No meals logged today',x:'Log meals so patterns are easy to spot.'});
  const insDays=new Set(list('insulin').map(r=>dayKey(r.ts))).size;
  if(hr>=14&&!t.ins.length&&insDays>=3) a.push({lvl:'info',i:'💉',t:'No insulin logged today',x:'If a dose was taken, add it to the log.'});
  if(hr>=17&&hr<=20&&!t.walks.length) a.push({lvl:'info',i:'👟',t:'No walk yet today',x:`Goal: ${c.walk_goal} minutes.`});
  const wt=weekTreats(); if(wt.n>c.treats_week) a.push({lvl:'warn',i:'🍫',t:'Treat budget exceeded',x:`${wt.n} treats this week (budget ${c.treats_week}).`});
  return a;
}
A.attention=attention;

/* ---------- treat guardian ---------- */
function treatVerdict(){
  const c=cfg(), last=list('glucose')[0], wt=weekTreats(), hr=new Date().getHours();
  const left=Math.max(0,c.treats_week-wt.n);
  if(!last||now()-last.ts>90*MIN) return {lvl:'amber',e:'🩸',t:'Check your sugar first',x:'Treat decisions need a fresh reading (under 90 minutes old). Check, log it, then I’ll tell you if a treat fits.',act:'sugar'};
  const st=gstat(last.v);
  if(st==='low'||st==='crit-low') return {lvl:'red',e:'⚠️',t:'That’s a low, not a craving',x:'Your sugar is low — treat it with fast sugar now (see the low-sugar fixers below), then recheck in 15 minutes.',act:'rescue'};
  if(st==='high'||st==='crit-high') return {lvl:'red',e:'✋',t:'Not now — sugar is high',x:`You’re at ${fmtG(last.v)} ${unitL()}. Water and a short walk first; a treat can wait until you’re back in range.`,act:'swap'};
  if(hr>=21||hr<5) return {lvl:'amber',e:'🌙',t:'Late — better tomorrow',x:'Sweet things late at night can push sugar up while you sleep. Have it tomorrow after a meal, or try a swap.',act:'swap'};
  if(left<=0) return {lvl:'amber',e:'🧮',t:'Weekly treat budget used',x:`You’ve had ${wt.n} treat${wt.n===1?'':'s'} this week. A swap will satisfy the craving; your budget resets Monday.`,act:'swap'};
  if(last.v>8.5) return {lvl:'amber',e:'🤔',t:'Borderline — walk first',x:`You’re in range (${fmtG(last.v)}) but on the higher side. A 10-minute walk first, then recheck.`,act:'walk'};
  return {lvl:'green',e:'🍫',t:'A small treat fits',x:`In range at ${fmtG(last.v)} and ${left} treat${left===1?'':'s'} left this week. Best right after a meal or walk, a tiny portion (≈15 g carbs or less), eaten slowly. Check again in 2 hours.`,act:'treat'};
}
A.treatVerdict=treatVerdict;

/* ---------- reminders ---------- */
function nextReminder(){
  const c=cfg(), d=new Date(), nm=d.getHours()*60+d.getMinutes();
  const on=(c.reminders||[]).filter(r=>r.on).map(r=>({...r,m:+r.t.slice(0,2)*60+ +r.t.slice(3,5)})).sort((a,b)=>a.m-b.m);
  if(!on.length) return null;
  const nx=on.find(r=>r.m>=nm); const r=nx||on[0]; const mins=nx?r.m-nm:(1440-nm+r.m);
  return {...r,in:mins*MIN};
}
A.nextReminder=nextReminder;
function checkReminders(cb){
  const c=cfg(), d=new Date(), nm=d.getHours()*60+d.getMinutes(), dk=dayKey(now());
  (c.reminders||[]).forEach(r=>{
    if(!r.on) return; const m=+r.t.slice(0,2)*60+ +r.t.slice(3,5), key=r.id+'|'+dk;
    if(nm>=m&&nm<m+10&&!meta.fired[key]){ meta.fired[key]=1; cb(r); }
  });
  Object.keys(meta.fired).forEach(k=>{ if(!k.endsWith(dk)) delete meta.fired[k]; });
  persist();
}
A.checkReminders=checkReminders;

/* ---------- sync ---------- */
const sync = A.sync = {state:'off',last:0,err:'',listeners:[]};
function setSync(state,err){sync.state=state;sync.err=err||'';sync.listeners.forEach(f=>f())}
let syncTimer=null, syncing=false;
A.scheduleSync=function(){ if(!meta.code) return; clearTimeout(syncTimer); syncTimer=setTimeout(()=>A.doSync(),900); };
A.doSync=async function(opts={}){
  if(!meta.code||syncing) return {ok:false}; if(!navigator.onLine){setSync('offline');return {ok:false}}
  syncing=true; setSync('busy');
  const sentU={}; const out=[];
  Object.keys(meta.pending).forEach(id=>{ if(recs[id]){sentU[id]=recs[id].u; out.push(recs[id]);} else delete meta.pending[id]; });
  try{
    const res=await fetch('/api/sync',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:meta.code,pin:meta.pin,create:!!opts.create,since:meta.seq,records:out,vpin:opts.vpin||undefined,newPin:opts.newPin||undefined,dev:meta.dev,epoch:opts.joining?undefined:meta.epoch,who:meta.ppin?meta.who:undefined,ppin:meta.ppin||undefined,email:meta.ppin?(meta.email||undefined):undefined,join:!!opts.joining})});
    const j=await res.json().catch(()=>({}));
    if(!res.ok){ const m={not_found:'That family code wasn’t found.',wrong_pin:'Wrong PIN for that code.',same_pin:'The family PIN must be different from her PIN.',bad_family_pin:'Family PIN must be 4–8 digits.',bad_pin:'PIN must be 4–8 digits.',session_expired:'The PIN was changed — please log in again.',need_identity:'Enter your name and your own PIN below (family only).',need_email:'Enter your email below — it is used for emergency alerts and resetting your PIN.',name_taken:'That name is already used with a different personal PIN. Enter your own PIN, or use another name.',too_many:'Too many people in this space.'}[j.error]||('Sync problem ('+res.status+')'); throw Object.assign(new Error(m),{code:j.error,status:res.status}); }
    let newCrit=[];
    (j.records||[]).forEach(r=>{
      const cur=recs[r.id];
      if(!cur||r.u>cur.u){ const {s,...rest}=r; recs[r.id]=rest; if(!cur&&r.type==='glucose'&&!r.del&&r.by!==meta.who&&now()-r.ts<45*MIN&&gstat(r.v)!=='ok') newCrit.push(rest); }
    });
    Object.keys(sentU).forEach(id=>{ if(recs[id]&&recs[id].u===sentU[id]) delete meta.pending[id]; });
    if(typeof j.epoch==='number') meta.epoch=j.epoch; if(j.me) meta.me=j.me; if(opts.newPin) meta.pin=opts.newPin;
    if(j.role){ meta.ro=j.role==='viewer'; if(meta.ro) meta.role='carer'; meta.hasFamilyPin=!!j.hasFamilyPin; if(opts.vpin) meta.vpin=opts.vpin; }
    meta.seq=j.seq; persist(); sync.last=now(); setSync('on');
    if(newCrit.length&&A.onRemoteAlert) A.onRemoteAlert(newCrit);
    if(A.onData) A.onData();
    syncing=false; if(Object.keys(meta.pending).length) A.scheduleSync();
    return {ok:true};
  }catch(e){
    syncing=false;
    if(!opts.joining&&meta.code&&(e.code==='wrong_pin'||e.code==='session_expired')){ const why=e.code; A.leaveSpace(); if(A.onSessionEnd) A.onSessionEnd(why); return {ok:false,error:e}; }
    const offline=!navigator.onLine||e.name==='TypeError';
    setSync(offline?'offline':'err',e.message); return {ok:false,error:e};
  }
};
A.joinSpace=async function(code,pin,create,vpin,ident){
  // Joining an existing space adopts its shared settings; creating uploads everything on this phone.
  const bak=recs.settings, bakPending=meta.pending.settings;
  meta.code=code; meta.pin=pin; meta.seq=0; meta.epoch=undefined; meta.me='';
  meta.ppin=ident&&ident.ppin||''; if(ident&&ident.who) meta.who=ident.who; if(ident&&ident.email) meta.email=ident.email;
  if(!create){ delete recs.settings; delete meta.pending.settings; }
  Object.keys(recs).forEach(id=>meta.pending[id]=1);
  persist();
  const r=await A.doSync({create,vpin,joining:true});
  if(!r.ok){
    const e=r.error; meta.code='';meta.pin='';meta.ppin='';
    if(!create&&bak){ recs.settings=bak; if(bakPending) meta.pending.settings=1; }
    persist(); setSync('off'); return {ok:false,msg:(e&&e.message)||'Could not connect'};
  }
  if(!meta.ro) meta.ppin=''; else meta.lastWho=meta.who; persist();
  return {ok:true};
};
A.leaveSpace=function(){
  // a view-only phone keeps no copy of her data once it is logged out
  if(meta.ro){ Object.keys(recs).forEach(k=>delete recs[k]); meta.pending={}; }
  meta.lastCode=meta.code||meta.lastCode||'';meta.pushOn=false;meta.pushSynced=0;meta.lastWho=meta.ro?meta.who:meta.lastWho;meta.ppin='';meta.code='';meta.pin='';meta.seq=0;meta.ro=false;meta.vpin='';meta.hasFamilyPin=false;meta.epoch=undefined;meta.me='';persist();setSync('off')};
A.genCode=function(){const al='ABCDEFGHJKMNPQRSTUVWXYZ23456789',b=new Uint8Array(12);crypto.getRandomValues(b);const s=[...b].map(x=>al[x%al.length]).join('');return s.slice(0,4)+'-'+s.slice(4,8)+'-'+s.slice(8,12);};
A.notifyServer=function(rec){
  if(!meta.code||!cfg().email_alerts) return;
  const st=gstat(rec.v); if(st==='ok'||st==='high') return;
  fetch('/api/notify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:meta.code,pin:meta.pin,ep:meta.pushEp||undefined,kind:'reading',id:rec.id,v:rec.v,ts:rec.ts,ctx:rec.ctx||'',by:rec.by||''})}).catch(()=>{});
};
setInterval(()=>{ if(meta.code&&document.visibilityState==='visible') A.doSync(); },10000);
window.addEventListener('focus',()=>{ if(meta.code) A.doSync(); });
window.addEventListener('pageshow',()=>{ if(meta.code) A.doSync(); });
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&meta.code) A.doSync(); });
window.addEventListener('online',()=>{ if(meta.code) A.doSync(); });

/* ---------- export ---------- */
A.exportCSV=function(){
  const rows=[['type','when','value','unit','context','details','by']];
  Object.values(recs).filter(r=>!r.del&&r.type!=='settings').sort((a,b)=>a.ts-b.ts).forEach(r=>{
    const when=new Date(r.ts).toISOString(); let v='',u='',ctx=r.ctx||'',det=r.note||'';
    if(r.type==='glucose'){v=isMg()?Math.round(r.v*MG):r.v.toFixed(1);u=unitL();}
    else if(r.type==='insulin'){v=r.units;u='units';det=r.name+(r.note?' — '+r.note:'');}
    else if(r.type==='meal'){v=r.carbs;u='g carbs';ctx=r.slot;det=(r.items||[]).map(i=>i.n+' x'+i.q).join('; ');}
    else if(r.type==='walk'){v=r.min;u='min';}
    else if(r.type==='treat'){v=r.carbs||'';u='g carbs';det=r.what+(r.craving?' (craving)':'');}
    else if(r.type==='mood'){v=r.mood;u='1-5';det=(r.symptoms||[]).join(', ')+(r.sleep?' | sleep '+r.sleep+'h':'');}
    else if(r.type==='note'){det=r.text;ctx=r.kind;}
    rows.push([r.type,when,v,u,ctx,det,r.by||'']);
  });
  return rows.map(r=>r.map(x=>'"'+String(x==null?'':x).replace(/"/g,'""')+'"').join(',')).join('\n');
};
A.resetLocal=function(){ recs={}; meta.pending={}; meta.seq=0; persist(); };
})();
