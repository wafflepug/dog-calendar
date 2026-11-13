/* Segmented views for the active Care profile. Existing controls and content
   stay in place so the profile, booking and records handlers keep their nodes. */
(() => {
  'use strict';

  const segments = ['overview', 'activity', 'records', 'tools'];
  const labels = { overview: 'Overview', activity: 'Activity', records: 'Records', tools: 'Tools' };
  const mounted = new WeakMap();
  let photoOutsideHandlerInstalled = false;
  let rosterPhotoOutsideHandlerInstalled = false;

  function isDirectory() {
    return window.WAFFLE_PAGE === 'directory' || document.body?.dataset?.wafflePage === 'directory';
  }

  function identity(card) {
    return [card.dataset.directoryStayId, card.dataset.directoryDogId, card.dataset.directoryStayKey].join('\u001f');
  }

  function mark(node, segment) {
    if (node && node.dataset.careProfileSegment !== segment) node.dataset.careProfileSegment = segment;
  }

  function unmark(node) {
    if (node?.hasAttribute('data-care-profile-segment')) node.removeAttribute('data-care-profile-segment');
  }

  function controlsFor(card) {
    return [...card.querySelectorAll('.care-profile-segment-button')];
  }

  function closePhotoMenu(card, returnFocus = false) {
    const details = card?.querySelector('[data-care-photo-options]');
    if (!details?.open) return;
    details.open = false;
    if (returnFocus) details.querySelector(':scope > summary')?.focus();
  }

  function ensureHeaderTools(header) {
    if (!header) return null;
    let tools = header.querySelector('[data-care-header-tools]');
    if (!tools) {
      tools = document.createElement('div');
      tools.className = 'care-header-tools';
      tools.dataset.careHeaderTools = '';
      header.append(tools);
    }
    return tools;
  }

  function mountHostAgain(card) {
    const dogId = String(card.dataset.directoryDogId || '').trim().toLowerCase();
    const header = card.querySelector('.directory-card-header');
    if (!header) return;
    let button = header.querySelector('[data-care-host-again]');
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(dogId)) {
      button?.remove();
      return;
    }
    if (button?.dataset.careHostAgain === dogId) return;
    button?.remove();
    const tools = ensureHeaderTools(header);
    button = document.createElement('button');
    button.type = 'button';
    button.dataset.careHostAgain = dogId;
    button.setAttribute('aria-label', 'Would host again');
    button.title = 'Would host again';
    button.disabled = true;
    button.innerHTML = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 21 3 12a5.5 5.5 0 0 1 9-7 5.5 5.5 0 0 1 9 7z"/></svg>';
    const status = document.createElement('span');
    status.setAttribute('role', 'status');
    status.className = 'care-host-again-status';
    tools.prepend(button, status);
    let liked;
    const request = async () => {
      const saving = typeof liked === 'boolean';
      button.disabled = true;
      status.textContent = '';
      try {
        const data = await window.queryAppsScript({
          action: saving ? 'save_dog_host_again' : 'get_dog_host_again',
          dogId,
          ...(saving ? { liked: !liked } : {})
        }, { maxAttempts: 1, timeoutMs: 12000 });
        if (data?.result !== 'success' || data.dogId !== dogId || typeof data.liked !== 'boolean') throw Error();
        liked = data.liked;
        button.setAttribute('aria-pressed', String(liked));
        button.title = liked ? 'Would host again · selected' : 'Would host again';
        if (saving) status.textContent = liked ? 'Marked as would host again.' : 'Would host again cleared.';
      } catch (_) {
        status.textContent = saving ? 'Could not save. Try again.' : 'Could not load preference. Tap to retry.';
      } finally {
        button.disabled = false;
      }
    };
    button.onclick = request;
    void request();
  }

  function mountPhotoMenu(card) {
    const header = card.querySelector('.directory-card-header');
    const upload = card.querySelector('.directory-care-photo-tools [data-upload-dog-photo]');
    if (!header || !upload || !upload.isConnected) {
      card.removeAttribute('data-care-photo-options-mounted');
      card.querySelector('[data-care-photo-options]')?.remove();
      return false;
    }
    const tools = ensureHeaderTools(header);
    let details = header.querySelector('[data-care-photo-options]');
    if (!details) {
      details = document.createElement('details');
      details.className = 'care-photo-options';
      details.dataset.carePhotoOptions = '';
      details.innerHTML = '<summary aria-label="Photo options"><svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M4 7h3l1.5-2h7L17 7h3v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg><span aria-hidden="true" class="care-photo-options-chevron"></span></summary><div class="care-photo-options-panel"><button type="button" data-care-change-profile-photo>Change profile photo</button><button type="button" data-care-upload-belongings-photo data-care-brief-action="belongings-photo">Upload belongings photos</button><button type="button" data-care-view-photos data-care-brief-action="belongings">View Photos</button></div>';
      tools.append(details);
      details.addEventListener('click', event => {
        const button = event.target.closest('[data-care-change-profile-photo], [data-care-upload-belongings-photo], [data-care-view-photos]');
        if (!button || !details.contains(button)) return;
        const belongings = button.hasAttribute('data-care-upload-belongings-photo');
        const viewPhotos = button.hasAttribute('data-care-view-photos');
        if(belongings || viewPhotos){
          details.open=false;
          if(!card.isConnected || !card.classList.contains('is-profile-active')){event.stopPropagation();return;}
          if(belongings && card.dataset.v1082PastStay==='true'){event.stopPropagation();return;}
          select(card,'tools');
          return; // Existing delegated Care action owns navigation and lazy loading.
        }
        const currentUpload = card.querySelector('.directory-care-photo-tools [data-upload-dog-photo]');
        if (!card.isConnected || !card.classList.contains('is-profile-active') || !currentUpload?.isConnected) {
          details.open = false;
          return;
        }
        details.open = false;
        details.querySelector(':scope > summary')?.focus();
        currentUpload.click();
      });
      details.addEventListener('keydown', event => {
        if (event.key === 'Escape' && details.open) {
          event.preventDefault();
          event.stopPropagation();
          closePhotoMenu(card, true);
        }
      });
      details.addEventListener('toggle', () => {
        if (details.open && (!card.isConnected || !card.classList.contains('is-profile-active'))) details.open = false;
      });
      if (!photoOutsideHandlerInstalled) {
        photoOutsideHandlerInstalled = true;
        document.addEventListener('click', event => {
          document.querySelectorAll('[data-care-photo-options][open]').forEach(openMenu => {
            if (!openMenu.contains(event.target)) openMenu.open = false;
          });
        });
      }
    }
    const belongingsAction=details.querySelector('[data-care-upload-belongings-photo]');
    if(belongingsAction)belongingsAction.hidden=card.dataset.v1082PastStay==='true';
    if (tools && details.parentElement !== tools) tools.append(details);
    if (card.dataset.carePhotoOptionsMounted !== 'true') card.dataset.carePhotoOptionsMounted = 'true';
    return true;
  }

  function select(card, requested, focus = false) {
    if (!segments.includes(requested)) return;
    const brief = card.querySelector('[data-directory-care-brief]');
    if (!brief) return;
    const state = mounted.get(brief);
    if (!state) return;
    state.active = requested;
    if (card.dataset.careProfileSegmentActive !== requested) card.dataset.careProfileSegmentActive = requested;
    if (brief.dataset.careProfileSegmentActive !== requested) brief.dataset.careProfileSegmentActive = requested;
    controlsFor(card).forEach(button => {
      const active = button.dataset.careProfileSegmentButton === requested;
      if (button.getAttribute('aria-pressed') !== String(active)) button.setAttribute('aria-pressed', String(active));
      const tabIndex = active ? '0' : '-1';
      if (button.getAttribute('tabindex') !== tabIndex) button.setAttribute('tabindex', tabIndex);
      if (focus && active) button.focus();
    });

    const routine = card.querySelector('[data-care-routine-log]');
    const routineDetails = routine?.querySelector('details');
    const summary = routineDetails?.querySelector(':scope > summary');
    if (routineDetails && requested === 'activity') {
      if (!routineDetails.open) routineDetails.open = true;
      if (summary) {
        if (summary.getAttribute('role') !== 'heading') summary.setAttribute('role', 'heading');
        if (summary.getAttribute('aria-level') !== '3') summary.setAttribute('aria-level', '3');
        if (summary.getAttribute('tabindex') !== '-1') summary.setAttribute('tabindex', '-1');
      }
    } else if (summary) {
      if (summary.getAttribute('role') === 'heading') summary.removeAttribute('role');
      if (summary.getAttribute('aria-level') === '3') summary.removeAttribute('aria-level');
      if (summary.getAttribute('tabindex') === '-1') summary.removeAttribute('tabindex');
    }

    if (requested === 'records' || requested === 'tools') {
      card.querySelectorAll(`[data-care-profile-segment="${requested}"]`).forEach(details => {
        if (details.tagName === 'DETAILS' && !details.matches('.directory-care-danger-disclosure') && !details.open) details.open = true;
      });
    }
  }

  function mount(card) {
    if (!card?.classList.contains('is-profile-active')) {
      closePhotoMenu(card);
      if (card?.hasAttribute('data-care-photo-options-mounted')) {
        card.removeAttribute('data-care-photo-options-mounted');
        card.querySelector('[data-care-photo-options]')?.remove();
      }
      return;
    }
    mountPhotoMenu(card);
    mountHostAgain(card);
    card.querySelectorAll('[data-care-brief-action="belongings-photo"], [data-care-brief-action="belongings-camera"]').forEach(button=>{button.hidden=card.dataset.v1082PastStay==='true';});
    const brief = card.querySelector('[data-directory-care-brief]');
    if (!brief) return;
    const key = identity(card);
    let state = mounted.get(brief);
    if (state && state.key !== key) {
      state.key = key;
      state.active = 'overview';
      if (card.dataset.careProfileSegmentActive !== 'overview') card.dataset.careProfileSegmentActive = 'overview';
      if (brief.dataset.careProfileSegmentActive !== 'overview') brief.dataset.careProfileSegmentActive = 'overview';
      controlsFor(card).forEach(button => {
        const selected = button.dataset.careProfileSegmentButton === 'overview';
        button.setAttribute('aria-pressed', String(selected));
        button.tabIndex = selected ? 0 : -1;
      });
    }
    if (state) return;

    state = { key, active: 'overview' };
    mounted.set(brief, state);
    card.dataset.careProfileSegmentActive = 'overview';
    if (!brief.id) brief.id = `care-profile-${Math.random().toString(36).slice(2, 10)}`;
    brief.dataset.careProfileSegmentActive = 'overview';

    const nav = document.createElement('div');
    nav.className = 'care-profile-segments';
    nav.dataset.careProfileSegments = '';
    nav.setAttribute('role', 'group');
    nav.setAttribute('aria-label', 'Care profile sections');
    nav.innerHTML = segments.map((segment, index) => `<button type="button" class="care-profile-segment-button" data-care-profile-segment-button="${segment}" aria-controls="${brief.id}" aria-pressed="${index === 0}" tabindex="${index === 0 ? '0' : '-1'}">${labels[segment]}</button>`).join('');

    const heading = brief.querySelector('.directory-care-brief-heading');
    if (heading) heading.before(nav);
    else brief.prepend(nav);

    mark(brief.querySelector('.directory-care-brief-heading'), 'overview');
    mark(brief.querySelector('.directory-care-brief-grid'), 'overview');
    mark(brief.querySelector('[data-care-brief-action="full-profile"]'), 'overview');
    mark(card.querySelector('[data-care-routine-log]'), 'activity');

    const assign = () => {
      // Detailed editors and the older profile subnavigation belong to Tools,
      // rather than repeating the overview underneath every primary section.
      card.querySelectorAll('.v11160-desktop-tabs, .directory-main-profile-tabs, .directory-main-profile-panel, .v1115-profile-danger, .directory-care-danger-disclosure').forEach(node => mark(node, 'tools'));
      const detailTabLabel = card.querySelector('.v11160-desktop-tabs [data-v11160-tab="profile"] span');
      if (detailTabLabel && detailTabLabel.textContent !== 'Detailed care') detailTabLabel.textContent = 'Detailed care';
      const duplicateEdit = card.querySelector('[data-care-brief-action="edit"]');
      if (duplicateEdit) duplicateEdit.toggleAttribute('data-care-duplicate-edit', Boolean(card.querySelector('[data-toggle-profile-edit]')));
      const records = card.querySelector('.directory-care-records-disclosure');
      const readiness = card.querySelector('.directory-care-readiness, .directory-care-readiness-disclosure');
      mark(records, 'records');
      mark(readiness, 'tools');
      // The owner form action is part of Records, including while the form
      // is rendered asynchronously by the directory profile.
      card.querySelectorAll('.directory-owner-care-action-group, [data-care-owner-link-group]').forEach(node => mark(node, 'records'));
      card.querySelectorAll('[data-p4-dir="owner"]').forEach(node => mark(node, 'records'));
      card.querySelectorAll('.directory-care-more-actions-list > *').forEach(node => {
        if (node === records || (records && node.contains(records))) {
          if (node.dataset.careProfileSegment === 'tools') unmark(node);
          return;
        }
        mark(node, 'tools');
      });
      // These are section headings in the segmented view, not another navigation layer.
      card.querySelectorAll('.directory-care-records-disclosure, .directory-care-contact-disclosure, .directory-care-readiness').forEach(details => {
        if (!details.hasAttribute('data-care-segment-flat')) details.dataset.careSegmentFlat = '';
        const summary = details.querySelector(':scope > summary');
        if (summary && summary.getAttribute('tabindex') !== '-1') summary.setAttribute('tabindex', '-1');
        if (summary && summary.getAttribute('role') !== 'heading') summary.setAttribute('role', 'heading');
        if (summary && summary.getAttribute('aria-level') !== '3') summary.setAttribute('aria-level', '3');
      });
      // A section may be relocated into the tools list after this script mounts.
      if (records?.dataset.careProfileSegment === 'tools') mark(records, 'records');
    };
    assign();

    card.addEventListener('click', event => {
      const summary = event.target.closest('[data-care-segment-flat] > summary');
      if (summary && card.contains(summary)) event.preventDefault();
      // An already-open details node emits no new toggle when an existing
      // shortcut targets it. Reveal the section before that handler focuses it.
      const shortcut = event.target.closest('[data-care-brief-action], [data-care-readiness-action]');
      const action = shortcut?.dataset.careReadinessAction || shortcut?.dataset.careBriefAction;
      if (action === 'intake') select(card, 'records');
      else if (['handover','full-profile','edit','edit-routine','emergency-contact','feeding','medication','safety','belongings'].includes(action)) select(card, 'tools');
    }, true);

    nav.addEventListener('click', event => {
      const button = event.target.closest('[data-care-profile-segment-button]');
      if (!button || !nav.contains(button)) return;
      select(card, button.dataset.careProfileSegmentButton);
    });
    nav.addEventListener('keydown', event => {
      const button = event.target.closest('[data-care-profile-segment-button]');
      if (!button || !nav.contains(button)) return;
      const current = segments.indexOf(button.dataset.careProfileSegmentButton);
      let next = current;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % segments.length;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + segments.length) % segments.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = segments.length - 1;
      else return;
      event.preventDefault();
      select(card, segments[next], true);
    });

    const observer = new MutationObserver(records => {
      if (identity(card) !== state.key) {
        state.key = identity(card);
        select(card, 'overview');
      }
      if (records.some(record => record.type === 'childList')) assign();
      for (const record of records) {
        if (record.type !== 'attributes' || record.attributeName !== 'open' || !record.target.open) continue;
        const targetSegment = record.target.closest('[data-care-profile-segment]')?.dataset.careProfileSegment;
        if (targetSegment && targetSegment !== state.active && targetSegment !== 'overview') select(card, targetSegment);
      }
      mark(card.querySelector('[data-care-routine-log]'), 'activity');
    });
    observer.observe(card, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'data-directory-stay-id', 'data-directory-dog-id', 'data-directory-stay-key'] });
  }

  function mountRosterPhotoMenu(card) {
    if(card.classList.contains('is-profile-active'))return;
    let menu=card.querySelector('[data-care-roster-photo-menu]');
    if(menu)return;
    menu=document.createElement('details');menu.className='care-roster-photo-options';menu.dataset.careRosterPhotoMenu='';
    menu.innerHTML='<summary aria-label="Photo options for '+String(card.dataset.directoryDogName||'guest').replace(/[&<>"']/g,'')+'"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h3l1.5-2h7L17 7h3v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg></summary><div class="care-roster-photo-panel"><button type="button" data-roster-photo-action="profile">Change profile photo</button><button type="button" data-roster-photo-action="upload">Upload belongings photos</button><button type="button" data-roster-photo-action="view">View gallery</button><p data-roster-photo-status role="status"></p></div>';
    card.append(menu);
    if(!rosterPhotoOutsideHandlerInstalled){rosterPhotoOutsideHandlerInstalled=true;document.addEventListener('click',event=>document.querySelectorAll('[data-care-roster-photo-menu][open]').forEach(openMenu=>{if(!openMenu.contains(event.target))openMenu.open=false;}));}
    menu.querySelector('[data-roster-photo-action="upload"]').hidden=card.dataset.v1082PastStay==='true';
    menu.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();menu.open=false;menu.querySelector('summary').focus();}});
    menu.addEventListener('click',async event=>{
      const action=event.target.closest('[data-roster-photo-action]');if(!action)return;
      event.preventDefault();event.stopPropagation();
      if(action.disabled||!card.isConnected)return;
      const key=identity(card),kind=action.dataset.rosterPhotoAction;
      if(kind==='upload'&&card.dataset.v1082PastStay==='true')return;
      const open=card.querySelector('[data-open-directory-profile]');if(!open)return;
      action.disabled=true;
      try{
        open.click();
        const active=await new Promise((resolve,reject)=>{
          let observer,timer;
          const check=()=>{
            const matches=[...document.querySelectorAll('.directory-card.is-profile-active')].filter(item=>identity(item)===key);
            if(matches.length===1&&matches[0].querySelector('[data-care-photo-options]')){clearTimeout(timer);observer?.disconnect();resolve(matches[0]);}
          };
          observer=new MutationObserver(check);observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
          timer=setTimeout(()=>{observer.disconnect();reject(new Error('Open this guest profile to access photo tools.'));},8000);check();
        });
        menu.open=false;
        const selector=kind==='profile'?'[data-care-change-profile-photo]':kind==='upload'?'[data-care-upload-belongings-photo]':'[data-care-view-photos]';
        const target=active.querySelector(selector);if(!target||target.hidden)throw new Error('This photo action is not available for this stay.');
        target.click();
      }catch(error){const status=menu.querySelector('[data-roster-photo-status]');if(status)status.textContent=error.message;}
      finally{if(action.isConnected)action.disabled=false;}
    });
    menu.addEventListener('toggle',()=>{if(menu.open)document.querySelectorAll('[data-care-roster-photo-menu][open]').forEach(other=>{if(other!==menu)other.open=false;});});
  }

  function scan() {
    if (isDirectory()) {
      document.querySelectorAll('.directory-card[data-care-photo-options-mounted]:not(.is-profile-active)').forEach(mount);
      document.querySelectorAll('.directory-card.is-profile-active').forEach(mount);
      document.querySelectorAll('.directory-card:not(.is-profile-active)').forEach(mountRosterPhotoMenu);
    }
  }

  if (isDirectory()) {
    const observer = new MutationObserver(scan);
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-directory-stay-id', 'data-directory-dog-id', 'data-directory-stay-key'] });
    scan();
  }
})();
