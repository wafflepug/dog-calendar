(() => {
  'use strict';
  async function ownerTool(payload) {
    const response = await fetch(window.WAFFLE_MAINTENANCE_GATE.endpoint,{method:'POST',cache:'no-store',credentials:'omit',
      referrerPolicy:'no-referrer',body:new URLSearchParams({action:'palz_operator',payloadJson:JSON.stringify(payload)})});
    const result = await response.json();
    if (!response.ok || result.result !== 'success') throw Error(result.error || 'Could not confirm the request.');
    return result.value;
  }

  const audit = document.getElementById('palzCareIdentityAudit');
  if (audit) {
    const form = audit.querySelector('form'), status = audit.querySelector('[role=status]'), issues = audit.querySelector('ul');
    let revision = 0;
    audit.addEventListener('toggle', () => {
      if (audit.open) return;
      revision++;
      form.reset();
      form.querySelector('button').disabled = false;
      status.textContent = '';
      issues.replaceChildren();
      issues.hidden = true;
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('button');
      if (button.disabled) return;
      button.disabled = true;
      const current = ++revision;
      issues.replaceChildren();
      issues.hidden = true;
      status.textContent = 'Checking Care records…';
      try {
        const result = await ownerTool({operation:'care_identity_audit',key:form.elements.key.value.trim()});
        if (current !== revision || !audit.open) return;
        status.textContent = `${result.linked} linked by ID · ${result.legacy} linked by legacy key · ${result.review} need review` +
          (result.review > result.issues.length ? ` · Showing first ${result.issues.length}` : '');
        for (const issue of result.issues) {
          const row = document.createElement('li');
          row.textContent = `${issue.source} · Row ${issue.row} · ${issue.reason}`;
          issues.append(row);
        }
        issues.hidden = !result.issues.length;
      } catch (error) {
        if (current === revision && audit.open) status.textContent = error.message;
      } finally {
        if (current === revision) {
          form.reset();
          button.disabled = false;
        }
      }
    });
  }
  if (document.body.dataset.wafflePage !== 'directory') return;
  let queued = false;

  async function photoData(file) {
    if (!file) return '';
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10000000) throw Error('Choose a JPEG, PNG or WebP photo under 10 MB.');
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(1,720/Math.max(bitmap.width,bitmap.height));
      canvas.width = Math.max(1,Math.round(bitmap.width*ratio));
      canvas.height = Math.max(1,Math.round(bitmap.height*ratio));
      const context = canvas.getContext('2d',{alpha:false});
      context.fillStyle = '#fff';
      context.fillRect(0,0,canvas.width,canvas.height);
      context.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const encoded = canvas.toDataURL('image/jpeg',.72);
      if (encoded.length > 150000) throw Error('Choose a smaller photo.');
      return encoded;
    } finally { bitmap.close(); }
  }

  function attach(card) {
    const records = card.querySelector('.directory-care-records-disclosure');
    const id = {stayId:card.dataset.directoryStayId,dogId:card.dataset.directoryDogId,stayKey:card.dataset.directoryStayKey};
    if (!records || !id.stayId || !id.dogId || !id.stayKey || records.querySelector('[data-palz-owner-tools]')) return;
    const tools = document.createElement('details');
    tools.className = 'palz-care-schedule';
    tools.dataset.palzOwnerTools = '';
    tools.innerHTML = '<summary>Owner link and record recovery</summary><form><label>Owner access key<input type="password" name="key" autocomplete="current-password" required></label><label>Update to share <input type="text" name="update" maxlength="1000"></label><label>Photo to share<input type="file" name="photo" accept="image/jpeg,image/png,image/webp"></label><label>Existing website intake link <input type="url" name="intake" placeholder="Optional"></label><button type="submit">Create 7-day link</button> <button type="button" data-owner-revoke>Revoke link</button> <button type="button" data-owner-recover>Find matching Care record</button></form><div data-owner-tool-result hidden></div><p role="status"></p>';
    records.append(tools);
    const form = tools.querySelector('form'), output = tools.querySelector('[data-owner-tool-result]'), status = tools.querySelector('[role=status]');
    let busy = false;
    async function run(operation, values = {}) {
      if (busy || !form.elements.key.reportValidity()) return;
      busy = true;
      const buttons = [...tools.querySelectorAll('button')];
      buttons.forEach(button => { button.disabled = true; });
      try {
        const extra = typeof values === 'function' ? await values() : values;
        return await ownerTool({operation,key:form.elements.key.value.trim(),...id,...extra});
      } catch (error) { status.textContent = error.message; }
      finally { busy = false; buttons.forEach(button => { button.disabled = false; }); }
    }
    function clear() { output.hidden = true; output.replaceChildren(); status.textContent = ''; }
    form.onsubmit = async event => {
      event.preventDefault();
      if (busy) return;
      clear();
      const result = await run('issue',async () => {
        const input = form.elements.intake.value.trim();
        const intake = input ? new URLSearchParams(new URL(input).hash.slice(1)).get('token') : '';
        if (input && !intake) throw Error('Use a Palz Stay website intake link.');
        return {intake,update:form.elements.update.value,photo:await photoData(form.elements.photo.files[0])};
      });
      if (!result) return;
      const link = new URL('owner-stay.html',location.href);
      link.hash = new URLSearchParams({token:result.token}).toString();
      const field = document.createElement('input');
      field.value = link.href;
      field.readOnly = true;
      field.setAttribute('aria-label','Private owner stay link');
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.textContent = 'Copy link';
      copy.onclick = async () => {
        try { await navigator.clipboard.writeText(field.value); status.textContent = 'Link copied.'; }
        catch (_) { field.focus(); field.select(); }
      };
      output.append(field,copy);
      output.hidden = false;
      form.elements.photo.value = '';
      status.textContent = 'Link created. It expires in 7 days.';
    };
    form.querySelector('[data-owner-revoke]').onclick = async () => {
      if (busy || !confirm('Revoke the private owner stay link?')) return;
      clear();
      if (await run('revoke')) status.textContent = 'Stay link revoked.';
    };
    form.querySelector('[data-owner-recover]').onclick = async () => {
      if (busy) return;
      clear();
      const result = await run('recover_preview');
      if (!result) return;
      if (!result.candidates.length) { status.textContent = 'No unmatched Care record with the same stay and dog IDs was found.'; return; }
      for (const candidate of result.candidates) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Relink Care for '+candidate.name;
        button.onclick = async () => {
          if (!confirm('Relink this verified Care record to the current stay?')) return;
          if (await run('recover_apply',{previousKey:candidate.key})) {
            output.hidden = true;
            status.textContent = 'Care record relinked.';
            window.WAFFLE_CARE_PROFILE_INVALIDATE?.(card);
            card.querySelector('[data-care-brief-refresh]')?.click();
          }
        };
        output.append(button);
      }
      output.hidden = false;
    };
    tools.addEventListener('toggle', () => {
      if (!tools.open) { form.reset(); clear(); }
    });
  }

  function scan() {
    queued = false;
    document.querySelectorAll('.directory-card.is-profile-active').forEach(attach);
  }
  new MutationObserver(() => {
    if (!queued) { queued = true; requestAnimationFrame(scan); }
  }).observe(document.body,{childList:true,subtree:true});
  scan();
})();
