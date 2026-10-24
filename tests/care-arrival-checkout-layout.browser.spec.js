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
const evidenceDir = path.join(root, 'output', 'releases', '2026.10.23.05', 'evidence');

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
    const receipt = document.createElement('span');
    receipt.className = 'directory-record-meta';
    receipt.dataset.intakeReceivedAt = '2026-10-22T14:30:00Z';
    receipt.dataset.intakeReceivedFor = [cardElement.dataset.directoryStayKey || cardElement.dataset.stayKey || '', cardElement.dataset.directoryDogId || '', cardElement.dataset.directoryStayId || '', (cardElement.dataset.directoryDogName || cardElement.dataset.dogName || '').trim().toLocaleLowerCase(), cardElement.dataset.directoryStartDate || cardElement.dataset.startDate || '', cardElement.dataset.directoryEndDate || cardElement.dataset.endDate || ''].join('|');
    strip.firstElementChild.append(receipt);
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
  const { selected, other } = await setup(page);
  await installVisualRuntime(page, baseURL, await selected.elementHandle());

  const owner = selected.locator('.directory-care-brief-actions [data-p4-dir="owner"]');
  const compactIntake = selected.locator('.directory-care-brief-actions [data-compact-intake-status]');
  await expect(owner).toBeVisible();
  await expect(compactIntake).toHaveText('Form received');
  await expect(compactIntake).toHaveAttribute('data-state', 'complete');
  await expect(compactIntake).toHaveAttribute('aria-description', /Owner form received .*2026/);
  await measureNoOverflow(page);
  await owner.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('care-receipt-context.png') });

  const next = page.locator('[data-waffle-arrival-next]');
  await expect(next).toBeVisible();
  await expect(next).toHaveText('Next arrival · 2');
  await expect(selected.locator('[data-waffle-arrival-ready]')).toHaveCount(0);
  await next.click();
  await expect(selected.locator('[data-v11217-roster-checkin]')).toBeFocused();

  await selected.locator('[data-directory-intake]').evaluate(strip => {
    strip.innerHTML = '<div class="directory-intake-state"><span class="directory-intake-dot is-not-sent"></span><span class="directory-record-status">No digital intake on file</span></div>';
  });
  await page.evaluate(card => {
    window.WAFFLE_INTAKE_STATUS.refresh(card);
    window.WAFFLE_ARRIVAL_READY.refresh();
  }, await selected.elementHandle());
  await expect(compactIntake).toHaveText('Not prepared');
  const arrivalStatus = selected.locator('[data-waffle-arrival-ready]');
  await expect(arrivalStatus).toBeVisible();
  await expect(arrivalStatus.locator('[data-arrival-label]')).toHaveText('Not prepared');
  await expect(arrivalStatus.locator('[data-arrival-detail]')).toHaveText('No digital intake link is recorded for this stay.');
  const light = await arrivalStatus.evaluate(node => ({ height: node.getBoundingClientRect().height, background: getComputedStyle(node).backgroundColor }));
  expect(light.height).toBeGreaterThanOrEqual(44);
  await measureNoOverflow(page);
  if (testInfo.project.name === 'chromium-390') {
    fs.mkdirSync(evidenceDir, { recursive: true });
    await page.screenshot({ path: path.join(evidenceDir, 'arrival-390-light.png') });
  }
  await page.evaluate(() => document.body.classList.add('dark-theme'));
  const dark = await arrivalStatus.evaluate(node => ({ height: node.getBoundingClientRect().height, background: getComputedStyle(node).backgroundColor }));
  expect(dark.height).toBeGreaterThanOrEqual(44);
  expect(dark.background).not.toBe(light.background);
  await measureNoOverflow(page);
  if (testInfo.project.name === 'chromium-390') {
    await page.screenshot({ path: path.join(evidenceDir, 'arrival-390-dark.png') });
  }
  await page.evaluate(() => document.body.classList.remove('dark-theme'));
  await next.click();
  await expect(other.locator('[data-v11217-roster-checkin]')).toBeFocused();

  if (testInfo.project.name === 'chromium-390' || testInfo.project.name === 'chromium-1440') {
    fs.mkdirSync(evidenceDir, { recursive: true });
    await page.screenshot({ path: path.join(evidenceDir, `care-arrival-checkout-${testInfo.project.use.viewport.width}.png`), fullPage: true });
  }

  const card = page.getByTestId('selected-card');
  await card.locator('[data-belongings-summary]').evaluate(node => node.setAttribute('aria-busy', 'true'));
  await card.locator('.v11217-roster-more-actions summary').click();
  await card.locator('[data-v11217-roster-checkout]').click();
  const dialog = page.locator('#v11217GuidedCheckout');
  await expect(dialog).toBeVisible();
  const cancel = dialog.locator('[data-v11217-guided-close].v11217-cancel');
  const confirm = dialog.locator('[data-v11217-guided-confirm]');
  const note = dialog.locator('[data-v11217-guided-note]');
  await expect(cancel).toBeVisible();
  await expect(confirm).toBeVisible();
  await expect(dialog.locator('[data-v11217-guided-belongings-unknown]')).toBeVisible();
  await expect(dialog.locator('[data-v11217-guided-missing]')).toBeVisible();
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
  const lightUnknown = await dialog.locator('[data-v11217-guided-belongings-unknown]').evaluate(node => getComputedStyle(node).backgroundColor);
  await page.evaluate(() => document.body.classList.add('dark-theme'));
  const darkCheckout = await page.evaluate(() => {
    const modal = document.querySelector('#v11217GuidedCheckout');
    const unknown = getComputedStyle(modal.querySelector('[data-v11217-guided-belongings-unknown]')).backgroundColor;
    const actions = [...modal.querySelectorAll('.v11217-modal-actions button')].map(button => {
      const rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return { height: rect.height, bottom: rect.bottom, hit: hit === button || button.contains(hit) };
    });
    return { unknown, actions, height: innerHeight };
  });
  expect(darkCheckout.unknown).not.toBe(lightUnknown);
  expect(darkCheckout.actions.every(button => button.height >= 44 && button.bottom <= darkCheckout.height && button.hit), JSON.stringify(darkCheckout)).toBe(true);
  await page.evaluate(() => document.body.classList.remove('dark-theme'));
  if (testInfo.project.name === 'chromium-390' || testInfo.project.name === 'chromium-1440') {
    fs.mkdirSync(evidenceDir, { recursive: true });
    await page.screenshot({ path: path.join(evidenceDir, `guided-checkout-${testInfo.project.use.viewport.width}.png`) });
  }
  await page.evaluate(() => {
    const modal = document.querySelector('#v11217GuidedCheckout');
    modal.querySelectorAll('h3,p,strong,small,span,label,button,textarea').forEach(node => node.style.setProperty('font-size', '20px', 'important'));
  });
  await note.evaluate(node => node.scrollIntoView({ block: 'center' }));
  const enlarged = await page.evaluate(() => {
    const modal = document.querySelector('#v11217GuidedCheckout');
    const body = modal.querySelector('.v11217-modal-body');
    const note = modal.querySelector('[data-v11217-guided-note]').getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    const actions = modal.querySelector('.v11217-modal-actions');
    return {
      bodyScroll: body.scrollHeight,
      bodyClient: body.clientHeight,
      noteReachable: note.bottom > bodyRect.top && note.top < bodyRect.bottom,
      buttons: [...actions.querySelectorAll('button')].map(button => {
        const r = button.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { height: r.height, bottom: r.bottom, hit: hit === button || button.contains(hit) };
      }),
      height: innerHeight
    };
  });
  expect(enlarged.noteReachable, JSON.stringify(enlarged)).toBe(true);
  expect(enlarged.buttons.every(button => button.height >= 44 && button.bottom <= enlarged.height && button.hit), JSON.stringify(enlarged)).toBe(true);
  await page.evaluate(() => document.querySelector('#v11217GuidedCheckout').querySelectorAll('*').forEach(node => node.style.removeProperty('font-size')));
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
