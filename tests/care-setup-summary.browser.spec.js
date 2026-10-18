const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'care-intake-status.js'), 'utf8');
const careSignalsRuntime = fs.readFileSync(path.join(__dirname, '..', 'waffle-v11.1.8.js'), 'utf8');
function fixture({ intake = '<span class="directory-intake-dot is-not-sent"></span>No digital intake on file', method = 'none' } = {}) {
  return `<body><main id="directory-grid"><article class="directory-card is-profile-active" data-directory-stay-key="milo|2026-10-20|2026-10-22" data-directory-dog-name="Milo" data-directory-start-date="2026-10-20" data-directory-end-date="2026-10-22" data-directory-dog-id="dog-1" data-directory-stay-id="stay-1" data-intake-method="${method}">
    <section data-directory-care-brief><div class="directory-care-brief-actions"><button data-p4-dir="owner" id="owner-care">Owner care</button></div>
      <details class="directory-care-readiness"><summary><span>Booking setup</span><strong data-care-readiness-summary>Needs intake</strong></summary><div data-care-readiness-list>
        <div class="directory-care-readiness-row" data-care-readiness-item="intake"><span class="directory-care-readiness-copy"><strong>Owner intake</strong><small data-care-readiness-detail>Owner intake form</small></span><span data-care-readiness-status>Not sent</span><button data-care-readiness-action="intake">Review</button></div>
        <div data-care-readiness-item="handover"><span data-care-readiness-detail>Handover note</span><span data-care-readiness-status>Add note</span><button data-care-readiness-action="handover">Review</button></div>
      </div></details>
    </section>
    <div data-directory-intake>${intake}</div>
    <details data-directory-records><summary>Records &amp; forms</summary><button data-create-intake-link>Create link</button><button data-care-record-upload>Upload PDF</button><a href="/intake.pdf">Saved PDF</a></details>
  </article></main></body>`;
}

test.describe('consolidated care setup summary', () => {
  for (const width of [320, 1440]) test(`keeps one first-level intake status and all setup actions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent(fixture({ intake: '<span class="directory-intake-dot is-awaiting"></span>Awaiting owner' }));
    await page.addScriptTag({ content: source });
    const status = page.locator('[data-compact-intake-status]');
    await expect(status).toHaveCount(1);
    await expect(status).toHaveText('Link ready');
    await expect(page.locator('[data-care-readiness-item="intake"]')).toHaveAttribute('data-compact-status-available', 'true');
    await expect(page.locator('#owner-care')).toBeAttached();
    await expect(page.locator('[data-care-readiness-action="intake"]')).toHaveText('Review');
    await expect(page.locator('[data-care-readiness-action="handover"]')).toBeAttached();
    await expect(page.locator('[data-directory-records] [data-create-intake-link]')).toBeAttached();
    await expect(page.locator('[data-directory-records] [data-care-record-upload]')).toBeAttached();
    await expect(page.locator('[data-directory-records] a[href="/intake.pdf"]')).toBeAttached();
    await expect(page.locator('[data-directory-records]')).not.toHaveAttribute('open', '');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test('stored care and legacy records never become current form completion', async ({ page }) => {
    await page.setContent(fixture({ method: 'digital', intake: '<span class="directory-intake-dot is-complete"></span><span>Intake complete</span><span class="directory-record-meta">Stored profile</span>' }));
    await page.addScriptTag({ content: source });
    const getState = () => page.evaluate(() => WAFFLE_INTAKE_STATUS.getState(document.querySelector('.directory-card')));
    expect(await getState()).toMatchObject({ code: 'unknown', label: 'Saved care available', detail: 'Current form completion not verified.' });
    await page.locator('.directory-card').evaluate(card => { card.dataset.intakeMethod = 'legacy'; });
    await expect.poll(async () => (await getState()).label).toBe('Care profile available');
    expect(await getState()).toMatchObject({ code: 'unknown' });
    await page.locator('.directory-card').evaluate(card => { card.dataset.intakeMethod = 'digital'; });
    await page.locator('[data-directory-intake]').evaluate(strip => { strip.innerHTML = '<span class="directory-intake-dot is-complete"></span><span>Intake complete</span><span class="directory-record-meta">18 Oct 2026</span>'; });
    await expect.poll(async () => (await getState()).code).toBe('complete');
    await expect(page.locator('[data-compact-intake-status]')).toHaveText('Form received');
    await expect(page.locator('[data-care-readiness-action="intake"]')).toBeAttached();
  });

  test('v11.1.8 roster intake signal follows verified completion and refreshes only that signal', async ({ page }) => {
    await page.setContent(`<body data-waffle-page="directory"><main id="directory-grid"><article class="directory-card" data-directory-stay-key="milo|2026-10-20|2026-10-22" data-directory-dog-name="Milo" data-directory-start-date="2026-10-20" data-directory-end-date="2026-10-22" data-directory-dog-id="dog-1" data-directory-stay-id="stay-1" data-v1088-phone="0400123456">
      <button class="directory-guest-tile-open"><span>Open Milo</span></button><div class="directory-care-brief-actions"><button data-p4-dir="owner">Owner care</button></div>
      <div data-directory-intake><span class="directory-intake-dot is-complete"></span><span>Intake complete</span><span class="directory-record-meta">18 Oct 2026</span></div>
      <section data-directory-detail="profile"><details open><summary>Care draft</summary><input value="unsaved profile draft"></details></section>
    </article></main></body>`);
    await page.evaluate(() => {
      window.WAFFLE_PAGE = 'directory';
      window.getLocalTodayDateString = () => '2026-10-18';
      window.__careRosterReads = [];
      window.queryAppsScript = async request => { window.__careRosterReads.push(request.action); return { result: 'success', records: [] }; };
    });
    await page.addScriptTag({ content: source });
    await page.addScriptTag({ content: careSignalsRuntime });
    const signals = page.locator('.v1118-care-signals');
    await expect(signals).toBeAttached();
    await expect(signals).not.toContainText('Intake missing');
    await expect(signals).not.toContainText('Intake unverified');
    const readsBefore = await page.evaluate(() => window.__careRosterReads.length);
    const profileInput = page.locator('[data-directory-detail="profile"] input');
    await profileInput.focus();
    await page.evaluate(() => {
      const card = document.querySelector('.directory-card');
      card.dataset.intakeMethod = 'legacy';
      card.querySelector('[data-directory-intake]').innerHTML = '<span class="directory-intake-dot is-not-sent"></span>No digital intake on file';
      WAFFLE_INTAKE_STATUS.refresh(card);
    });
    await expect(page.locator('.v1118-care-signal', { hasText: 'Intake unverified' })).toBeVisible();
    await expect(page.locator('.v1118-care-signal', { hasText: 'Intake missing' })).toHaveCount(0);
    await expect(profileInput).toHaveValue('unsaved profile draft');
    await expect(profileInput).toBeFocused();
    expect(await page.evaluate(() => window.__careRosterReads.length)).toBe(readsBefore);
  });

  test('enhancement refresh is a zero-write no-op and preserves an open setup draft', async ({ page }) => {
    await page.setContent(fixture());
    await page.evaluate(() => {
      window.__intakeStatusReads = 0;
      window.__careBriefRenderCalls = 0;
      window.fetch = () => { window.__intakeStatusReads++; throw new Error('unexpected request'); };
      window.WAFFLE_REFRESH_CARE_SETUP = () => { window.__careBriefRenderCalls++; };
    });
    await page.addScriptTag({ content: source });
    const result = await page.evaluate(async () => {
      const card = document.querySelector('.directory-card');
      const disclosure = card.querySelector('.directory-care-readiness');
      disclosure.open = true;
      const draft = document.createElement('input');
      draft.value = 'unsaved handover draft';
      card.querySelector('[data-care-readiness-item="handover"]').append(draft);
      draft.focus();
      let mutations = 0;
      const observer = new MutationObserver(records => mutations += records.length);
      observer.observe(card, { subtree: true, childList: true, characterData: true, attributes: true });
      const callsBeforeRefresh = window.__careBriefRenderCalls;
      WAFFLE_INTAKE_STATUS.refresh(card);
      WAFFLE_INTAKE_STATUS.refresh(card);
      await Promise.resolve();
      observer.disconnect();
      return { mutations, statusCount: card.querySelectorAll('[data-compact-intake-status]').length, disclosureOpen: disclosure.open, draft: draft.value, focused: document.activeElement === draft, reads: window.__intakeStatusReads, renderCallsStable: window.__careBriefRenderCalls === callsBeforeRefresh };
    });
    expect(result).toEqual({ mutations: 0, statusCount: 1, disclosureOpen: true, draft: 'unsaved handover draft', focused: true, reads: 0, renderCallsStable: true });
  });
});
