/* ============================================================
   WAFFLE HOUSE V11.1.37 — GLOBAL ASK WAFFLE
   Canonical intent routing + speaking Waffle avatars + global access.
   ============================================================ */
(function(){
'use strict';
const VERSION='11.1.37', SNAP='waffleAskWaffleSnapshotV11137', FULL=4;
const A=window.WAFFLE_AI_ASSETS||{};
const MONTHS={jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11};
const MP='(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
function page(){return String(window.WAFFLE_PAGE||document.body?.dataset?.wafflePage||'calendar')}
function clean(v){return String(v||'').toLowerCase().replace(/[’']/g,'').replace(/[–—]/g,'-').replace(/[^a-z0-9\s/&.-]/g,' ').replace(/\s+/g,' ').trim()}
function esc(v){try{if(typeof window.escapeDashboardHtml==='function')return window.escapeDashboardHtml(String(v??''))}catch(_){}return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
function cal(){try{if(window.globalCalendar?.getEvents)return window.globalCalendar}catch(_){}try{if(typeof globalCalendar!=='undefined'&&globalCalendar?.getEvents)return globalCalendar}catch(_){}return null}
function today(){const n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate())}
function key(v){const d=v instanceof Date?new Date(v):new Date(v);if(Number.isNaN(d.getTime()))return'';return[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function fromKey(k){const p=String(k||'').split('-').map(Number);if(p.length!==3||p.some(Number.isNaN))return null;const d=new Date(p[0],p[1]-1,p[2]);return Number.isNaN(d.getTime())?null:d}
function add(d,n){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()+n);return x}
function raw(e){if(e?._awSnap)return{start:e.start,end:e.end};try{if(typeof window.v10EventRawDates==='function'){const d=window.v10EventRawDates(e);if(d?.start&&d?.end)return d}}catch(_){}const s=String(e?.startStr||'').slice(0,10)||key(e?.start);let end=s;if(e?.end){const d=new Date(e.end);if(!Number.isNaN(d.getTime())){if(e.allDay!==false)d.setDate(d.getDate()-1);end=key(d)||s}}return{start:s,end}}
function props(e){return e?.extendedProps||{}}
function meet(e){return props(e).isMeetGreet===true||/meet\s*&?\s*greet/i.test(String(e?.title||''))}
function potential(e){return props(e).isPotential===true}
function out(e){try{if(typeof window.v110IsCheckedOutEvent==='function')return window.v110IsCheckedOutEvent(e)===true}catch(_){}return props(e).isCheckedOut===true||props(e).checkedOut===true}
function boarding(e){return!meet(e)&&!potential(e)&&!out(e)}
function dog(e){const d=String(props(e).dogName||'').trim();if(d)return d;let t=String(e?.title||'Guest').replace(/^.*?Meet\s*&?\s*Greet:\s*/i,'').trim();if(/\s[-–—]\s/.test(t))t=t.split(/\s[-–—]\s/)[0].trim();return t||'Guest'}
function time(e){const d=String(props(e).time||'').trim();if(d)return d;const m=String(e?.title||'').match(/\b(\d{1,2}:\d{2})\b/);return m?m[1]:''}
function overlap(e,r){const d=raw(e);return d.start&&d.end&&d.start<=r.end&&d.end>=r.start}
function occurs(e,k){const d=raw(e);return d.start&&d.end&&k>=d.start&&k<=d.end}
function live(){const c=cal();return c?c.getEvents().slice():[]}
function saveSnap(){const ev=live();if(!ev.length)return;const rows=ev.map(e=>{const d=raw(e);return{_awSnap:true,title:String(e.title||''),start:d.start,end:d.end,allDay:e.allDay!==false,extendedProps:{...(e.extendedProps||{})}}}).filter(x=>x.start);try{localStorage.setItem(SNAP,JSON.stringify({ts:Date.now(),events:rows}))}catch(_){}}
function events(){const l=live();if(l.length){saveSnap();return{rows:l,source:'live'}}try{const x=JSON.parse(localStorage.getItem(SNAP)||'null');return{rows:Array.isArray(x?.events)?x.events:[],source:Array.isArray(x?.events)&&x.events.length?'saved':'none'}}catch(_){return{rows:[],source:'none'}}}
function fmt(k,y=false){const d=fromKey(k);return d?d.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short',...(y?{year:'numeric'}:{})}):k}
function fmtRange(r){if(!r)return'';if(r.start===r.end)return fmt(r.start,true);return`${fmt(r.start)} – ${fmt(r.end,true)}`}
function week(next){const b=today(),day=b.getDay()||7;let m=add(b,1-day);if(next)m=add(m,7);return{start:key(m),end:key(add(m,6)),label:next?'next week':'this week'}}
function weekend(next){const b=today();let s=b.getDay()===6?b:b.getDay()===0?add(b,-1):add(b,6-b.getDay());if(next)s=add(s,7);return{start:key(s),end:key(add(s,1)),label:next?'next weekend':'this weekend'}}
function valid(y,m,d){const x=new Date(y,m,d);return x.getFullYear()===y&&x.getMonth()===m&&x.getDate()===d?x:null}
function mi(v){return Object.prototype.hasOwnProperty.call(MONTHS,String(v||'').toLowerCase())?MONTHS[String(v).toLowerCase()]:-1}
function dy(m){const n=today();return m<n.getMonth()?n.getFullYear()+1:n.getFullYear()}
function py(v,f){if(!v)return f;let y=Number(v);return y<100?y+2000:y}
function range(q){
 const s=clean(q),n=today();let m;
 if(/\bday after tomorrow\b/.test(s)){const k=key(add(n,2));return{start:k,end:k,label:'the day after tomorrow'}}
 if(/\btomorrow\b/.test(s)){const k=key(add(n,1));return{start:k,end:k,label:'tomorrow'}}
 if(/\btoday\b/.test(s)){const k=key(n);return{start:k,end:k,label:'today'}}
 if(/\bnext weekend\b/.test(s))return weekend(true);if(/\b(this )?weekend\b/.test(s))return weekend(false);if(/\bnext week\b/.test(s))return week(true);if(/\bthis week\b/.test(s))return week(false);
 m=s.match(new RegExp(`\\b${MP}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:to|until|through|-)\\s*(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(\\d{2,4}))?\\b`));if(m){const mm=mi(m[1]),y=py(m[4],dy(mm)),a=valid(y,mm,+m[2]),b=valid(y,mm,+m[3]);if(a&&b&&b>=a)return{start:key(a),end:key(b),label:'requested dates'}}
 m=s.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:to|until|through|-)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s+${MP}(?:\\s+(\\d{2,4}))?\\b`));if(m){const mm=mi(m[3]),y=py(m[4],dy(mm)),a=valid(y,mm,+m[1]),b=valid(y,mm,+m[2]);if(a&&b&&b>=a)return{start:key(a),end:key(b),label:'requested dates'}}
 m=s.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\s*(?:to|until|through|-)\s*(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/);if(m){const sm=+m[2]-1,em=+m[5]-1,sy=py(m[3],dy(sm));let ey=py(m[6],sy);if(!m[6]&&em<sm)ey++;const a=valid(sy,sm,+m[1]),b=valid(ey,em,+m[4]);if(a&&b&&b>=a)return{start:key(a),end:key(b),label:'requested dates'}}
 return null
}
function keys(r){const a=fromKey(r?.start),b=fromKey(r?.end),o=[];if(!a||!b||b<a)return o;for(let d=a;d<=b;d=add(d,1)){o.push(key(d));if(o.length>400)break}return o}
function count(ev,k){return ev.filter(boarding).filter(e=>occurs(e,k)).length}
function meetAns(ev,r){const x=ev.filter(meet).filter(e=>overlap(e,r)).sort((a,b)=>raw(a).start.localeCompare(raw(b).start));if(!x.length)return{text:`No — there are no Meet & Greets scheduled for ${r.label||fmtRange(r)}.`,tone:'muted'};return{text:`Yes — there ${x.length===1?'is':'are'} ${x.length} Meet & Greet${x.length===1?'':'s'} scheduled for ${r.label||fmtRange(r)}.`,list:x.slice(0,12).map(e=>`${dog(e)} — ${fmt(raw(e).start)}${time(e)?` at ${time(e)}`:''}`),overflow:Math.max(0,x.length-12)}}
function capAns(ev,r){const d=keys(r).map(k=>({k,c:count(ev,k)})),red=d.filter(x=>x.c>=FULL),amber=d.filter(x=>x.c===3);if(red.length)return{text:`No — ${fmtRange(r)} is not fully available. ${red.length} requested day${red.length===1?' is':'s are'} at Red/full capacity.`,list:red.map(x=>`${fmt(x.k)} — ${x.c}/4 dogs · Full capacity`),tone:'full'};return{text:`Yes — ${fmtRange(r)} is available. Every requested day is Green or Amber. Peak occupancy is ${Math.max(...d.map(x=>x.c),0)}/4 dogs.`,list:amber.length?amber.map(x=>`${fmt(x.k)} — 3/4 dogs · Amber · Busy`):['All requested dates are Green (0–2 dogs).'],tone:'available'}}
function dogSpecific(ev,q){
 const s=clean(q),names=[...new Set(ev.filter(boarding).map(dog).filter(Boolean))].sort((a,b)=>b.length-a.length),name=names.find(n=>s.includes(clean(n)));if(!name)return null;
 const stays=ev.filter(boarding).filter(e=>dog(e).toLowerCase()===name.toLowerCase()).map(e=>({...raw(e),e})).filter(x=>x.end>=key(today())).sort((a,b)=>a.start.localeCompare(b.start));if(!stays.length)return{text:`I cannot see an upcoming stay for ${name}.`,tone:'muted'};const x=stays[0];
 if(/\b(arriv|arrival|check in|check-in)\w*/.test(s))return{text:`${name} is arriving ${fmt(x.start,true)} and is booked through ${fmt(x.end)}.`};
 if(/\b(leav|depart|checkout|check out|check-out)\w*/.test(s))return{text:`${name} is leaving ${fmt(x.end,true)}. The stay starts ${fmt(x.start)}.`};
 if(/\b(stay|booking|booked|when|next)\b/.test(s))return{text:`${name}’s next stay is ${fmt(x.start,true)} to ${fmt(x.end,true)}.`};return null
}
function fallback(ev,q){
 const s=clean(q),r=range(q)||(/\bnext week\b/.test(s)?week(true):/\bthis week\b/.test(s)?week(false):null),ds=dogSpecific(ev,q);if(ds)return ds;
 if(/\b(meet\s*&?\s*greet|meet and greet|meet greets?|m&g)\b/.test(s))return meetAns(ev,r||{start:key(today()),end:key(add(today(),30)),label:'the next 30 days'});
 if(/\b(capacity|available|availability|room|space|fit|booking|request)\b/.test(s)&&r)return capAns(ev,r);
 const rr=r||{start:key(today()),end:key(today()),label:'today'};
 if(/\b(arriv|arrival|check in|check-in)\w*/.test(s)){const x=ev.filter(boarding).filter(e=>{const d=raw(e);return d.start>=rr.start&&d.start<=rr.end});return{x:x,text:x.length?`${x.length} dog${x.length===1?' is':'s are'} arriving ${rr.label}.`:`No dogs are arriving ${rr.label}.`,list:x.map(e=>`${dog(e)} — ${fmt(raw(e).start)}`)}}
 if(/\b(leav|depart|checkout|check out|check-out)\w*/.test(s)){const x=ev.filter(boarding).filter(e=>{const d=raw(e);return d.end>=rr.start&&d.end<=rr.end});return{text:x.length?`${x.length} dog${x.length===1?' is':'s are'} leaving ${rr.label}.`:`No dogs are leaving ${rr.label}.`,list:x.map(e=>`${dog(e)} — ${fmt(raw(e).end)}`)}}
 if(/\b(who|which dogs?|staying|at home|here|boarding)\b/.test(s)){const names=[...new Set(ev.filter(boarding).filter(e=>overlap(e,rr)).map(dog))].sort();return{text:names.length?`${names.length} dog${names.length===1?' is':'s are'} scheduled during ${rr.label}:`:`No boarding dogs are scheduled during ${rr.label}.`,list:names}}
 return null
}
function style(){
 if(document.getElementById('aw37style'))return;
 const s=document.createElement('style');s.id='aw37style';s.textContent=`
 .aw37-launch{display:inline-flex;align-items:center;gap:7px;min-height:40px;padding:7px 11px;border:1px solid color-mix(in srgb,var(--wh-accent,#0f6292) 30%,transparent);border-radius:999px;background:var(--wh-surface,#fff);color:var(--wh-text,#10243a);font:inherit;font-size:11px;font-weight:900;cursor:pointer;box-shadow:0 8px 24px rgba(15,23,42,.12);z-index:2147481000}.aw37-launch img{width:30px;height:30px;object-fit:contain}.aw37-launch.float{position:fixed;right:18px;bottom:22px}body.dark-theme .aw37-launch{background:#18253a;border-color:#31557c;color:#f8fafc}
 #v11133AskWaffleModal{position:fixed;inset:0;z-index:2147482200;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.52);backdrop-filter:blur(8px)}#v11133AskWaffleModal[hidden]{display:none!important}.aw37-card{display:grid;grid-template-rows:auto auto minmax(220px,1fr) auto auto;width:min(720px,calc(100vw - 36px));max-height:min(88dvh,820px);overflow:hidden;border:1px solid var(--wh-border,#d9e2ec);border-radius:24px;background:var(--wh-surface,#fff);box-shadow:0 28px 80px rgba(15,23,42,.28)}.aw37-head{display:flex;justify-content:space-between;gap:12px;padding:18px 20px 14px;border-bottom:1px solid var(--wh-border,#d9e2ec)}.aw37-brand{display:flex;align-items:center;gap:10px}.aw37-brand>img{width:52px;height:52px;object-fit:contain}.aw37-brand small,.aw37-brand h3,.aw37-brand p{margin:0}.aw37-brand small{color:var(--wh-accent,#0f6292);font-size:9px;font-weight:950;letter-spacing:.08em}.aw37-brand h3{font-size:20px;color:var(--wh-text,#111827)}.aw37-brand p{font-size:10px;color:var(--wh-text-muted,#64748b)}.aw37-close{width:38px;height:38px;border:0;border-radius:50%;background:var(--wh-surface-soft,#f8fafc);color:var(--wh-text,#111827);font-size:20px;cursor:pointer}.aw37-prompts{display:flex;gap:7px;padding:10px 20px;overflow:auto;border-bottom:1px solid var(--wh-border,#d9e2ec)}.aw37-prompts button{flex:none;padding:7px 10px;border:1px solid var(--wh-border,#d9e2ec);border-radius:999px;background:var(--wh-surface-soft,#f8fafc);color:var(--wh-text,#111827);font:inherit;font-size:9px;font-weight:850}.aw37-thread{display:flex;flex-direction:column;gap:13px;padding:18px 20px;overflow:auto;background:var(--wh-surface-soft,#f8fafc)}.aw37-msg{display:flex;width:100%}.aw37-msg.user{justify-content:flex-end}.aw37-msg.bot{align-items:flex-end;gap:8px}.aw37-bubble{max-width:82%;padding:11px 13px;border-radius:16px;font-size:11px;line-height:1.48}.user .aw37-bubble{background:var(--wh-accent,#0f6292);color:#fff;border-bottom-right-radius:5px}.bot .aw37-bubble{background:var(--wh-surface,#fff);color:var(--wh-text,#111827);border:1px solid var(--wh-border,#d9e2ec);border-bottom-right-radius:5px}.aw37-bubble ul{display:grid;gap:5px;margin:9px 0 0;padding-left:17px}.aw37-face{width:56px;height:56px;object-fit:contain;filter:drop-shadow(0 4px 8px rgba(15,23,42,.16))}.aw37-face.latest{width:66px;height:66px}.aw37-form{display:grid;grid-template-columns:1fr auto;gap:8px;padding:13px 20px;background:var(--wh-surface,#fff);border-top:1px solid var(--wh-border,#d9e2ec)}.aw37-form input{min-width:0;min-height:44px;padding:10px 12px;border:1px solid var(--wh-border,#d9e2ec);border-radius:13px;background:var(--wh-surface-soft,#f8fafc);color:var(--wh-text,#111827)}.aw37-form button{border:0;border-radius:13px;padding:0 17px;background:var(--wh-accent,#0f6292);color:#fff;font-weight:900}.aw37-foot{padding:0 20px 12px;background:var(--wh-surface,#fff);color:var(--wh-text-muted,#64748b);font-size:8px}body.dark-theme .aw37-card,body.dark-theme .aw37-head,body.dark-theme .aw37-form,body.dark-theme .aw37-foot,body.dark-theme .bot .aw37-bubble{background:#18253a}body.dark-theme .aw37-thread{background:#121d2d}body.dark-theme .aw37-close,body.dark-theme .aw37-prompts button,body.dark-theme .aw37-form input{background:#22304a;border-color:#334155;color:#f8fafc}
 @media(max-width:768px){.aw37-launch.float{right:12px;bottom:calc(88px + env(safe-area-inset-bottom));width:52px;height:52px;padding:0;border-radius:50%}.aw37-launch.float span{display:none}.aw37-launch.float img{width:40px;height:40px}.aw37-card{width:calc(100vw - 16px);max-height:calc(100dvh - 18px);border-radius:20px}.aw37-head{padding:14px}.aw37-thread{padding:14px}.aw37-bubble{max-width:78%;font-size:10px}.aw37-face{width:50px;height:50px}.aw37-face.latest{width:58px;height:58px}.aw37-form{padding:10px 14px}.aw37-foot{padding:0 14px 10px}}
 `;document.head.appendChild(s)
}
function settle(t){t?.querySelectorAll('.aw37-face').forEach(i=>{i.src=A.closed||i.src;i.classList.remove('latest')})}
function user(t,q){const r=document.createElement('div');r.className='aw37-msg user';r.innerHTML=`<div class="aw37-bubble">${esc(q)}</div>`;t.appendChild(r)}
function bot(t,a){settle(t);const r=document.createElement('div');r.className='aw37-msg bot';const li=Array.isArray(a?.list)&&a.list.length?`<ul>${a.list.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'';r.innerHTML=`<div class="aw37-bubble">${esc(a?.text||'')}${li}</div><img class="aw37-face latest" src="${A.open||''}" alt="">`;t.appendChild(r)}
function modal(){
 let m=document.getElementById('v11133AskWaffleModal');if(m?.dataset.aw37==='1')return m;if(m)m.remove();
 m=document.createElement('div');m.id='v11133AskWaffleModal';m.hidden=true;m.dataset.aw37='1';m.dataset.v11133Wired='true';m.dataset.v11135FreshIntent='true';
 m.innerHTML=`<section class="aw37-card" role="dialog" aria-modal="true"><header class="aw37-head"><div class="aw37-brand"><img src="${A.icon||''}" alt=""><div><small>WAFFLE OPERATIONS ASSISTANT</small><h3>Ask Waffle</h3><p>Bookings, dogs, Meet & Greets and capacity</p></div></div><button class="aw37-close" type="button">×</button></header><div class="aw37-prompts"><button data-q="Who is staying this weekend?">This weekend</button><button data-q="Any Meet & Greets next week?">Next week M&Gs</button><button data-q="Who is arriving tomorrow?">Arriving tomorrow</button><button data-q="Do we have capacity 2-9 December?">Check capacity</button></div><div class="aw37-thread"><div class="aw37-msg bot"><div class="aw37-bubble"><b>Hi — I’m Waffle.</b><br>Ask me what’s happening across bookings, stays, Meet & Greets or capacity.</div><img class="aw37-face latest" src="${A.open||''}" alt=""></div></div><form class="aw37-form"><input autocomplete="off" placeholder="Ask Waffle about a dog, date or booking…"><button>Send</button></form><footer class="aw37-foot">Live/saved Waffle Calendar data</footer></section>`;
 document.body.appendChild(m);m.querySelector('.aw37-close').onclick=()=>m.hidden=true;m.onclick=e=>{if(e.target===m)m.hidden=true;const b=e.target.closest?.('[data-q]');if(b)ask(b.dataset.q)};m.querySelector('form').onsubmit=e=>{e.preventDefault();const i=m.querySelector('input'),q=i.value.trim();if(q){i.value='';ask(q)}};return m
}
function ask(q){
 const m=modal(),t=m.querySelector('.aw37-thread');user(t,q);const src=events(),ev=src.rows;let a=null;
 if(ev.length)a=fallback(ev,q);
 if(!a&&page()==='calendar'&&typeof window.v11133AskWaffle==='function'){window.v11133AskWaffle(q);setTimeout(()=>decorate(),0);return}
 if(!a)a={text:ev.length?'I can help with arrivals, departures, stays, Meet & Greets and capacity.':'Ask Waffle is available here, but I need one Calendar visit to sync booking data across the app.',tone:'muted'};
 setTimeout(()=>{bot(t,a);t.scrollTop=t.scrollHeight},55)
}
function decorate(){const m=document.getElementById('v11133AskWaffleModal');if(!m)return;const t=m.querySelector('.aw37-thread,.v11133-thread');if(!t)return;const bots=[...t.querySelectorAll('.v11133-message.is-assistant')];if(!bots.length)return;settle(t);bots.forEach((r,i)=>{if(!r.querySelector('.aw37-face')){const img=document.createElement('img');img.className='aw37-face';img.alt='';r.appendChild(img)}const img=r.querySelector('.aw37-face');img.src=i===bots.length-1?(A.open||''):(A.closed||'');img.classList.toggle('latest',i===bots.length-1)})}
function launch(){
 document.getElementById('v11133AskWaffleButton')?.remove();let b=document.getElementById('aw37launch');if(b)return b;b=document.createElement('button');b.id='aw37launch';b.className='aw37-launch';b.type='button';b.innerHTML=`<img src="${A.icon||''}" alt=""><span>Ask Waffle</span>`;const h=document.querySelector('.calendar-header-branding');if(page()==='calendar'&&h){const th=document.getElementById('themeToggle');h.insertBefore(b,th||null)}else{b.classList.add('float');document.body.appendChild(b)}b.onclick=()=>{const m=modal();m.hidden=false;m.querySelector('input')?.focus()};return b
}
function apply(){style();modal();launch();if(page()==='calendar')saveSnap()}
function start(){apply();[150,500,1200,2600,5000].forEach(x=>setTimeout(apply,x));if(page()==='calendar')[800,2200,6000,12000].forEach(x=>setTimeout(saveSnap,x));window.addEventListener('pageshow',apply);window.addEventListener('focus',apply);document.addEventListener('keydown',e=>{if(e.key==='Escape'){const m=document.getElementById('v11133AskWaffleModal');if(m)m.hidden=true}});window.v11137AskWaffle=ask;window.v11137AskWaffleVersion=VERSION}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();