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
  await expect(dialog.locator('[data-v11217-guided-belongings] li')).toHaveText(['Blue lead', 'Food tub']);
  await expect(dialog).toContainText('Return blue inhaler');
  await expect(dialog.locator('[data-v11217-guided-dates]')).toContainText('18 Oct 2026');
  await expect(dialog.locator('[data-v11217-guided-checkout-caption]')).toHaveText('Checkout today');
  await expect(dialog.locator('[data-v11217-guided-checkout-today]')).toHaveText('18 Oct 2026');
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

test('queued offline result is not treated as saved and missing evidence shares one review prompt', async ({ page }) => {
  await setup(page, { loadedEvidence: false });
  await page.evaluate(() => { window.queued = true; });
  const card = page.getByTestId('selected-card');
  await openCheckout(card);
  const dialog = page.locator('#v11217GuidedCheckout');
  await expect(dialog.locator('[data-v11217-guided-missing]')).toContainText('Some Care details are not available here');
  await expect(dialog.locator('[data-v11217-guided-belongings]')).toHaveText('Not available in this summary');
  await expect(dialog.locator('[data-v11217-guided-medication]')).toHaveText('Not available in this summary');
  await expect(dialog.locator('[data-v11217-guided-missing]')).toContainText('Review Care · note kept');
  await expect(dialog.locator('[data-v11217-guided-missing]')).toHaveCount(1);
  await dialog.locator('[data-v11217-guided-note]').fill('Retain this note on failure');
  await dialog.locator('[data-v11217-guided-confirm]').click();
  await expect(dialog).toContainText('cannot be queued');
  await expect(dialog.locator('[data-v11217-guided-note]')).toHaveValue('Retain this note on failure');
  await expect(dialog.locator('[data-v11217-guided-confirm]')).toBeDisabled();
  await expect(card).toBeAttached();
  expect(await page.evaluate(() => window.writes.length)).toBe(1);
});

test('explicit Care review preserves the note for the exact stay until checkout is reopened', async ({ page }) => {
  await setup(page, { loadedEvidence: false, secondCheckout: true });
  const first = page.getByTestId('selected-card');
  await first.evaluate(card => {
    const opener = card.querySelector('.directory-guest-tile-open');
    opener.addEventListener('click', () => {
      card.dataset.opened = 'true';
      if (!card.querySelector('[data-fixture-profile-back]')) {
        const back = document.createElement('button');
        back.type = 'button'; back.dataset.fixtureProfileBack = '';
        back.textContent = 'Back to Staying';
        back.addEventListener('click', () => { card.dataset.opened = 'false'; });
        card.appendChild(back);
      }
    });
  });
  await openCheckout(first);
  const dialog = page.locator('#v11217GuidedCheckout');
  const review = dialog.locator('[data-v11217-guided-review-care]');
  await expect(review).toBeVisible();
  await expect(review).toHaveText('Review Care · note kept');
  await dialog.locator('[data-v11217-guided-note]').fill('Return the blue lead to Jamie');
  await review.click();
  await expect(dialog).toBeHidden();
  await expect(first).toHaveAttribute('data-opened', 'true');
  await first.locator('[data-fixture-profile-back]').click();
  expect(await page.evaluate(() => window.writes.length)).toBe(0);
  expect(await page.evaluate(() => window.movedIds)).toEqual([]);

  const second = page.locator('[data-directory-stay-id="stay-c"]');
  await openCheckout(second);
  await expect(dialog.locator('[data-v11217-guided-note]')).toHaveValue('');
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect(await page.evaluate(() => window.writes.length)).toBe(0);

  await openCheckout(first);
  await expect(dialog.locator('[data-v11217-guided-note]')).toHaveValue('Return the blue lead to Jamie');
  await dialog.locator('[data-v11217-guided-confirm]').click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => window.writes.map(write => [write.stayId, write.note]))).toEqual([['stay-a', 'Return the blue lead to Jamie']]);
  expect(await page.evaluate(() => window.movedIds)).toEqual(['stay-a']);
});

test('Care review stays in the checkout sheet if its original identity was replaced', async ({ page }) => {
  await setup(page, { loadedEvidence: false });
  const card = page.getByTestId('selected-card');
  await openCheckout(card);
  const dialog = page.locator('#v11217GuidedCheckout');
  const note = dialog.locator('[data-v11217-guided-note]');
  await note.fill('Keep for the selected stay');
  await card.evaluate(element => { element.dataset.directoryStayId = 'reused-card'; });
  await dialog.locator('[data-v11217-guided-review-care]').click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('changed or is no longer uniquely identifiable');
  await expect(note).toHaveValue('Keep for the selected stay');
  await expect(card).not.toHaveAttribute('data-opened', 'true');
  expect(await page.evaluate(() => window.writes.length)).toBe(0);
});

test('checkout keeps full medication detail and distinguishes no medication from not loaded', async ({ page }) => {
  await setup(page);
  const card = page.getByTestId('selected-card');
  const longMedication = 'Give 2.5 ml from the labelled oral syringe at 7:15 am with breakfast. Repeat at 7:15 pm with dinner. Do not crush the tablet. Call the clinic if the dose is missed.';
  await card.locator('[data-care-brief-medication]').evaluate((node, text) => { node.textContent = text; }, longMedication);
  await openCheckout(card);
  const dialog = page.locator('#v11217GuidedCheckout');
  await expect(dialog.locator('[data-v11217-guided-medication]')).toHaveText(longMedication);
  await expect(dialog.locator('[data-v11217-guided-review-care]')).toBeHidden();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await card.locator('[data-care-brief-medication]').evaluate(node => { node.textContent = 'No medication instructions saved'; });
  await card.locator('[data-belongings-summary]').evaluate(node => { node.setAttribute('aria-busy', 'true'); });
  await openCheckout(card);
  await expect(dialog.locator('[data-v11217-guided-medication]')).toHaveText('No medication instructions saved');
  await expect(dialog.locator('[data-v11217-guided-review-care]')).toBeVisible();
  await expect(dialog.locator('[data-v11217-guided-belongings]')).toHaveText('Not available in this summary');
});

test('neutral initial focus and visible keyboard trap do not confirm checkout', async ({ page }) => {
  await setup(page, { loadedEvidence: false });
  await openCheckout(page.getByTestId('selected-card'));
  const dialog = page.locator('#v11217GuidedCheckout');
  const heading = dialog.locator('#v11217GuidedCheckoutTitle');
  const confirm = dialog.locator('[data-v11217-guided-confirm]');
  const close = dialog.locator('[data-v11217-guided-close]').first();
  await expect(heading).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.writes.length)).toBe(0);
  await page.keyboard.press('Shift+Tab');
  await expect(confirm).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await expect(dialog.locator('[data-v11217-guided-review-care]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.writes.length)).toBe(0);
});

test('loaded details hide the review action and keyboard navigation skips it', async ({ page }) => {
  await setup(page);
  await openCheckout(page.getByTestId('selected-card'));
  const dialog = page.locator('#v11217GuidedCheckout');
  await expect(dialog.locator('[data-v11217-guided-review-care]')).toBeHidden();
  await page.keyboard.press('Tab');
  await expect(dialog.locator('[data-v11217-guided-close]').first()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.locator('[data-v11217-guided-note]')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.locator('[data-v11217-guided-close]').first()).toBeFocused();
  expect(await page.evaluate(() => window.writes.length)).toBe(0);
});

test('explicit empty belongings stay distinct from pending list evidence', async ({ page }) => {
  await setup(page);
  const card = page.getByTestId('selected-card');
  const evidence = card.locator('[data-belongings-summary]');
  await evidence.evaluate(node => { node.innerHTML = '<span class="belongings-summary-empty">No belongings recorded</span>'; });
  await openCheckout(card);
  const dialog = page.locator('#v11217GuidedCheckout');
  await expect(dialog.locator('[data-v11217-guided-belongings]')).toHaveText('No belongings recorded');
  await expect(dialog.locator('[data-v11217-guided-missing]')).toBeHidden();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await evidence.evaluate(node => { node.innerHTML = '<ul class="belongings-summary-list"><li>Loading belongings…</li></ul>'; });
  await openCheckout(card);
  await expect(dialog.locator('[data-v11217-guided-belongings]')).toHaveText('Not available in this summary');
  await expect(dialog.locator('[data-v11217-guided-review-care]')).toBeVisible();
  expect(await page.evaluate(() => window.writes.length)).toBe(0);
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
