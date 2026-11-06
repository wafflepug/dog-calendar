/* Lazy shared availability and handovers; no request is made for unopened settings. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const idFor = card => ({stayId:card.dataset.directoryStayId || '',dogId:card.dataset.directoryDogId || '',stayKey:card.dataset.directoryStayKey || ''});
  const key = id => JSON.stringify([id.stayId,id.dogId,id.stayKey]);
  const current = (card,id) => card.isConnected && card.classList.contains('is-profile-active') && key(idFor(card))===key(id);
  async function read(payload) {if(navigator.onLine===false)throw Error('You are offline. Reconnect and retry.');const r=await window.queryAppsScript(payload,{maxAttempts:1,timeoutMs:25000});if(r?.result!=='success')throw Error(r?.error || 'Planning service unavailable. Retry once connected.');return r;}
  async function write(payload) {if(navigator.onLine===false)throw Error('You are offline. Nothing was saved.');const r=await window.sendPayloadToAppsScript(payload);if(r?.result!=='success' || r.queued)throw Error(r?.error || 'Save was not confirmed. Reload to check before retrying.');return r;}
  const css=document.createElement('style');css.textContent=`
  .sitter-planning{color:var(--wh-text,#172033);font-size:14px;line-height:1.5;box-sizing:border-box}.sitter-planning *{box-sizing:border-box}.sitter-planning button,.sitter-planning input{font:inherit;color:inherit}.sitter-planning button{min-height:44px;padding:9px 12px;border:1px solid var(--wh-border,#d6deeb);border-radius:10px;background:var(--wh-surface-soft,#f5f3ff);cursor:pointer}.sitter-planning button:focus-visible,.sitter-planning input:focus-visible{outline:3px solid var(--wh75-accent,#7c3aed);outline-offset:2px}.sitter-planning button:disabled{opacity:.6;cursor:wait}.sitter-planning label{display:grid;gap:5px;min-width:0;font-weight:700}.sitter-planning input{width:100%;min-width:0;min-height:44px;padding:8px;border:1px solid var(--wh-border,#d6deeb);border-radius:9px;background:var(--wh-surface,#fff)}.sitter-planning-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.sitter-planning-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:12px}.sitter-planning [role=status]{margin:8px 0;overflow-wrap:anywhere}.sitter-planning h3{margin:0 0 8px;font-size:18px}.sitter-planning h4{margin:16px 0 8px}.sitter-planning p{margin:6px 0 12px}.sitter-planning-block{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end;margin-bottom:10px}.sitter-planning-dialog{width:min(560px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:auto;border:1px solid var(--wh-border,#d6deeb);border-radius:16px;padding:20px;background:var(--wh-surface,#fff);color:var(--wh-text,#172033);z-index:2147483000}.sitter-planning-dialog::backdrop{background:#0f172a99}.sitter-planning-head{display:flex;justify-content:space-between;gap:12px;align-items:start}.sitter-handover{margin:12px 0;padding:12px;border:1px solid var(--wh-border,#d6deeb);border-radius:12px}.sitter-handover-summary{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px}.sitter-handover-summary span{font-size:13px;white-space:pre-line}.sitter-compose{margin:12px 0}.sitter-photo-preview{display:flex;gap:8px;flex-wrap:wrap}.sitter-photo-preview img{width:64px;height:64px;object-fit:cover;border-radius:10px}.sitter-planning [hidden]{display:none!important}@media(max-width:520px){.sitter-planning-block{grid-template-columns:1fr 1fr}.sitter-planning-block button{grid-column:1/-1}.sitter-planning-dialog{padding:14px}}
  `;document.head.append(css);
  let dialog, returnFocus, busy=false;
  function blockRow(start='',end='') {const row=document.createElement('div');row.className='sitter-planning-block';row.innerHTML=`<label>From<input type="date" data-sitter-block-start required value="${esc(start)}"></label><label>Through<input type="date" data-sitter-block-end required value="${esc(end)}"></label><button type="button" aria-label="Remove time-off period">Remove</button>`;row.querySelector('button').onclick=()=>row.remove();return row;}
  async function loadRules() {
    const status=dialog.querySelector('[data-sitter-rules-status]'), form=dialog.querySelector('form');form.querySelector('button[type=submit]').disabled=true;status.textContent='Loading shared availability…';
    try {const {rules}=await read({action:'get_sitter_planning'});dialog.dataset.revision=rules.revision;$('#sitterMaxDogs').value=rules.maxDogs ?? '';for(const name of ['arrivalFrom','arrivalTo','pickupFrom','pickupTo'])form.elements[name].value=rules[name] || '';const host=dialog.querySelector('[data-sitter-blocks]');host.replaceChildren(...rules.blocked.map(b=>blockRow(b.start,b.end)));status.textContent='Applies to new confirmations and date changes. Existing stays are kept.';form.querySelector('button[type=submit]').disabled=false;}catch(e){status.textContent=e.message;}
  }
  function openSettings() {
    returnFocus=document.activeElement;
    if(!dialog){dialog=document.createElement('dialog');dialog.id='sitterPlanningDialog';dialog.className='sitter-planning sitter-planning-dialog';dialog.setAttribute('aria-labelledby','sitterPlanningTitle');dialog.innerHTML=`<div class="sitter-planning-head"><h3 id="sitterPlanningTitle">Availability & handovers</h3><button type="button" data-sitter-close aria-label="Close availability">Close</button></div><form data-sitter-rules-form><label>Maximum dogs at once<input id="sitterMaxDogs" type="number" min="1" max="100" step="1" placeholder="No limit"></label><p>Includes arrival and departure days. Leave blank to keep capacity advisory.</p><h4>Time off</h4><p>New confirmed stays cannot overlap these dates.</p><div data-sitter-blocks></div><button type="button" data-sitter-add-block>Add time off</button><h4>Usual handover windows</h4><p>Optional, local sitter time. Leave each pair blank for flexible times.</p><div class="sitter-planning-grid">${[['arrivalFrom','Drop-off from'],['arrivalTo','Drop-off until'],['pickupFrom','Pickup from'],['pickupTo','Pickup until']].map(([n,l])=>`<label>${l}<input type="time" name="${n}"></label>`).join('')}</div><div class="sitter-planning-actions"><button type="submit" disabled>Save availability</button><button type="button" data-sitter-reload>Reload shared settings</button></div><p role="status" data-sitter-rules-status></p></form>`;document.body.append(dialog);
      dialog.querySelector('[data-sitter-add-block]').onclick=()=>{const host=dialog.querySelector('[data-sitter-blocks]');if(host.children.length<30){const row=blockRow();host.append(row);row.querySelector('input').focus();}};
      dialog.querySelector('[data-sitter-close]').onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog.addEventListener('close',()=>returnFocus?.isConnected && returnFocus.focus());dialog.querySelector('[data-sitter-reload]').onclick=()=>loadRules();
      dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();if(busy)return;const form=e.currentTarget,status=dialog.querySelector('[data-sitter-rules-status]'),rules={maxDogs:$('#sitterMaxDogs').value,blocked:[...dialog.querySelectorAll('.sitter-planning-block')].map(row=>({start:row.querySelector('[data-sitter-block-start]').value,end:row.querySelector('[data-sitter-block-end]').value}))};for(const name of ['arrivalFrom','arrivalTo','pickupFrom','pickupTo'])rules[name]=form.elements[name].value;busy=true;form.querySelectorAll('button,input').forEach(n=>n.disabled=true);status.textContent='Saving…';try{const r=await write({action:'save_sitter_planning',expectedRevision:dialog.dataset.revision,rules});dialog.dataset.revision=r.rules.revision;status.textContent='Availability saved for all devices.';}catch(e){status.textContent=e.message;}finally{busy=false;form.querySelectorAll('button,input').forEach(n=>n.disabled=false);}};
    }
    if(!dialog.open){dialog.showModal();void loadRules();}
  }
  function mountCard(card) {
    const brief=card.querySelector('[data-directory-care-brief]');if(!brief)return;const id=idFor(card);if(!id.stayId || !id.dogId || !id.stayKey)return;
    let section=card.querySelector('[data-sitter-handover]');
    if(section && section.dataset.identity!==key(id)){section.remove();section=null;}
    if(!section){section=document.createElement('section');section.className='sitter-planning sitter-handover';section.dataset.sitterHandover='';section.dataset.identity=key(id);section.innerHTML='<div class="sitter-handover-summary"><span data-sitter-times-summary>Drop-off / pickup times</span><button type="button" data-sitter-times-edit>Set times</button></div><form data-sitter-times-form hidden><div class="sitter-planning-grid"><label>Drop-off<input type="time" name="dropoffTime"></label><label>Pickup<input type="time" name="pickupTime"></label></div><p>Local sitter time. Blank means not confirmed.</p><div class="sitter-planning-actions"><button type="submit">Save times</button><button type="button" data-sitter-times-cancel>Cancel</button></div></form><p role="status" data-sitter-times-status></p>';const header=card.querySelector('.directory-card-header');if(header)header.after(section);else brief.prepend(section);
      const form=section.querySelector('form'),status=section.querySelector('[role=status]'),edit=section.querySelector('[data-sitter-times-edit]');let record=null,saving=false,loading=null;
      const show=()=>{section.querySelector('[data-sitter-times-summary]').textContent=`Drop-off: ${record.times.dropoffTime || 'Not confirmed'} · Pickup: ${record.times.pickupTime || 'Not confirmed'}`;edit.textContent='Edit times';};
      const load=()=>loading || (loading=(async()=>{const r=await read({action:'get_sitter_handover',...id});if(!current(card,id))return false;if(r.record.stayId!==id.stayId || r.record.dogId!==id.dogId)throw Error('Stay identity changed. Reopen the profile.');record=r.record;show();return true;})().finally(()=>{loading=null;}));
      edit.onclick=async()=>{if(saving)return;edit.disabled=true;status.textContent='Loading saved times...';try{if(!await load())return;for(const n of ['dropoffTime','pickupTime'])form.elements[n].value=record.times[n] || '';form.hidden=false;status.textContent='';form.elements.dropoffTime.focus();}catch(e){if(current(card,id))status.textContent=e.message;}finally{edit.disabled=false;}};
      void load().catch(()=>{if(current(card,id))section.querySelector('[data-sitter-times-summary]').textContent='Handover times unavailable - select Set times to retry';});
      section.querySelector('[data-sitter-times-cancel]').onclick=()=>{if(!saving){form.hidden=true;status.textContent='';edit.focus();}};
      form.onsubmit=async e=>{e.preventDefault();if(saving || !record || !current(card,id))return;saving=true;const times={dropoffTime:form.elements.dropoffTime.value,pickupTime:form.elements.pickupTime.value};form.querySelectorAll('button,input').forEach(n=>n.disabled=true);status.textContent='Saving…';try{const r=await write({action:'save_sitter_handover',...id,...times,expectedRevision:record.revision});if(!current(card,id))return;if(r.record.stayId!==id.stayId || r.record.dogId!==id.dogId || r.record.times.dropoffTime!==times.dropoffTime || r.record.times.pickupTime!==times.pickupTime)throw Error('Save confirmation did not match this stay. Reload to check.');record=r.record;pickupTimes.set(key(id), record.times.pickupTime);show();form.hidden=true;status.textContent='Handover times saved.';}catch(e){if(current(card,id))status.textContent=e.message;}finally{saving=false;form.querySelectorAll('button,input').forEach(n=>n.disabled=false);}};
    }
    const oldComposer=card.querySelector('.sitter-compose');if(oldComposer && oldComposer.dataset.identity!==key(id))oldComposer.remove();
    if(!card.querySelector('[data-sitter-compose]')){const host=document.createElement('div');host.className='sitter-planning sitter-compose';host.dataset.identity=key(id);host.dataset.careProfileSegment='activity';const button=document.createElement('button');button.type='button';button.dataset.sitterCompose='';button.textContent='Prepare owner update';button.onclick=()=>{if(!current(card,id))return;const trigger=card.querySelector('[data-owner-care-sharing-options]');if(!trigger)return;trigger.click();const purpose=$('#p4OwnerPurpose');if(purpose){purpose.value='update';purpose.dispatchEvent(new Event('change',{bubbles:true}));const template=$('#p4OwnerUpdateTemplate');template.value='daily';template.dispatchEvent(new Event('change',{bubbles:true}));$('#p4OwnerUpdatePreview')?.focus();}};host.append(button);brief.append(host);}
  }
  const pickupTimes = new Map();
  let requestedRosterPickups = false;

  function refreshCheckoutButtons() {
    const buttons = document.querySelectorAll('[data-roster-checkout-estimate]');
    if (buttons.length && !requestedRosterPickups) {
      requestedRosterPickups = true;
      read({action:'get_sitter_roster_pickups'}).then(result => {
        for (const entry of result.pickups) {
          const stay = key(entry);
          if (!pickupTimes.has(stay)) pickupTimes.set(stay, entry.time);
        }
        refreshCheckoutButtons();
      }).catch(() => {});
    }
    for (const button of buttons) {
      const card = button.closest('.directory-card');
      const time = pickupTimes.get(key(idFor(card)));
      const label = time ? 'Checkout: ' + time : 'Set checkout time';
      if (button.textContent !== label) button.textContent = label;
    }
  }

  async function editCheckoutTime(button) {
    if (document.querySelector('[data-roster-checkout-dialog]')) return;
    const card = button.closest('.directory-card');
    const identity = idFor(card);
    const isCurrent = () => button.isConnected && key(idFor(card)) === key(identity);
    const editor = document.createElement('dialog');
    editor.className = 'sitter-planning sitter-planning-dialog';
    editor.dataset.rosterCheckoutDialog = '';
    editor.setAttribute('aria-labelledby', 'rosterCheckoutTitle');
    editor.innerHTML = `<h3 id="rosterCheckoutTitle">Estimated checkout time</h3>
      <p data-checkout-dog></p><form>
        <label>Pickup time<input type="time" name="pickupTime" disabled></label>
        <p>Use local time on the scheduled checkout day. Leave blank to clear the estimate.</p>
        <div class="sitter-planning-actions"><button type="submit" disabled>Save time</button><button type="button">Cancel</button></div>
        <p role="status"></p>
      </form>`;
    editor.querySelector('[data-checkout-dog]').textContent = card.dataset.directoryDogName || 'Guest';
    const form = editor.querySelector('form');
    const input = form.elements.pickupTime;
    const save = form.querySelector('[type=submit]');
    const cancel = form.querySelector('[type=button]');
    const status = form.querySelector('[role=status]');
    let record;
    let saving = false;
    cancel.onclick = () => editor.close();
    editor.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
    editor.addEventListener('close', () => {
      editor.remove();
      if (isCurrent()) button.focus();
    });
    document.body.append(editor);
    editor.showModal();
    status.textContent = 'Loading saved time...';
    try {
      const result = await read({action:'get_sitter_handover', ...identity});
      if (!editor.open) return;
      if (!isCurrent() || result.record.stayId !== identity.stayId || result.record.dogId !== identity.dogId) {
        throw Error('This stay changed. Close this window and try again.');
      }
      record = result.record;
      input.value = record.times.pickupTime || '';
      pickupTimes.set(key(identity), input.value);
      refreshCheckoutButtons();
      input.disabled = save.disabled = false;
      input.focus();
      status.textContent = '';
    } catch (error) {
      status.textContent = error.message;
    }
    form.onsubmit = async event => {
      event.preventDefault();
      if (!record || saving) return;
      if (!isCurrent()) {
        status.textContent = 'This stay changed. Close this window and try again.';
        return;
      }
      saving = true;
      const time = input.value;
      input.disabled = save.disabled = cancel.disabled = true;
      status.textContent = 'Saving...';
      try {
        const result = await write({action:'save_sitter_handover', ...identity,
          dropoffTime:record.times.dropoffTime, pickupTime:time, expectedRevision:record.revision});
        const saved = result.record;
        if (saved.stayId !== identity.stayId || saved.dogId !== identity.dogId || saved.times.pickupTime !== time) {
          throw Error('Save confirmation did not match this stay. Reopen to check.');
        }
        pickupTimes.set(key(identity), time);
        refreshCheckoutButtons();
        editor.close();
      } catch (error) {
        status.textContent = error.message;
      } finally {
        saving = false;
        input.disabled = save.disabled = cancel.disabled = false;
      }
    };
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-roster-checkout-estimate]');
    if (button) void editCheckoutTime(button);
  });

  function mountToday(){const agenda=$('#v10TodayAgenda');if(!agenda || agenda.querySelector('[data-sitter-day-handovers]'))return;const host=document.createElement('section');host.className='sitter-planning';host.dataset.sitterDayHandovers='';host.innerHTML='<button type="button" aria-expanded="false">Handover times</button><div hidden><p>Scheduled today, in local sitter time.</p><div data-sitter-day-list></div><p role="status"></p></div>';agenda.prepend(host);const button=host.querySelector('button'),panel=host.querySelector('div'),status=host.querySelector('[role=status]');let loading=false;button.onclick=async()=>{if(loading)return;if(!panel.hidden){panel.hidden=true;button.setAttribute('aria-expanded','false');return;}panel.hidden=false;button.setAttribute('aria-expanded','true');loading=true;status.textContent='Loading scheduled times...';try{const r=await read({action:'get_sitter_day_handovers'});if(!host.isConnected)return;host.querySelector('[data-sitter-day-list]').innerHTML=r.entries.length?r.entries.map(x=>`<p><strong>${esc(x.time || 'Time not confirmed')}</strong> - ${esc(x.type)} - ${esc(x.dogName)}</p>`).join(''):'No arrivals or pickups scheduled today.';status.textContent='';}catch(e){status.textContent=e.message;}finally{loading=false;}};}
  const businessNameCache = 'palz.business-name.v1';
  let businessName = 'Waffle House';
  let businessNameChanged = false;
  try { businessName = localStorage.getItem(businessNameCache) || businessName; } catch (_) {}

  function showBusinessName() {
    const sidebar = $('.wh-sitter-sidebar-brand small');
    if (sidebar && sidebar.textContent !== businessName + ' workspace') sidebar.textContent = businessName + ' workspace';
    const todayTitle = $('#v10OperationsTitle');
    if (todayTitle && todayTitle.textContent !== 'Today at ' + businessName) todayTitle.textContent = 'Today at ' + businessName;
    for (const branding of document.querySelectorAll('#whPalzStayMobileShellBrand, #whPalzStayMobileBrand')) {
      let label = branding.querySelector('[data-palz-business-name]');
      if (!label) {
        label = document.createElement('small');
        label.dataset.palzBusinessName = '';
        branding.append(label);
      }
      if (label.textContent !== businessName) label.textContent = businessName;
    }
  }

  function mountBusinessSettings() {
    const panel = $('#wh75SettingsPanel');
    if (!panel || panel.querySelector('[data-palz-business-settings]')) return;
    const form = document.createElement('form');
    form.dataset.palzBusinessSettings = '';
    form.className = 'wh75-settings-section sitter-planning';
    form.innerHTML = '<label>Business name<input name="businessName" type="text" maxlength="60" required></label><div class="sitter-planning-actions"><button type="submit">Save business name</button></div><p role="status"></p>';
    const input = form.elements.businessName;
    const button = form.querySelector('button');
    const status = form.querySelector('[role=status]');
    input.value = businessName;
    form.onsubmit = async event => {
      event.preventDefault();
      if (button.disabled) return;
      const name = input.value.trim();
      if (!name) { status.textContent = 'Enter a business name.'; return; }
      button.disabled = input.disabled = true;
      status.textContent = 'Saving...';
      try {
        const result = await write({action:'save_business_name', name});
        if (result.name !== name) throw Error('The business name could not be confirmed.');
        businessNameChanged = true;
        applyBusinessName(name);
        input.value = name;
        status.textContent = 'Business name saved.';
      } catch (error) {
        status.textContent = error.message;
      } finally {
        button.disabled = input.disabled = false;
      }
    };
    panel.querySelector('.wh75-settings-head')?.after(form);
    if (!form.isConnected) panel.prepend(form);
  }

  function applyBusinessName(name) {
    const input = $('[data-palz-business-settings] input');
    if (input && input.value === businessName) input.value = name;
    businessName = name;
    try { localStorage.setItem(businessNameCache, name); } catch (_) {}
    showBusinessName();
  }

  if (typeof window.queryAppsScript === 'function') {
    void read({action:'get_business_name'}).then(result => {
      if (!businessNameChanged && typeof result.name === 'string' && result.name) applyBusinessName(result.name);
    }).catch(() => {});
  }

  function scan(){showBusinessName();mountBusinessSettings();refreshCheckoutButtons();mountToday();const panel=$('#wh75SettingsPanel');if(panel && !panel.querySelector('[data-sitter-planning-settings]')){const section=document.createElement('section');section.className='wh75-settings-section sitter-planning';section.innerHTML='<h3>Availability</h3><button type="button" data-sitter-planning-settings>Availability & handover windows</button>';section.querySelector('button').onclick=openSettings;panel.append(section);}document.querySelectorAll('.directory-card.is-profile-active').forEach(mountCard);}
  let queued=false;new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;scan();});}}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-directory-stay-id','data-directory-dog-id','data-directory-stay-key']});scan();
  window.PALZ_SITTER_PLANNING=Object.freeze({openSettings});
})();
