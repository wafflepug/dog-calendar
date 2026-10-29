const { test, expect } = require('@playwright/test');
const { setup } = require('./fixtures/guided-checkout-fixture');

async function openCheckout(card) {
  const details = card.locator('.v11217-roster-more-actions');
  const checkout = card.locator('[data-v11217-roster-checkout]');
  if (!(await checkout.isVisible())) {
    if (await details.getAttribute('open') === null) await details.locator('summary').click();
  }
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
  await expect(dialog.locator('[data-v11217-guided-belongings-summary]')).toHaveText('2 listed · review');
  await expect(dialog.locator('[data-v11217-guided-belongings-details]')).toHaveJSProperty('open', false);
  await expect(dialog.locator('[data-v11217-guided-medication]')).toHaveText('Return blue inhaler');
  await dialog.locator('[data-v11217-guided-belongings-summary]').click();
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
  await expect(dialog.locator('[data-v11217-guided-missing]')).toContainText('Review saved care before handover');
  await expect(dialog.locator('[data-v11217-guided-belongings-unknown]')).toHaveText('Not available in this summary');
  await expect(dialog.locator('[data-v11217-guided-medication-unknown]')).toHaveText('Not available in this summary');
  await expect(dialog.locator('[data-v11217-guided-missing]')).toContainText('Review missing details');
  await expect(dialog.locator('[data-v11217-guided-missing]')).toHaveCount(1);
  await dialog.locator('[data-v11217-guided-note]').fill('Retain this note on failure');
  await dialog.locator('[data-v11217-guided-confirm]').click();
  await expect(dialog).toContainText('cannot be queued');
  await expect(dialog.locator('[data-v11217-guided-note]')).toHaveValue('Retain this note on failure');
  await expect(dialog.locator('[data-v11217-guided-confirm]')).toBeDisabled();
  await expect(card).toBeAttached();
  expect(await page.evaluate(() => window.writes.length)).toBe(1);
});

test('explicit detail review stays in the sheet, reads each missing source once, and preserves the note', async ({ page }) => {
  await setup(page, { loadedEvidence: false, secondCheckout: true });
  const first = page.getByTestId('selected-card');
  await openCheckout(first);
  const dialog = page.locator('#v11217GuidedCheckout');
  const review = dialog.locator('[data-v11217-guided-review-care]');
  await expect(review).toBeVisible();
  await expect(review).toHaveText('Review missing details');
  await dialog.locator('[data-v11217-guided-note]').fill('Return the blue lead to Jamie');
  await review.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-v11217-guided-note]')).toHaveValue('Return the blue lead to Jamie');
  await expect(dialog.locator('[data-v11217-guided-medication]')).toHaveText('Give medicine with dinner');
  await expect(dialog.locator('[data-v11217-guided-belongings] li')).toHaveText(['Lead · Present · Blue lead', 'Food · Present · Food tub']);
  await expect(dialog.locator('[data-v11217-guided-missing]')).toBeHidden();
  expect(await page.evaluate(() => window.detailReads)).toEqual([
    { source: 'belongings', stayId: 'stay-a' },
    { source: 'profile', stayId: 'stay-a' }
  ]);
  expect(await page.evaluate(() => window.writes.length)).toBe(0);
  expect(await page.evaluate(() => window.movedIds)).toEqual([]);

  const second = page.locator('[data-directory-stay-id="stay-c"]');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await dialog.locator('[data-v11217-discard-confirm]').click();
  await openCheckout(second);
  await expect(dialog.locator('[data-v11217-guided-note]')).toHaveValue('');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => window.writes.length)).toBe(0);

  await openCheckout(first);
  await expect(dialog.locator('[data-v11217-guided-note]')).toHaveValue('');
  await dialog.locator('[data-v11217-guided-confirm]').click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => window.writes.map(write => [write.stayId, Object.hasOwn(write, 'note')]))).toEqual([['stay-a', false]]);
  expect(await page.evaluate(() => window.movedIds)).toEqual(['stay-a']);
});

test('detail review refuses a replaced stay identity and retains the note in the open sheet', async ({ page }) => {
  await setup(page, { loadedEvidence: false });
  const card = page.getByTestId('selected-card');
  await openCheckout(card);
  const dialog = page.locator('#v11217GuidedCheckout');
  const note = dialog.locator('[data-v11217-guided-note]');
  await note.fill('Keep for the selected stay');
  await card.evaluate(element => { element.dataset.directoryStayId = 'reused-card'; });
  await dialog.locator('[data-v11217-guided-review-care]').click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('changed or cannot be uniquely verified');
  await expect(note).toHaveValue('Keep for the selected stay');
  expect(await page.evaluate(() => window.detailReads.length)).toBe(0);
  expect(await page.evaluate(() => window.writes.length)).toBe(0);
});

test('a failed detail read leaves evidence unknown and retries only that source', async ({ page }) => {
  await setup(page, { loadedEvidence: false });
  await page.evaluate(() => { window.profileReadFailure = 'Profile read timed out'; });
  await openCheckout(page.getByTestId('selected-card'));
  const dialog = page.locator('#v11217GuidedCheckout');
  const note = dialog.locator('[data-v11217-guided-note]');
  await note.fill('Keep the medicine handover note');
  await dialog.locator('[data-v11217-guided-review-care]').click();
  await expect(dialog).toContainText('Profile read timed out');
  await expect(note).toHaveValue('Keep the medicine handover note');
  await expect(dialog.locator('[data-v11217-guided-belongings] li')).toHaveCount(2);
  await expect(dialog.locator('[data-v11217-guided-belongings-unknown]')).toBeHidden();
  await expect(dialog.locator('[data-v11217-guided-medication-unknown]')).toBeVisible();
  await expect(dialog.locator('[data-v11217-guided-confirm]')).toBeEnabled();
  expect(await page.evaluate(() => window.detailReads)).toEqual([
    { source: 'belongings', stayId: 'stay-a' },
    { source: 'profile', stayId: 'stay-a' }
  ]);

  await page.evaluate(() => { window.profileReadFailure = ''; });
  await dialog.locator('[data-v11217-guided-review-care]').click();
  await expect(dialog.locator('[data-v11217-guided-medication]')).toHaveText('Give medicine with dinner');
  await expect(dialog.locator('[data-v11217-guided-belongings] li')).toHaveCount(2);
  expect(await page.evaluate(() => window.detailReads)).toEqual([
    { source: 'belongings', stayId: 'stay-a' },
    { source: 'profile', stayId: 'stay-a' },
    { source: 'profile', stayId: 'stay-a' }
  ]);
  expect(await page.evaluate(() => window.writes.length)).toBe(0);
});

test('an exact not-found profile is distinct from a saved profile with no medication instructions', async ({ page }) => {
  await setup(page, { loadedEvidence: false });
  await page.evaluate(() => { window.profileNotFound = true; });
  await openCheckout(page.getByTestId('selected-card'));
  const dialog = page.locator('#v11217GuidedCheckout');
  await dialog.locator('[data-v11217-guided-review-care]').click();
  await expect(dialog.locator('[data-v11217-guided-medication]')).toHaveText('No saved care record');
  await expect(dialog.locator('[data-v11217-guided-medication]')).not.toHaveText('No medication instructions saved');
  await expect(dialog.locator('[data-v11217-guided-medication-unknown]')).toBeVisible();
  await expect(dialog.locator('[data-v11217-guided-missing]')).toBeVisible();
  expect(await page.evaluate(() => window.detailReads.filter(read => read.source === 'profile'))).toEqual([{ source: 'profile', stayId: 'stay-a' }]);
  expect(await page.evaluate(() => window.writes.length)).toBe(0);
});

test('confirm is disabled while detail review is pending and cancel ignores its late response', async ({ page }) => {
  await setup(page, { loadedEvidence: false });
  await page.evaluate(() => {
    window.pendingDetail = new Promise(resolve => { window.finishDetail = resolve; });
    window.WAFFLE_CARE_PROFILE_READS.read = async card => {
      window.detailReads.push({ source: 'profile', stayId: card.dataset.directoryStayId });
      await window.pendingDetail;
      return { data: { record: { identity: { stayId: card.dataset.directoryStayId, dogId: card.dataset.directoryDogId, stayKey: card.dataset.directoryStayKey }, resolution: { status: 'resolved' }, intakeAttributes: { medicationInstructions: 'Late stale instructions' } } } };
    };
  });
  await openCheckout(page.getByTestId('selected-card'));
  const dialog = page.locator('#v11217GuidedCheckout');
  const note = dialog.locator('[data-v11217-guided-note]');
  await note.fill('Only use this checkout note');
  await dialog.locator('[data-v11217-guided-review-care]').click();
  await dialog.locator('[data-v11217-guided-review-care]').evaluate(button => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await expect(dialog.locator('[data-v11217-guided-confirm]')).toBeDisabled();
  await expect(dialog.locator('[data-v11217-guided-close].v11217-cancel')).toBeEnabled();
  expect(await page.evaluate(() => window.detailReads)).toEqual([
    { source: 'belongings', stayId: 'stay-a' },
    { source: 'profile', stayId: 'stay-a' }
  ]);
  await dialog.locator('[data-v11217-guided-close].v11217-cancel').click();
  await dialog.locator('[data-v11217-discard-confirm]').click();
  await page.evaluate(() => window.finishDetail());
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => window.writes.length)).toBe(0);
  expect(await page.evaluate(() => window.movedIds)).toEqual([]);
});

test('editing the handover note while details load keeps the latest text and focus', async ({ page }) => {
  await setup(page, { loadedEvidence: false });
  await page.evaluate(() => {
    window.pendingDetail = new Promise(resolve => { window.finishDetail = resolve; });
    window.WAFFLE_CARE_PROFILE_READS.read = async card => {
      await window.pendingDetail;
      return { data: { record: { identity: { stayId: card.dataset.directoryStayId, dogId: card.dataset.directoryDogId, stayKey: card.dataset.directoryStayKey }, resolution: { status: 'resolved' }, intakeAttributes: { medicationInstructions: 'Latest saved instructions' } } } };
    };
  });
  await openCheckout(page.getByTestId('selected-card'));
  const dialog = page.locator('#v11217GuidedCheckout');
  const note = dialog.locator('[data-v11217-guided-note]');
  await note.fill('Initial note');
  await dialog.locator('[data-v11217-guided-review-care]').click();
  await note.fill('Updated while loading');
  await page.evaluate(() => window.finishDetail());
  await expect(dialog.locator('[data-v11217-guided-medication]')).toHaveText('Latest saved instructions');
  await expect(note).toHaveValue('Updated while loading');
  await expect(note).toBeFocused();
  expect(await page.evaluate(() => window.writes.length)).toBe(0);
});

test('detail returned after the selected card changes cannot replace unknown evidence', async ({ page }) => {
  await setup(page, { loadedEvidence: false });
  await page.evaluate(() => {
    window.pendingDetail = new Promise(resolve => { window.finishDetail = resolve; });
    window.WAFFLE_CARE_PROFILE_READS.read = async card => {
      window.detailReads.push({ source: 'profile', stayId: card.dataset.directoryStayId });
      await window.pendingDetail;
      return { data: { record: { identity: { stayId: 'stay-a', dogId: 'dog-a', stayKey: 'twin|2026-10-18|2026-10-18|a' }, resolution: { status: 'resolved' }, intakeAttributes: { medicationInstructions: 'Must not be shown' } } } };
    };
  });
  const card = page.getByTestId('selected-card');
  await openCheckout(card);
  const dialog = page.locator('#v11217GuidedCheckout');
  await dialog.locator('[data-v11217-guided-note]').fill('Keep this note');
  await dialog.locator('[data-v11217-guided-review-care]').click();
  await card.evaluate(element => { element.dataset.directoryDogId = 'different-dog'; });
  await page.evaluate(() => window.finishDetail());
  await expect(dialog.locator('[data-v11217-guided-medication-unknown]')).toBeVisible();
  await expect(dialog).not.toContainText('Must not be shown');
  await expect(dialog.locator('[data-v11217-guided-note]')).toHaveValue('Keep this note');
  await expect(dialog.locator('[data-v11217-guided-confirm]')).toBeDisabled();
  await expect(dialog).toContainText('selected stay changed while details were loading');
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
  await expect(dialog.locator('[data-v11217-guided-belongings-unknown]')).toHaveText('Not available in this summary');
});

test('reopening checkout for a guest with unknown medication clears the previous guest instructions', async ({ page }) => {
  await setup(page, { secondCheckout: true });
  const first = page.getByTestId('selected-card');
  await openCheckout(first);
  const dialog = page.locator('#v11217GuidedCheckout');
  await expect(dialog.locator('[data-v11217-guided-medication]')).toHaveText('Return blue inhaler');
  await dialog.locator('[data-v11217-guided-close].v11217-cancel').click();

  const next = page.locator('[data-directory-stay-id="stay-c"]');
  await next.evaluate(card => {
    const medication = document.createElement('span');
    medication.dataset.careBriefMedication = '';
    medication.setAttribute('aria-busy', 'true');
    medication.textContent = 'Instructions for the previous guest';
    card.appendChild(medication);
  });
  await openCheckout(next);
  await expect(dialog.locator('[data-v11217-guided-medication-unknown]')).toHaveText('Not available in this summary');
  await expect(dialog.locator('[data-v11217-guided-medication]')).toBeEmpty();
  await expect(dialog).not.toContainText('Return blue inhaler');
  await expect(dialog).not.toContainText('Instructions for the previous guest');
  expect(await page.evaluate(() => window.writes.length)).toBe(0);
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

test('loaded belongings stay collapsed until reviewed and their disclosure works by keyboard', async ({ page }) => {
  await setup(page);
  await openCheckout(page.getByTestId('selected-card'));
  const dialog = page.locator('#v11217GuidedCheckout');
  await expect(dialog.locator('[data-v11217-guided-review-care]')).toBeHidden();
  await page.keyboard.press('Tab');
  await expect(dialog.locator('[data-v11217-guided-close]').first()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.locator('[data-v11217-guided-belongings-summary]')).toBeFocused();
  await expect(dialog.locator('[data-v11217-guided-belongings-details]')).toHaveJSProperty('open', false);
  await page.keyboard.press('Enter');
  await expect(dialog.locator('[data-v11217-guided-belongings-details]')).toHaveJSProperty('open', true);
  await expect(dialog.locator('[data-v11217-guided-belongings] li')).toHaveCount(2);
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
  await expect(dialog.locator('[data-v11217-guided-belongings-unknown]')).toHaveText('Not available in this summary');
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
  await expect(card.locator('[data-v11217-roster-checkout]')).toBeVisible();
  await openCheckout(card);
  await page.locator('[data-v11217-guided-note]').fill('Owner collected lead');
  await page.locator('[data-v11217-guided-confirm]').click();
  await expect(page.locator('#v11217GuidedCheckout')).toBeHidden();
  expect(await page.evaluate(() => window.movedIds)).toEqual(['upgraded-stay-a']);
  expect(await page.evaluate(() => window.writes[0].note)).toBe('Owner collected lead');
});

test('one recorded belonging is visible immediately and a larger list keeps the existing disclosure',async({page})=>{
  await setup(page);
  const card=page.getByTestId('selected-card');
  await card.locator('[data-belongings-summary]').evaluate(node=>{node.innerHTML='<ul class="belongings-summary-list"><li>Blue lead</li></ul>';});
  await openCheckout(card);
  const dialog=page.locator('#v11217GuidedCheckout');
  await expect(dialog.locator('[data-v11217-guided-belongings] li')).toBeVisible();
  await expect(dialog.locator('[data-v11217-guided-belongings] li')).toHaveText('Blue lead');
  await expect(dialog.locator('[data-v11217-guided-belongings-summary]')).toBeHidden();
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await card.locator('[data-belongings-summary]').evaluate(node=>{node.innerHTML='<ul class="belongings-summary-list"><li>Blue lead</li><li>Food tub</li></ul>';});
  await openCheckout(card);
  await expect(dialog.locator('[data-v11217-guided-belongings-summary]')).toBeVisible();
  await expect(dialog.locator('[data-v11217-guided-belongings-details]')).toHaveJSProperty('open',false);
  expect(await page.evaluate(()=>window.writes.length)).toBe(0);
  expect(await page.evaluate(()=>window.detailReads.length)).toBe(0);
});

test('failed detail review has one full error message and keeps source-specific unknown warnings',async({page})=>{
  await setup(page,{loadedEvidence:false});
  await page.evaluate(()=>{window.profileReadFailure='Profile read timed out';});
  await openCheckout(page.getByTestId('selected-card'));
  const dialog=page.locator('#v11217GuidedCheckout');
  await dialog.locator('[data-v11217-guided-note]').fill('Return the lead');
  await dialog.locator('[data-v11217-guided-review-care]').click();
  await expect(dialog.locator('[data-v11217-guided-missing-message]')).toHaveText('Review is incomplete. Retry the missing details.');
  await expect(dialog.locator('[data-v11217-guided-feedback]')).toContainText('Profile read timed out');
  await expect(dialog.locator('[data-v11217-guided-missing-message]')).not.toContainText('Profile read timed out');
  await expect(dialog.locator('[data-v11217-guided-medication-unknown]')).toBeVisible();
  await expect(dialog.locator('[data-v11217-guided-belongings-unknown]')).toBeHidden();
  await expect(dialog.locator('[data-v11217-guided-note]')).toHaveValue('Return the lead');
  expect(await page.evaluate(()=>window.writes.length)).toBe(0);
});


test('checkout shows only the selected saved owner and handover without loading or copying them into the departure note',async({page})=>{
 await setup(page,{secondCheckout:true});
 await page.evaluate(()=>{
  const selected=document.querySelector('[data-testid="selected-card"]');
  selected.dataset.fixtureOwner='Alex & Pat';selected.dataset.fixturePhone='+61 (400) 123-456';
  const trigger=document.createElement('button');trigger.dataset.directoryEditField='notes';trigger.dataset.directoryCurrentValue='<b>Return the blue lead</b>\nCall before pickup.';selected.appendChild(trigger);
  window.v110OperationalPayloadFromCard=card=>({stayId:card.dataset.directoryStayId,stayKey:card.dataset.directoryStayKey,dogId:card.dataset.directoryDogId,dogName:card.dataset.directoryDogName,startDate:card.dataset.directoryStartDate,endDate:card.dataset.directoryEndDate,ownerName:card.dataset.fixtureOwner||'',phone:card.dataset.fixturePhone||''});
 });
 const selected=page.getByTestId('selected-card');await openCheckout(selected);
 const dialog=page.locator('#v11217GuidedCheckout');
 await expect(dialog.locator('[data-v11217-guided-owner-name]')).toHaveText('Owner: Alex & Pat');
 await expect(dialog.locator('[data-v11217-guided-owner-call]')).toHaveAttribute('href','tel:+61400123456');
 await expect(dialog.locator('[data-v11217-guided-handover]')).toHaveJSProperty('open',true);
 await expect(dialog.locator('[data-v11217-guided-handover-note]')).toHaveText('<b>Return the blue lead</b>\nCall before pickup.');
 await expect(dialog.locator('[data-v11217-guided-handover-note] b')).toHaveCount(0);
 await expect(dialog.locator('[data-v11217-guided-note]')).toHaveValue('');
 expect(await page.evaluate(()=>window.detailReads)).toEqual([]);expect(await page.evaluate(()=>window.writes)).toEqual([]);
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await openCheckout(page.locator('[data-directory-stay-id="stay-c"]'));
 await expect(dialog.locator('[data-v11217-guided-owner]')).toBeHidden();
 await expect(dialog.locator('[data-v11217-guided-owner-call]')).not.toHaveAttribute('href',/tel:/);
 await expect(dialog.locator('[data-v11217-guided-handover]')).toBeHidden();
 await expect(dialog.locator('[data-v11217-guided-handover-note]')).toHaveText('');
});

test('saved handover disclosure opens only for concise notes and resets for each selected stay',async({page})=>{
 await setup(page,{secondCheckout:true});
 const first=page.getByTestId('selected-card'),dialog=page.locator('#v11217GuidedCheckout');
 const putNote=async value=>first.evaluate((card,text)=>{
  let trigger=card.querySelector('[data-directory-edit-field="notes"]');
  if(!trigger){trigger=document.createElement('button');trigger.dataset.directoryEditField='notes';card.appendChild(trigger);}
  trigger.dataset.directoryCurrentValue=text;
 },value);
 const handover=dialog.locator('[data-v11217-guided-handover]');
 const handoverText=dialog.locator('[data-v11217-guided-handover-note]');
 const preview=dialog.locator('[data-v11217-guided-handover-preview]');
 const openAndCheck=async(value,{visible=true,open=false,rendered=value}={})=>{
  await putNote(value);await openCheckout(first);
  if(visible){await expect(handover).toBeVisible();await expect(handover).toHaveJSProperty('open',open);await expect(handoverText).toHaveText(rendered);if(!open && (Array.from(value).length>120||value.split(/\r\n|[\n\r\u2028\u2029]/).length>2)){await expect(preview).toBeVisible();const compact=value.replace(/\s+/gu,' ').trim();await expect(preview).toHaveText(` · ${Array.from(compact).slice(0,66).join('').trimEnd()}${Array.from(compact).length>66?'…':''}`);}}
  else {await expect(handover).toBeHidden();await expect(handoverText).toHaveText('');}
  await expect(dialog.locator('[data-v11217-guided-note]')).toHaveValue('');
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 };
 await openAndCheck('🧇'.repeat(120),{open:true});
 await openAndCheck(`  ${'x'.repeat(120)}  `,{open:false});
 await openAndCheck('\n'.repeat(20)+'short note',{open:false});
 await openAndCheck(' '.repeat(121)+'short note',{open:false});
 await openAndCheck('x'.repeat(121),{open:false});
 await openAndCheck('first\nsecond\nthird',{open:false});
 await openAndCheck('first\n\nsecond',{open:false});
 await openAndCheck('first\nsecond',{open:true});
 await openAndCheck('  No handover note saved.  ',{visible:false});
 await openAndCheck('   ',{visible:false});
 await openAndCheck('<img src=x onerror=alert(1)>',{open:true});
 await expect(handoverText.locator('img')).toHaveCount(0);

 await putNote('short saved note');await openCheckout(first);
 await expect(handover).toHaveJSProperty('open',true);
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 const second=page.locator('[data-directory-stay-id="stay-c"]');
 await openCheckout(second);
 await expect(handover).toBeHidden();await expect(handover).toHaveJSProperty('open',false);
 await expect(handoverText).toHaveText('');
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await openCheckout(first);
 await expect(handover).toHaveJSProperty('open',true);
 await expect(handoverText).toHaveText('short saved note');
});

test('dirty departure note uses inline discard confirmation and Keep editing retains the draft',async({page})=>{
 await setup(page);await openCheckout(page.getByTestId('selected-card'));
 const dialog=page.locator('#v11217GuidedCheckout'),note=dialog.locator('[data-v11217-guided-note]');
 await note.fill('Give the owner the blue bag.');
 await page.keyboard.press('Escape');
 const prompt=dialog.locator('[data-v11217-discard-prompt]');await expect(prompt).toBeVisible();await expect(prompt.locator('[data-v11217-discard-keep]')).toBeFocused();
 await expect(dialog.locator('[data-v11217-guided-confirm]')).toBeDisabled();
 await page.keyboard.press('Escape');await expect(prompt).toBeHidden();await expect(dialog).toBeVisible();await expect(note).toHaveValue('Give the owner the blue bag.');await expect(note).toBeFocused();
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(prompt).toBeVisible();await prompt.locator('[data-v11217-discard-confirm]').click();
 await expect(dialog).toBeHidden();await openCheckout(page.getByTestId('selected-card'));await expect(note).toHaveValue('');
 expect(await page.evaluate(()=>window.writes)).toEqual([]);
});

test('care detail completion cannot enable checkout behind a pending inline discard choice',async({page})=>{
 await setup(page,{loadedEvidence:false});await openCheckout(page.getByTestId('selected-card'));
 const dialog=page.locator('#v11217GuidedCheckout');
 await page.evaluate(()=>{
  let release;const gate=new Promise(resolve=>release=resolve);window.releaseDiscardReview=release;
  for(const api of [window.WAFFLE_CARE_PROFILE_READS,window.WAFFLE_CARE_BELONGINGS_READS]){const read=api.read;api.read=async(...args)=>{await gate;return read(...args);};}
 });
 await dialog.locator('[data-v11217-guided-note]').fill('Keep this pending departure note.');
 await dialog.locator('[data-v11217-guided-review-care]').click();
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(dialog.locator('[data-v11217-discard-prompt]')).toBeVisible();
 await page.evaluate(()=>window.releaseDiscardReview());
 await expect(dialog.locator('[data-v11217-guided-review-care]')).toBeEnabled();
 await expect(dialog.locator('[data-v11217-guided-confirm]')).toBeDisabled();
 await dialog.locator('[data-v11217-discard-keep]').click();
 await expect(dialog.locator('[data-v11217-guided-confirm]')).toBeEnabled();
 await expect(dialog.locator('[data-v11217-guided-note]')).toHaveValue('Keep this pending departure note.');
 expect(await page.evaluate(()=>window.writes)).toEqual([]);
});


test('verified normal checkout focuses its real completion while failure and cancel stay in the sheet', async ({page}) => {
  await setup(page);
  await page.evaluate(() => {
    window.v110ValidStayId = value => !!value;
    const save = window.v110SaveOperationalStatus;
    window.v110SaveOperationalStatus = async (...args) => {
      const result = await save(...args);
      if (result.record) Object.assign(result.record, {dogId: args[0].dogId, actualCheckoutDate:'2026-10-18'});
      return result;
    };
  });
  await page.addScriptTag({content: require('node:fs').readFileSync(require('node:path').join(__dirname,'..','care-departure-message.js'),'utf8')});
  const card = page.getByTestId('selected-card');
  await openCheckout(card);
  await page.evaluate(() => {window.failNext=true;});
  const dialog=page.locator('#v11217GuidedCheckout');
  await dialog.locator('[data-v11217-guided-confirm]').click();
  await expect(dialog).toBeVisible();
  await expect(page.locator('#v11217DepartureMessageBanner')).toHaveCount(0);
  await dialog.locator('[data-v11217-guided-confirm]').click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('[data-v11217-departure-copy]')).toBeFocused();
  await expect(page.locator('[data-v11217-departure-disclosure]')).toHaveJSProperty('open',false);
  expect(await page.evaluate(()=>window.writes.length)).toBe(2);
});
