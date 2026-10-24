/* Steady — pages (HTML builders). Forms + event handling live in app.js */
(function(){
'use strict';
const A=window.A, SD=window.SD;
const {esc,now,dayKey,startOfDay,addDays,hhmm,WD,MON,ago,dur,dayLabel,MIN,HOUR,DAY,cfg,list,fmtG,unitL,gstat,SL,meta}=A;
const U = A.ui = {tab:'home',sub:{food:'guide',care:'board'},prog:7,planDay:new Date().getDay(),foodQ:'',foodF:'all',noteKind:'care',deferred:null};

const COL={'crit-low':'#C81D4E',low:'#EE5A6F',ok:'#1FA97A',high:'#EE9B2E','crit-high':'#E04A24'};
const cd = ts=>{const s=Math.max(0,Math.ceil((ts-now())/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const ctxL = k=>{const c=SD.contexts.find(x=>x[0]===k);return c?c[1]+' '+c[2]:''};
const isStandalone = ()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone;
U.cd=cd; U.ctxL=ctxL; U.COL=COL;

function top(title,sub){
  const c=cfg(), st=A.sync.state;
  const cls=st==='on'?'on':st==='busy'?'busy':(st==='err'||st==='offline')?'err':'';
  return `<div class="top"><div><h1>${title}</h1>${sub?`<div class="sub">${sub}</div>`:''}</div>
  <button class="avatar tap" data-act="go" data-v="me" aria-label="Profile and settings">${esc(c.avatar)}${meta.code?`<span class="sync-dot ${cls}"></span>`:''}</button></div>`;
}
function zones(v){
  const c=cfg(), lo=2, hi=20, p=x=>Math.max(0,Math.min(100,(x-lo)/(hi-lo)*100));
  const a=p(c.crit_low), b=p(c.low), d=p(c.high), e=p(c.crit_high);
  return `<div class="zwrap"><div class="zones"><i class="z-cl" style="width:${a}%"></i><i class="z-l" style="width:${b-a}%"></i><i class="z-ok" style="width:${d-b}%"></i><i class="z-h" style="width:${e-d}%"></i><i class="z-ch" style="width:${100-e}%"></i></div><span class="mk" style="left:${p(v)}%"></span></div>`;
}
function trend(g){
  const l=g[0], p=g[1]; if(!l||!p||l.ts-p.ts>6*HOUR) return '';
  const d=l.v-p.v;
  return d>=1.5?'⬆️ rising fast':d>=0.5?'↗ rising':d<=-1.5?'⬇️ dropping fast':d<=-0.5?'↘ dropping':'→ steady';
}
function heroCard(g){
  const last=g[0];
  if(!last) return `<div class="hero"><div class="lbl">Blood sugar</div><div class="display" style="font-size:30px;margin:8px 0 6px">No readings yet</div><p class="meta">Check your sugar and log it — it takes five seconds.</p>${meta.ro?'':'<div class="mt"><button class="btn white" data-act="add" data-v="glucose">＋ Log a reading</button></div>'}</div>`;
  const st=gstat(last.v), s=SL[st], crit=st==='crit-low'||st==='crit-high';
  return `<div class="hero s-${st} ${crit?'crit':''}">
    <div class="row between"><span class="lbl">Blood sugar</span><span class="pill">${s.e} ${s.t}</span></div>
    <div style="margin:10px 0 4px"><span class="big">${fmtG(last.v)}</span><span class="unit">${unitL()}</span></div>
    <div class="meta">${ago(last.ts)}${last.ctx?' · '+ctxL(last.ctx):''}${trend(g)?' · '+trend(g):''}</div>
    ${zones(last.v)}
    <div class="row between mt" style="margin-top:16px"><span class="xs" style="opacity:.75">${fmtG(cfg().low)}–${fmtG(cfg().high)} is your target</span>${meta.ro?'':'<button class="btn white sm" data-act="add" data-v="glucose">＋ New reading</button>'}</div>
  </div>`;
}
function guideCard(st,ctx){
  const g=A.guidance(st,ctx), cls=g.lvl==='crit'?'crit':g.lvl==='warn'?'warn':'good';
  let h=`<div class="banner ${cls}"><h3>${g.h}</h3><ol>${g.ol.map(x=>`<li>${x}</li>`).join('')}</ol>`;
  if(g.rescue) h+=`<div class="row wrap mt">${meta.recheck>now()?'':'<button class="btn primary sm" data-act="recheck">⏱️ Start 15-min recheck timer</button>'}<button class="btn ghost sm" data-act="rescue-list">What is fast sugar?</button></div>`;
  return h+'</div>';
}
U.guideCard=guideCard; U.heroCard=heroCard;

/* ---------------- HOME ---------------- */
function stepsCard(){
  const c=cfg(),n=A.stepsToday(),goal=c.step_goal||6000,pct=Math.min(100,Math.round(n/goal*100)),wk=A.stepsWeek(),mx=Math.max(goal,...wk.map(x=>x.n)),R=34,C=2*Math.PI*R;
  const bars=wk.map(x=>`<i title="${esc(x.d)}: ${x.n.toLocaleString('en-ZA')}" style="height:${Math.max(4,Math.round(x.n/mx*100))}%" class="${x.n>=goal?'hit':''}"></i>`).join('');
  const own=!meta.ro&&meta.role!=='carer';
  return `<div class="card steps"><div class="row between" style="align-items:center;gap:14px"><svg width="86" height="86" viewBox="0 0 86 86" aria-hidden="true"><circle cx="43" cy="43" r="${R}" fill="none" stroke="currentColor" stroke-opacity=".15" stroke-width="9"/><circle cx="43" cy="43" r="${R}" fill="none" stroke="var(--ok,#2bb673)" stroke-width="9" stroke-linecap="round" stroke-dasharray="${(C*pct/100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 43 43)"/><text x="43" y="48" text-anchor="middle" font-size="17" font-weight="800" fill="currentColor">${pct}%</text></svg>
    <div class="grow"><div class="k">👟 Steps today</div><div class="sv">${n.toLocaleString('en-ZA')}<small> / ${goal.toLocaleString('en-ZA')}</small></div><div class="sbars">${bars}</div></div></div>
    ${own?`<div class="row mt" style="gap:8px"><button class="btn soft sm grow" data-act="steps-add">＋ Add steps</button><button class="btn ghost sm grow" data-act="steps-help">⚙️ Count automatically</button></div>`:''}</div>`;
}
const QUOTES=[
  ["Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee.","Isaiah 41:10"],
  ["I can do all things through Christ which strengtheneth me.","Philippians 4:13"],
  ["God is our refuge and strength, a very present help in trouble.","Psalm 46:1"],
  ["Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.","Joshua 1:9"],
  ["My help cometh from the LORD, which made heaven and earth.","Psalm 121:2"],
  ["They that wait upon the LORD shall renew their strength; they shall run, and not be weary; and they shall walk, and not faint.","Isaiah 40:31"],
  ["I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.","Jeremiah 29:11"],
  ["The LORD is my shepherd; I shall not want.","Psalm 23:1"],
  ["The LORD is nigh unto them that are of a broken heart.","Psalm 34:18"],
  ["Come unto me, all ye that labour and are heavy laden, and I will give you rest.","Matthew 11:28"],
  ["The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life.","Psalm 27:1"],
  ["He will not fail thee, nor forsake thee.","Deuteronomy 31:6"],
  ["Weeping may endure for a night, but joy cometh in the morning.","Psalm 30:5"],
  ["My grace is sufficient for thee: for my strength is made perfect in weakness.","2 Corinthians 12:9"],
  ["God is the strength of my heart, and my portion for ever.","Psalm 73:26"],
  ["Trust in the LORD with all thine heart; and lean not unto thine own understanding.","Proverbs 3:5"],
  ["The LORD is my strength and my shield; my heart trusted in him, and I am helped.","Psalm 28:7"],
  ["His compassions fail not. They are new every morning: great is thy faithfulness.","Lamentations 3:22-23"],
  ["Casting all your care upon him; for he careth for you.","1 Peter 5:7"],
  ["This is the day which the LORD hath made; we will rejoice and be glad in it.","Psalm 118:24"],
  ["When thou passest through the waters, I will be with thee.","Isaiah 43:2"],
  ["What time I am afraid, I will trust in thee.","Psalm 56:3"],
  ["God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.","2 Timothy 1:7"],
  ["In the day when I cried thou answeredst me, and strengthenedst me with strength in my soul.","Psalm 138:3"],
  ["Let us not be weary in well doing: for in due season we shall reap, if we faint not.","Galatians 6:9"],
  ["The peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.","Philippians 4:7"],
  ["The LORD shall fight for you, and ye shall hold your peace.","Exodus 14:14"],
  ["Commit thy way unto the LORD; trust also in him; and he shall bring it to pass.","Psalm 37:5"],
  ["Strength and honour are her clothing; and she shall rejoice in time to come.","Proverbs 31:25"],
  ["I am fearfully and wonderfully made: marvellous are thy works.","Psalm 139:14"],
  ["I have set the LORD always before me: because he is at my right hand, I shall not be moved.","Psalm 16:8"],
  ["Beloved, I wish above all things that thou mayest prosper and be in health, even as thy soul prospereth.","3 John 1:2"],
  ["You don’t have to be perfect today. You just have to keep showing up.",""],
  ["One steady choice at a time. That’s how big things change.",""],
  ["A high or low number is information, not a verdict on you.",""],
  ["You are doing something hard every single day — and you’re still here. That’s strength.",""],
  ["Small, kind habits beat big, perfect plans.",""],
  ["Rest is part of the plan too. Be gentle with yourself today.",""],
  ["Every check, every meal you think about, every walk — it all counts.",""],
  ["Your family is in your corner. You never carry this alone.",""],
  ["Progress isn’t a straight line. Keep going.",""],
  ["Drink some water, take a breath, and take the next good step.",""],
  ["You’ve handled every hard day so far. Today is no different.",""],
  ["Look after yourself the way you’d look after someone you love.",""],
  ["Steady wins. Slow, calm and consistent is a powerful way to live.",""],
  ["A walk after a meal is a gift to your future self.",""],
  ["Be proud of the effort, not just the number.",""],
  ["Today is a fresh page. Write something kind on it.",""],
  ["You are stronger than your worst day and braver than you feel.",""],
  ["Celebrate the small wins — they add up to a healthy life.",""],
  ["It’s okay to ask for help. That’s what family is for.",""],
  ["Take it one meal, one check, one day at a time.",""],
  ["You deserve to feel well. Keep taking care of you.",""],
  ["Courage is not the absence of fear — it’s checking anyway.",""],
  ["Good days build confidence; hard days build resilience. Both make you stronger.",""],
  ["Breathe. You’re doing better than you think.",""],
  ["Your story isn’t defined by a diagnosis. It’s defined by how you live.",""],
  ["Be patient with your body. It’s working hard for you.",""],
  ["Joy counts as medicine too — laugh, sing, call someone you love.",""],
  ["You are loved, you are capable, and you are not alone.",""]
];
function quoteCard(){const d=new Date(),day=Math.floor((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()))/864e5),n=(meta.qn&&meta.qd===day)?meta.qn:0,i=(day*7+n*13)%QUOTES.length,qt=QUOTES[i];
  return `<div class="card quote"><div class="qk">${qt[1]?'📖 Today’s verse':'💛 Today’s note'}</div><div class="qt">“${esc(qt[0])}”</div>${qt[1]?`<div class="qr">— ${esc(qt[1])}</div>`:''}<button class="linkish sm" data-act="quote-next">Another one ›</button></div>`;}
function pageHome(){
  const c=cfg(), g=list('glucose'), last=g[0], carer=meta.role==='carer', t=A.today(), gm=A.game();
  const hr=new Date().getHours(), greet=hr<12?'Good morning':hr<17?'Good afternoon':'Good evening', nm=c.name?esc(c.name):'';
  let h=top(carer?(nm?nm+'’s day':'Her day'):`${greet}${nm?', '+nm:''}`,new Date().toLocaleDateString('en-ZA',{weekday:'long',day:'numeric',month:'long'}));
  h+='<div class="stack">';
  h+=heroCard(g);
  if(meta.code&&A.sync.state==='err')h+=`<div class="banner crit"><div class="b">⚠️ Can’t reach the family space</div><div class="sm">${esc(A.sync.err||'Check your connection')} — new messages won’t show until this works.</div><button class="btn primary block mt" data-act="sync-now">Try again</button></div>`;
  h+=quoteCard();
  h+=stepsCard();
  if(!meta.ro&&!carer) h+=`<button class="sosbtn" data-act="sos"><span>🆘</span> I need help<small>Alerts your family with your location</small></button>`;
  if(meta.recheck>now()) h+=`<div class="banner crit"><div class="row between"><div><h3 style="margin:0">⏱️ Recheck in <span data-cd="recheck">${cd(meta.recheck)}</span></h3><div class="sm">Wait the full 15 minutes before testing again.</div></div><button class="btn sm white" data-act="add" data-v="glucose">Log</button></div></div>`;
  else if(meta.recheck) h+=`<div class="banner crit"><div class="row between"><div><h3 style="margin:0">⏱️ Time to recheck!</h3><div class="sm">15 minutes are up — test and log your sugar.</div></div><button class="btn sm primary" data-act="add" data-v="glucose">Log</button></div></div>`;
  if(meta.walkStart) h+=`<div class="banner good"><div class="row between"><div><h3 style="margin:0">🚶 Walk in progress <span data-up="walk">${cd(2*now()-meta.walkStart)}</span></h3><div class="sm">Take water. Stop if you feel shaky or dizzy.</div></div><button class="btn sm primary" data-act="walk-finish">Finish</button></div></div>`;
  if(last&&now()-last.ts<6*HOUR) h+=guideCard(gstat(last.v),last.ctx);
  const att=A.attention().filter(a=>!(a.t.startsWith('Last reading')||a.t.startsWith('Recheck')));
  if(att.length){
    h+=`<div class="card"><h3>${carer?'Needs attention':'Gentle nudges'}</h3>`+att.slice(0,4).map(a=>`<div class="item"><div class="ico">${a.i}</div><div class="grow"><div class="t">${esc(a.t)}</div><div class="d">${esc(a.x)}</div></div></div>`).join('')+'</div>';
  }
  const li=t.ins[0];
  h+=`<div class="grid2">
    <button class="tile tap" data-act="add" data-v="glucose"><div class="k">Readings</div><div class="v">${t.g.length}<small> today</small></div><div class="sm mut">${last?'last '+ago(last.ts):'none yet'}</div></button>
    <button class="tile tap" data-act="add" data-v="meal"><div class="k">Carbs</div><div class="v">${t.carbs}<small> g</small></div><div class="sm mut">${t.meals.length} meal${t.meals.length===1?'':'s'} logged</div></button>
    <button class="tile tap" data-act="add" data-v="walk"><div class="k">Walk</div><div class="v">${t.walkMin}<small> / ${c.walk_goal} min</small></div><div class="meter"><i style="width:${Math.min(100,t.walkMin/Math.max(1,c.walk_goal)*100)}%"></i></div></button>
    <button class="tile tap" data-act="add" data-v="insulin"><div class="k">Insulin</div><div class="v">${t.ins.length}<small> dose${t.ins.length===1?'':'s'}</small></div><div class="sm mut">${li?esc(li.name.split(' ')[0])+' '+ago(li.ts):'none today'}</div></button>
  </div>`;
  const nr=A.nextReminder();
  if(nr) h+=`<div class="card row tap" data-act="remind-go" data-k="${nr.k}"><div class="ico">⏰</div><div class="grow"><div class="t b">${esc(nr.l)}</div><div class="d sm mut">${nr.t} · in ${dur(nr.in)}</div></div><span class="pill solid">Next up</span></div>`;
  const ins=list('insulin').slice(0,2);
  if(ins.length) h+=`<div class="card"><h3>💉 Recent insulin</h3>`+ins.map(i=>`<div class="item"><div class="ico">💉</div><div class="grow"><div class="t">${esc(i.name)}</div><div class="d">${ago(i.ts)}${i.cat==='rapid'?' · mealtime insulin':''}</div></div><span class="carb">${i.units} u</span></div>`).join('')+'</div>';
  const nt=list('note').find(n=>n.kind==='praise'||n.kind==='care');
  if(!carer&&nt&&now()-nt.ts<4*DAY) h+=`<div class="banner coral"><h3>💌 From ${esc(nt.by||'family')}</h3><div>${esc(nt.text)}</div></div>`;
  h+=`<button class="card tap" data-act="go" data-v="me" style="width:100%;text-align:left"><div class="row between"><div><div class="b">${gm.streak>0?'🔥 '+gm.streak+'-day streak':'🌱 Start a streak today'} · Level ${gm.level} <span class="mut">${gm.levelName}</span></div><div class="sm mut" style="margin-top:2px">${gm.points} pts · ${gm.got}/${gm.badges.length} badges</div></div><span class="mut">›</span></div><div class="meter"><i style="width:${gm.pct}%"></i></div></button>`;
  if(!isStandalone()&&meta.installSeen<2){
    const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
    h+=`<div class="banner info"><h3>📲 Put Steady on the home screen</h3><div class="sm">${ios?'Tap the <b>Share</b> button in Safari, then <b>Add to Home Screen</b>.':U.deferred?'Install it like a normal app — one tap.':'Open the browser menu <b>⋮</b> and choose <b>Add to Home screen</b>.'}</div><div class="row mt">${U.deferred?'<button class="btn primary sm" data-act="install">Install</button>':''}<button class="btn ghost sm" data-act="install-dismiss">Got it</button></div></div>`;
  }
  h+=`<p class="disc center">Steady is a logging and coaching aid, not a medical device. Follow your doctor’s plan and call emergency services if you feel very unwell.</p>`;
  return h+'</div>';
}

/* ---------------- FOOD ---------------- */
const LIGHT={go:'Great choice',care:'Watch the portion',stop:'Treat only'};
const GROUPS=['Staples','Protein','Veg','Fruit','Dairy','Drinks','Snacks & sweets'];
function foodRow(f,i){
  return `<div class="item tap" data-act="tip" data-i="${i}"><div class="ico">${f.e}</div><div class="grow"><div class="t">${esc(f.n)}</div><div class="d">${esc(f.p)} · ${LIGHT[f.l]}</div><div class="d" id="tip${i}" style="display:none;color:var(--ink2);margin-top:4px">${esc(f.t||'Enjoy in the portion shown.')}</div></div><span class="carb">${f.c} g</span><span class="dot ${f.l}"></span></div>`;
}
function foodList(){
  const q=U.foodQ.trim().toLowerCase(); let h='';
  GROUPS.forEach(gp=>{
    const rows=SD.foods.map((f,i)=>({f,i})).filter(({f})=>f.g===gp&&(U.foodF==='all'||f.l===U.foodF)&&(!q||f.n.toLowerCase().includes(q)));
    if(rows.length) h+=`<div class="card" style="margin-bottom:12px"><h3>${gp}</h3>${rows.map(({f,i})=>foodRow(f,i)).join('')}</div>`;
  });
  return h||`<div class="empty"><div class="e">🔍</div>Nothing found. Try another word.</div>`;
}
U.foodList=foodList;
function planHtml(){
  const day=U.planDay, items=SD.plan[day], td=new Date().getDay(), isToday=day===td, c=cfg();
  const doneKeys=new Set(A.today().meals.map(m=>m.pk).filter(Boolean));
  const order=[1,2,3,4,5,6,0], nm=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  let h=`<div class="hscroll">${order.map((d,i)=>`<button class="chip scroll ${d===day?'on':''}" data-act="plan-day" data-v="${d}">${nm[i]}${d===td?' •':''}</button>`).join('')}</div>`;
  const total=items.reduce((a,x)=>a+x.c,0);
  h+=`<div class="card"><div class="row between"><h3 style="margin:0">Sample day · ${total} g carbs</h3><span class="pill solid">≈ ${c.carb_meal} g / meal</span></div><div class="sm mut" style="margin-top:4px">A starting point — your dietitian can tailor it. Tap ✓ after you eat to log it.</div>`;
  items.forEach((x,i)=>{
    const pk=dayKey(now())+'|'+day+'|'+i, done=doneKeys.has(pk);
    h+=`<div class="item"><div class="ico">${x.s==='Breakfast'?'🍳':x.s==='Lunch'?'🥗':x.s==='Dinner'?'🍲':'🍎'}</div><div class="grow"><div class="t">${esc(x.ti)}</div><div class="d">${x.t} · ${x.s} · ${x.c} g</div><div class="d" style="color:var(--ink2)">${esc(x.d)}</div></div>${isToday?`<button class="btn sm ${done?'soft':'primary'}" ${done?'disabled':''} data-act="plan-log" data-i="${i}">${done?'Done':'✓ Ate'}</button>`:''}</div>`;
  });
  return h+'</div>';
}
function treatsHtml(){
  const c=cfg(), v=A.treatVerdict(), wt=A.weekTreats(), g=A.game();
  const lightIcon={green:'😋',amber:'🤔',red:'✋'}[v.lvl];
  let h=`<div class="card"><div class="light-card"><div class="light ${v.lvl}">${v.e}</div><div class="grow"><div class="b" style="font-size:18px">${esc(v.t)}</div><div class="lead" style="margin-top:4px">${v.x}</div></div></div><div class="row wrap mt">`;
  if(v.act==='sugar') h+=`<button class="btn primary sm" data-act="add" data-v="glucose">🩸 Log my sugar</button>`;
  if(v.act==='rescue') h+=`<button class="btn primary sm" data-act="rescue-list">Low-sugar fixers</button>`;
  if(v.act==='walk') h+=`<button class="btn primary sm" data-act="add" data-v="walk">🚶 Log / start a walk</button>`;
  if(v.act==='treat') h+=`<button class="btn coral sm" data-act="add" data-v="treat">${lightIcon} I’ll have a small treat</button>`;
  h+=`<button class="btn soft sm" data-act="treat-pause">⏳ Pause 15 min</button></div>`;
  if(meta.pause>now()) h+=`<div class="banner coral mt"><div class="row between"><div><b>Craving timer</b> · <span data-cd="pause">${cd(meta.pause)}</span><div class="sm">Water, a swap or a short walk — cravings often fade.</div></div></div></div>`;
  else if(meta.pause) h+=`<div class="banner coral mt"><b>Time’s up.</b> Still craving?<div class="row mt"><button class="btn primary sm" data-act="treat-resist">🎉 I resisted!</button><button class="btn ghost sm" data-act="add" data-v="treat">I’ll have a little</button></div></div>`;
  h+=`</div>`;
  h+=`<div class="card"><div class="row between"><h3 style="margin:0">Weekly treat budget</h3><span class="pill solid">${Math.max(0,c.treats_week-wt.n)} left</span></div><div class="pips mt">${Array.from({length:Math.max(c.treats_week,wt.n)},(_,i)=>`<span class="pip ${i<wt.n?'used':''}">${i<wt.n?'🍫':''}</span>`).join('')}</div><div class="sm mut mt">Set with your care team. Cravings beaten so far: <b>${g.resisted}</b> 🛡️</div></div>`;
  h+=`<div class="card"><h3>Sweet swaps</h3>`+SD.swaps.map(s=>`<div class="item"><div class="ico">${s.e}</div><div class="grow"><div class="t">${esc(s.n)}</div><div class="d">${esc(s.d)}</div></div></div>`).join('')+`<button class="btn ghost block mt" data-act="treat-resist">🎉 I used a swap / resisted</button></div>`;
  h+=`<div class="card"><h3>Best time for a treat</h3><ul class="sm" style="margin:0;padding-left:18px;line-height:1.7"><li>Right <b>after a balanced meal</b>, never on an empty stomach</li><li>Or after a <b>10–15 min walk</b></li><li><b>Tiny portion</b>, eaten slowly (≈15 g carbs or less)</li><li>Not when sugar is high or late at night</li><li>Recheck about <b>2 hours later</b></li><li>Take insulin only as your doctor’s plan says</li></ul></div>`;
  h+=`<div class="banner crit"><h3>🚨 If sugar is LOW (under ${fmtG(c.low)})</h3><div class="sm" style="margin-bottom:6px">This is the one time fast sugar is the medicine. ~15 g:</div>${SD.rescue.map(r=>`<div class="row" style="padding:3px 0"><span style="font-size:22px">${r[0]}</span><b>${r[1]}</b><span class="mut">— ${r[2]}</span></div>`).join('')}<div class="sm mt">Recheck after 15 minutes. Repeat if still low.</div></div>`;
  return h;
}
function pageFood(){
  let h=top('Food','Eat well, feel steady');
  h+=`<div class="seg tabs-sub">${[['guide','Guide'],['plan','Meal plan'],['treats','Treats']].map(([k,l])=>`<button class="${U.sub.food===k?'on':''}" data-act="sub" data-p="food" data-v="${k}">${l}</button>`).join('')}</div>`;
  if(U.sub.food==='guide'){
    h+=`<div class="stack"><div class="banner info"><h3>The plate method</h3><div class="sm">½ plate non-starchy veg · ¼ lean protein · ¼ starch (pap, rice, potato). Tap any food for tips.</div></div>
    <input class="inp" id="foodq" placeholder="🔍  Search foods (pap, amasi, apple…)" value="${esc(U.foodQ)}" autocomplete="off">
    <div class="chips">${[['all','All'],['go','🟢 Great'],['care','🟡 Portion'],['stop','🔴 Rarely']].map(([k,l])=>`<button class="chip ${U.foodF===k?'on':''}" data-act="food-filter" data-v="${k}">${l}</button>`).join('')}</div>
    <div id="foodlist">${foodList()}</div><p class="disc">Carb counts are approximate for the portion shown. Your dietitian’s advice comes first.</p></div>`;
  } else if(U.sub.food==='plan') h+=`<div class="stack">${planHtml()}</div>`;
  else h+=`<div class="stack">${treatsHtml()}</div>`;
  return h;
}

/* ---------------- PROGRESS ---------------- */
function chart(g,days){
  const c=cfg(), W=340,H=190,L=34,R=8,T=10,B=24, end=now(), start=end-days*DAY;
  const d=g.filter(r=>r.ts>=start).sort((a,b)=>a.ts-b.ts);
  if(d.length<2) return `<div class="empty"><div class="e">📉</div>Log a few more readings to see your chart.</div>`;
  const vs=d.map(r=>r.v), ymax=Math.max(14.5,Math.ceil(Math.max(...vs)+1)), ymin=Math.min(2,Math.floor(Math.min(...vs)-0.5));
  const x=ts=>L+(ts-start)/(end-start)*(W-L-R), y=v=>T+(1-(v-ymin)/(ymax-ymin))*(H-T-B);
  let s=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sugar readings over time">`;
  s+=`<rect x="${L}" y="${y(c.high)}" width="${W-L-R}" height="${y(c.low)-y(c.high)}" rx="6" fill="#1FA97A" opacity=".14"/>`;
  [c.low,c.high].forEach(v=>{s+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="#1FA97A" stroke-width="1" stroke-dasharray="3 4" opacity=".6"/><text x="${L-5}" y="${y(v)+4}" text-anchor="end" style="font-size:10px;fill:var(--mut)">${fmtG(v)}</text>`});
  const step=days<=7?1:days<=14?2:5;
  for(let i=days;i>=0;i-=step){const t=startOfDay(end)-i*DAY; if(t<start-DAY/2) continue; const dt=new Date(t); s+=`<text x="${Math.max(L,Math.min(W-R-6,x(t)))}" y="${H-6}" text-anchor="middle" style="font-size:10px;fill:var(--mut)">${days<=7?WD[dt.getDay()]:dt.getDate()+' '+MON[dt.getMonth()]}</text>`;}
  s+=`<path d="${d.map((r,i)=>(i?'L':'M')+x(r.ts).toFixed(1)+' '+y(r.v).toFixed(1)).join(' ')}" fill="none" stroke="var(--brand2)" stroke-width="2" stroke-linejoin="round" opacity=".55"/>`;
  d.forEach(r=>{s+=`<circle cx="${x(r.ts).toFixed(1)}" cy="${y(r.v).toFixed(1)}" r="4" fill="${COL[gstat(r.v)]}" stroke="var(--card)" stroke-width="1.5"/>`});
  return s+'</svg>';
}
function tirBar(st){
  const seg=[['crit-low','z-cl','Very low'],['low','z-l','Low'],['ok','z-ok','In range'],['high','z-h','High'],['crit-high','z-ch','Very high']];
  if(!st.n) return '';
  return `<div class="tir">${seg.map(([k,cl])=>st.cnt[k]?`<i class="${cl}" style="width:${st.cnt[k]/st.n*100}%"></i>`:'').join('')}</div>
  <div class="legend">${seg.map(([k,cl,l])=>`<span><b class="${cl}"></b>${l} ${Math.round(st.cnt[k]/st.n*100)}%</span>`).join('')}</div>`;
}
function tlRow(r){
  const me=cfg().name; let ico='•',t='',d='',right='';
  if(r.type==='glucose'){const s=SL[gstat(r.v)];ico='🩸';t=`${fmtG(r.v)} ${unitL()}`;d=(r.ctx?ctxL(r.ctx)+' · ':'')+(r.note?esc(r.note):'');right=`<span class="pill ${s.pill}">${s.t}</span>`;}
  else if(r.type==='insulin'){ico='💉';t=esc(r.name);d=r.note?esc(r.note):'';right=`<span class="carb">${r.units} u</span>`;}
  else if(r.type==='meal'){ico='🍽️';t=`${esc(r.slot||'Meal')}`;d=(r.items||[]).map(i=>esc(i.n)).join(', ');right=`<span class="carb">${r.carbs} g</span>`;}
  else if(r.type==='walk'){ico='🚶';t=`${r.min} min ${esc(r.kind||'walk')}`;d=r.note?esc(r.note):'';}
  else if(r.type==='mood'){ico=SD.moods[(r.mood||3)-1];t='Mood check';d=[(r.symptoms||[]).join(', '),r.sleep?'slept '+r.sleep+'h':'',r.stress?'stress '+r.stress:''].filter(Boolean).map(esc).join(' · ');}
  else if(r.type==='treat'){ico='🍫';t=esc(r.what);d=(r.craving?'craving':'planned')+(r.note?' · '+esc(r.note):'');right=r.carbs?`<span class="carb">${r.carbs} g</span>`:'';}
  else return '';
  const by=r.by&&r.by!==me&&r.by!=='Me'?` · by ${esc(r.by)}`:'';
  return `<div class="item"><div class="ico">${ico}</div><div class="grow"><div class="t">${t}</div><div class="d">${hhmm(r.ts)}${d?' · '+d:''}${by}</div></div>${right}<button class="x" data-act="del" data-id="${r.id}" aria-label="Delete">✕</button></div>`;
}
function pageProgress(){
  const days=U.prog, st=A.rangeStats(days), c=cfg();
  let h=top('Progress','How things are going');
  h+=`<div class="seg tabs-sub">${[7,14,30].map(d=>`<button class="${days===d?'on':''}" data-act="prog" data-v="${d}">${d} days</button>`).join('')}</div><div class="stack">`;
  h+=`<div class="card"><div class="row between"><h3 style="margin:0">Time in range</h3><span class="display" style="font-size:30px;color:${st.tir>=70?'var(--ok)':st.tir>=50?'var(--high)':'var(--crit-high)'}">${st.n?st.tir+'%':'—'}</span></div><div class="sm mut" style="margin:2px 0 10px">Goal: 70% of readings between ${fmtG(c.low)} and ${fmtG(c.high)}</div>${tirBar(st)||'<div class="empty">No readings in this period yet.</div>'}</div>`;
  h+=`<div class="grid2"><div class="tile"><div class="k">Average</div><div class="v">${st.n?fmtG(st.avg):'—'}<small> ${unitL()}</small></div></div><div class="tile"><div class="k">Readings</div><div class="v">${st.n}</div></div><div class="tile"><div class="k">Lows</div><div class="v" style="color:${st.lows?'var(--low)':'inherit'}">${st.lows}</div></div><div class="tile"><div class="k">Highs</div><div class="v" style="color:${st.highs?'var(--high)':'inherit'}">${st.highs}</div></div></div>`;
  h+=`<div class="card"><h3>Sugar over time</h3>${chart(list('glucose'),days)}</div>`;
  const ins=A.insights();
  h+=`<div class="card"><h3>What Steady noticed</h3>`+ins.map(i=>`<div class="item"><div class="ico">${i.i}</div><div class="grow"><div class="t">${esc(i.t)}</div><div class="d" style="color:var(--ink2)">${esc(i.x)}</div></div></div>`).join('')+`<div class="disc" style="margin-top:6px">Patterns, not diagnoses — share them with your doctor.</div></div>`;
  const s=now()-days*DAY, recs=Object.values(A.recs()).filter(r=>!r.del&&r.ts>=s&&['glucose','insulin','meal','walk','mood','treat'].includes(r.type)).sort((a,b)=>b.ts-a.ts).slice(0,80);
  h+=`<div class="card"><h3>Timeline</h3>`;
  if(!recs.length) h+=`<div class="empty"><div class="e">📝</div>Nothing logged in this period.</div>`;
  let lastDay='';
  recs.forEach(r=>{const dl=dayLabel(r.ts); if(dl!==lastDay){h+=`<div class="b sm mut" style="margin:14px 0 2px">${dl}</div>`;lastDay=dl;} h+=tlRow(r);});
  return h+'</div></div>';
}

/* ---------------- CARE ---------------- */
const RX=['❤️','👏','💪','🙏','😊'];
const canDel=n=>!meta.ro||(!!meta.me&&n.a===meta.me);
function reactBar(id,rmap){
  const mine='rx_'+id+'_'+(meta.me||'loc'), rs=rmap[id]||[];
  return `<div class="rxbar">${RX.map(e=>{const who=rs.filter(r=>r.e===e),on=who.some(r=>r.id===mine);return `<button class="rx ${on?'on':''}" data-act="react" data-id="${id}" data-e="${e}" title="${esc(who.map(r=>r.by||'').join(', '))}" aria-label="React ${e}">${e}${who.length?`<b>${who.length}</b>`:''}</button>`;}).join('')}</div>`;
}
function noteRow(n,rmap){
  const del=canDel(n)?`<button class="x" data-act="note-del" data-id="${n.id}" aria-label="Delete">✕</button>`:'';
  if(n.type==='post'){
    const ok=typeof n.img==='string'&&n.img.startsWith('data:image/jpeg;base64,');
    return `<div class="note post"><div class="row between"><span class="b sm">📸 Moment</span><span class="xs mut">${esc(n.by||'')} · ${ago(n.ts)} ${del}</span></div>${ok?`<img class="pimg" alt="Photo shared by ${esc(n.by||'family')}" src="${n.img}">`:`<div class="empty" style="padding:14px"><div class="e">🖼️</div>Older photo removed to save space</div>`}${n.text?`<div style="margin-top:6px;white-space:pre-wrap">${esc(n.text)}</div>`:''}${reactBar(n.id,rmap)}</div>`;
  }
  const ic={do:'✅ Do',dont:'⛔ Don’t',praise:'💪 Cheer',care:'📝 Note'}[n.kind]||'📝';
  return `<div class="note ${n.kind}"><div class="row between"><span class="b sm">${ic}</span><span class="xs mut">${esc(n.by||'')} · ${ago(n.ts)} ${del}</span></div><div style="margin-top:4px;white-space:pre-wrap">${esc(n.text)}</div>${reactBar(n.id,rmap)}</div>`;
}
function pageCare(){
  const carer=meta.role==='carer', c=cfg();
  let h=top('Care circle',carer?'Support her, stay in the loop':'The people who’ve got you');
  h+=`<div class="seg tabs-sub">${[['board','Board'],['play','Playbook']].map(([k,l])=>`<button class="${U.sub.care===k?'on':''}" data-act="sub" data-p="care" data-v="${k}">${l}</button>`).join('')}</div><div class="stack">`;
  if(U.sub.care==='board'){
    const att=A.attention();
    const last=list('glucose')[0];
    if(carer&&last){h+=heroCard(list('glucose'));}
    h+=`<div class="card"><h3>${carer?'Needs attention':'Heads-up'}</h3>${att.length?att.map(a=>`<div class="item"><div class="ico">${a.i}</div><div class="grow"><div class="t">${esc(a.t)}</div><div class="d">${esc(a.x)}</div></div></div>`).join(''):`<div class="empty" style="padding:12px"><div class="e">🌿</div>All calm right now.</div>`}</div>`;
    h+=`<div class="card"><h3>Leave a note</h3><div class="chips">${[['care','📝 Note'],['praise','💪 Cheer'],['do','✅ Do'],['dont','⛔ Don’t']].map(([k,l])=>`<button class="chip ${U.noteKind===k?'on':''}" data-act="note-kind" data-v="${k}">${l}</button>`).join('')}</div><textarea class="ta mt" id="notetext" placeholder="${U.noteKind==='praise'?'So proud of your walks this week! 💛':U.noteKind==='dont'?'e.g. No cooldrinks with dinner':U.noteKind==='do'?'e.g. Check sugar before supper':'Anything the other person should know…'}"></textarea><button class="btn primary block mt" data-act="note-post">Post</button></div>`;
    h+=`<div class="card"><h3>Share a moment 📸</h3><input type="file" id="postfile" accept="image/*" capture="user" hidden>${U.postImg?`<img class="pimg" alt="Preview" src="${U.postImg}"><textarea class="ta mt" id="postcap" placeholder="Say something (optional)">${esc(U.postCap||'')}</textarea><div class="row mt"><button class="btn primary grow" data-act="post-go">Share with everyone</button><button class="btn ghost" data-act="post-clear">Cancel</button></div>`:`<div class="sm mut">Take a selfie or share a photo — everyone with access can see it and react.</div><button class="btn soft block mt" data-act="post-photo">📷 Take or choose a photo</button>`}</div>`;
    const rmap={}; list('react').forEach(r=>{(rmap[r.t]=rmap[r.t]||[]).push(r);});
    const feed=[...list('note'),...list('post')].sort((a,b)=>b.ts-a.ts).slice(0,40);
    h+=feed.length?`<div class="stack">${feed.map(n=>noteRow(n,rmap)).join('')}</div>`:`<div class="empty"><div class="e">💌</div>Nothing yet. Leave an encouraging note or share a photo!</div>`;
    if(!meta.code) h+=`<div class="banner info"><h3>🔗 Connect phones</h3><div class="sm">To see each other’s updates live, create a family space in <a class="linkish" data-act="go" data-v="me">Profile → Family sync</a>.</div></div>`;
  } else {
    const dos=list('note').filter(n=>n.kind==='do'), donts=list('note').filter(n=>n.kind==='dont');
    h+=`<div class="card"><h3>✅ Do</h3><ul class="sm" style="margin:0;padding-left:18px;line-height:1.75"><li>Check sugar before meals, at bedtime and when feeling “off”</li><li>Keep fast sugar + water within reach — bag, car, bedside</li><li>Eat regular meals; follow the plate method</li><li>Take insulin exactly as the doctor’s plan says, and log it</li><li>Walk daily (10–30 min), ideally after meals</li><li>Tell family when sugar is low or high</li>${dos.map(n=>`<li><b>${esc(n.text)}</b></li>`).join('')}</ul></div>
    <div class="card"><h3>⛔ Don’t</h3><ul class="sm" style="margin:0;padding-left:18px;line-height:1.75"><li>Skip meals after taking mealtime insulin</li><li>Double up or guess an insulin dose</li><li>Keep sugary drinks/sweets “just in case” in easy reach (only fast sugar for lows)</li><li>Exercise when ketones are present or feeling unwell</li><li>Drive when sugar is low or you feel shaky</li><li>Ignore symptoms — shaky, sweaty, confused, very thirsty</li>${donts.map(n=>`<li><b>${esc(n.text)}</b></li>`).join('')}</ul></div>`;
    h+=`<div class="banner crit"><h3>🚨 Low sugar — she’s awake and can swallow</h3><ol><li>Give <b>15–20 g fast sugar</b>: ½ cup juice or regular cooldrink, or 3–4 glucose tablets.</li><li>Sit her down, stay with her. Recheck in <b>15 minutes</b>.</li><li>Repeat if still under ${fmtG(c.low)}, then a snack with slow carbs.</li></ol></div>
    <div class="banner crit"><h3>🚑 Low sugar — drowsy, confused or unconscious</h3><ol><li>Call <b>10177</b> (ambulance) or <b>112</b> from a cell phone <b>now</b>.</li><li>Nothing in her mouth. Lay her on her side.</li><li>If a glucagon kit is prescribed and you’ve been trained, use it.</li><li>Stay until help arrives.</li></ol></div>
    <div class="banner warn"><h3>⬆️ Very high sugar (over ${fmtG(c.crit_high)})</h3><ol><li>Water. No exercise if unwell.</li><li>Check ketones if strips are available.</li><li>Follow the doctor’s sick-day plan; call the doctor if it stays high.</li><li><b>Emergency care</b> for vomiting, belly pain, fast breathing, fruity breath or drowsiness.</li></ol></div>
    <p class="disc">General first-aid information. Ask her care team to tailor this plan, and keep their number handy.</p>`;
  }
  return h+'</div>';
}

/* ---------------- ME ---------------- */
U.open={};
function sec(title,body,open){const o=U.open[title]!==undefined?U.open[title]:open;return `<details class="card sec" data-k="${esc(title)}" ${o?'open':''}><summary>${title}</summary><div class="secbody">${body}</div></details>`;}
function syncLabel(){
  const s=A.sync;
  return s.state==='on'?`Synced ${ago(s.last)}`:s.state==='busy'?'Syncing…':s.state==='offline'?'Offline — will sync when back':s.state==='err'?('Problem: '+esc(s.err)):'Not connected';
}
U.syncLabel=syncLabel;
function pageMe(){
  const c=cfg(), gm=A.game(), carer=meta.role==='carer', ro=!!meta.ro;
  let h=`<div class="top"><div><h1>Profile</h1><div class="sub">Your space, your rules</div></div><button class="avatar tap" data-act="go" data-v="home" aria-label="Back home">🏠</button></div><div class="stack">`;
  if(meta.code) h+=`<button class="btn soft block" data-act="sync-leave">🔒 ${ro?'Log out':'Disconnect from family space'}</button>`;
  h+=`<div class="card"><div class="row"><div class="avatar" style="width:64px;height:64px;font-size:34px;box-shadow:none;background:var(--brand-soft)">${esc(c.avatar)}</div><div class="grow"><div class="display" style="font-size:22px">${esc(c.name||'Your name')}</div><div class="sm mut">Level ${gm.level} · ${gm.levelName} · ${gm.points} pts</div><div class="meter"><i style="width:${gm.pct}%"></i></div></div></div>
  <div class="row between mt"><div><div class="k xs mut b">STREAK</div><div class="display" style="font-size:24px">🔥 ${gm.streak}</div></div><div><div class="k xs mut b">BADGES</div><div class="display" style="font-size:24px">🏅 ${gm.got}</div></div><div><div class="k xs mut b">CRAVINGS BEATEN</div><div class="display" style="font-size:24px">🛡️ ${gm.resisted}</div></div></div></div>`;
  h+=`<div class="card"><h3>🏆 Achievements</h3><div class="badges">${gm.badges.map(b=>`<div class="bd ${b.got?'got':''}"><div class="e">${b.e}</div><div class="n">${esc(b.n)}</div><div class="p">${b.got?'Earned!':esc(b.d)}</div>${b.got?'':`<div class="meter"><i style="width:${b.p/b.m*100}%"></i></div>`}</div>`).join('')}</div></div>`;
  h+=sec('👤 About',`${ro?`<div class="banner info"><div class="sm">👀 <b>View-only.</b> You can watch everything and leave notes, but only she can change entries and settings.</div></div>`:`<label class="f">This phone belongs to</label><div class="seg"><button class="${!carer?'on':''}" data-act="role" data-v="patient">Her</button><button class="${carer?'on':''}" data-act="role" data-v="carer">Family / carer</button></div>
    <label class="f">Her name</label><input class="inp" data-set="name" value="${esc(c.name)}" placeholder="e.g. Nomsa">
    <label class="f">Her phone number (for family’s “Call” button in an emergency)</label><input class="inp" type="tel" inputmode="tel" data-set="phone" value="${esc(c.phone||'')}" placeholder="e.g. 082 123 4567">
    <button class="btn soft block mt" data-act="sos-test">📍 Allow location for the help button (alerts no one)</button>`}
    ${carer?`<label class="f">Your email (emergency alerts + PIN reset)</label><input class="inp" type="email" id="myemail" value="${esc(meta.email||'')}" placeholder="you@email.com"><label class="f">Your name (shown on notes)</label><input class="inp" id="whoname" value="${esc(meta.who||'')}" placeholder="e.g. Thuthu">`:''}
    ${ro?'':`<label class="f">Avatar</label><div class="emoji-grid">${SD.avatars.map(a=>`<button class="${a===c.avatar?'on':''}" data-act="avatar" data-v="${a}">${a}</button>`).join('')}</div>`}`,true);
  if(!ro){
  h+=sec('🎯 Targets (set with her doctor)',`<label class="f">Units</label><div class="seg"><button class="${c.units==='mmol'?'on':''}" data-act="unit" data-v="mmol">mmol/L</button><button class="${c.units==='mg'?'on':''}" data-act="unit" data-v="mg">mg/dL</button></div>
    <div class="grid2"><div><label class="f">Very low below</label><input class="inp" type="text" inputmode="decimal" step="any" data-gset="crit_low" value="${fmtG(c.crit_low)}"></div><div><label class="f">Low below</label><input class="inp" type="text" inputmode="decimal" step="any" data-gset="low" value="${fmtG(c.low)}"></div>
    <div><label class="f">High above</label><input class="inp" type="text" inputmode="decimal" step="any" data-gset="high" value="${fmtG(c.high)}"></div><div><label class="f">Very high above</label><input class="inp" type="text" inputmode="decimal" step="any" data-gset="crit_high" value="${fmtG(c.crit_high)}"></div></div>
    <div class="grid2"><div><label class="f">Carbs / meal (g)</label><input class="inp" type="text" inputmode="decimal" data-set="carb_meal" data-num="1" value="${c.carb_meal}"></div><div><label class="f">Carbs / snack (g)</label><input class="inp" type="text" inputmode="decimal" data-set="carb_snack" data-num="1" value="${c.carb_snack}"></div>
    <div><label class="f">Daily walk (min)</label><input class="inp" type="text" inputmode="decimal" data-set="walk_goal" data-num="1" value="${c.walk_goal}"></div><div><label class="f">Treats per week</label><input class="inp" type="text" inputmode="decimal" data-set="treats_week" data-num="1" value="${c.treats_week}"></div></div>
    <div class="grid2"><div><label class="f">Daily steps goal</label><input class="inp" type="text" inputmode="numeric" data-set="step_goal" data-num="1" value="${c.step_goal||6000}"></div><div></div></div>
    <div class="disc">Defaults follow common international targets. Always use the numbers her doctor gives her.</div>`);
  h+=sec('💉 Insulin',`<div>${c.insulins.map((i,k)=>`<div class="item"><div class="ico">💉</div><div class="grow"><div class="t">${esc(i.n)}</div><div class="d">${{rapid:'Mealtime / rapid-acting',long:'Long-acting / basal',mixed:'Mixed',other:'Other'}[i.c]}</div></div><button class="x" data-act="ins-del" data-i="${k}" aria-label="Remove">✕</button></div>`).join('')}</div>
    <label class="f">Add insulin</label><input class="inp" id="insname" placeholder="Name, e.g. NovoRapid"><select class="sel mt" id="inscat"><option value="rapid">Mealtime / rapid-acting</option><option value="long">Long-acting / basal</option><option value="mixed">Mixed</option><option value="other">Other</option></select><button class="btn soft block mt" data-act="ins-add">Add insulin</button>
    <label class="f">Doctor’s insulin plan (for reference)</label><textarea class="ta" data-set="plan_note" placeholder="Copy the plan from her doctor here, e.g. “Long-acting at 21:00. Mealtime with meals as instructed…”">${esc(c.plan_note)}</textarea><div class="disc">Steady never calculates or suggests doses.</div>`);
  h+=sec('⏰ Reminders',`${c.reminders.map(r=>`<div class="item"><button class="switch ${r.on?'on':''}" data-act="rem-toggle" data-id="${r.id}" aria-label="Toggle"></button><div class="grow"><div class="t sm">${esc(r.l)}</div></div><input type="time" class="inp" style="width:108px;min-height:40px" data-rem="${r.id}" value="${r.t}"><button class="x" data-act="rem-del" data-id="${r.id}" aria-label="Remove">✕</button></div>`).join('')}
    <label class="f">Add reminder</label><input class="inp" id="remlabel" placeholder="e.g. Afternoon snack"><div class="row mt"><input type="time" class="inp" id="remtime" value="15:30"><select class="sel" id="remkind"><option value="meal">Meal</option><option value="sugar">Sugar check</option><option value="insulin">Insulin</option><option value="walk">Walk</option></select></div><button class="btn soft block mt" data-act="rem-add">Add reminder</button>`);
  }
  const nperm=('Notification' in window)?Notification.permission:'unsupported';
  h+=sec('🔔 Notifications & email alerts',`${meta.code?`<div class="banner ${meta.pushOn?'good':'crit'}"><div class="b">${meta.pushOn?'✅ Emergency alerts are on for this phone':'🔔 Get alerts even when the app is closed'}</div><div class="sm">${ro?'You’ll get a pop-up the moment she presses the help button or her sugar is very low/high.':'Family phones get a pop-up when you press the help button.'}${/iphone|ipad/i.test(navigator.userAgent)&&!isStandalone()?' <b>On iPhone: first tap Share → Add to Home Screen and open Steady from there.</b>':''}</div>${meta.pushOn?'':`<button class="btn primary block mt" data-act="push-on">Turn on alerts</button>`}</div>`:''}<div class="banner info"><div class="sm"><b>On this phone:</b> ${nperm==='granted'?'✅ pop-up reminders are on while the app is open or recently used.':nperm==='denied'?'⛔ blocked in browser settings.':nperm==='unsupported'?'Not supported here.':'tap below to allow pop-up reminders.'}</div>${nperm==='default'?'<button class="btn primary sm mt" data-act="notif-enable">Enable reminders</button>':''}</div>
    ${ro?'':`<label class="f">Her email (for reminder emails)</label><input class="inp" type="email" data-set="my_email" value="${esc(c.my_email)}" placeholder="her@email.com">
    <label class="f">PIN-reset email (codes to reset her PIN are sent here — leave empty to use her email)</label><input class="inp" type="email" data-set="recovery_email" value="${esc(c.recovery_email||'')}" placeholder="e.g. the person who looks after the app">`}
    <label class="f">${ro?'Family who get alerts + the morning summary':'Family emails (alerts for lows / very highs + the 7am “how is she doing” summary)'}</label>${(c.carers||[]).map((e,k)=>`<div class="item"><div class="ico">✉️</div><div class="grow t sm" style="word-break:break-all">${esc(e)}</div>${ro?'':`<button class="x" data-act="carer-del" data-i="${k}" aria-label="Remove">✕</button>`}</div>`).join('')}${list('follower').map(f=>`<div class="item"><div class="ico">✉️</div><div class="grow"><div class="t sm">${esc(f.name||'Family')}</div><div class="d" style="word-break:break-all">${esc(f.email)}</div></div>${(!ro||f.by===meta.who)?`<button class="x" data-act="follow-del" data-id="${f.id}" aria-label="Remove">✕</button>`:''}</div>`).join('')}
    <div class="mt"><input class="inp" id="carername" placeholder="Name, e.g. Thembeka Radebe" autocomplete="name"><div class="row mt"><input class="inp" type="email" id="careremail" placeholder="family@email.com"><button class="btn soft" data-act="follow-add">Add</button></div></div>
    ${ro?'':`<div class="item"><button class="switch ${c.email_alerts?'on':''}" data-act="tog" data-k="email_alerts" aria-label="Toggle"></button><div class="grow"><div class="t sm">Email family on low / very high readings</div></div></div>
    <div class="item"><button class="switch ${c.email_digest!==false?'on':''}" data-act="tog" data-k="email_digest" aria-label="Toggle"></button><div class="grow"><div class="t sm">Morning summary email to family (about 7am)</div></div></div>
    <div class="item"><button class="switch ${c.email_reminders?'on':''}" data-act="tog" data-k="email_reminders" aria-label="Toggle"></button><div class="grow"><div class="t sm">Email her reminders when the app is closed</div></div></div>
    <label class="f">Alert family if no sugar check for (hours)</label><input class="inp" type="text" inputmode="decimal" data-set="miss_hours" data-num="1" value="${c.miss_hours}">`}
    <div class="disc">Emails need the sync space below. Reminder emails go out every 15 minutes at most; phone pop-ups need the app to have been opened recently.</div>`);
  if(meta.code&&!ro){const iv=meta.invites||[];h+=sec('👨‍👩‍👧 Family members',`<div class="disc">Add each person by email. They sign in with a code sent to that email — no PIN to remember — and can see everything but not edit.</div>
    ${iv.map(i=>`<div class="item"><div class="grow"><div class="t">${esc(i.name)}</div><div class="d">${esc(i.email)}</div></div><button class="btn ghost sm" data-act="inv-del" data-e="${esc(i.email)}">Remove</button></div>`).join('')}
    <label class="f">Name</label><input class="inp" id="invname" placeholder="e.g. Raymond" autocomplete="off"><label class="f">Email</label><input class="inp" id="invemail" type="email" placeholder="name@example.com" autocomplete="off"><button class="btn primary block mt" data-act="inv-add">Add person</button>`,true);}
  h+=sec('🔗 Family sync',meta.code?`<div class="banner good"><div class="b">✅ Connected</div><div class="sm">${syncLabel()}</div></div>
      <label class="f">Family code</label><div class="inp row" style="font-weight:800;letter-spacing:.06em">${esc(meta.code)}</div>
      ${ro?`<div class="disc">You’re connected with the family (view-only) PIN.</div>`:`<label class="f">Her PIN (full access — keep private)</label><div class="inp row between"><span id="pinshow">••••</span><button class="linkish sm" data-act="show-pin">Show</button></div>
      <label class="f">Family PIN (view-only — share this one)</label>${meta.hasFamilyPin?`<div class="inp row between"><span id="fpinshow">••••</span><button class="linkish sm" data-act="show-fpin">Show</button></div><button class="btn soft block mt" data-act="famepin">Change family PIN</button>`:`<button class="btn primary block" data-act="famepin">Set a family PIN</button><div class="disc">Without one, family would need her own PIN, which lets them edit.</div>`}
      <button class="btn soft block mt" data-act="pinchg">Change her PIN</button>
      <div class="disc">Changing either PIN logs everyone else out — they must log in again.</div>
      <div class="disc">Family join with the code + <b>family PIN</b> via “Join with a code”. They can watch everything but not edit.</div>`}
      <button class="btn soft block mt" data-act="invite">🔗 Share invite link (family then only types the PIN)</button>
      <div class="row mt"><button class="btn soft grow" data-act="sync-now">Sync now</button><button class="btn danger" data-act="sync-leave">Disconnect</button></div><button class="btn ghost block mt" data-act="resync">🔄 Reload everything from the server</button><div class="disc">Use this if chats, people or messages look missing on this phone.</div>`
    :`<div class="lead">Link two phones so what she logs shows up on yours instantly, with alerts when it matters.</div><div class="row mt"><button class="btn primary grow" data-act="open-sync" data-v="create">Create family space</button><button class="btn ghost grow" data-act="open-sync" data-v="join">Join with a code</button></div>`,!meta.code);
  h+=sec('📤 Data',`<button class="btn soft block" data-act="export">Download all data (CSV) for the doctor</button><button class="btn danger block mt" data-act="reset">Erase data on this phone</button><div class="disc">Synced data is stored in your Netlify site’s private storage. Keep the family code private.</div>`);
  h+=`<p class="disc center">Steady is a logging and coaching aid — not a medical device and not a substitute for professional care. In an emergency call 10177 / 112.</p>`;
  return h+'</div>';
}

/* ---------------- SOS banner ---------------- */
U.sosBanner=()=>{const s=list('sos')[0];if(!s||s.status!=='open'||now()-s.ts>3*HOUR)return '';
  const her=!meta.ro&&meta.role!=='carer', nm=cfg().name||'She', ph=String(cfg().phone||'').replace(/[^\d+]/g,'');
  return `<div class="banner crit sosb"><h3>🆘 ${her?'Help alert sent':esc(nm)+' pressed the help button'} · ${ago(s.ts)}</h3><div class="row mt" style="flex-wrap:wrap;gap:8px">${!her&&ph?`<a class="btn primary" href="tel:${ph}">📞 Call ${esc(nm)}</a>`:''}${typeof s.lat==='number'?`<a class="btn soft" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${s.lat},${s.lng}">📍 Location</a>`:''}${her?`<button class="btn primary" data-act="sos-ok">✅ I’m OK now</button>`:`<button class="btn soft" data-act="sos-way">🚗 I’m on my way</button>`}</div></div>`;};

U.pushBanner=()=>{
  if(!meta.code||meta.pushOn) return '';
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent), can=('PushManager' in window)&&('Notification' in window);
  const perm=('Notification' in window)?Notification.permission:'denied';
  if(perm==='denied') return `<div class="banner crit"><div class="b">🔕 Alerts are blocked on this phone</div><div class="sm">Allow notifications for Steady in your phone/browser settings so you hear about emergencies.</div></div>`;
  if(!can) return ios&&!isStandalone()?`<div class="banner crit"><div class="b">🔔 Get emergency alerts on your iPhone</div><div class="sm">Tap <b>Share</b> → <b>Add to Home Screen</b>, then open Steady from the new icon and tap Turn on alerts.</div></div>`:'';
  return `<div class="banner crit"><div class="b">🔔 Turn on emergency alerts</div><div class="sm">So this phone rings when someone presses help, her sugar is very low/high, or you get a message.</div><button class="btn primary block mt" data-act="push-on">Turn on alerts</button></div>`;};

/* ---------------- CHAT ---------------- */
const nname=n=>String(n||'').trim().toLowerCase().replace(/\s+/g,' ');
/* same name = same person, even if they joined before personal PINs and got an older id */
function idsOf(id){const ms=list('member'),me=ms.find(x=>x.id==='mb_'+id),s=new Set([id]);if(me&&nname(me.name))ms.forEach(x=>{if(nname(x.name)===nname(me.name))s.add(x.id.slice(3));});return s;}
const mine=m=>!!meta.me&&idsOf(meta.me).has(m.a);
const partner=m=>mine(m)?m.to:m.a;
const roomOf=m=>m.room==='g'?'g':partner(m);
function msgs(room){if(room==='g')return list('msg').filter(m=>m.room==='g').sort((a,b)=>a.ts-b.ts);const P=idsOf(room),M=idsOf(meta.me);return list('msg').filter(m=>m.room==='d'&&((M.has(m.a)&&P.has(m.to))||(P.has(m.a)&&M.has(m.to)))).sort((a,b)=>a.ts-b.ts);}
function unreadIn(room){const seen=(meta.seen||{})[room]||0;return msgs(room).filter(m=>!mine(m)&&m.ts>seen).length;}
function members(){const seen={},M=idsOf(meta.me);return list('member').filter(m=>!M.has(m.id.slice(3))&&!seen[nname(m.name)||m.id]&&(seen[nname(m.name)||m.id]=1)).sort((a,b)=>(a.name||'').localeCompare(b.name||''));}
U.unread=()=>{if(!meta.code||!meta.me)return 0;let n=unreadIn('g');members().forEach(m=>{n+=unreadIn(m.id.slice(3));});return n;};
U.markSeen=room=>{meta.seen=meta.seen||{};const l=msgs(room);meta.seen[room]=l.length?l[l.length-1].ts:now();A.persist();};
const linkify=t=>t.replace(/https:\/\/meet\.jit\.si\/[A-Za-z0-9_#.=&-]+/g,u=>`<a class="linkish" href="${u}" target="_blank" rel="noopener"><b>Join call</b></a>`);
function bubble(m){const me=mine(m),del=me?`<button class="x" data-act="msg-del" data-id="${m.id}" aria-label="Delete message">✕</button>`:'';
  return `<div class="bub ${me?'me':'them'}">${me?'':`<div class="bn">${esc(m.by||'')}</div>`}<div class="bt">${linkify(esc(m.text))}</div><div class="bm">${hhmm(m.ts)} ${del}</div></div>`;}
function msgsHtml(){const l=msgs(U.room);return l.length?l.map(bubble).join(''):`<div class="empty"><div class="e">💬</div>No messages yet — say hi!</div>`;}
U.chatRefresh=()=>{const el=document.getElementById('msgs');if(!el)return;const atEnd=el.scrollHeight-el.scrollTop-el.clientHeight<80;el.innerHTML=msgsHtml();U.markSeen(U.room);if(atEnd)el.scrollTop=el.scrollHeight;};
U.chatScroll=()=>{const el=document.getElementById('msgs');if(el)el.scrollTop=el.scrollHeight;};
function pageChat(){
  if(!meta.code) return top('Chat','Talk with the family')+`<div class="banner info"><h3>🔗 Connect first</h3><div class="sm">Chat works inside the family space. Create or join it in <a class="linkish" data-act="go" data-v="me">Profile → Family sync</a>.</div></div>`;
  if(!meta.me) return top('Chat','Talk with the family')+`<div class="empty"><div class="e">⏳</div>Connecting… one moment.</div>`;
  if(U.room){
    const dm=U.room!=='g',p=dm?list('member').find(m=>m.id==='mb_'+U.room):null,title=dm?(p?p.name:'Private chat'):'Family group';
    setTimeout(U.chatScroll,0);
    return `<div class="chathead"><button class="btn ghost sm" data-act="chat-back" aria-label="Back">‹ Back</button><div class="grow"><div class="b">${dm?'🔒 ':'👨‍👩‍👧 '}${esc(title)}</div><div class="xs mut">${dm?'Private — only you two can read this':'Everyone in the family space'}</div></div><button class="btn ghost sm" data-act="call" data-v="voice" aria-label="Voice call">📞</button><button class="btn ghost sm" data-act="call" data-v="video" aria-label="Video call">🎥</button></div><div class="msgs" id="msgs">${msgsHtml()}</div><div class="chatbar"><textarea id="chatin" class="ta" rows="1" maxlength="1000" placeholder="Write a message…"></textarea><button class="btn primary" data-act="chat-send" aria-label="Send">Send</button></div>`;
  }
  const row=(room,ic,name,sub)=>{const l=msgs(room),last=l[l.length-1],un=unreadIn(room);
    return `<button class="item chatrow" data-act="chat-open" data-v="${room}"><div class="ico">${ic}</div><div class="grow"><div class="t">${esc(name)}</div><div class="d">${last?esc((mine(last)?'You: ':'')+last.text).slice(0,60):esc(sub)}</div></div>${last?`<div class="xs mut">${ago(last.ts)}</div>`:''}${un?`<b class="bdg">${un}</b>`:''}</button>`;};
  const ms=members();
  let h=top('Chat','Talk with the family')+`<div class="stack"><button class="btn ghost sm" data-act="sync-leave" style="align-self:flex-end">🔒 Log out</button><div class="card"><h3>Group</h3>${row('g','👨‍👩‍👧','Family group','Everyone together')}</div><div class="card"><h3>Private chats 🔒</h3>`;
  h+=ms.length?ms.map(m=>row(m.id.slice(3),m.role==='her'?'💛':'🙂',m.name||'Family',m.role==='her'?'Message her privately':'Message privately')).join(''):`<div class="empty" style="padding:12px"><div class="e">👋</div>People appear here once they’ve opened the app. Private chats can only be read by the two people in them.</div>`;
  return h+`</div></div>`;
}

Object.assign(U,{stepsCard,pageChat,pageHome,pageFood,pageProgress,pageCare,pageMe,top,planHtml,treatsHtml});
})();
