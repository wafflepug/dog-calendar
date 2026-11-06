/* Palz Stay: shared code-native SVG icons. No fonts, remote assets or image requests. */
(() => {
  'use strict';
  if(window.PALZ_ICONS)return;
  const paths={
    home:'<path d="m3 10 9-7 9 7v10H7V10m10 10v-7h-6v7"/>',
    calendar:'<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v5m8-5v5M4 11h16"/>',
    paw:'<ellipse cx="12" cy="16" rx="6" ry="4" fill="currentColor" stroke="none"/><ellipse cx="5" cy="10" rx="2.1" ry="3" fill="currentColor" stroke="none"/><ellipse cx="10" cy="6" rx="2.1" ry="3" fill="currentColor" stroke="none"/><ellipse cx="15" cy="6" rx="2.1" ry="3" fill="currentColor" stroke="none"/><ellipse cx="20" cy="10" rx="2.1" ry="3" fill="currentColor" stroke="none"/>',
    users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m3 10v-3a6 6 0 0 0-2-4"/>',
    payment:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/>',
    chart:'<path d="M5 20V11m7 9V4m7 16V8"/>',
    tasks:'<rect x="5" y="4" width="15" height="17" rx="3"/><path d="M9 3h7v4H9zm0 11 2 2 5-5"/>',
    bell:'<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zm5 4h4"/>',
    plus:'<path d="M12 4v16M4 12h16"/>',
    settings:'<path d="m9 3-.8 3-2.5 1-2.7-.8-1.5 2.6 2 2.2v2l-2 2.2L3 17.8l2.7-.8 2.5 1L9 21h3l.8-3 2.5-1 2.7.8 1.5-2.6-2-2.2v-2l2-2.2L18 6.2l-2.7.8-2.5-1L12 3z" transform="translate(1)"/><circle cx="11.5" cy="12" r="3"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
    moon:'<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z"/>',
    camera:'<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/>',
    image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/>',
    upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
    download:'<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
    checkin:'<path d="M14 3h6v18h-6M3 12h12m-5-5 5 5-5 5"/>',
    checkout:'<path d="M10 3H4v18h6m-1-9h12m-5-5 5 5-5 5"/>',
    edit:'<path d="m4 16-1 5 5-1L21 7l-4-4zm10-10 4 4"/>',
    trash:'<path d="M4 6h16M9 3h6l1 3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
    shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/>',
    food:'<path d="M3 12h18a9 9 0 0 1-18 0ZM7 8c-2-3 2-3 0-6m5 6c-2-3 2-3 0-6m5 6c-2-3 2-3 0-6"/>',
    walk:'<circle cx="15" cy="4" r="2"/><path d="m9 21 3-7-3-4 3-3 4 3h4m-8 4 5 7M4 12l5-2"/>',
    medicine:'<path d="m6 18 12-12m-8-2a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7-7z"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    refresh:'<path d="M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 2M4 17l2 2a8 8 0 0 0 13-3"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    book:'<path d="M3 4h6l3 2 3-2h6v16h-6l-3 2-3-2H3zm9 2v16"/>',
    chat:'<path d="M4 4h16v13H9l-5 4zM8 9h8m-8 4h5"/>',
    bed:'<path d="M3 5v16m18-9v9M3 17h18M6 12V8h6v4m-9 0h18v5"/>',
    storage:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 10h18M3 16h18M10 7h4m-4 6h4m-4 6h4"/>',
    alert:'<path d="m12 3 10 18H2zM12 9v5m0 3h.01"/>',
    heart:'<path d="M12 21 3 12a5.5 5.5 0 0 1 9-7 5.5 5.5 0 0 1 9 7z"/>',
    document:'<path d="M5 3h10l4 4v14H5zm10 0v5h4M9 12h6m-6 4h6"/>',
    phone:'<path d="m5 3 4 1 1 5-3 2a14 14 0 0 0 6 6l2-3 5 1 1 4c-7 6-23-10-16-16Z"/>',
    check:'<path d="m4 12 5 5L20 6"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    link:'<path d="m9 15 6-6M8 8 5 11a5 5 0 0 0 7 7l3-3M9 9l3-3a5 5 0 0 1 7 7l-3 3"/>',
    pin:'<path d="m8 3 10 4-3 3v5l-5-2-5 3 2-6zM8 16l-4 5"/>',
    mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    scale:'<path d="M12 3v18M5 7h14M6 7l-4 8h8zm12 0-4 8h8zM8 21h8"/>',
    lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>'
  };
  function svg(name){if(!Object.prototype.hasOwnProperty.call(paths,name))name='paw';return '<svg class="palz-icon" data-palz-icon="'+name+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+(paths[name]||paths.paw)+'</svg>';}
  window.PALZ_ICONS=Object.freeze({svg,names:Object.freeze(Object.keys(paths))});
  const style=document.createElement('style');style.id='palzIconStyle';style.textContent=`
    .palz-icon{display:inline-block;width:20px;height:20px;flex:0 0 20px;vertical-align:-4px;pointer-events:none}
    .palz-inline-icon{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;margin-right:.28em;line-height:1}
    .palz-icon-host{font-size:0!important;line-height:1!important;color:var(--wh-text,#162044)}
    #wh75MobileBottomNav .palz-icon-host>img,.wh75-nav-item .palz-icon-host>img,.palz-icon-host>img{display:none!important}.palz-icon-host>.palz-icon{width:22px;height:22px}
    html body #wh75MobileBottomNav .wh75-bottom-item .wh75-bottom-icon.palz-icon-host{display:inline-flex!important;align-items:center;justify-content:center;width:40px!important;height:40px!important;min-width:40px!important;min-height:40px!important;padding:8px!important;border:0!important;border-radius:12px!important;background:transparent!important;color:#162044!important;box-shadow:none!important;transform:none!important;box-sizing:border-box}
    html body #wh75MobileBottomNav .wh75-bottom-item.is-active .wh75-bottom-icon.palz-icon-host{color:var(--wh75-accent,#7c3aed)!important;background:var(--wh75-accent-soft,#f3e8ff)!important}
    html body #wh75MobileBottomNav .wh75-bottom-add .wh75-bottom-icon.palz-icon-host{color:var(--wh75-accent,#7c3aed)!important}
    .wh75-nav-item .palz-icon-host{border-radius:10px;background:color-mix(in srgb,var(--wh75-accent,#7c3aed) 8%,var(--wh-surface,#fff));color:var(--wh-text,#162044)}
    .wh75-nav-item.is-active .palz-icon-host{color:var(--wh75-accent,#7c3aed)}
    body.dark-theme .palz-icon-host{color:var(--wh-text,#eef0ff)}
    html body.dark-theme #wh75MobileBottomNav .wh75-bottom-item.is-active .wh75-bottom-icon.palz-icon-host{background:var(--wh75-accent-soft,#2e1065)!important;color:var(--wh75-accent,#c084fc)!important}
    html body.dark-theme #wh75MobileBottomNav .wh75-bottom-item .wh75-bottom-icon.palz-icon-host{color:#eef0ff!important}
    .wh-sitter-sidebar-icon.palz-icon-host{display:inline-flex;align-items:center;justify-content:center;color:#162044;background:#f5f4fa}
    body.dark-theme .wh-sitter-sidebar-icon.palz-icon-host{color:#eef0ff;background:#252c40}
    #whSitterDesktopSidebar .wh-sitter-sidebar-item.is-active .wh-sitter-sidebar-icon.palz-icon-host{color:var(--wh75-accent,#7c3aed)!important;background:var(--wh75-accent-soft,#f3e8ff)!important}
    .palz-mode-choice>img{display:none!important}.palz-mode-icon{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;background:color-mix(in srgb,currentColor 7%,transparent)}
    .care-tool-icon .palz-icon{width:18px;height:18px}
    .care-tool-icon svg,.care-photo-options svg,.care-roster-photo-options svg{stroke-linecap:round;stroke-linejoin:round;stroke-width:1.8}
    #wh80MobileHeaderRail [data-wh80-role].palz-icon-host{color:var(--wh-text,#162044)!important;background:var(--wh-surface,#fff)!important;border-radius:12px!important}
    #wh80MobileHeaderRail [data-wh80-role].palz-icon-host>.wh81-header-avatar{display:none!important}
    #wh80MobileHeaderRail [data-wh80-role].palz-icon-host>[data-palz-icon]{display:block!important;width:22px!important;height:22px!important}
    #aw37launch.palz-icon-host{display:flex!important;align-items:center;justify-content:center;background:var(--wh75-accent-soft,#f3e8ff)!important;color:var(--wh75-accent,#7c3aed)!important;border:1px solid var(--wh75-accent,#7c3aed)!important;box-shadow:0 4px 16px #1720441a!important}
    #aw37launch.palz-icon-host>img{display:none!important}
    body.dark-theme #aw37launch.palz-icon-host{background:var(--wh75-accent-soft,#2e1065)!important;color:var(--wh75-accent,#c084fc)!important}

  `;document.head.append(style);
  const emojiMap={'🛬':'checkin','🛫':'checkout','👋':'checkout','🏡':'home','🏠':'home','🐾':'paw','🐶':'paw','🧳':'storage','🛏️':'bed','🛏':'bed','🥣':'food','🍽️':'food','🍽':'food','💊':'medicine','🩺':'heart','🛡️':'shield','🛡':'shield','🧠':'heart','📋':'tasks','📅':'calendar','🗓️':'calendar','📆':'calendar','📸':'camera','📷':'camera','🖼️':'image','🖼':'image','✏️':'edit','✏':'edit','📝':'document','📄':'document','📚':'book','📎':'link','🔗':'link','📌':'pin','📍':'pin','🔔':'bell','🔍':'search','🔎':'search','⚙️':'settings','⚙':'settings','✅':'check','✔️':'check','✔':'check','✓':'check','❌':'close','⚠️':'alert','⚠':'alert','⏳':'clock','⏱️':'clock','⏱':'clock','🕒':'clock','🕐':'clock','💾':'download','🔄':'refresh','🗑️':'trash','🗑':'trash','🗑︎':'trash','📞':'phone','☎️':'phone','☎':'phone','💬':'chat','💡':'chat','🤝':'users','👤':'users','👥':'users','💰':'payment','💳':'payment','📊':'chart','📈':'chart','❤️':'heart','🔒':'lock','✉️':'mail','✉':'mail','🦮':'walk','🚶':'walk','🐕':'paw','😟':'heart','😰':'heart','⚖️':'scale','⚖':'scale','🚪':'checkout','🦴':'food','💧':'food'};
  const tokens=Object.keys(emojiMap).sort((a,b)=>b.length-a.length);
  const userContent='input,textarea,[contenteditable],script,style,pre,code,[data-palz-icon],.palz-inline-icon,[data-directory-edit-field],[data-open-directory-profile],[data-care-brief-handover-note],[data-care-brief-owner-name],.directory-dog-name-btn,.directory-photo-placeholder,.directory-photo-media,.v11115-target-note,.reminder-text,.sticky-note-text,[data-profile-subpanel],.directory-field-value';
  function hostIcon(host,name){if(!host)return;if(host.dataset.palzGlyph===name&&host.querySelector(':scope > [data-palz-icon]'))return;host.dataset.palzGlyph=name;host.classList.add('palz-icon-host');if(!host.matches('button,a,summary'))host.setAttribute('aria-hidden','true');host.querySelectorAll(':scope > [data-palz-icon]').forEach(n=>n.remove());host.insertAdjacentHTML('beforeend',svg(name));}
  function navigation(){
    hostIcon(document.getElementById('aw37launch'),'chat');
    hostIcon(document.querySelector('#whSitterDesktopTools .waffle-notification-button-icon'),'bell');
    document.querySelectorAll('#wh80MobileHeaderRail [data-wh80-role="notification"]').forEach(control=>hostIcon(control,'bell'));
    document.querySelectorAll('#wh80MobileHeaderRail [data-wh80-role="search"]').forEach(control=>hostIcon(control,'search'));
    document.querySelectorAll('.directory-photo-placeholder').forEach(placeholder=>{if(placeholder.textContent.trim()==='🐶'||placeholder.dataset.palzGlyph)hostIcon(placeholder,'paw');});
    const routeIcons={today:'home',calendar:'calendar',directory:'paw',reminders:'tasks',audit:'document'};
    document.querySelectorAll('[data-wh75-route],[data-wh-sitter-route]').forEach(control=>hostIcon(control.querySelector('.wh75-nav-icon,.wh75-bottom-icon,.wh-sitter-sidebar-icon'),routeIcons[control.dataset.wh75Route||control.dataset.whSitterRoute]||'home'));
    document.querySelectorAll('[data-wh-sitter-settings]').forEach(control=>hostIcon(control.querySelector('.wh-sitter-sidebar-icon'),'settings'));
    const controls={'[data-wh78-quick-add], [data-wh75-quick-add]':'plus','[data-wh78-ai], [data-wh75-ask]':'chat','[data-wh75-settings]':'settings','[data-wh75-theme-quick]':'moon','[data-wh-sitter-mobile-action="notification"]':'bell','[data-wh-sitter-mobile-action="search"]':'search'};
    Object.entries(controls).forEach(([selector,name])=>document.querySelectorAll(selector).forEach(control=>hostIcon(control.querySelector('.wh75-nav-icon,.wh75-bottom-icon'),name)));
  }
  const selectors='button,summary,.v10-agenda-icon,.wh75-nav-icon,[class$="-icon"],[class*="-icon "],.directory-status-tag,.v1118-status-chip,.v1118-care-signals,.v1118-care-signal,.v11115-empty > span,.v11115-section-heading h2,.v110-operation-icon';
  function convert(root){
    if(root.nodeType!==1)return;
    const elements=[...(root.matches(selectors)?[root]:[]),...root.querySelectorAll(selectors)];
    for(const element of elements){
      const trustedIcon=element.matches('.v1118-care-signal-icon,.v10-agenda-icon');
      if((element.closest(userContent)&&!trustedIcon)||element.classList.contains('palz-icon-host'))continue;
      const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT,{acceptNode(node){return node.parentElement.closest('[data-palz-icon],.palz-inline-icon,.palz-icon-host')||(!trustedIcon&&node.parentElement.closest(userContent))?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}});const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
      for(const node of nodes){
        const raw=node.nodeValue;if(!tokens.some(token=>raw.includes(token)))continue;
        const fragment=document.createDocumentFragment();let rest=raw;
        while(rest){let position=-1,token='';for(const candidate of tokens){const i=rest.indexOf(candidate);if(i!==-1&&(position===-1||i<position)){position=i;token=candidate;}}if(position===-1){fragment.append(document.createTextNode(rest));break;}if(position)fragment.append(document.createTextNode(rest.slice(0,position)));const span=document.createElement('span');span.className='palz-inline-icon';span.setAttribute('aria-hidden','true');span.innerHTML=svg(emojiMap[token]);fragment.append(span);rest=rest.slice(position+token.length).replace(/^\uFE0F/,'');}
        node.replaceWith(fragment);
      }
      if((element.matches('button,summary'))&&!element.textContent.trim()&&!element.getAttribute('aria-label')&&element.querySelector('[data-palz-icon]'))element.setAttribute('aria-label',element.querySelector('[data-palz-icon]').dataset.palzIcon.replace(/^./,c=>c.toUpperCase()));
    }
  }
  let scheduled=false;const pending=new Set();
  function semanticControls(){
    document.querySelectorAll('[data-wh75-mode]').forEach(control=>{control.classList.add('palz-mode-choice');if(!control.querySelector('[data-palz-icon]')){const span=document.createElement('span');span.className='palz-mode-icon';span.innerHTML=svg(control.dataset.wh75Mode==='light'?'sun':'moon');control.prepend(span);}});
    const items={'[data-v11217-roster-owner-call]':'phone','[data-v110-checkin],[data-v11217-roster-checkin],[data-today-action="checkin"]':'checkin','[data-v110-checkout],[data-v11217-roster-checkout],[data-today-action="checkout"],[data-v11217-early-checkout]':'checkout','[data-care-upload-belongings-photo],[data-upload-belongings-photo]':'upload','[data-care-change-profile-photo],[data-upload-dog-photo],[data-take-belongings-photo]':'camera','[data-care-view-photos],[data-v108-gallery]':'image','[data-care-brief-action="refresh"]':'refresh','[data-organiser-add-task]':'plus'};
    Object.entries(items).forEach(([selector,name])=>document.querySelectorAll(selector).forEach(control=>{if(!control.querySelector('[data-palz-icon]')){const span=document.createElement('span');span.className='palz-inline-icon';span.setAttribute('aria-hidden','true');span.innerHTML=svg(name);control.prepend(span);}}));
  }
  function flush(){scheduled=false;navigation();const roots=[...pending];pending.clear();roots.filter(root=>root.isConnected&&!roots.some(other=>other!==root&&other.contains(root))).forEach(convert);semanticControls();}
  new MutationObserver(records=>{let changed=false;for(const record of records){if(record.target.closest?.('[data-palz-icon],.palz-inline-icon,.palz-icon-host'))continue;for(const node of record.addedNodes){if(node.nodeType===1&&!node.matches('[data-palz-icon],.palz-inline-icon')){pending.add(node);changed=true;}else if(node.nodeType===3&&node.parentElement){pending.add(node.parentElement);changed=true;}}}if(changed&&!scheduled){scheduled=true;requestAnimationFrame(flush);}}).observe(document.body,{childList:true,subtree:true});
  pending.add(document.body);flush();
})();
