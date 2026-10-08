const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dogA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const dogB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const script = fs.readFileSync(path.join(root, 'phase4-booking.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'phase4-core.js'), 'utf8');
const styleStart = core.indexOf('function style(){');
const styleEnd = core.indexOf('\nlet active=', styleStart);

async function setup(page, readHandler) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent('<div id="p4Modal" class="p4-modal"><section class="p4-card" role="dialog"><header class="p4-head"><h2>Booking</h2><button data-p4-close type="button">Close</button></header><nav class="p4-tabs"></nav><div class="p4-body"><section class="p4-panel" data-p4-panel="booking"></section><section data-p4-panel="capacity"></section><section data-p4-panel="owner"></section></div></section></div>');
  await page.evaluate(({ dogA, dogB }) => {
    window.fixtureWrites = [];
    window.fixtureReads = [];
    window.WAFFLE_PHASE4_CORE = {
      modal: () => document.getElementById('p4Modal'), page: () => window.fixturePage || 'booking', open: () => {},
      settings: () => ({ preferred: 4, absolute: 6 }),
      esc: value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]),
      norm: value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
      fmt: value => String(value ?? ''), today: () => '2026-10-06', rows: () => [], visits: () => [],
      read: payload => { window.fixtureReads.push(payload); return window.identityRead(payload); },
      write: async payload => { window.fixtureWrites.push(structuredClone(payload)); return { result: 'success' }; },
      duplicate: () => null, capacity: () => ({ band: 'green' }), renderDecision: () => {}, toast: message => { window.lastToast = message; },
      saveSettings: () => ({ preferred: 4, absolute: 6 }), parseBooking: () => ({})
    };
    window.identityRows = [
      { dogId: dogA, dogNumber: '00001', dogName: 'Luna', breed: 'Pug', ownerName: 'Alex' },
      { dogId: dogB, dogNumber: '00002', dogName: 'Luna', breed: 'Pug', ownerName: 'Blair' }
    ];
    window.identityRead = async payload => payload.action === 'list_dog_identities'
      ? { identities: window.identityRows }
      : { history: { dogId: payload.dogId, previousStays: [], stayCount: 0 } };
  }, { dogA, dogB });
  await page.addScriptTag({ content: core.slice(styleStart, styleEnd) + '\nstyle();' });
  await page.addScriptTag({ content: script });
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function seedBooking(page) {
  await page.locator('#p4Start').fill('2026-11-10');
  await page.locator('#p4End').fill('2026-11-13');
}

test('Book Again opens a clean new stay immediately and confirms only the exact matching Dog ID', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { window.identityRead = payload => payload.action === 'list_dog_identities' ? window.pendingIdentityRead : Promise.resolve({ history: { previousStays: [] } }); });
  await page.evaluate(() => { window.pendingIdentityRead = new Promise(resolve => { window.resolveIdentityRead = resolve; }); });
  await page.evaluate(dogA => window.WAFFLE_PHASE4_BOOKING.fillOwner({ dogName: 'Luna', dogId: dogA, dogNumber: '00001', breed: 'Pug', ownerName: 'Alex', phone: '0400000000', startDate: '2025-01-01', endDate: '2025-01-02' }), dogA);
  await expect(page.locator('#p4OwnerBookingContext')).toContainText('Dog ID #00001');
  await expect(page.locator('#p4OwnerBookingContext')).toContainText('2025-01-01–2025-01-02');
  await page.locator('#p4BookAgain').click();
  await expect(page.locator('#p4Dog')).toHaveValue('Luna');
  await expect(page.locator('#p4Breed')).toHaveValue('Pug');
  await expect(page.locator('#p4Owner')).toHaveValue('Alex');
  await expect(page.locator('#p4Start')).toHaveValue('');
  await expect(page.locator('#p4End')).toHaveValue('');
  await expect(page.locator('#p4Notes')).toHaveValue('Returning guest — confirm what changed since the last stay.');
  await expect(page.locator('#p4SaveConfirmed')).toBeDisabled();
  await expect(page.locator('#p4BookingContext')).toContainText('New stay dates to be selected');
  await page.evaluate(rows => window.resolveIdentityRead({ identities: rows }), [
    { dogId: dogA, dogNumber: '00001', dogName: 'Luna', breed: 'Pug', ownerName: 'Alex' },
    { dogId: dogB, dogNumber: '00002', dogName: 'Luna', breed: 'Pug', ownerName: 'Blair' }
  ]);
  await expect(page.locator('#p4DogIdentity')).toHaveValue(dogA);
  await expect(page.locator('#p4BookingContext')).toContainText('Dog ID #00001');
  await expect(page.locator('#p4SaveConfirmed')).toBeEnabled();
  await seedBooking(page);
  await page.locator('#p4SaveConfirmed').click();
  await expect.poll(() => page.evaluate(() => window.fixtureWrites.length)).toBe(1);
  expect(await page.evaluate(() => window.fixtureWrites[0].dogId)).toBe(dogA);
  expect(await page.evaluate(() => window.fixtureWrites[0].startDate)).toBe('2026-11-10');
  expect(await page.evaluate(() => window.fixtureWrites[0].endDate)).toBe('2026-11-13');
});

test('late identity read preserves entered dates and notes; edited identity fields require review', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { window.identityRead = payload => payload.action === 'list_dog_identities' ? new Promise(resolve => { window.resolveIdentityRead = resolve; }) : Promise.resolve({ history: { previousStays: [] } }); });
  await page.evaluate(dogA => window.WAFFLE_PHASE4_BOOKING.openReturningBooking({ dogName: 'Luna', dogId: dogA }), dogA);
  await page.locator('#p4Start').fill('2026-12-01');
  await page.locator('#p4End').fill('2026-12-03');
  await page.locator('#p4Notes').fill('Changed dates and note');
  await page.evaluate(rows => window.resolveIdentityRead({ identities: rows }), [{ dogId: dogA, dogNumber: 1, dogName: 'Luna', breed: 'Pug', ownerName: 'Alex' }]);
  await expect(page.locator('#p4DogIdentity')).toHaveValue(dogA);
  await expect(page.locator('#p4Start')).toHaveValue('2026-12-01');
  await expect(page.locator('#p4Notes')).toHaveValue('Changed dates and note');

  await page.evaluate(() => { window.identityRead = payload => payload.action === 'list_dog_identities' ? new Promise(resolve => { window.resolveIdentityRead = resolve; }) : Promise.resolve({ history: { previousStays: [] } }); });
  await page.evaluate(dogA => window.WAFFLE_PHASE4_BOOKING.openReturningBooking({ dogName: 'Luna', dogId: dogA, ownerName: 'Alex' }), dogA);
  await page.locator('#p4Owner').fill('Different owner');
  await page.evaluate(rows => window.resolveIdentityRead({ identities: rows }), [{ dogId: dogA, dogNumber: 1, dogName: 'Luna', breed: 'Pug', ownerName: 'Alex' }]);
  await expect(page.locator('#p4DogIdentity')).toHaveValue('__review__');
  await expect(page.locator('#p4SaveConfirmed')).toBeDisabled();
  await page.evaluate(() => window.WAFFLE_PHASE4_BOOKING.save('confirmed'));
  expect(await page.evaluate(() => window.fixtureWrites.length)).toBe(0);
});

test('failed or missing source IDs require explicit New dog and rapid reopen ignores stale responses', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { window.identityRead = payload => payload.action === 'list_dog_identities' ? new Promise((resolve, reject) => { window.pendingReads ||= []; window.pendingReads.push({ resolve, reject }); }) : Promise.resolve({ history: { previousStays: [] } }); });
  await page.evaluate(() => window.WAFFLE_PHASE4_BOOKING.openReturningBooking({ dogName: 'Luna' }));
  await expect(page.locator('#p4SaveConfirmed')).toBeDisabled();
  await page.evaluate(rows => window.pendingReads[0].resolve({ identities: rows }), [{ dogId: dogA, dogNumber: '00001', dogName: 'Luna', breed: 'Pug', ownerName: 'Alex' }, { dogId: dogB, dogNumber: '00002', dogName: 'Luna', breed: 'Pug', ownerName: 'Blair' }]);
  await expect(page.locator('#p4DogIdentity')).toHaveValue('__review__');
  await expect(page.locator('#p4SaveConfirmed')).toBeDisabled();
  await page.locator('#p4DogIdentity').selectOption('');
  await expect(page.locator('#p4SaveConfirmed')).toBeEnabled();

  await page.evaluate(dogA => window.WAFFLE_PHASE4_BOOKING.openReturningBooking({ dogName: 'Luna', dogId: dogA }), dogA);
  await page.evaluate(dogB => window.WAFFLE_PHASE4_BOOKING.openReturningBooking({ dogName: 'Luna', dogId: dogB }), dogB);
  await page.evaluate(rows => window.pendingReads[1].resolve({ identities: rows }), [{ dogId: dogA, dogNumber: 1, dogName: 'Luna', breed: 'Pug', ownerName: 'Alex' }]);
  await page.evaluate(rows => window.pendingReads[2].resolve({ identities: rows }), [{ dogId: dogA, dogNumber: 1, dogName: 'Luna', breed: 'Pug', ownerName: 'Alex' }, { dogId: dogB, dogNumber: 2, dogName: 'Luna', breed: 'Pug', ownerName: 'Blair' }]);
  await expect(page.locator('#p4DogIdentity')).toHaveValue(dogB);
  await expect(page.locator('#p4Owner')).toHaveValue('');

  await page.evaluate(dogA => window.WAFFLE_PHASE4_BOOKING.openReturningBooking({ dogName: 'Luna', dogId: dogA }), dogA);
  await page.locator('#p4DogIdentity').selectOption(dogB);
  await expect(page.locator('#p4DogIdentity')).toHaveValue(dogB);
  await page.locator('#p4LoadDogIdentities').click();
  await page.evaluate(rows => window.pendingReads[4].resolve({ identities: rows }), [{ dogId: dogA, dogNumber: 1, dogName: 'Luna', breed: 'Pug', ownerName: 'Alex' }, { dogId: dogB, dogNumber: 2, dogName: 'Luna', breed: 'Pug', ownerName: 'Blair' }]);
  await expect(page.locator('#p4DogIdentity')).toHaveValue(dogB);
  await page.evaluate(rows => window.pendingReads[3].resolve({ identities: rows }), [{ dogId: dogA, dogNumber: 1, dogName: 'Luna', breed: 'Pug', ownerName: 'Alex' }]);
  await expect(page.locator('#p4DogIdentity')).toHaveValue(dogB);
  await expect(page.locator('#p4Owner')).toHaveValue('Blair');
});

test('directory Booking tools labels are guest-specific and direct Book Again gates an absent Dog ID', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    window.fixturePage = 'directory';
    document.getElementById('p4Modal').hidden = true;
    window.WAFFLE_PHASE4_CORE.open = () => { document.getElementById('p4Modal').hidden = false; };
    const card = document.createElement('article');
    card.className = 'directory-card';
    Object.assign(card.dataset, { directoryStayKey: 'luna|2026-01-01|2026-01-03', directoryDogName: 'Luna <Guest>', directoryDogId: '', directoryDogNumber: '00017', directoryStartDate: '2026-01-01', directoryEndDate: '2026-01-03' });
    card.innerHTML = '<header class="directory-card-header"></header><span class="directory-primary-breed" data-directory-current-value="Pug"></span><span data-directory-edit-field="ownerName" data-directory-current-value="Alex"></span><span data-directory-edit-field="phone" data-directory-current-value="0400123456"></span>';
    document.body.appendChild(card);
    window.WAFFLE_PHASE4_BOOKING.enhanceDirectory();
  });
  const tools = page.locator('.p4-directory-actions');
  await expect(tools.locator('summary')).toHaveAccessibleName('Booking tools for Luna <Guest>');
  await expect(tools.locator('[data-p4-dir="owner"]')).toHaveAttribute('aria-label', 'Owner Care Link for Luna <Guest>');
  await expect(tools.locator('[data-p4-dir="again"]')).toHaveAttribute('aria-label', 'Book Again for Luna <Guest>');
  await page.evaluate(() => { window.identityRows = []; let tries = 0; window.identityRead = payload => payload.action === 'list_dog_identities' && tries++ === 0 ? Promise.reject(new Error('offline')) : payload.action === 'list_dog_identities' ? Promise.resolve({ identities: [] }) : Promise.resolve({ history: { previousStays: [] } }); });
  await tools.locator('summary').click();
  await tools.locator('[data-p4-dir="again"]').click();
  await expect(page.locator('#p4Dog')).toHaveValue('Luna <Guest>');
  await expect(page.locator('#p4DogIdentity')).toBeFocused();
  await expect(page.locator('#p4Start')).toHaveValue('');
  await expect(page.locator('#p4End')).toHaveValue('');
  await expect(page.locator('#p4BookingContext')).toContainText('Dog ID #00017');
  await expect(page.locator('#p4SaveConfirmed')).toBeDisabled();
  await page.evaluate(() => window.WAFFLE_PHASE4_BOOKING.save('confirmed'));
  expect(await page.evaluate(() => window.fixtureWrites.length)).toBe(0);
  await expect(page.locator('#p4DogIdentity')).toHaveValue('__review__');
  await page.locator('#p4LoadDogIdentities').click();
  await expect(page.locator('#p4DogIdentity')).toHaveValue('__review__');
  await expect(page.locator('#p4SaveConfirmed')).toBeDisabled();
  await page.locator('#p4DogIdentity').selectOption('');
  await expect(page.locator('#p4SaveConfirmed')).toBeEnabled();
});

test('stale generic identity failure cannot reset a newer Book Again action', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { window.identityRead = payload => payload.action === 'list_dog_identities' ? new Promise((resolve, reject) => { window.pendingReads ||= []; window.pendingReads.push({ resolve, reject }); }) : Promise.resolve({ history: { previousStays: [] } }); });
  await page.locator('#p4DogIdentity').focus();
  await expect.poll(() => page.evaluate(() => window.pendingReads?.length || 0)).toBe(1);
  await page.evaluate(dogA => window.WAFFLE_PHASE4_BOOKING.openReturningBooking({ dogName: 'Luna', dogId: dogA }), dogA);
  await expect.poll(() => page.evaluate(() => window.pendingReads.length)).toBe(2);
  await page.evaluate(() => window.pendingReads[0].reject(new Error('late generic failure')));
  await expect(page.locator('#p4Dog')).toHaveValue('Luna');
  await expect(page.locator('#p4DogIdentityStatus')).toContainText('Checking the exact Dog ID');
  await expect(page.locator('#p4SaveConfirmed')).toBeDisabled();
  await page.evaluate(rows => window.pendingReads[1].resolve({ identities: rows }), [{ dogId: dogA, dogNumber: '00001', dogName: 'Luna', breed: 'Pug', ownerName: 'Alex' }]);
  await expect(page.locator('#p4DogIdentity')).toHaveValue(dogA);
});
