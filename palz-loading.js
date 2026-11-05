/* Show the brand while the shell starts; never add a minimum loading delay. */
(()=>{'use strict';const root=document.documentElement;let timer;
try{const dark=localStorage.getItem('theme')==='dark',palette=localStorage.getItem('waffleColourStyle')||'waffle-purple';const accents={'waffle-purple':['#7c3aed','#c084fc'],'coastal-blue':['#0284c7','#38bdf8'],eucalyptus:['#15803d','#4ade80'],'sunset-coral':['#e11d48','#fb7185'],'warm-honey':['#d97706','#fbbf24']};root.style.setProperty('--palz-load-accent',(accents[palette]||accents['waffle-purple'])[dark?1:0]);root.style.setProperty('--palz-load-bg',dark?'#111827':'#fbfaff');root.style.setProperty('--palz-load-ink',dark?'#fff':'#111638');root.style.setProperty('--palz-load-muted',dark?'#b5bfd2':'#64748b');}catch(_){}
let parsed=document.readyState!=='loading';
function finish(force=false){if(!force&&(!parsed||root.dataset.waffleUiReady!=='true'))return;root.dataset.palzLoading='done';delete root.dataset.palzNavigating;clearTimeout(timer);}
const observer=new MutationObserver(()=>finish());observer.observe(root,{attributes:true,attributeFilter:['data-waffle-ui-ready']});
document.addEventListener('DOMContentLoaded',()=>{parsed=true;finish();},{once:true});
window.addEventListener('waffle:first-paint-ready',()=>finish());
window.addEventListener('pageshow',event=>{if(event.persisted&&parsed)finish(true);else finish();});
timer=setTimeout(()=>finish(true),8000);finish();
document.addEventListener('click',event=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const link=event.target.closest?.('a[href]');if(!link||link.hasAttribute('download')||(link.target&&link.target!=='_self'))return;let url;try{url=new URL(link.href,location.href);}catch(_){return;}if(url.origin!==location.origin||!url.pathname.endsWith('.html')||(url.pathname===location.pathname&&url.search===location.search))return;root.dataset.palzNavigating='true';clearTimeout(timer);timer=setTimeout(()=>finish(true),8000);});
})();
