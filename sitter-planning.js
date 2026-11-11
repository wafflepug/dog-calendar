/* Lazy shared availability and handovers; no request is made for unopened settings. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const idFor = card => ({stayId:card.dataset.directoryStayId || '',dogId:card.dataset.directoryDogId || '',stayKey:card.dataset.directoryStayKey || ''});
  const key = id => JSON.stringify([id.stayId,id.dogId,id.stayKey]);
  let todayHandoversDate = '', todayHandovers = null, todayHandoversRequestedFor = '';
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

  function mountToday() {
    const agenda = $('#v10TodayAgenda');
    if (!agenda) return;
    const today = typeof getLocalTodayDateString === 'function'
      ? getLocalTodayDateString()
      : new Date().toISOString().slice(0, 10);
    if (todayHandoversDate && todayHandoversDate !== today) {
      agenda.querySelectorAll('[data-today-meta]').forEach(meta => {
        meta.textContent = meta.textContent.replace(/ @ \d{2}:\d{2}(?:am|pm)$/, '');
        const link = meta.closest('a[data-today-identity]');
        if (link) link.setAttribute('aria-label', 'Open ' + (link.querySelector('strong')?.textContent || 'Guest') + ' care profile, ' + meta.textContent.trim());
      });
      todayHandoversDate = '';
      todayHandovers = null;
    }
    const formatTime = value => {
      const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
      if (!match) return '';
      const hour = Number(match[1]), minute = Number(match[2]);
      if (hour > 23 || minute > 59) return '';
      return String(hour % 12 || 12).padStart(2, '0') + ':' + match[2] + (hour < 12 ? 'am' : 'pm');
    };
    const apply = entries => {
      const groups = new Map();
      (entries || []).forEach(entry => {
        const id = String(entry.stayId || '').toLowerCase() + '|' + String(entry.dogId || '').toLowerCase();
        if (!id || id === '|') return;
        if (!groups.has(id)) groups.set(id, []);
        groups.get(id).push(entry);
      });
      agenda.querySelectorAll('a[data-today-identity]').forEach(link => {
        const meta = link.querySelector('[data-today-meta]');
        if (!meta) return;
        const label = meta.textContent.trim();
        const type = label === 'Arriving today' ? 'Drop-off' : label === 'Leaving today' ? 'Pickup' : '';
        if (!type) return;
        const id = String(link.dataset.todayStayId || '').toLowerCase() + '|' + String(link.dataset.todayDogId || '').toLowerCase();
        const matches = (groups.get(id) || []).filter(entry => entry.type === type);
        if (matches.length !== 1 || !matches[0].time) return;
        const time = formatTime(matches[0].time);
        if (!time) return;
        meta.textContent = label + ' @ ' + time;
        link.setAttribute('aria-label', 'Open ' + (link.querySelector('strong')?.textContent || 'Guest') + ' care profile, ' + meta.textContent);
      });
    };
    if (todayHandoversDate === today && Array.isArray(todayHandovers)) {
      apply(todayHandovers);
      return;
    }
    if (todayHandoversRequestedFor === today) return;
    if (!agenda.querySelector('.type-arrival [data-today-meta], .type-departure [data-today-meta]')) return;
    todayHandoversRequestedFor = today;
    void read({ action: 'get_sitter_day_handovers' }).then(result => {
      const currentToday = typeof getLocalTodayDateString === 'function'
        ? getLocalTodayDateString()
        : new Date().toISOString().slice(0, 10);
      if (String(result.date || '') !== today || currentToday !== today) return;
      todayHandoversDate = today;
      todayHandovers = Array.isArray(result.entries) ? result.entries : [];
      if (agenda.isConnected) apply(todayHandovers);
    }).catch(() => {});
  }
  const businessNameCache = 'palz.business-name.v1';
  let businessName = 'Waffle House';
  let businessTagline = 'Dog sitting, organised.';
  let businessIcon = '';
  let businessNameChanged = false;
  try {
    businessName = localStorage.getItem(businessNameCache) || businessName;
    const saved = JSON.parse(localStorage.getItem('palz.business-brand.v1') || '{}');
    if (typeof saved.tagline === 'string') businessTagline = saved.tagline;
    businessIcon = saved.icon || '';
  } catch (_) {}

  function showBusinessName() {
    const drawerName = $('.wh75-drawer-brand strong');
    const drawerTagline = $('.wh75-drawer-brand span');
    const drawerIcon = $('.wh75-drawer-logo');
    if (drawerName && drawerName.textContent !== businessName) drawerName.textContent = businessName;
    if (drawerTagline && drawerTagline.textContent !== businessTagline) drawerTagline.textContent = businessTagline;
    if (drawerTagline) drawerTagline.hidden = !businessTagline;
    const imageSource = businessIcon || 'waffle-logo.png';
    if (drawerIcon && drawerIcon.getAttribute('src') !== imageSource) drawerIcon.setAttribute('src', imageSource);
    if (drawerIcon && drawerIcon.alt !== businessName) drawerIcon.alt = businessName;

    const sidebar = $('.wh-sitter-sidebar-brand small');
    if (sidebar && sidebar.textContent !== businessName) sidebar.textContent = businessName;
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

  async function prepareBusinessIcon(file, payload) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      throw Error('Choose a PNG, JPG or WebP image up to 8 MB.');
    }
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      for (const size of [64, 48, 40, 32]) {
        canvas.width = canvas.height = size;
        const context = canvas.getContext('2d');
        const scale = size / Math.max(image.naturalWidth, image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        for (const quality of [0.85, 0.65, 0.45]) {
          let icon = canvas.toDataURL('image/webp', quality);
          if (!icon.startsWith('data:image/webp;')) icon = canvas.toDataURL('image/jpeg', quality);
          if (/^data:image\/(webp|jpeg);/.test(icon) && icon.length <= 1350 &&
              encodeURIComponent(JSON.stringify({...payload, icon})).length <= 1660) return icon;
        }
      }
      throw Error('This icon could not be compressed enough. Try a simpler image.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function mountBusinessSettings() {
    const panel = $('#wh75SettingsPanel');
    if (!panel || panel.querySelector('[data-palz-business-settings]')) return;
    const form = document.createElement('form');
    form.dataset.palzBusinessSettings = '';
    form.className = 'wh75-settings-section sitter-planning';
    form.innerHTML = `<label>Business name<input name="businessName" type="text" maxlength="60" required></label>
      <label>Business tagline<input name="tagline" type="text" maxlength="80"></label>
      <label>Upload business icon<input name="icon" type="file" accept="image/png,image/jpeg,image/webp"></label>
      <div class="sitter-planning-actions"><button type="button" data-reset-business-icon>Use default icon</button><button type="submit">Save business branding</button></div>
      <p role="status"></p>`;
    const input = form.elements.businessName;
    const tagline = form.elements.tagline;
    const file = form.elements.icon;
    const button = form.querySelector('[type=submit]');
    const reset = form.querySelector('[data-reset-business-icon]');
    const status = form.querySelector('[role=status]');
    let resetIcon = false;
    input.value = businessName;
    tagline.value = businessTagline;
    reset.onclick = () => {
      resetIcon = true;
      file.value = '';
      status.textContent = 'Save to use the default icon.';
    };
    file.onchange = () => { resetIcon = false; status.textContent = ''; };
    form.onsubmit = async event => {
      event.preventDefault();
      if (button.disabled) return;
      const name = input.value.trim();
      if (!name) { status.textContent = 'Enter a business name.'; return; }
      const controls = [button, input, tagline, file, reset];
      controls.forEach(control => { control.disabled = true; });
      status.textContent = 'Saving...';
      try {
        const payload = {action:'save_business_name', name, tagline:tagline.value.trim()};
        if (file.files[0]) payload.icon = await prepareBusinessIcon(file.files[0], payload);
        else if (resetIcon) payload.icon = '';
        const result = await write(payload);
        if (result.name !== name || result.tagline !== payload.tagline ||
            (payload.icon !== undefined && result.icon !== payload.icon)) {
          throw Error('Business branding could not be confirmed.');
        }
        businessNameChanged = true;
        applyBusinessName(result);
        input.value = result.name;
        tagline.value = result.tagline;
        file.value = '';
        resetIcon = false;
        status.textContent = 'Business branding saved.';
      } catch (error) {
        status.textContent = error.message;
      } finally {
        controls.forEach(control => { control.disabled = false; });
      }
    };
    panel.querySelector('.wh75-settings-head')?.after(form);
    if (!form.isConnected) panel.prepend(form);
    if (!panel.querySelector('[data-palz-crm-link]')) {
      const section = document.createElement('section');
      section.className = 'wh75-settings-section sitter-planning';
      section.innerHTML = '<h3>Customer records</h3><a data-palz-crm-link href="crm.html">Open CRM</a>';
      form.after(section);
    }
  }

  function applyBusinessName(brand) {
    const form = $('[data-palz-business-settings]');
    if (form?.elements.businessName.value === businessName) form.elements.businessName.value = brand.name;
    if (typeof brand.tagline === 'string') {
      if (form?.elements.tagline.value === businessTagline) form.elements.tagline.value = brand.tagline;
      businessTagline = brand.tagline;
    }
    if (typeof brand.icon === 'string') businessIcon = brand.icon;
    businessName = brand.name;
    try {
      localStorage.setItem(businessNameCache, businessName);
      localStorage.setItem('palz.business-brand.v1', JSON.stringify({tagline:businessTagline, icon:businessIcon}));
    } catch (_) {}
    showBusinessName();
  }

  if (typeof window.queryAppsScript === 'function') {
    void read({action:'get_business_name'}).then(result => {
      if (!businessNameChanged && typeof result.name === 'string' && result.name) applyBusinessName(result);
    }).catch(() => {});
  }

  function scan(){showBusinessName();mountBusinessSettings();refreshCheckoutButtons();mountToday();const panel=$('#wh75SettingsPanel');if(panel && !panel.querySelector('[data-sitter-planning-settings]')){const section=document.createElement('section');section.className='wh75-settings-section sitter-planning';section.innerHTML='<h3>Availability</h3><button type="button" data-sitter-planning-settings>Availability & handover windows</button>';section.querySelector('button').onclick=openSettings;panel.append(section);}document.querySelectorAll('.directory-card.is-profile-active').forEach(mountCard);}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)mountToday();});
  let queued=false;new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;scan();});}}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-directory-stay-id','data-directory-dog-id','data-directory-stay-key']});scan();
  window.PALZ_SITTER_PLANNING=Object.freeze({openSettings});
})();
