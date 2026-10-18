const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'care-intake-status.js'), 'utf8');
const markup = (extra = '') => `<body><main id="directory-grid"><article class="directory-card is-profile-active" data-directory-stay-key="milo|2026-10-20|2026-10-22" data-directory-dog-name="Milo" data-directory-start-date="2026-10-20" data-directory-end-date="2026-10-22" data-directory-stay-id="stay-1" data-directory-dog-id="dog-1"><section data-directory-care-brief><div class="directory-care-brief-actions"><button data-p4-dir="owner" id="firstlevelOwnerCareLink">Owner care</button></div><div data-care-readiness-item="intake"></div></section><div data-directory-intake ${extra}></div><details data-directory-records><summary>Records &amp; forms</summary><button data-create-intake-link>Copy link</button><a href="/intake.pdf">PDF</a></details></article></main></body>`;

test.describe('compact care intake status', () => {
  test('maps canonical states without network reads, preserves controls, and ignores an ambiguous wrong stay', async ({ page }) => {
    await page.setContent(markup('aria-busy="true"'));
    await page.addScriptTag({ content: source });
    const state = () => page.evaluate(() => WAFFLE_INTAKE_STATUS.getState(document.querySelector('.directory-card')));
    expect(await state()).toMatchObject({ code: 'unknown', label: 'Loading' });
    await page.locator('[data-directory-intake]').evaluate(el => { el.removeAttribute('aria-busy'); el.innerHTML = '<span class="directory-intake-dot is-not-sent"></span>No digital intake on file'; });
    await expect.poll(async () => (await state()).code).toBe('not_prepared');
    await page.locator('[data-directory-intake]').evaluate(el => { el.innerHTML = '<span class="directory-intake-dot is-awaiting"></span>Awaiting owner'; });
    await expect.poll(async () => (await state()).code).toBe('link_ready');
    await page.locator('[data-directory-intake]').evaluate(el => { el.removeAttribute('aria-busy'); el.innerHTML = '<span class="directory-intake-dot is-complete"></span><span>Intake complete</span>'; });
    await expect.poll(async () => (await state()).code).toBe('complete');
    expect(await state()).toMatchObject({ label: 'Form received', method: 'digital' });
    await page.locator('[data-directory-intake]').evaluate(el => el.setAttribute('aria-busy', 'true'));
    await expect.poll(async () => (await state()).label).toBe('Loading');
    expect(await state()).toMatchObject({ code: 'unknown' });
    await page.locator('[data-directory-intake]').evaluate(el => el.removeAttribute('aria-busy'));
    await page.locator('[data-directory-intake]').evaluate(el => { el.innerHTML = '<span class="directory-intake-dot is-awaiting"></span>Awaiting owner · submitted 18 Oct'; });
    await expect.poll(async () => (await state()).code).toBe('link_ready');
    await page.locator('[data-directory-intake]').evaluate(el => { el.innerHTML = '<span class="directory-intake-dot is-complete"></span>Saved profile'; });
    await expect.poll(async () => (await state()).code).toBe('unknown');

    await page.locator('[data-directory-intake]').evaluate(el => { el.innerHTML = '<span class="directory-intake-dot is-not-sent"></span>No digital intake on file'; });
    await page.locator('.directory-card').evaluate(card => { card.dataset.intakeMethod = 'legacy'; });
    await expect.poll(async () => (await state()).label).toBe('Care profile available');
    expect(await state()).toMatchObject({ code: 'unknown', detail: 'Current form completion not verified.' });
    await page.locator('.directory-card').evaluate(card => { card.dataset.intakeMethod = 'none'; });
    await page.locator('[data-directory-intake]').evaluate(el => { el.innerHTML = '<span class="directory-intake-dot is-complete"></span><span>Intake complete</span><span class="directory-record-meta">Stored profile</span>'; });
    await expect.poll(async () => (await state()).label).toBe('Saved care available');
    expect(await state()).toMatchObject({ code: 'unknown', detail: 'Current form completion not verified.' });
    await page.locator('[data-directory-intake]').evaluate(el => { el.textContent = 'Digital intake unavailable'; });
    await expect.poll(async () => (await state()).code).toBe('unknown');

    await page.locator('.directory-card').evaluate(card => window.dispatchEvent(new CustomEvent('waffle:owner-care-link-ready', { detail: { dogName: 'Milo', startDate: '2026-10-20', endDate: '2026-10-23', link: 'https://secret.invalid/token' } })));
    expect(await state()).toMatchObject({ code: 'unknown' });
    await page.locator('[data-directory-intake]').evaluate(el => { el.innerHTML = '<span class="directory-intake-dot is-not-sent"></span>No digital intake on file'; });
    await expect.poll(async () => (await state()).code).toBe('not_prepared');
    expect(await page.locator('[data-compact-intake-status]').textContent()).not.toContain('secret.invalid');
    await expect(page.locator('#firstlevelOwnerCareLink')).toHaveCount(1);
    await expect(page.locator('[data-create-intake-link]')).toBeAttached();
    await expect(page.locator('details a[href="/intake.pdf"]')).toBeAttached();
  });

  test('accepts a prepared link only for the exact selected stay; canonical completion wins', async ({ page }) => {
    await page.setContent(markup('aria-busy="true"'));
    await page.addScriptTag({ content: source });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('waffle:owner-care-link-ready', { detail: { dogName: 'Milo', startDate: '2026-10-20', endDate: '2026-10-22', link: 'https://secret.invalid/token', dogId: 'dog-1', stayId: 'stay-1' } })));
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
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('waffle:owner-care-link-ready', { detail: { dogName: 'Milo', startDate: '2026-10-20', endDate: '2026-10-22', link: 'https://secret.invalid/token', dogId: 'dog-1', stayId: 'stay-1' } })));
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
    await page.setContent('<body><main id="directory-grid"><article class="directory-card is-profile-active"><div class="directory-care-brief-actions"><button data-p4-dir="owner">Owner care</button></div></article></main></body>');
    await page.addInitScript(() => { window.fetch = () => { window.__unexpectedIntakeFetch = true; throw new Error('unexpected read'); }; });
    await page.addScriptTag({ content: source });
    expect(await page.evaluate(() => WAFFLE_INTAKE_STATUS.getState(document.querySelector('.directory-card')))).toMatchObject({ code: 'unknown', label: 'Status unknown' });
    expect(await page.evaluate(() => !!window.__unexpectedIntakeFetch)).toBe(false);
  });
});
