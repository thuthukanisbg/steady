/* Steady — forms, actions, timers, onboarding, boot. */
(function(){
'use strict';
const A=window.A, SD=window.SD, U=A.ui;
const {esc,now,dayKey,hhmm,toLocalInput,ago,MIN,HOUR,cfg,saveSettings,put,list,fmtG,fromIn,unitL,gstat,SL,meta,persist}=A;
const $=(s,e=document)=>e.querySelector(s), $$=(s,e=document)=>[...e.querySelectorAll(s)];
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
let F={}, pendingRender=false, tt;

/* ---------- toast / sheet / render ---------- */
A.toast=m=>toast(m);
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),2800);}
function sheet(html){const s=$('#sheet');s.innerHTML=`<div class="scrim" data-act="close"></div><div class="panel" role="document"><div class="grab"></div>${html}</div>`;s.classList.add('open');document.body.style.overflow='hidden';}
function setBody(html){$('#sheet .panel').innerHTML='<div class="grab"></div>'+html;}
function closeSheet(){const s=$('#sheet');s.classList.remove('open');s.innerHTML='';document.body.style.overflow='';F={};if(pendingRender){pendingRender=false;softRender();}}
function renderNav(){
  const un=U.unread?U.unread():0, ch=['chat','💬','Chat'+(un?' <b class="bdg">'+(un>9?'9+':un)+'</b>':'')];
  const it=meta.ro?[['home','🏠','Home'],['food','🥗','Food'],['progress','📊','Progress'],['care','💞','Care'],ch]:[['home','🏠','Home'],['food','🥗','Food'],null,['progress','📊','Progress'],['care','💞','Care'],ch];
  $('#nav').style.gridTemplateColumns=it.map(i=>i?'1fr':'72px').join(' ');
  $('#nav').innerHTML=it.map(i=>i?`<button class="n ${U.tab===i[0]?'on':''}" data-act="go" data-v="${i[0]}"><span class="i">${i[1]}</span>${i[2]}</button>`:`<button class="fab" data-act="add" data-v="glucose" aria-label="Add entry">＋</button>`).join('');
}
let rendering=false;
function render(quiet){
  if(rendering) return; rendering=true;
  try{
    const fn={home:U.pageHome,food:U.pageFood,progress:U.pageProgress,care:U.pageCare,chat:U.pageChat,me:U.pageMe}[U.tab];
    const html=`<div class="page${quiet?' noanim':''}">${fn()}</div>`;
    const ae=document.activeElement; if(ae&&ae!==document.body&&$('#view').contains(ae)){try{ae.blur()}catch(e){}}
    $('#view').innerHTML=html; renderNav(); tick();
  } finally { rendering=false; }
}
function softRender(){
  if(U.tab==='chat'&&U.room&&$('#msgs')){U.chatRefresh();renderNav();return;}
  const ae=document.activeElement, typing=ae&&/INPUT|TEXTAREA|SELECT/.test(ae.tagName);
  if($('#sheet').classList.contains('open')||typing){pendingRender=true;return;}
  const y=window.scrollY; render(true); window.scrollTo(0,y);
}
function go(tab){U.tab=tab;if(tab!=='chat')U.room=null;render();window.scrollTo(0,0);}
function withBadges(fn){
  const before=new Set(A.game().badges.filter(b=>b.got).map(b=>b.id)); const r=fn();
  const nb=A.game().badges.filter(b=>b.got&&!before.has(b.id)); if(nb.length) setTimeout(()=>toast('🏅 New badge: '+nb[0].n+'!'),500); return r;
}
function parseTime(el){if(!el||!el.value) return 0;const t=new Date(el.value).getTime();return (!t||t>now()+5*MIN)?0:t;}
function confirmSheet(msg,label,fn){F={yes:fn};sheet(`<h2>${msg}</h2><div class="row mt2"><button class="btn ghost grow" data-act="close">Cancel</button><button class="btn danger grow" data-act="yes">${label}</button></div>`);}
const timeNote=()=>`<details class="acc"><summary>Change time or add a note</summary><label class="f">Time</label><input class="inp" type="datetime-local" id="ft" value="${toLocalInput(now())}" max="${toLocalInput(now()+MIN)}"><label class="f">Note</label><input class="inp" id="fn" placeholder="Optional"></details>`;
const stepEl=()=>{};

/* ---------- add sheet ---------- */
const KINDS=[['glucose','🩸','Sugar'],['insulin','💉','Insulin'],['meal','🍽️','Meal'],['walk','🚶','Walk'],['mood','🙂','Mood'],['treat','🍫','Treat']];
const forms={};
function addHtml(){return `<div class="hscroll" style="margin-bottom:6px">${KINDS.map(k=>`<button class="chip scroll ${F.kind===k[0]?'on':''}" data-act="add" data-v="${k[0]}">${k[1]} ${k[2]}</button>`).join('')}</div>`+forms[F.kind]();}
function openAdd(kind,pre){F=Object.assign({kind},pre||{});sheet(addHtml());const el=$('#gv')||$('#iu');if(el)setTimeout(()=>el.focus(),280);}

forms.glucose=()=>{
  const hr=new Date().getHours(), had=A.today().g.length;
  if(!F.ctx) F.ctx=(!had&&hr<10)?'fasting':hr>=21?'bed':'random';
  return `<h2>Log sugar</h2><div class="sm mut">Type your meter reading.</div>
  <div class="center mt"><input id="gv" class="inp bigin" type="number" inputmode="decimal" step="any" placeholder="0.0" aria-label="Glucose reading"><div class="mut sm" style="margin-top:4px">${unitL()}</div></div>
  <label class="f">When was it?</label><div class="chips">${SD.contexts.map(c=>`<button class="chip ${F.ctx===c[0]?'on':''}" data-act="pick" data-grp="ctx" data-v="${c[0]}">${c[1]} ${c[2]}</button>`).join('')}</div>
  ${timeNote()}<button class="btn primary block mt2" data-act="save-glucose">Save reading</button>`;
};
function stackWarn(){
  const c=cfg(), ins=c.insulins[F.ins]; if(!ins||ins.c!=='rapid') return '';
  const lr=A.lastRapid(); if(!lr||now()-lr.ts>c.stack_hours*HOUR) return '';
  return `<div class="banner warn mt"><b>⚠️ Heads-up:</b> ${esc(lr.name)} (${lr.units} u) was logged ${ago(lr.ts)}. Mealtime insulin can still be working — check your doctor’s plan before another dose.</div>`;
}
forms.insulin=()=>{
  const c=cfg(); if(F.ins==null) F.ins=0;
  return `<h2>Log insulin</h2>${c.plan_note?`<details class="acc"><summary>📋 Doctor’s plan</summary><div class="sm" style="white-space:pre-wrap;margin-top:8px">${esc(c.plan_note)}</div></details>`:''}
  <label class="f">Which insulin?</label><div class="chips">${c.insulins.map((i,k)=>`<button class="chip ${F.ins===k?'on':''}" data-act="pick" data-grp="ins" data-v="${k}">${esc(i.n)}</button>`).join('')}<button class="chip ${F.ins==='o'?'on':''}" data-act="pick" data-grp="ins" data-v="o">Other…</button></div>
  ${F.ins==='o'?'<input class="inp mt" id="insother" placeholder="Insulin name">':''}
  <label class="f">Units taken</label><input class="inp bigin" style="font-size:44px;height:80px" id="iu" type="number" inputmode="decimal" step="0.5" placeholder="0">
  <div id="stackwarn">${stackWarn()}</div>${timeNote()}<button class="btn primary block mt2" data-act="save-insulin">Save dose</button><div class="disc center">Steady only records doses. It never suggests how much to take.</div>`;
};
function mealResults(q){
  q=(q||'').trim().toLowerCase(); let idx;
  if(q) idx=SD.foods.map((f,i)=>i).filter(i=>SD.foods[i].n.toLowerCase().includes(q));
  else{const cnt={};list('meal').slice(0,40).forEach(m=>(m.items||[]).forEach(it=>{const i=SD.foods.findIndex(f=>f.n===it.n);if(i>=0)cnt[i]=(cnt[i]||0)+1;}));
    idx=Object.keys(cnt).map(Number).sort((a,b)=>cnt[b]-cnt[a]); ['Stiff pap','Eggs','Apple','Grilled chicken','Morogo / spinach','Seed / low-GI bread','Water'].forEach(n=>{const i=SD.foods.findIndex(f=>f.n===n);if(i>=0&&!idx.includes(i))idx.push(i);});}
  idx=idx.slice(0,12);
  return idx.length?`<div class="chips">${idx.map(i=>{const f=SD.foods[i];return `<button class="chip" data-act="meal-add" data-fi="${i}">${f.e} ${esc(f.n)} <span class="mut">${f.c}g</span></button>`}).join('')}</div>`:'<div class="sm mut">No match — use “Add something not in the list”.</div>';
}
function mealTotal(){return Math.round((F.items||[]).reduce((a,i)=>a+i.c*i.q,0));}
function mealSel(){
  const c=cfg(), items=F.items||[]; if(!items.length) return '<div class="sm mut center" style="padding:14px 0">Nothing added yet — tap foods above.</div>';
  const tot=mealTotal(), tg=F.slot==='snack'?c.carb_snack:c.carb_meal, r=tot/tg;
  const pill=r<=1?['ok','within target ✓']:r<=1.25?['warn','a little over']:['bad','over target'];
  return items.map((it,i)=>`<div class="item"><div class="ico">${it.e||'🍽️'}</div><div class="grow"><div class="t sm">${esc(it.n)}</div><div class="d">${it.c} g each</div></div><div class="stepper"><button data-act="meal-q" data-i="${i}" data-d="-0.5" aria-label="Less">−</button><span>${it.q}</span><button data-act="meal-q" data-i="${i}" data-d="0.5" aria-label="More">＋</button></div></div>`).join('')+
  `<div class="card flat mt"><div class="row between"><b>${tot} g carbs</b><span class="pill ${pill[0]}">${pill[1]}</span></div><div class="meter"><i style="width:${Math.min(100,r*100)}%;${r>1?'background:linear-gradient(90deg,var(--high),var(--crit-high))':''}"></i></div><div class="xs mut" style="margin-top:4px">Target for a ${F.slot}: about ${tg} g</div></div>`;
}
forms.meal=()=>{
  if(!F.slot){const h=new Date().getHours();F.slot=h<10?'breakfast':h<12?'snack':h<15?'lunch':h<17?'snack':h<21?'dinner':'snack';}
  F.items=F.items||[];
  return `<h2>Log a meal</h2><div class="chips">${['breakfast','lunch','dinner','snack'].map(s=>`<button class="chip ${F.slot===s?'on':''}" data-act="pick" data-grp="slot" data-v="${s}">${cap(s)}</button>`).join('')}</div>
  <label class="f">Add foods</label><input class="inp" id="mq" placeholder="🔍 Search: pap, apple, egg…" autocomplete="off"><div id="mres" class="mt">${mealResults('')}</div>
  <div id="msel" class="mt">${mealSel()}</div>
  <details class="acc"><summary>Add something not in the list</summary><div class="row mt"><input class="inp" id="cname" placeholder="Food"><input class="inp" id="ccarb" type="number" inputmode="numeric" placeholder="g carbs" style="width:110px"></div><button class="btn soft block mt" data-act="meal-custom">Add to meal</button></details>
  ${timeNote()}<button class="btn primary block mt2" data-act="save-meal">Save meal</button>`;
};
forms.walk=()=>{
  const c=cfg(); F.kind2=F.kind2||'walk';
  return `<h2>Walk / activity</h2>
  <div class="banner good"><b>Before you go</b><div class="sm">Check your sugar. If it’s on the low side, have a small carb snack first (ask your care team what’s right for you). Skip it if sugar is very high and you feel unwell. Carry fast sugar and water.</div></div>
  <button class="btn coral block mt" data-act="walk-start">▶ Start live timer</button>
  <div class="center mut sm mt">— or log a finished one —</div>
  <label class="f">Minutes</label><input class="inp bigin" style="font-size:44px;height:80px" id="wm" type="number" inputmode="numeric" placeholder="${c.walk_goal}">
  <label class="f">Type</label><div class="chips">${[['walk','🚶 Walk'],['jog','🏃 Jog'],['gym','🏋️ Gym'],['chores','🧹 Active chores']].map(([k,l])=>`<button class="chip ${F.kind2===k?'on':''}" data-act="pick" data-grp="kind2" data-v="${k}">${l}</button>`).join('')}</div>
  ${timeNote()}<button class="btn primary block mt2" data-act="save-walk">Save</button>`;
};
forms.mood=()=>{
  F.mood=F.mood||4; F.sym=F.sym||[]; F.stress=F.stress||'low';
  return `<h2>How are you feeling?</h2><div class="moods mt">${SD.moods.map((m,i)=>`<button class="${F.mood===i+1?'on':''}" data-act="pick" data-grp="mood" data-v="${i+1}" aria-label="Mood ${i+1}">${m}</button>`).join('')}</div>
  <label class="f">Anything going on? (tap all that apply)</label><div class="chips">${SD.symptoms.map(s=>`<button class="chip ${F.sym.includes(s)?'on':''}" data-act="toggle" data-grp="sym" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>
  <div class="grid2"><div><label class="f">Sleep last night (h)</label><input class="inp" id="sl" type="number" inputmode="decimal" step="0.5" placeholder="7"></div><div><label class="f">Stress</label><div class="chips">${['low','medium','high'].map(s=>`<button class="chip ${F.stress===s?'on':''}" data-act="pick" data-grp="stress" data-v="${s}">${cap(s)}</button>`).join('')}</div></div></div>
  ${timeNote()}<button class="btn primary block mt2" data-act="save-mood">Save</button>`;
};
forms.treat=()=>{
  const c=cfg(), wt=A.weekTreats();
  return `<h2>Log a treat</h2><div class="sm mut">${wt.n} of ${c.treats_week} treats used this week</div>
  <label class="f">Quick pick</label><div class="chips">${SD.treats.map((t,i)=>`<button class="chip" data-act="treat-pick" data-i="${i}">${t.e} ${esc(t.n)}</button>`).join('')}</div>
  <label class="f">What was it?</label><input class="inp" id="tw" placeholder="e.g. Half a koeksister">
  <label class="f">Approx. carbs (g)</label><input class="inp" id="tc" type="number" inputmode="numeric" placeholder="15">
  <label class="f">Was it…</label><div class="chips"><button class="chip ${!F.craving?'on':''}" data-act="pick" data-grp="craving" data-v="0">📅 Planned</button><button class="chip ${F.craving?'on':''}" data-act="pick" data-grp="craving" data-v="1">⚡ A craving</button></div>
  ${timeNote()}<button class="btn coral block mt2" data-act="save-treat">Save treat</button>`;
};

function showResult(rec){
  const st=gstat(rec.v), s=SL[st];
  sheet(`<div class="center"><div class="display" style="font-size:68px;line-height:1">${fmtG(rec.v)}</div><div class="mut">${unitL()}</div><span class="pill ${s.pill}" style="margin-top:8px">${s.e} ${s.t}</span></div><div class="mt">${U.guideCard(st,rec.ctx)}</div><button class="btn primary block mt" data-act="close">Done</button>`);
}

/* ---------- actions ---------- */
const ACT={};
ACT.go=el=>{closeSheet();go(el.dataset.v);};
ACT.close=()=>closeSheet();
ACT.yes=()=>{const f=F.yes;closeSheet();f&&f();};
const _add=null;
ACT.add=el=>openAdd(el.dataset.v);
ACT.pick=el=>{
  const g=el.dataset.grp,v=el.dataset.v;
  F[g]=g==='ins'?(v==='o'?'o':parseInt(v,10)):g==='craving'?v==='1':g==='mood'?parseInt(v,10):v;
  if(g==='ins'){const u=$('#iu')&&$('#iu').value;setBody(addHtml());if(u)$('#iu').value=u;return;}
  $$('#sheet [data-grp="'+g+'"]').forEach(b=>b.classList.toggle('on',b===el));
  if(g==='slot'&&$('#msel')) $('#msel').innerHTML=mealSel();
};
ACT.toggle=el=>{const g=el.dataset.grp,v=el.dataset.v;F[g]=F[g]||[];const i=F[g].indexOf(v);if(i>=0)F[g].splice(i,1);else F[g].push(v);el.classList.toggle('on',i<0);};
ACT.sub=el=>{U.sub[el.dataset.p]=el.dataset.v;render();};
ACT.prog=el=>{U.prog=+el.dataset.v;render();};
ACT['food-filter']=el=>{U.foodF=el.dataset.v;render();};
ACT.tip=el=>{const t=$('#tip'+el.dataset.i);if(t)t.style.display=t.style.display==='none'?'block':'none';};
ACT['plan-day']=el=>{U.planDay=+el.dataset.v;render();};
ACT['plan-log']=el=>{
  const i=+el.dataset.i,day=U.planDay,x=SD.plan[day][i];
  withBadges(()=>put({type:'meal',slot:x.s.toLowerCase(),items:[{n:x.ti,c:x.c,q:1}],carbs:x.c,pk:dayKey(now())+'|'+day+'|'+i}));
  render(true);toast('Logged ✔ +4 pts');
};
ACT['remind-go']=el=>{const k=el.dataset.k;if(k==='sugar')openAdd('glucose');else if(k==='insulin')openAdd('insulin');else if(k==='walk')openAdd('walk');else{U.sub.food='plan';U.planDay=new Date().getDay();go('food');}};

ACT['save-glucose']=()=>{
  const raw=parseFloat($('#gv').value); if(!(raw>0)){toast('Enter your reading first');return;}
  const v=fromIn(raw); if(v<0.5||v>45){toast('That number looks off — please double-check');return;}
  const ts=parseTime($('#ft'))||now(), ctx=F.ctx, note=($('#fn').value||'').trim();
  const rec=withBadges(()=>put({type:'glucose',v:Math.round(v*100)/100,ctx,note,ts}));
  meta.recheck=0;persist();A.notifyServer(rec);closeSheet();render(true);showResult(rec);
};
ACT['save-insulin']=()=>{
  const c=cfg(), u=parseFloat($('#iu').value); if(!(u>0)||u>300){toast('Enter the units taken');return;}
  let name,cat; if(F.ins==='o'){name=($('#insother').value||'').trim();cat='other';if(!name){toast('Name the insulin');return;}}else{const i=c.insulins[F.ins]||c.insulins[0];if(!i){toast('Add an insulin in Profile first');return;}name=i.n;cat=i.c;}
  withBadges(()=>put({type:'insulin',name,cat,units:u,note:($('#fn').value||'').trim(),ts:parseTime($('#ft'))||now()}));
  closeSheet();render(true);toast('💉 Dose logged');
};
ACT['meal-add']=el=>{const f=SD.foods[+el.dataset.fi],ex=F.items.find(x=>x.n===f.n);if(ex)ex.q+=1;else F.items.push({n:f.n,c:f.c,q:1,e:f.e});$('#msel').innerHTML=mealSel();};
ACT['meal-q']=el=>{const i=+el.dataset.i,it=F.items[i];it.q=Math.round((it.q+parseFloat(el.dataset.d))*2)/2;if(it.q<=0)F.items.splice(i,1);$('#msel').innerHTML=mealSel();};
ACT['meal-custom']=()=>{const n=($('#cname').value||'').trim(),c=parseFloat($('#ccarb').value);if(!n||!(c>=0)){toast('Add a name and carbs');return;}F.items.push({n,c,q:1,e:'🍽️'});$('#cname').value='';$('#ccarb').value='';$('#msel').innerHTML=mealSel();};
ACT['save-meal']=()=>{
  if(!F.items.length){toast('Add at least one food');return;}
  const tot=mealTotal(), tg=F.slot==='snack'?cfg().carb_snack:cfg().carb_meal;
  withBadges(()=>put({type:'meal',slot:F.slot,items:F.items.map(i=>({n:i.n,c:i.c,q:i.q})),carbs:tot,note:($('#fn').value||'').trim(),ts:parseTime($('#ft'))||now()}));
  closeSheet();render(true);toast(tot>tg*1.25?`🍽️ Logged ${tot} g — a bit over target, walk after if you can`:'🍽️ Meal logged +4 pts');
};
ACT['walk-start']=()=>{meta.walkStart=now();persist();closeSheet();render(true);toast('Timer started — enjoy your walk 🚶');};
ACT['walk-finish']=()=>{
  const min=Math.max(1,Math.round((now()-meta.walkStart)/MIN)), ts=meta.walkStart; meta.walkStart=0;
  withBadges(()=>put({type:'walk',min,kind:'walk',ts}));render(true);toast(`🚶 ${min} min logged — nice!`);
  setTimeout(()=>{openAdd('glucose',{ctx:'walk'});toast('Check your sugar after your walk');},700);
};
ACT['save-walk']=()=>{
  const m=parseFloat($('#wm').value);if(!(m>0)||m>600){toast('Enter minutes');return;}
  withBadges(()=>put({type:'walk',min:Math.round(m),kind:F.kind2,note:($('#fn').value||'').trim(),ts:parseTime($('#ft'))||now()}));
  closeSheet();render(true);toast('🚶 Activity logged');
};
ACT['save-mood']=()=>{
  const sym=F.sym.slice(), low=sym.filter(s=>['Shaky','Sweaty','Dizzy','Very hungry','Fast heartbeat','Irritable'].includes(s)).length, high=sym.filter(s=>['Very thirsty','Need to wee a lot','Blurry vision'].includes(s)).length;
  withBadges(()=>put({type:'mood',mood:F.mood,symptoms:sym,sleep:parseFloat($('#sl').value)||0,stress:F.stress,note:($('#fn').value||'').trim(),ts:parseTime($('#ft'))||now()}));
  closeSheet();render(true);
  if(low>=2||high>=2){setTimeout(()=>sheet(`<h2>Check your sugar now</h2><p class="lead mt">${low>=2?'Shaky, sweaty, dizzy or hungry can be signs of <b>low</b> sugar.':'Very thirsty, blurry vision or lots of wees can be signs of <b>high</b> sugar.'} A quick check tells you what to do.</p><button class="btn primary block mt2" data-act="add" data-v="glucose">🩸 Log my sugar</button>`),300);}
  else toast('🙂 Mood logged');
};
ACT['treat-pick']=el=>{const t=SD.treats[+el.dataset.i];$('#tw').value=t.n;$('#tc').value=t.c;};
ACT['save-treat']=()=>{
  const what=($('#tw').value||'').trim(); if(!what){toast('What did you have?');return;}
  const c=cfg(), before=A.weekTreats().n;
  withBadges(()=>put({type:'treat',what,carbs:parseFloat($('#tc').value)||0,craving:!!F.craving,note:($('#fn').value||'').trim(),ts:parseTime($('#ft'))||now()}));
  closeSheet();render(true);
  toast(before+1>c.treats_week?'Over this week’s budget — that’s okay, tomorrow is a fresh start 💛':'🍫 Enjoy it! Recheck sugar in about 2 hours.');
};
ACT.recheck=()=>{meta.recheck=now()+15*MIN;persist();closeSheet();render(true);toast('⏱️ Timer set — recheck in 15 minutes');};
ACT['treat-pause']=()=>{meta.pause=now()+15*MIN;persist();render(true);toast('⏳ Pausing 15 minutes. Drink some water.');};
ACT['treat-resist']=()=>{withBadges(()=>put({type:'resist'}));meta.pause=0;persist();render(true);toast('🎉 Cravings beaten +15 pts — proud of you!');};
ACT['rescue-list']=()=>sheet(`<h2>Fast sugar for a low</h2><div class="sm mut">About 15 g — pick one:</div><div class="mt">${SD.rescue.map(r=>`<div class="item"><div class="ico">${r[0]}</div><div class="grow"><div class="t">${r[1]}</div><div class="d">${r[2]}</div></div></div>`).join('')}</div><div class="banner crit mt"><div class="sm">Recheck in 15 minutes and repeat if still low. If she can’t swallow or is confused, call <b>10177</b> / <b>112</b>.</div></div><button class="btn primary block mt" data-act="close">Got it</button>`);
ACT.del=el=>{const id=el.dataset.id;confirmSheet('Delete this entry?','Delete',()=>{A.del(id);render(true);toast('Deleted');});};
ACT['note-kind']=el=>{const t=($('#notetext')||{}).value||'';U.noteKind=el.dataset.v;render(true);$('#notetext').value=t;};
ACT['note-post']=()=>{const t=($('#notetext').value||'').trim();if(!t){toast('Write something first');return;}put({type:'note',kind:U.noteKind,text:t});render(true);toast('Posted 💌');};
ACT['note-del']=el=>{const id=el.dataset.id;confirmSheet('Delete this?','Delete',()=>{A.del(id);render(true);});};
ACT['react']=el=>{const t=el.dataset.id,e=el.dataset.e,id='rx_'+t+'_'+(meta.me||'loc'),cur=A.recs()[id];
  if(cur&&!cur.del&&cur.e===e){A.del(id);} else {put({id,type:'react',t,e});}
  softRender();};
ACT['post-photo']=()=>{const f=$('#postfile');if(f)f.click();};
ACT['post-clear']=()=>{U.postImg='';render(true);};
ACT['post-go']=()=>{const cap=(($('#postcap')||{}).value||'').trim().slice(0,400);
  if(!U.postImg){toast('Choose a photo first 📷');return;}
  put({type:'post',text:cap,img:U.postImg});U.postImg='';render(true);toast('Shared 📸');};
function shrinkImg(file){return new Promise((res,rej)=>{const url=URL.createObjectURL(file),im=new Image();
  im.onload=()=>{const M=640,k=Math.min(1,M/Math.max(im.naturalWidth,im.naturalHeight)),w=Math.round(im.naturalWidth*k),h=Math.round(im.naturalHeight*k),c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(im,0,0,w,h);URL.revokeObjectURL(url);
    let q=.7,d=c.toDataURL('image/jpeg',q);while(d.length>110000&&q>.3){q-=.1;d=c.toDataURL('image/jpeg',q);}
    d.length>135000||!d.startsWith('data:image/jpeg')?rej(new Error('big')):res(d);};
  im.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('bad'));};im.src=url;});}
document.addEventListener('change',async e=>{const t=e.target;if(t.id!=='postfile'||!t.files||!t.files[0])return;
  const cap=(($('#postcap')||{}).value||'');try{U.postImg=await shrinkImg(t.files[0]);U.postCap=cap;render(true);}catch(x){toast('Couldn’t use that photo — try another');}t.value='';});
A.onSessionEnd=why=>{render(true);toast(why==='session_expired'?'🔒 The PIN was changed — please log in again':'🔒 Logged out — please log in again');setTimeout(()=>ACT['open-sync']({dataset:{v:'join'}}),400);};

/* profile actions */
ACT.role=el=>{if(meta.ro)return;meta.role=el.dataset.v;persist();render(true);};
ACT.avatar=el=>{saveSettings({avatar:el.dataset.v});render(true);};
ACT.unit=el=>{saveSettings({units:el.dataset.v});render(true);};
ACT.tog=el=>{const k=el.dataset.k;saveSettings({[k]:!cfg()[k]});render(true);};
ACT['ins-add']=()=>{const n=($('#insname').value||'').trim();if(!n){toast('Type the insulin name');return;}saveSettings({insulins:[...cfg().insulins,{n,c:$('#inscat').value}]});render(true);toast('Added');};
ACT['ins-del']=el=>{const i=+el.dataset.i;confirmSheet('Remove this insulin?','Remove',()=>{saveSettings({insulins:cfg().insulins.filter((_,k)=>k!==i)});render(true);});};
ACT['rem-toggle']=el=>{saveSettings({reminders:cfg().reminders.map(r=>r.id===el.dataset.id?{...r,on:!r.on}:r)});render(true);};
ACT['rem-del']=el=>{saveSettings({reminders:cfg().reminders.filter(r=>r.id!==el.dataset.id)});render(true);};
ACT['rem-add']=()=>{const l=($('#remlabel').value||'').trim();if(!l){toast('Name the reminder');return;}saveSettings({reminders:[...cfg().reminders,{id:A.uid(),l,t:$('#remtime').value||'12:00',k:$('#remkind').value,on:true}]});render(true);toast('Reminder added');};
ACT['carer-add']=()=>{const e=($('#careremail').value||'').trim().toLowerCase();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)){toast('That email doesn’t look right');return;}const cur=cfg().carers||[];if(cur.includes(e)||cur.length>=5){toast(cur.includes(e)?'Already added':'Up to 5 emails');return;}saveSettings({carers:[...cur,e]});render(true);toast('Added');};
ACT['follow-add']=()=>{
  const e=($('#careremail').value||'').trim().toLowerCase(), n=(($('#carername')||{}).value||'').trim().slice(0,40);
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)){toast('That email doesn’t look right');return;}
  const fs=A.list('follower'); if(fs.some(f=>f.email===e)||(cfg().carers||[]).includes(e)){toast('Already added');return;} if(fs.length>=10){toast('Up to 10 people');return;}
  put({type:'follower',email:e,name:n||(meta.ro?meta.who:'')||''});render(true);toast('Added ✔');};
ACT['follow-del']=el=>{A.del(el.dataset.id);render(true);toast('Removed');};
ACT['famepin']=()=>sheet(`<h2>Family view-only PIN</h2><div class="lead">Family who join with <b>this</b> PIN can watch everything but can’t change anything. Keep her own PIN to yourself.</div><label class="f">Family PIN (4–8 digits, different from yours)</label><input class="inp" id="fpin" inputmode="numeric" maxlength="8" value="${esc(meta.vpin||'')}" autocomplete="off"><button class="btn primary block mt2" data-act="famepin-go">Save family PIN</button><div id="fperr" class="sm" style="color:var(--crit-low);margin-top:8px"></div>`);
ACT['pinchg']=()=>sheet(`<h2>Change her PIN</h2><div class="lead">Everyone else — family and any other phone — will be logged out and must log in again with the new PIN(s).</div><label class="f">New PIN (4–8 digits)</label><input class="inp" id="npin" inputmode="numeric" maxlength="8" autocomplete="off"><button class="btn primary block mt2" data-act="pinchg-go">Change PIN</button><div id="nperr" class="sm" style="color:var(--crit-low);margin-top:8px"></div>`);
ACT['pinchg-go']=async el=>{const v=($('#npin').value||'').trim(),err=$('#nperr');if(!/^\d{4,8}$/.test(v)){err.textContent='4–8 digits please.';return;}if(v===meta.pin){err.textContent='That is already her PIN.';return;}if(v===meta.vpin){err.textContent='Must differ from the family PIN.';return;}el.disabled=true;const r=await A.doSync({newPin:v});if(!r.ok){el.disabled=false;err.textContent=(r.error&&r.error.message)||'Could not change — try again';return;}closeSheet();render(true);toast('PIN changed — everyone else must log in again');};
ACT['famepin-go']=async el=>{const v=($('#fpin').value||'').trim(),err=$('#fperr');if(!/^\d{4,8}$/.test(v)){err.textContent='4–8 digits please.';return;}if(v===meta.pin){err.textContent='Must be different from her PIN.';return;}el.disabled=true;const r=await A.doSync({vpin:v});if(!r.ok){el.disabled=false;err.textContent=(r.error&&r.error.message)||'Could not save — try again';return;}closeSheet();render(true);toast('Family PIN saved ✔ — everyone must log in again');};
ACT['show-fpin']=el=>{const s=$('#fpinshow');const on=s.textContent!=='••••';s.textContent=on?'••••':(meta.vpin||'(set on another phone)');el.textContent=on?'Show':'Hide';};
ACT['carer-del']=el=>{saveSettings({carers:cfg().carers.filter((_,k)=>k!==+el.dataset.i)});render(true);};
ACT['notif-enable']=()=>{if(!('Notification' in window)){toast('Not supported on this browser');return;}Notification.requestPermission().then(p=>{render(true);if(p==='granted'){notify('Steady','Reminders are on 🎉','welcome');}});};
ACT['show-pin']=el=>{const s=$('#pinshow');const on=s.textContent!=='••••';s.textContent=on?'••••':meta.pin;el.textContent=on?'Show':'Hide';};
ACT['sync-now']=async()=>{toast('Syncing…');const r=await A.doSync();toast(r.ok?'✔ Up to date':'Couldn’t sync — will retry');render(true);};
ACT['sync-leave']=()=>confirmSheet(meta.ro?'Log out? You’ll need the code and family PIN to see her updates again.':'Disconnect from the family space? Your data stays on this phone.',meta.ro?'Log out':'Disconnect',()=>{A.leaveSpace();render(true);});
ACT.export=()=>{const b=new Blob([A.exportCSV()],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='steady-'+dayKey(now())+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);};
ACT.reset=()=>confirmSheet('Erase all data on this phone? Synced data stays in the family space.','Erase',()=>{A.resetLocal();render(true);toast('Cleared');});
ACT.install=async()=>{if(!U.deferred)return;U.deferred.prompt();await U.deferred.userChoice;U.deferred=null;meta.installSeen=2;persist();render(true);};
ACT['install-dismiss']=()=>{meta.installSeen=2;persist();render(true);};

/* sync + onboarding sheets */
function syncHtml(){
  const create=F.mode==='create';
  return `<h2>${create?'Create a family space':'Join with a code'}</h2><div class="lead">${create?'You’ll get a code. Share it and your PIN with family so they can join.':'Type the code and PIN you were given.'}</div>
  <label class="f">Family code</label><input class="inp" id="scode" value="${esc(F.code||'')}" ${create?'readonly':''} placeholder="XXXX-XXXX-XXXX" autocapitalize="characters" autocomplete="off" style="font-weight:800;letter-spacing:.06em">
  <label class="f">${create?'Choose a PIN (4–8 digits)':'PIN'}</label><input class="inp" id="spin" inputmode="numeric" maxlength="8" placeholder="••••" autocomplete="off">
  ${create?`<label class="f">Family view-only PIN (optional — family can watch but not edit)</label><input class="inp" id="svpin" inputmode="numeric" maxlength="8" placeholder="e.g. a different 4–8 digits" autocomplete="off">`:'<div class="disc">Family: use the <b>family PIN</b> you were given — it opens a view-only copy.</div>'}
  <button class="btn primary block mt2" data-act="sync-go">${create?'Create & connect':'Join'}</button><div id="syncerr" class="sm" style="color:var(--crit-low);margin-top:8px"></div>`;
}
ACT['open-sync']=el=>{F={step:'sync',mode:el.dataset.v,code:el.dataset.v==='create'?A.genCode():''};sheet(syncHtml());};
ACT['sync-go']=async el=>{
  const code=($('#scode').value||'').trim().toUpperCase(), pin=($('#spin').value||'').trim(), err=$('#syncerr');
  if(code.replace(/-/g,'').length<8){err.textContent='That code looks too short.';return;}
  if(!/^\d{4,8}$/.test(pin)){err.textContent='PIN must be 4–8 digits.';return;}
  const mode=F.mode, vp=(($('#svpin')||{}).value||'').trim();
  if(vp&&!/^\d{4,8}$/.test(vp)){err.textContent='Family PIN must be 4–8 digits.';return;}
  if(vp&&vp===pin){err.textContent='Family PIN must differ from her PIN.';return;}
  el.disabled=true;el.textContent='Connecting…';err.textContent='';
  const r=await A.joinSpace(code,pin,mode==='create',vp||undefined);
  if(!r.ok){el.disabled=false;el.textContent=mode==='create'?'Create & connect':'Join';err.textContent=r.msg+(r.msg.includes('Sync problem')?' Is the site deployed to Netlify with functions enabled?':'');return;}
  meta.onboarded=true;persist();
  if(mode==='create'){setBody(`<div class="center" style="font-size:54px">🎉</div><h2 class="center">Family space ready</h2><p class="center lead">Share these on the other phone (Profile → Family sync → Join):</p><div class="card mt center"><div class="b" style="font-size:22px;letter-spacing:.08em">${esc(code)}</div><div class="mut sm mt">Her PIN (keep private)</div><div class="b" style="font-size:22px">${esc(pin)}</div>${vp?`<div class="mut sm mt">Family PIN (view-only — share this)</div><div class="b" style="font-size:22px">${esc(vp)}</div>`:''}</div><button class="btn primary block mt2" data-act="close">Done</button>`);}
  else{closeSheet();toast('Connected ✔');}
  render(true);
};
function obHtml(){
  if(F.step==='ob2') return `<div class="center" style="font-size:48px">🔗</div><h2 class="center">Link the phones?</h2><p class="center lead">So what she logs shows up on family’s phone — with alerts when it matters.</p>
  <button class="btn primary block mt2" data-act="open-sync" data-v="create">Create a family space</button><button class="btn soft block mt" data-act="open-sync" data-v="join">I have a code — join</button><button class="btn ghost block mt" data-act="close">Skip for now</button>`;
  const carer=F.role==='carer';
  return `<div class="center" style="font-size:54px">🌿</div><h2 class="center">Welcome to Steady</h2><p class="center lead">Track sugar, food, insulin and walks — together.</p>
  <label class="f">Who is using this phone?</label><div class="seg"><button class="${!carer?'on':''}" data-act="ob-role" data-v="patient">🌸 I have diabetes</button><button class="${carer?'on':''}" data-act="ob-role" data-v="carer">💞 I’m family</button></div>
  <label class="f">Your first name</label><input class="inp" id="obname" placeholder="First name" autocomplete="given-name">
  ${carer?'<label class="f">Her name</label><input class="inp" id="obher" placeholder="First name">':''}
  <button class="btn primary block mt2" data-act="ob-next">Continue</button>`;
}
ACT['ob-role']=el=>{const n=$('#obname').value;F.role=el.dataset.v;setBody(obHtml());$('#obname').value=n;};
ACT['ob-next']=()=>{
  const name=($('#obname').value||'').trim(), her=($('#obher')&&$('#obher').value||'').trim();
  meta.role=F.role; meta.who=name; meta.onboarded=true; persist();
  if(F.role==='carer'){ if(her) saveSettings({name:her}); } else if(name) saveSettings({name});
  F.step='ob2'; setBody(obHtml()); render(true);
};

/* ---------- notifications / timers ---------- */
function notify(title,body,tag){
  try{
    if(!('Notification' in window)||Notification.permission!=='granted') return;
    if(navigator.serviceWorker&&navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(r=>r.showNotification(title,{body,tag,icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',vibrate:[120,60,120]})).catch(()=>{try{new Notification(title,{body})}catch(e){}});
    else new Notification(title,{body});
  }catch(e){}
}
function fireReminder(r){toast('⏰ '+r.l);notify('Steady — '+r.l,'Tap to open',r.id);try{navigator.vibrate&&navigator.vibrate([150,80,150])}catch(e){}if(!$('#sheet').classList.contains('open'))softRender();}
let rcFor=0,pFor=0;
function tick(){
  $$('[data-cd]').forEach(e=>{const t=e.dataset.cd==='recheck'?meta.recheck:meta.pause;e.textContent=U.cd(t);});
  $$('[data-up]').forEach(e=>{e.textContent=U.cd(2*now()-meta.walkStart);});
  if(meta.recheck&&now()>=meta.recheck&&rcFor!==meta.recheck){rcFor=meta.recheck;notify('Recheck your sugar','15 minutes are up','recheck');softRender();}
  if(meta.pause&&now()>=meta.pause&&pFor!==meta.pause){pFor=meta.pause;notify('Craving timer done','Still want it? Choose a swap or a small treat.','pause');softRender();}
}
A.onData=softRender;
A.onRemoteAlert=arr=>{
  const r=arr[0],s=SL[gstat(r.v)]; if(meta.role!=='carer') return;
  const who=cfg().name||'She'; toast(`${s.e} ${who}: ${fmtG(r.v)} ${unitL()} — ${s.t.toLowerCase()}`); notify(`${s.e} ${who}’s sugar is ${s.t.toLowerCase()}`,`${fmtG(r.v)} ${unitL()} · ${ago(r.ts)}`,'alert-'+r.id);
};
A.sync.listeners.push(()=>{ if(U.tab==='me'||meta.code) { const dot=$('.sync-dot'); if(dot){const st=A.sync.state;dot.className='sync-dot '+(st==='on'?'on':st==='busy'?'busy':(st==='err'||st==='offline')?'err':'');} } });

/* ---------- events ---------- */
const RO_ALLOW=new Set(['go','close','yes','toggle','sub','prog','food-filter','tip','plan-day','note-kind','note-post','note-del','react','chat-open','chat-back','chat-send','msg-del','post-photo','post-clear','post-go','follow-add','follow-del','show-pin','show-fpin','sync-now','sync-leave','open-sync','sync-go','export','install','install-dismiss','rescue-list','ob-role','ob-next','notif-enable']);
document.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(!el)return;const f=ACT[el.dataset.act];if(f){e.preventDefault();if(meta.ro&&!RO_ALLOW.has(el.dataset.act)){toast('👀 View-only — family can look but not edit');return;}f(el,e);}});
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.id==='foodq'){U.foodQ=t.value;$('#foodlist').innerHTML=U.foodList();}
  else if(t.id==='mq'){$('#mres').innerHTML=mealResults(t.value);}
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.dataset.set){
    let v=t.value; if(t.dataset.num){v=parseFloat(v);if(!(v>=0)){render(true);return;}}
    saveSettings({[t.dataset.set]:v}); if(t.dataset.set==='name'&&meta.role!=='carer'){meta.who=v;persist();} toast('Saved ✔');
  } else if(t.dataset.gset){
    const k=t.dataset.gset,c=cfg(),v=fromIn(parseFloat(t.value)), n={crit_low:c.crit_low,low:c.low,high:c.high,crit_high:c.crit_high};n[k]=v;
    if(!(v>0)||!(n.crit_low<n.low&&n.low<n.high&&n.high<n.crit_high)){toast('Keep them in order: very low < low < high < very high');render(true);return;}
    saveSettings({[k]:Math.round(v*100)/100});toast('Saved ✔');
  } else if(t.dataset.rem){
    saveSettings({reminders:cfg().reminders.map(r=>r.id===t.dataset.rem?{...r,t:t.value||r.t}:r)});toast('Saved ✔');
  } else if(t.id==='whoname'){meta.who=t.value.trim();persist();toast('Saved ✔');}
});
document.addEventListener('toggle',e=>{const d=e.target;if(d&&d.classList&&d.classList.contains('sec'))U.open[d.dataset.k]=d.open;},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#sheet').classList.contains('open'))closeSheet();});

/* ---------- boot ---------- */
function boot(){
  if(meta.recheck&&now()-meta.recheck>30*MIN) meta.recheck=0;
  if(meta.pause&&now()-meta.pause>30*MIN) meta.pause=0;
  if(meta.walkStart&&now()-meta.walkStart>6*HOUR) meta.walkStart=0;
  persist();
  if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();U.deferred=e;if(U.tab==='home')softRender();});
  window.addEventListener('appinstalled',()=>{meta.installSeen=2;persist();});
  render();
  if(!meta.onboarded){F={step:'ob1',role:meta.role||'patient'};sheet(obHtml());}
  const qa=new URLSearchParams(location.search).get('add'); if(qa&&forms[qa]&&meta.onboarded) openAdd(qa);
  if(meta.code) A.doSync();
  setInterval(tick,1000);
  setInterval(()=>A.checkReminders(fireReminder),20000); A.checkReminders(fireReminder);
  setInterval(()=>{if(document.visibilityState==='visible'&&U.tab==='home')softRender();},60000);
}
boot();
})();

/* ---- chat ---- */
ACT['chat-open']=el=>{U.room=el.dataset.v;U.markSeen(U.room);render();U.chatScroll();};
ACT['chat-back']=()=>{U.room=null;render();};
ACT['chat-send']=()=>{const t=$('#chatin'),v=(t.value||'').trim();if(!v)return;
  const r=U.room;if(r==='g')put({type:'msg',room:'g',text:v.slice(0,1000)});else put({type:'msg',room:'d',to:r,text:v.slice(0,1000)});
  t.value='';U.markSeen(r);U.chatRefresh();t.focus();};
ACT['msg-del']=el=>{const id=el.dataset.id;confirmSheet('Delete this message?','Delete',()=>{A.del(id);U.chatRefresh();});};
document.addEventListener('keydown',e=>{if(e.target&&e.target.id==='chatin'&&e.key==='Enter'&&!e.shiftKey){e.preventDefault();ACT['chat-send']();}});
// keep my name on the member list so others can message me privately
function ensureMember(){if(!meta.code||!meta.me)return;const nm=meta.who||(meta.role==='carer'?'Family':(cfg().name||'Her')),id='mb_'+meta.me,cur=A.recs()[id];
  const role=meta.ro?'family':'her';if(!cur||cur.del||cur.by!==nm||cur.name!==nm||cur.role!==role)put({id,type:'member',name:nm,role,by:nm});}
A.sync.listeners.push(()=>{try{ensureMember()}catch(e){}});
// poll faster while the chat is open
setInterval(()=>{if(U.tab==='chat'&&document.visibilityState==='visible'&&meta.code)A.doSync();},5000);
