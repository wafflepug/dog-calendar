const { test, expect } = require('@playwright/test');
const { setup } = require('./fixtures/guided-checkout-fixture');

async function openCheckout(card) {
  const details = card.locator('.v11217-roster-more-actions');
  if (await details.getAttribute('open') === null) await details.locator('summary').click();
  const checkout = card.locator('[data-v11217-roster-checkout]');
  await expect(checkout).toBeVisible();
  await checkout.click();
}

test('same-day checkout reviews selected identity, opens without writes, and confirms once before moving the selected card', async ({ page }) => {
  await setup(page);
  const card = page.getByTestId('selected-card');
  await openCheckout(card);
  const dialog = page.getByRole('dialog', { name: 'Check out' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Dog ID: #0017');
  await expect(dialog).toContainText('Blue lead, Food tub');
  await expect(dialog).toContainText('Return blue inhaler');
  await expect(dialog).toContainText('18 Oct 2026');
  await expect.poll(() => page.evaluate(() => window.writes.length)).toBe(0);
  const confirm = dialog.locator('[data-v11217-guided-confirm]');
  await dialog.locator('[data-v11217-guided-note]').fill('Blue lead handed to owner');
  await confirm.click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('[data-directory-stay-id="stay-b"]')).toBeAttached();
  expect(await page.evaluate(() => window.writes.map(w => [w.stayId, w.status, w.note]))).toEqual([['stay-a', 'checked_out', 'Blue lead handed to owner']]);
});

test('cancel does not write and stale identity never moves a card to Past', async ({ page }) => {
  await setup(page);
  const card = page.getByTestId('selected-card');
  await openCheckout(card);
  await page.getByRole('button', { name: 'Cancel' }).last().click();
  expect(await page.evaluate(() => window.writes.length)).toBe(0);

  await openCheckout(card);
  await card.evaluate(el => { el.dataset.directoryStayId = 'stay-reused'; });
  await page.getByRole('button', { name: 'Confirm checkout' }).click();
  await expect(page.locator('#v11217GuidedCheckout')).toBeVisible();
  await expect(page.locator('#v11217GuidedCheckout')).toContainText('This card changed while saving');
  await expect(page.locator('#v11217GuidedCheckout [data-v11217-guided-confirm]')).toBeDisabled();
  expect(await page.evaluate(() => window.movedIds)).toEqual([]);
  await expect.poll(() => page.evaluate(() => window.writes.length)).toBe(0);
});

test('transport failure stays retryable in the guided sheet and duplicate confirmation is locked', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    window.failNext = true;
    window.pending = new Promise(resolve => { window.release = resolve; });
  });
  const card = page.getByTestId('selected-card');
  await openCheckout(card);
  const dialog = page.locator('#v11217GuidedCheckout');
  const confirm = dialog.locator('[data-v11217-guided-confirm]');
  await dialog.locator('[data-v11217-guided-note]').fill('Keep the blue lead note');
  await confirm.click();
  await expect(confirm).toBeDisabled();
  await expect(dialog.getByRole('button', {name:'Cancel', exact:true})).toBeDisabled();
  await expect(dialog.locator('[data-v11217-guided-note]')).toHaveJSProperty('readOnly', true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await confirm.evaluate(button => button.click());
  expect(await page.evaluate(() => window.writes.length)).toBe(1);
  await page.evaluate(() => { window.release(); window.pending = null; });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Network connection failed');
  await expect(confirm).toHaveText('Retry checkout');
  await expect(dialog.locator('[data-v11217-guided-note]')).toHaveValue('Keep the blue lead note');
  await confirm.click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => window.writes.map(write => write.note))).toEqual(['Keep the blue lead note', 'Keep the blue lead note']);
});

test('queued offline result is not treated as saved and unavailable evidence is stated plainly', async ({ page }) => {
  await setup(page, { loadedEvidence: false });
  await page.evaluate(() => { window.queued = true; });
  const card = page.getByTestId('selected-card');
  await openCheckout(card);
  const dialog = page.locator('#v11217GuidedCheckout');
  await expect(dialog).toContainText('Not loaded · check Care before handover');
  await dialog.locator('[data-v11217-guided-note]').fill('Retain this note on failure');
  await dialog.locator('[data-v11217-guided-confirm]').click();
  await expect(dialog).toContainText('cannot be queued');
  await expect(dialog.locator('[data-v11217-guided-note]')).toHaveValue('Retain this note on failure');
  await expect(dialog.locator('[data-v11217-guided-confirm]')).toBeDisabled();
  await expect(card).toBeAttached();
  expect(await page.evaluate(() => window.writes.length)).toBe(1);
});

test('checkout without a note leaves the supported note field empty and can proceed for a second guest', async ({ page }) => {
  await setup(page, { secondCheckout: true });
  const first = page.getByTestId('selected-card');
  await openCheckout(first);
  await page.getByRole('button', { name: 'Cancel' }).click();
  const second = page.locator('[data-directory-stay-id="stay-c"]');
  await openCheckout(second);
  const dialog = page.locator('#v11217GuidedCheckout');
  await dialog.locator('[data-v11217-guided-confirm]').click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => window.writes.map(w => [w.stayId, Object.hasOwn(w, 'note')]))).toEqual([['stay-c', false]]);
  expect(await page.evaluate(() => window.movedIds)).toEqual(['stay-c']);
  await expect(second).toHaveCount(0);
});

test('a successful checkout resets the sheet for another exact guest and returns focus to a visible roster control', async ({page}) => {
  await setup(page, {secondCheckout:true});
  await openCheckout(page.getByTestId('selected-card'));
  await page.locator('[data-v11217-guided-confirm]').click();
  await expect(page.locator('#v11217GuidedCheckout')).toBeHidden();
  await expect(page.locator('[data-directory-stay-id="stay-b"] .directory-guest-tile-open')).toBeFocused();
  await openCheckout(page.locator('[data-directory-stay-id="stay-c"]'));
  await expect(page.locator('[data-v11217-guided-confirm]')).toHaveText('Confirm checkout');
  await page.locator('[data-v11217-guided-confirm]').click();
  await expect(page.locator('#v11217GuidedCheckout')).toBeHidden();
  expect(await page.evaluate(() => window.movedIds)).toEqual(['stay-a','stay-c']);
});

test('a legacy stay upgraded by the canonical save retains its returned identity with a checkout note', async ({page}) => {
  await setup(page);
  const card = page.getByTestId('selected-card');
  await card.evaluate(node => node.dataset.directoryStayId = '');
  await page.evaluate(() => {
    window.v110SaveOperationalStatus = async (payload, status, target) => {
      window.writes.push({...payload,status});
      payload.stayId = 'upgraded-stay-a';
      target.dataset.directoryStayId = payload.stayId;
      return {result:'success',record:{...payload,status}};
    };
  });
  await expect(card.locator('.v11217-roster-more-actions summary')).toBeVisible();
  await openCheckout(card);
  await page.locator('[data-v11217-guided-note]').fill('Owner collected lead');
  await page.locator('[data-v11217-guided-confirm]').click();
  await expect(page.locator('#v11217GuidedCheckout')).toBeHidden();
  expect(await page.evaluate(() => window.movedIds)).toEqual(['upgraded-stay-a']);
  expect(await page.evaluate(() => window.writes[0].note)).toBe('Owner collected lead');
});
