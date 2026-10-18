const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { setup } = require('./fixtures/guided-checkout-fixture');

test.beforeEach(async ({page}) => {
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    return ['GET','HEAD'].includes(request.method()) && url.hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
});

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const intakeStatus = read('care-intake-status.js');
const arrivalReady = read('care-arrival-ready.js');
const mobileCheckout = read('waffle-v11.2.19.js');
const touchScroll = read('quick-add-touch-scroll.js');

async function installVisualRuntime(page, baseURL, card) {
  await page.evaluate(() => {
    document.documentElement.dataset.waffleUiReady = 'true';
    const nav = document.createElement('nav');
    nav.id = 'wh75MobileBottomNav';
    nav.textContent = 'Today · Care · Calendar';
    nav.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:80px;box-sizing:border-box;z-index:2147481795;display:flex;align-items:center;justify-content:space-around;background:white;border-top:1px solid #ddd';
    document.body.appendChild(nav);
  });
  await page.addStyleTag({ url: `${baseURL}/waffle-runtime.css` });
  await page.addScriptTag({ content: intakeStatus });
  await page.addScriptTag({ content: arrivalReady });
  await page.addScriptTag({ content: mobileCheckout });
  await page.addScriptTag({ content: touchScroll });
  await page.evaluate(cardElement => {
    const strip = document.createElement('section');
    strip.dataset.directoryIntake = cardElement.dataset.directoryStayKey;
    strip.setAttribute('aria-busy', 'false');
    strip.innerHTML = '<div class="directory-intake-state"><span class="directory-intake-dot is-complete"></span><span class="directory-record-status">Intake complete</span></div>';
    cardElement.appendChild(strip);
    window.WAFFLE_INTAKE_STATUS.refresh(cardElement);
    window.WAFFLE_ARRIVAL_READY.refresh();
  }, card);
}

async function measureNoOverflow(page) {
  const measurements = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    gridWidth: document.querySelector('#directory-grid').scrollWidth,
    gridClientWidth: document.querySelector('#directory-grid').clientWidth
  }));
  expect(measurements.documentWidth, JSON.stringify(measurements)).toBeLessThanOrEqual(measurements.width);
  expect(measurements.bodyWidth, JSON.stringify(measurements)).toBeLessThanOrEqual(measurements.width);
  expect(measurements.gridWidth, JSON.stringify(measurements)).toBeLessThanOrEqual(measurements.gridClientWidth);
}

test('Care arrival and guided checkout remain reachable at the configured viewport', async ({ page, baseURL }, testInfo) => {
  const { selected } = await setup(page);
  await installVisualRuntime(page, baseURL, await selected.elementHandle());

  const owner = selected.locator('.directory-care-brief-actions [data-p4-dir="owner"]');
  const compactIntake = selected.locator('.directory-care-brief-actions [data-compact-intake-status]');
  await expect(owner).toBeVisible();
  await expect(compactIntake).toHaveText('Form received');
  await expect(compactIntake).toHaveAttribute('data-state', 'complete');
  await measureNoOverflow(page);

  const next = page.locator('[data-waffle-arrival-next]');
  await expect(next).toBeVisible();
  await next.click();
  await expect(selected.locator('[data-v11217-roster-checkin]')).toBeFocused();

  if (testInfo.project.name === 'chromium-390' || testInfo.project.name === 'chromium-1440') {
    const dir = path.join(root, 'output', 'releases', '2026.10.18.02');
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, `care-arrival-checkout-${testInfo.project.use.viewport.width}.png`), fullPage: true });
  }

  const card = page.getByTestId('selected-card');
  await card.locator('.v11217-roster-more-actions summary').click();
  await card.locator('[data-v11217-roster-checkout]').click();
  const dialog = page.locator('#v11217GuidedCheckout');
  await expect(dialog).toBeVisible();
  const cancel = dialog.locator('[data-v11217-guided-close].v11217-cancel');
  const confirm = dialog.locator('[data-v11217-guided-confirm]');
  const note = dialog.locator('[data-v11217-guided-note]');
  await expect(cancel).toBeVisible();
  await expect(confirm).toBeVisible();
  const layout = await page.evaluate(() => {
    const nav = document.querySelector('#wh75MobileBottomNav');
    const modal = document.querySelector('#v11217GuidedCheckout');
    const card = modal.querySelector('.v11217-modal-card');
    const body = modal.querySelector('.v11217-modal-body');
    const actions = modal.querySelector('.v11217-modal-actions');
    const buttons = [...actions.querySelectorAll('button')];
    return {
      height: innerHeight,
      navHeight: nav.getBoundingClientRect().height,
      navTop: nav.getBoundingClientRect().top,
      navZ: Number(getComputedStyle(nav).zIndex),
      modalZ: Number(getComputedStyle(modal).zIndex),
      cardBottom: card.getBoundingClientRect().bottom,
      bodyScroll: body.scrollHeight,
      bodyClient: body.clientHeight,
      actionBottom: actions.getBoundingClientRect().bottom,
      actionButtons: buttons.map(button => {
        const r = button.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { height: r.height, bottom: r.bottom, hit: hit === button || button.contains(hit) };
      }),
      noteFontSize: parseFloat(getComputedStyle(modal.querySelector('[data-v11217-guided-note]')).fontSize),
      modalScrollWidth: modal.scrollWidth
    };
  });
  expect(layout.navHeight).toBe(80);
  expect(layout.modalZ).toBeGreaterThan(layout.navZ);
  expect(layout.actionButtons.every(button => button.height >= 44 && button.bottom <= layout.height && button.hit), JSON.stringify(layout)).toBe(true);
  expect(layout.noteFontSize).toBeGreaterThanOrEqual(16);
  expect(layout.modalScrollWidth).toBeLessThanOrEqual(testInfo.project.use.viewport.width);
  if (testInfo.project.use.viewport.width <= 390) expect(layout.bodyScroll).toBeGreaterThanOrEqual(layout.bodyClient);
  if (testInfo.project.name === 'chromium-390' || testInfo.project.name === 'chromium-1440') {
    const dir = path.join(root, 'output', 'releases', '2026.10.18.02');
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, `guided-checkout-${testInfo.project.use.viewport.width}.png`) });
  }
  await expect.poll(() => page.evaluate(() => window.writes.length)).toBe(0);
  await measureNoOverflow(page);
  if (testInfo.project.use.viewport.width <= 390) {
    await page.setViewportSize({ width: testInfo.project.use.viewport.width, height: 360 });
    await page.evaluate(() => window.WAFFLE_EARLY_CHECKOUT_MOBILE_V11219?.sync());
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const reduced = await page.evaluate(() => {
      const modal = document.querySelector('#v11217GuidedCheckout');
      const nav = document.querySelector('#wh75MobileBottomNav');
      return {
        height: innerHeight,
        navTop: nav.getBoundingClientRect().top,
        buttons: [...modal.querySelectorAll('.v11217-modal-actions button')].map(button => {
          const r = button.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { height: r.height, bottom: r.bottom, hit: hit === button || button.contains(hit) };
        })
      };
    });
    expect(reduced.buttons.every(button => button.height >= 44 && button.bottom <= reduced.height && button.hit), JSON.stringify(reduced)).toBe(true);
  }
  await cancel.click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.writes.length)).toBe(0);
});
