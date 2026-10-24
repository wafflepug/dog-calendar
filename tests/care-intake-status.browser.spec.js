const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'care-intake-status.js'), 'utf8');
const handoffSource = fs.readFileSync(path.join(__dirname, '..', 'owner-handoff.js'), 'utf8');
const receiptIdentity = 'milo|2026-10-20|2026-10-22|dog-1|stay-1|milo|2026-10-20|2026-10-22';
const markup = (extra = '') => `<body><main id="directory-grid"><article class="directory-card is-profile-active" data-directory-stay-key="milo|2026-10-20|2026-10-22" data-directory-dog-name="Milo" data-directory-start-date="2026-10-20" data-directory-end-date="2026-10-22" data-directory-stay-id="stay-1" data-directory-dog-id="dog-1"><section data-directory-care-brief><div class="directory-care-brief-actions"><button data-p4-dir="owner" id="firstlevelOwnerCareLink"><span>Owner Care Link</span><small>Send or copy this guest’s care link</small></button></div><details class="directory-care-more-actions"><summary>More tools</summary><div class="directory-care-more-actions-list"></div></details><div data-care-readiness-item="intake"></div></section><div data-directory-intake="milo|2026-10-20|2026-10-22" ${extra}></div><details data-directory-records><summary>Records &amp; forms</summary><button data-create-intake-link>Copy link</button><a href="/intake.pdf">PDF</a></details></article></main></body>`;

async function watchNetworkReads(page) {
  await page.evaluate(() => {
    window.__intakeNetworkReads = 0;
    const originalFetch = window.fetch.bind(window);
    window.fetch = (...args) => { window.__intakeNetworkReads += 1; return originalFetch(...args); };
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (...args) { window.__intakeNetworkReads += 1; return originalOpen.apply(this, args); };
  });
}

test.describe('compact care intake status', () => {
  test('shows only a validated digital receipt timestamp and clears it on state change', async ({ page }) => {
    await page.setContent(markup());
    await watchNetworkReads(page);
    await page.addScriptTag({ content: source });
    const strip = page.locator('[data-directory-intake]');
    const state = () => page.evaluate(() => WAFFLE_INTAKE_STATUS.getState(document.querySelector('.directory-card')));

    await strip.evaluate((el, identity) => { el.innerHTML = `<div><span class="directory-intake-dot is-complete"></span><span>Intake complete</span><span class="directory-record-meta" data-intake-received-at="2026-10-22T14:30:00.000Z" data-intake-received-for="${identity}">22 Oct 2026, 01:30 pm</span></div>`; }, receiptIdentity);
    await expect.poll(async () => (await state()).code).toBe('complete');
    expect((await state()).detail).toMatch(/^Owner form received .+\. Review the submitted answers in Records & forms\.$/);
    const localReceipt = await page.evaluate(() => new Date('2026-10-22T14:30:00Z').toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
    expect((await state()).detail).toBe(`Owner form received ${localReceipt}. Review the submitted answers in Records & forms.`);

    for (const invalid of ['', '18 Oct 2026', '2026-02-30T14:30:00Z', '2026-10-22T25:30:00Z', '2026-10-22T14:30:00+11:90', 'javascript:alert(1)', 'https://secret.invalid/token']) {
      await strip.evaluate((el, { value, identity }) => {
        el.innerHTML = '<div><span class="directory-intake-dot is-complete"></span><span>Intake complete</span><span class="directory-record-meta"></span></div>';
        el.querySelector('.directory-record-meta').setAttribute('data-intake-received-at', value);
        el.querySelector('.directory-record-meta').setAttribute('data-intake-received-for', identity);
      }, { value: invalid, identity: receiptIdentity });
      expect((await state()).detail).toBe('Review the submitted answers in Records & forms.');
      expect(await page.locator('[data-compact-intake-status]').textContent()).toBe('Form received');
      expect(await page.locator('[data-compact-intake-status]').getAttribute('aria-description')).not.toContain('secret.invalid');
    }
    await strip.evaluate(el => { el.innerHTML = '<div><span class="directory-intake-dot is-complete"></span><span>Intake complete</span><span class="directory-record-meta" data-intake-received-at="2026-10-22T14:30:00Z">22 Oct 2026</span></div>'; });
    expect(await state()).toMatchObject({ code: 'unknown', label: 'Status unknown' });

    await strip.evaluate((el, identity) => {
      el.innerHTML = `<div><span class="directory-intake-dot is-complete"></span><span>Intake complete</span><span class="directory-record-meta" data-intake-received-at="2026-10-22T14:30:00Z" data-intake-received-for="${identity}">Stored profile</span></div>`;
    }, receiptIdentity);
    expect(await state()).toMatchObject({ code: 'unknown', detail: 'Current form completion is not verified. Check Records & forms for submitted answers.' });
    await strip.evaluate(el => { el.innerHTML = '<span class="directory-intake-dot is-awaiting"></span>Awaiting owner'; });
    await expect.poll(async () => (await state()).code).toBe('awaiting');
    expect((await state()).detail).not.toContain('Owner form received');

    await strip.evaluate((el, identity) => { el.innerHTML = `<div><span class="directory-intake-dot is-complete"></span><span>Intake complete</span><span class="directory-record-meta" data-intake-received-at="2026-10-22T14:30:00Z" data-intake-received-for="${identity}">22 Oct 2026</span></div>`; }, receiptIdentity);
    await expect.poll(async () => (await state()).detail).toContain('Owner form received');
    const meta = strip.locator('.directory-record-meta');
    const originalDescription = await page.locator('[data-compact-intake-status]').getAttribute('aria-description');
    await meta.evaluate(el => el.setAttribute('data-intake-received-at', '2026-10-22T14:31:00Z'));
    await expect.poll(() => page.locator('[data-compact-intake-status]').getAttribute('aria-description')).not.toBe(originalDescription);
    await meta.evaluate(el => el.removeAttribute('data-intake-received-at'));
    await expect.poll(() => page.locator('[data-compact-intake-status]').getAttribute('aria-description')).toBe('Review the submitted answers in Records & forms.');
    await meta.evaluate(el => el.setAttribute('data-intake-received-at', '2026-10-22T14:30:00Z'));
    await expect.poll(() => page.locator('[data-compact-intake-status]').getAttribute('aria-description')).toContain('Owner form received');
    await strip.evaluate(el => el.setAttribute('aria-busy', 'true'));
    await expect.poll(async () => (await state()).label).toBe('Loading');
    await expect.poll(() => strip.locator('[data-intake-received-at]').count()).toBe(0);
    await strip.evaluate(el => el.removeAttribute('aria-busy'));
    await page.locator('.directory-card').evaluate(card => { card.dataset.directoryDogId = 'dog-2'; });
    await expect.poll(async () => (await state()).code).toBe('unknown');
    expect((await state()).detail).not.toContain('Owner form received');
    await expect.poll(() => strip.locator('[data-intake-received-at]').count()).toBe(0);
    await page.locator('.directory-card').evaluate((card, identity) => {
      card.dataset.directoryDogId = 'dog-1';
      const meta = card.querySelector('.directory-record-meta');
      meta.dataset.intakeReceivedFor = identity;
      meta.dataset.intakeReceivedAt = '2026-10-22T14:30:00Z';
    }, receiptIdentity);
    await expect.poll(() => page.locator('[data-compact-intake-status]').getAttribute('aria-description')).toContain('Owner form received');
    await expect(strip.locator('[data-intake-received-at]')).toHaveCount(1);
    await meta.evaluate(el => el.removeAttribute('data-intake-received-for'));
    await expect.poll(async () => (await state()).code).toBe('unknown');
    expect(await page.evaluate(() => window.__intakeNetworkReads)).toBe(0);
  });

  test('maps canonical states without network reads, preserves controls, and ignores an ambiguous wrong stay', async ({ page }) => {
    await page.setContent(markup('aria-busy="true"'));
    await watchNetworkReads(page);
    await page.addScriptTag({ content: source });
    const state = () => page.evaluate(() => WAFFLE_INTAKE_STATUS.getState(document.querySelector('.directory-card')));
    expect(await state()).toMatchObject({ code: 'unknown', label: 'Loading' });
    await page.locator('[data-directory-intake]').evaluate(el => { el.removeAttribute('aria-busy'); el.innerHTML = '<span class="directory-intake-dot is-not-sent"></span>No digital intake on file'; });
    await expect.poll(async () => (await state()).code).toBe('not_prepared');
    await expect(page.locator('#firstlevelOwnerCareLink')).toHaveAccessibleName('Prepare owner form for Milo');
    await page.locator('[data-directory-intake]').evaluate(el => { el.innerHTML = '<span class="directory-intake-dot is-awaiting"></span>Awaiting owner'; });
    await expect.poll(async () => (await state()).code).toBe('awaiting');
    await expect(page.locator('[data-compact-intake-status]')).toHaveText('Awaiting owner');
    await expect(page.locator('#firstlevelOwnerCareLink span')).toHaveText('Review owner form');
    await expect(page.locator('#firstlevelOwnerCareLink')).toHaveAccessibleName('Review owner form for Milo');
    await expect(page.locator('#firstlevelOwnerCareLink small')).toContainText('not been received');
    await page.locator('[data-directory-intake]').evaluate(el => { el.removeAttribute('aria-busy'); el.innerHTML = '<span class="directory-intake-dot is-complete"></span><span>Intake complete</span>'; });
    await expect.poll(async () => (await state()).code).toBe('complete');
    expect(await state()).toMatchObject({ label: 'Form received', method: 'digital' });
    await expect(page.locator('#firstlevelOwnerCareLink span')).toHaveText('Review owner form');
    await expect(page.locator('#firstlevelOwnerCareLink')).toHaveAccessibleName('Review owner form for Milo');
    await expect(page.locator('#firstlevelOwnerCareLink')).toHaveAttribute('aria-description', /Records & forms/);
    await page.locator('[data-directory-intake]').evaluate(el => el.setAttribute('aria-busy', 'true'));
    await expect.poll(async () => (await state()).label).toBe('Loading');
    expect(await state()).toMatchObject({ code: 'unknown' });
    await page.locator('[data-directory-intake]').evaluate(el => el.removeAttribute('aria-busy'));
    await page.locator('[data-directory-intake]').evaluate(el => { el.innerHTML = '<span class="directory-intake-dot is-awaiting"></span>Awaiting owner · submitted 18 Oct'; });
    await expect.poll(async () => (await state()).code).toBe('awaiting');
    await page.locator('[data-directory-intake]').evaluate(el => { el.innerHTML = '<span class="directory-intake-dot is-complete"></span>Saved profile'; });
    await expect.poll(async () => (await state()).code).toBe('unknown');

    await page.locator('[data-directory-intake]').evaluate(el => { el.innerHTML = '<span class="directory-intake-dot is-not-sent"></span>No digital intake on file'; });
    await page.locator('.directory-card').evaluate(card => { card.dataset.intakeMethod = 'legacy'; });
    await expect.poll(async () => (await state()).label).toBe('Care profile available');
    expect(await state()).toMatchObject({ code: 'unknown', detail: 'Current form completion is not verified. Check Records & forms for submitted answers.' });
    await page.locator('.directory-card').evaluate(card => { card.dataset.intakeMethod = 'none'; });
    await page.locator('[data-directory-intake]').evaluate(el => { el.innerHTML = '<span class="directory-intake-dot is-complete"></span><span>Intake complete</span><span class="directory-record-meta">Stored profile</span>'; });
    await expect.poll(async () => (await state()).label).toBe('Saved care available');
    expect(await state()).toMatchObject({ code: 'unknown', detail: 'Current form completion is not verified. Check Records & forms for submitted answers.' });
    await page.locator('[data-directory-intake]').evaluate(el => { el.textContent = 'Digital intake unavailable'; });
    await expect.poll(async () => (await state()).code).toBe('unknown');

    await page.locator('.directory-card').evaluate(card => window.dispatchEvent(new CustomEvent('waffle:owner-care-link-ready', { detail: { dogName: 'Milo', startDate: '2026-10-20', endDate: '2026-10-23', link: 'https://secret.invalid/token' } })));
    expect(await state()).toMatchObject({ code: 'unknown' });
    await page.locator('[data-directory-intake]').evaluate(el => { el.innerHTML = '<span class="directory-intake-dot is-not-sent"></span>No digital intake on file'; });
    await expect.poll(async () => (await state()).code).toBe('not_prepared');
    await expect(page.locator('.directory-card.is-profile-active #firstlevelOwnerCareLink span')).toHaveText('Prepare owner form');
    expect(await page.locator('[data-compact-intake-status]').textContent()).not.toContain('secret.invalid');
    await expect(page.locator('#firstlevelOwnerCareLink')).toHaveCount(1);
    await expect(page.locator('[data-create-intake-link]')).toBeAttached();
    await expect(page.locator('details a[href="/intake.pdf"]')).toBeAttached();
  });

  test('contextual action stays singular and updates with truthful state without extra reads', async ({ page }) => {
    await watchNetworkReads(page);
    await page.setViewportSize({ width: 320, height: 740 });
    await page.setContent(markup());
    await page.addScriptTag({ content: source });
    const card = page.locator('.directory-card');
    const owner = page.locator('#firstlevelOwnerCareLink');
    await page.locator('[data-directory-intake]').evaluate(el => { el.innerHTML = '<span class="directory-intake-dot is-not-sent"></span>No digital intake on file'; });
    await expect(owner.locator('span')).toHaveText('Prepare owner form');
    await expect(card.locator('.directory-owner-care-action-group [data-p4-dir="owner"]')).toHaveCount(1);
    await page.locator('[data-directory-intake]').evaluate(el => { el.innerHTML = '<span class="directory-intake-dot is-awaiting"></span>Awaiting owner'; });
    await expect(owner.locator('span')).toHaveText('Review owner form');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('waffle:owner-care-link-ready', { detail: { dogName: 'Milo', startDate: '2026-10-20', endDate: '2026-10-22', link: 'https://secret.invalid/token', dogId: 'dog-1', stayId: 'stay-1', stayKey: 'milo|2026-10-20|2026-10-22' } })));
    await page.locator('[data-directory-intake]').evaluate(el => { el.innerHTML = '<span class="directory-intake-dot is-not-sent"></span>No digital intake on file'; });
    await expect(owner.locator('span')).toHaveText('Copy care link');
    await expect(owner).toHaveAccessibleName('Copy care link for Milo');
    await expect(owner).toHaveAttribute('aria-description', /Copy the current care link/);
    await expect(page.locator('[data-compact-intake-status]')).toHaveText('Link ready');
    expect(await page.evaluate(() => ({ actions: document.querySelectorAll('.directory-owner-care-action-group [data-p4-dir="owner"]').length, statuses: document.querySelectorAll('[data-compact-intake-status]').length, reads: window.__intakeNetworkReads }))).toEqual({ actions: 1, statuses: 1, reads: 0 });
    for (const dark of [false, true]) {
      await page.locator('body').evaluate((node, enabled) => node.classList.toggle('dark-theme', enabled), dark);
      const layout = await owner.evaluate(node => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, height: node.getBoundingClientRect().height }));
      expect(layout.scroll).toBeLessThanOrEqual(layout.client);
      expect(layout.height).toBeGreaterThan(0);
    }
  });

  test('copies only an exact current ready link from the first-level action and keeps the token out of status text', async ({ page }) => {
    await page.setContent(markup());
    await watchNetworkReads(page);
    await page.addScriptTag({ content: handoffSource });
    await page.addScriptTag({ content: source });
    await page.evaluate(() => {
      window.__copied = [];
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => window.__copied.push(value) } });
      window.__ownerFallbackCalls = 0;
      document.querySelector('#firstlevelOwnerCareLink').addEventListener('click', () => window.__ownerFallbackCalls++);
      window.dispatchEvent(new CustomEvent('waffle:owner-care-link-ready', { detail: { dogName: 'Milo', startDate: '2026-10-20', endDate: '2026-10-22', link: 'https://secret.invalid/token', dogId: 'dog-1', stayId: 'stay-1' } }));
    });
    const owner = page.locator('#firstlevelOwnerCareLink');
    await expect(owner.locator('span')).toHaveText('Copy care link');
    await owner.click();
    await expect(page.locator('[data-compact-intake-status]')).toContainText('Care link copied');
    expect(await page.evaluate(() => ({ copied: window.__copied, fallbackCalls: window.__ownerFallbackCalls, status: document.querySelector('[data-compact-intake-status]').textContent }))).toEqual({ copied: ['https://secret.invalid/token'], fallbackCalls: 0, status: 'Care link copied. Paste it into the owner’s usual chat and send.' });
    expect(await page.locator('[data-compact-intake-status]').textContent()).not.toContain('token');
    expect(await page.evaluate(() => window.__intakeNetworkReads)).toBe(0);
  });

  test('a legacy name-and-date link remains reviewable but cannot become a direct-copy action', async ({ page }) => {
    await page.setContent(markup());
    await page.addScriptTag({ content: handoffSource });
    await page.addScriptTag({ content: source });
    await page.locator('[data-directory-intake]').evaluate(el => { el.innerHTML = '<span class="directory-intake-dot is-not-sent"></span>No digital intake on file'; });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('waffle:owner-care-link-ready', { detail: { dogName: 'Milo', startDate: '2026-10-20', endDate: '2026-10-22', link: 'https://secret.invalid/legacy-token' } })));
    await expect(page.locator('#firstlevelOwnerCareLink span')).toHaveText('Share care link');
    await expect(page.locator('[data-compact-intake-status]')).toHaveText('Link ready');
    expect(await page.locator('#firstlevelOwnerCareLink').getAttribute('aria-label')).toBe('Share care link for Milo');
  });

  test('blocked clipboard exposes a selectable manual fallback with truthful status', async ({ page }) => {
    await page.setContent(markup());
    await page.addScriptTag({ content: handoffSource });
    await page.addScriptTag({ content: source });
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('blocked'); } } });
      window.dispatchEvent(new CustomEvent('waffle:owner-care-link-ready', { detail: { dogName: 'Milo', startDate: '2026-10-20', endDate: '2026-10-22', link: 'https://secret.invalid/token', dogId: 'dog-1', stayId: 'stay-1', stayKey: 'milo|2026-10-20|2026-10-22' } }));
    });
    await page.locator('#firstlevelOwnerCareLink').click();
    const fallback = page.locator('[data-owner-care-link-fallback]');
    await expect(fallback).toHaveValue('https://secret.invalid/token');
    await expect(fallback).toBeFocused();
    await expect(fallback).toHaveJSProperty('selectionStart', 0);
    await expect(page.locator('[data-compact-intake-status]')).toContainText('Copy was blocked');
    await expect(page.locator('[data-compact-intake-status]')).not.toContainText('copied');
  });

  test('a blocked-copy field is removed when the selected stay and trusted link change', async ({ page }) => {
    await page.setContent(markup());
    await page.addScriptTag({ content: handoffSource });
    await page.addScriptTag({ content: source });
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('blocked'); } } });
      window.dispatchEvent(new CustomEvent('waffle:owner-care-link-ready', { detail: { dogName: 'Milo', startDate: '2026-10-20', endDate: '2026-10-22', link: 'https://secret.invalid/old-token', dogId: 'dog-1', stayId: 'stay-1', stayKey: 'milo|2026-10-20|2026-10-22' } }));
    });
    await page.locator('#firstlevelOwnerCareLink').click();
    await expect(page.locator('[data-owner-care-link-fallback]')).toHaveValue('https://secret.invalid/old-token');
    await page.locator('.directory-card').evaluate(card => { card.dataset.directoryDogId = 'dog-2'; card.dataset.directoryStayId = 'stay-2'; });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('waffle:owner-care-link-ready', { detail: { dogName: 'Milo', startDate: '2026-10-20', endDate: '2026-10-22', link: 'https://secret.invalid/new-token', dogId: 'dog-2', stayId: 'stay-2', stayKey: 'milo|2026-10-20|2026-10-22' } })));
    await expect(page.locator('[data-owner-care-link-fallback]')).toHaveCount(0);
    await page.evaluate(() => {
      window.__copiedAfterChange = [];
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => window.__copiedAfterChange.push(value) } });
    });
    await page.locator('#firstlevelOwnerCareLink').click();
    await expect(page.locator('[data-compact-intake-status]')).toContainText('Care link copied');
    expect(await page.evaluate(() => window.__copiedAfterChange)).toEqual(['https://secret.invalid/new-token']);
  });

  test('same-name stay with different exact IDs cannot reuse a prepared link', async ({ page }) => {
    await page.setContent(markup());
    await page.addScriptTag({ content: handoffSource });
    await page.addScriptTag({ content: source });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('waffle:owner-care-link-ready', { detail: { dogName: 'Milo', startDate: '2026-10-20', endDate: '2026-10-22', link: 'https://secret.invalid/token', dogId: 'other-dog', stayId: 'other-stay' } })));
    await expect(page.locator('#firstlevelOwnerCareLink span')).toHaveText('Review owner form');
    expect(await page.evaluate(() => WAFFLE_INTAKE_STATUS.getState(document.querySelector('.directory-card')).code)).toBe('unknown');
  });

  test('a stay change during clipboard completion suppresses the stale copied confirmation', async ({ page }) => {
    await page.setContent(markup());
    await page.addScriptTag({ content: handoffSource });
    await page.addScriptTag({ content: source });
    await page.evaluate(() => {
      let finish;
      window.__clipboardStarted = new Promise(resolve => { window.__clipboardFinishStarted = resolve; });
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise(resolve => { finish = resolve; window.__clipboardFinishStarted(); }) } });
      window.__resolveClipboard = () => finish();
      window.dispatchEvent(new CustomEvent('waffle:owner-care-link-ready', { detail: { dogName: 'Milo', startDate: '2026-10-20', endDate: '2026-10-22', link: 'https://secret.invalid/token', dogId: 'dog-1', stayId: 'stay-1', stayKey: 'milo|2026-10-20|2026-10-22' } }));
    });
    await page.locator('#firstlevelOwnerCareLink').click();
    await page.evaluate(() => window.__clipboardStarted);
    await page.locator('.directory-card').evaluate(card => { card.dataset.directoryDogId = 'changed-dog'; });
    await page.evaluate(() => window.__resolveClipboard());
    await expect(page.locator('[data-compact-intake-status]')).toContainText('stay changed while copying');
    await expect(page.locator('[data-compact-intake-status]')).not.toContainText('copied');
  });

  test('a current cached link keeps the same identity through observer refresh while clipboard is pending', async ({ page }) => {
    await page.setContent(markup());
    await page.addScriptTag({ content: handoffSource });
    await page.evaluate(() => {
      const card = document.querySelector('.directory-card');
      window.__link = { link: 'https://secret.invalid/current-token', stayKey: card.dataset.directoryStayKey, stayId: 'stay-1', dogId: 'dog-1', dogName: card.dataset.directoryDogName, startDate: card.dataset.directoryStartDate, endDate: card.dataset.directoryEndDate };
      window.WAFFLE_CARE_LINKS = { getCurrent: () => window.__link };
    });
    await page.addScriptTag({ content: source });
    await page.evaluate(() => {
      let finish;
      window.__copyStarted = new Promise(resolve => { window.__resolveStarted = resolve; });
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise(resolve => { finish = resolve; window.__resolveStarted(); }) } });
      window.__finishCopy = () => finish();
    });
    const owner = page.locator('#firstlevelOwnerCareLink');
    await expect(owner.locator('span')).toHaveText('Copy care link');
    await owner.click();
    await page.evaluate(() => window.__copyStarted);
    await page.locator('[data-directory-intake]').evaluate(el => {
      el.append(document.createTextNode(' refreshed'));
      return new Promise(resolve => requestAnimationFrame(() => resolve()));
    });
    await expect.poll(() => page.locator('[data-compact-intake-status]').textContent()).toContain('Copying');
    await page.evaluate(() => window.__finishCopy());
    await expect(page.locator('[data-compact-intake-status]')).toContainText('Care link copied');
  });

  test('duplicate stay-key cards cannot use an ID-incomplete cached link', async ({ page }) => {
    await page.setContent(markup());
    await page.addScriptTag({ content: handoffSource });
    await page.evaluate(() => {
      const second = document.querySelector('.directory-card').cloneNode(true);
      second.classList.remove('is-profile-active');
      second.dataset.directoryDogId = 'dog-2';
      second.dataset.directoryStayId = 'stay-2';
      document.querySelector('#directory-grid').appendChild(second);
      window.WAFFLE_CARE_LINKS = { getCurrent: () => ({ link: 'https://secret.invalid/token', stayKey: second.dataset.directoryStayKey, dogId: '', stayId: '' }) };
    });
    await page.addScriptTag({ content: source });
    await expect(page.locator('.directory-card.is-profile-active #firstlevelOwnerCareLink span')).toHaveText('Review owner form');
    expect(await page.locator('[data-owner-care-link-fallback]').count()).toBe(0);
  });

  test('a canonical cached link disappearing clears a blocked-copy fallback and cannot reseed it', async ({ page }) => {
    await page.setContent(markup());
    await page.addScriptTag({ content: handoffSource });
    await page.evaluate(() => {
      const card = document.querySelector('.directory-card');
      window.__currentLink = { link: 'https://secret.invalid/current-token', stayKey: card.dataset.directoryStayKey, stayId: 'stay-1', dogId: 'dog-1', dogName: card.dataset.directoryDogName, startDate: card.dataset.directoryStartDate, endDate: card.dataset.directoryEndDate };
      window.WAFFLE_CARE_LINKS = { getCurrent: () => window.__currentLink };
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('blocked'); } } });
    });
    await page.addScriptTag({ content: source });
    await page.locator('[data-directory-intake]').evaluate(el => { el.innerHTML = '<span class="directory-intake-dot is-not-sent"></span>No digital intake on file'; });
    await page.locator('#firstlevelOwnerCareLink').click();
    await expect(page.locator('[data-owner-care-link-fallback]')).toHaveValue('https://secret.invalid/current-token');
    await page.evaluate(() => { window.__currentLink = null; WAFFLE_INTAKE_STATUS.refresh(document.querySelector('.directory-card')); });
    await expect(page.locator('[data-owner-care-link-fallback]')).toHaveCount(0);
    await expect(page.locator('#firstlevelOwnerCareLink span')).toHaveText('Prepare owner form');
    expect(await page.evaluate(() => WAFFLE_INTAKE_STATUS.getState(document.querySelector('.directory-card')).code)).toBe('not_prepared');
  });

  test('a duplicate current stay key revokes a previously prepared event link', async ({ page }) => {
    await page.setContent(markup());
    await page.addScriptTag({ content: handoffSource });
    await page.addScriptTag({ content: source });
    await page.locator('[data-directory-intake]').evaluate(el => { el.innerHTML = '<span class="directory-intake-dot is-not-sent"></span>No digital intake on file'; });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('waffle:owner-care-link-ready', { detail: { dogName: 'Milo', startDate: '2026-10-20', endDate: '2026-10-22', link: 'https://secret.invalid/token', dogId: 'dog-1', stayId: 'stay-1' } })));
    await expect(page.locator('.directory-card.is-profile-active #firstlevelOwnerCareLink span')).toHaveText('Copy care link');
    await page.locator('.directory-card').evaluate(card => {
      const second = card.cloneNode(true);
      second.classList.remove('is-profile-active');
      second.dataset.directoryDogId = 'dog-2';
      second.dataset.directoryStayId = 'stay-2';
      document.querySelector('#directory-grid').appendChild(second);
    });
    await expect(page.locator('.directory-card.is-profile-active #firstlevelOwnerCareLink span')).toHaveText('Prepare owner form');
  });

  test('More tools keeps owner sharing options secondary and reuses the existing owner flow', async ({ page }) => {
    await page.setContent(markup());
    await page.addScriptTag({ content: source });
    await page.evaluate(() => {
      window.__ownerFlowCalls = 0;
      document.querySelector('#firstlevelOwnerCareLink').addEventListener('click', () => window.__ownerFlowCalls++);
      window.dispatchEvent(new CustomEvent('waffle:owner-care-link-ready', { detail: { dogName: 'Milo', startDate: '2026-10-20', endDate: '2026-10-22', link: 'https://secret.invalid/token', dogId: 'dog-1', stayId: 'stay-1', stayKey: 'milo|2026-10-20|2026-10-22' } }));
    });
    const tools = page.locator('.directory-care-more-actions');
    await expect(tools).not.toHaveAttribute('open', '');
    await expect(tools.locator('[data-owner-care-sharing-options]')).toHaveCount(1);
    await expect(tools.locator('[data-owner-care-sharing-options]')).toBeHidden();
    await tools.locator(':scope > summary').click();
    await tools.locator('[data-owner-care-sharing-options]').click();
    expect(await page.evaluate(() => window.__ownerFlowCalls)).toBe(1);
  });

  test('accepts a prepared link only for the exact selected stay; canonical completion wins', async ({ page }) => {
    await page.setContent(markup('aria-busy="true"'));
    await page.addScriptTag({ content: source });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('waffle:owner-care-link-ready', { detail: { dogName: 'Milo', startDate: '2026-10-20', endDate: '2026-10-22', link: 'https://secret.invalid/token', dogId: 'dog-1', stayId: 'stay-1', stayKey: 'milo|2026-10-20|2026-10-22' } })));
    await expect.poll(() => page.evaluate(() => WAFFLE_INTAKE_STATUS.getState(document.querySelector('.directory-card')).code)).toBe('link_ready');
    await page.locator('[data-directory-intake]').evaluate(el => { el.removeAttribute('aria-busy'); el.innerHTML = '<span class="directory-intake-dot is-complete"></span><span>Intake complete</span>'; });
    await expect.poll(() => page.evaluate(() => WAFFLE_INTAKE_STATUS.getState(document.querySelector('.directory-card')).code)).toBe('complete');
    expect(await page.locator('[data-compact-intake-status]').textContent()).not.toContain('token');

    await page.locator('.directory-card').evaluate(card => {
      card.dataset.directoryDogId = 'different-dog';
      card.dataset.directoryStayKey = 'milo|2026-10-20|2026-10-22'; // unchanged legacy key
    });
    await page.locator('[data-directory-intake]').evaluate(el => { el.setAttribute('aria-busy', 'true'); el.innerHTML = '<span class="directory-intake-dot is-not-sent"></span>No digital intake on file'; });
    await expect.poll(() => page.evaluate(() => WAFFLE_INTAKE_STATUS.getState(document.querySelector('.directory-card')).code)).toBe('unknown');
  });

  test('a verified prepared link is visible while the canonical intake strip is busy or absent', async ({ page }) => {
    await page.setContent(markup('aria-busy="true"'));
    await page.addScriptTag({ content: source });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('waffle:owner-care-link-ready', { detail: { dogName: 'Milo', startDate: '2026-10-20', endDate: '2026-10-22', link: 'https://secret.invalid/token', dogId: 'dog-1', stayId: 'stay-1', stayKey: 'milo|2026-10-20|2026-10-22' } })));
    await expect.poll(() => page.evaluate(() => WAFFLE_INTAKE_STATUS.getState(document.querySelector('.directory-card')).code)).toBe('link_ready');
    await page.locator('[data-directory-intake]').evaluate(el => el.remove());
    await expect.poll(() => page.evaluate(() => WAFFLE_INTAKE_STATUS.getState(document.querySelector('.directory-card')).code)).toBe('link_ready');
  });

  test('repeated refreshes do not rewrite unchanged status or duplicate it', async ({ page }) => {
    await page.setContent(markup());
    await page.addScriptTag({ content: source });
    await page.locator('[data-directory-intake]').evaluate(el => { el.innerHTML = '<span class="directory-intake-dot is-not-sent"></span>No digital intake on file'; });
    await expect(page.locator('[data-compact-intake-status]')).toBeAttached();
    const result = await page.evaluate(async () => {
      const status = document.querySelector('[data-compact-intake-status]');
      const card = document.querySelector('.directory-card');
      const draft = document.createElement('input');
      draft.value = 'unsaved care edit';
      document.querySelector('.directory-care-brief-actions').append(draft);
      draft.focus();
      let writes = 0;
      const mo = new MutationObserver(rows => writes += rows.length);
      mo.observe(card, { attributes: true, childList: true, characterData: true, subtree: true });
      WAFFLE_INTAKE_STATUS.refresh(); WAFFLE_INTAKE_STATUS.refresh();
      await Promise.resolve(); mo.disconnect();
      return { writes, count: document.querySelectorAll('[data-compact-intake-status]').length, draft: draft.value, focused: document.activeElement === draft };
    });
    expect(result).toEqual({ writes: 0, count: 1, draft: 'unsaved care edit', focused: true });
  });

  test('missing canonical intake evidence stays unknown without triggering a profile read', async ({ page }) => {
    await watchNetworkReads(page);
    await page.setContent('<body><main id="directory-grid"><article class="directory-card is-profile-active"><div class="directory-care-brief-actions"><button data-p4-dir="owner">Owner care</button></div></article></main></body>');
    await page.addScriptTag({ content: source });
    expect(await page.evaluate(() => WAFFLE_INTAKE_STATUS.getState(document.querySelector('.directory-card')))).toMatchObject({ code: 'unknown', label: 'Status unknown' });
    expect(await page.evaluate(() => window.__intakeNetworkReads)).toBe(0);
  });
});
