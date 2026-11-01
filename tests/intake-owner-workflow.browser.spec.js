const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const template = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Intake.html'), 'utf8')
  .replace('<?!= JSON.stringify(intakeToken) ?>', JSON.stringify('fixture-secure-token'));

async function openIntake(page) {
  await page.route('http://intake.test/', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' }));
  await page.goto('http://intake.test/');
  await page.setContent(template.replace(/<script>[\s\S]*<\/script>/, ''));
  await page.evaluate(() => {
    window.__intakeCalls = [];
    const runner = {
      success: null,
      failure: null,
      withSuccessHandler(handler) { this.success = handler; return this; },
      withFailureHandler(handler) { this.failure = handler; return this; },
      getIntakePrefillForHtml(token) {
        window.__intakeCalls.push({ kind: 'prefill', token, success: this.success, failure: this.failure });
        return this;
      },
      submitIntakeFromHtml(payload) {
        window.__intakeCalls.push({ kind: 'submit', payload, success: this.success, failure: this.failure });
        return this;
      }
    };
    window.google = { script: { run: runner } };
    window.__timerCallbacks = new Map();
    let nextTimerId = 1;
    const nativeSetTimeout = window.setTimeout.bind(window);
    const nativeClearTimeout = window.clearTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) => {
      if (delay === 10_000 || delay === 30_000) {
        const id = nextTimerId++;
        window.__timerCallbacks.set(id, { callback: () => callback(...args), delay });
        return id;
      }
      return nativeSetTimeout(callback, delay, ...args);
    };
    window.clearTimeout = id => {
      if (window.__timerCallbacks.has(id)) window.__timerCallbacks.delete(id);
      else nativeClearTimeout(id);
    };
  });
  const script = template.match(/<script>([\s\S]*)<\/script>/)[1];
  await page.addScriptTag({ content: script });
  await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));
  await expect.poll(() => page.evaluate(() => window.__intakeCalls.length)).toBe(1);
}

async function fireTimer(page, delay) {
  await page.evaluate(target => {
    const entry = [...window.__timerCallbacks.entries()].find(([, timer]) => timer.delay === target);
    if (!entry) throw new Error(`No ${target}ms intake timer was scheduled`);
    window.__timerCallbacks.delete(entry[0]);
    entry[1].callback();
  }, delay);
}

async function succeedPrefill(page, index = 0, dogName = 'Cino', savedAnswers = { additionalInstructions: 'Use the blue harness.' }) {
  await page.evaluate(({ index, dogName, savedAnswers }) => window.__intakeCalls[index].success({
    status: 'Awaiting Owner',
    booking: { dogName, breed: 'Jack Russell', startDate: '2026-11-01', endDate: '2026-11-11', ownerName: 'Owner One', phone: '0400000000', bookingType: 'Confirmed Boarding' },
    savedAnswers
  }), { index, dogName, savedAnswers });
}

test('prefill shows progress, then offers one explicit retry and rejects stale results at phone and desktop widths', async ({ page }) => {
  for (const theme of ['', 'dark-theme']) {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await openIntake(page);
      await page.locator('body').evaluate((el, value) => el.classList.toggle('dark-theme', value), theme === 'dark-theme');
      await fireTimer(page, 10_000);
      await expect(page.locator('#loadingMessage')).toHaveText('Still loading your secure intake form…');
      await fireTimer(page, 30_000);
      await expect(page.getByRole('button', { name: 'Retry loading form' })).toBeVisible();
      expect(await page.locator('#retryPrefillBtn').evaluate(button => button.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
      expect(await page.locator('#loadingMessage').getAttribute('aria-live')).toBe('polite');
      const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
      await page.locator('#retryPrefillBtn').evaluate(button => { button.click(); button.click(); });
      expect(await page.evaluate(() => window.__intakeCalls.filter(call => call.kind === 'prefill').length)).toBe(2);
      await succeedPrefill(page, 0, 'Stale Dog');
      await expect(page.locator('#intakeForm')).not.toHaveClass(/ready/);
      await succeedPrefill(page, 1);
      await expect(page.locator('#intakeForm')).toHaveClass(/ready/);
      await expect(page.locator('#bookingDog')).toHaveText('Cino');
      await expect(page.locator('#bookingDates')).toHaveText('1 Nov 2026 – 11 Nov 2026');
    }
  }
});

for (const [width, colorScheme] of [[320, 'light'], [320, 'dark'], [390, 'light'], [390, 'dark'], [1440, 'light'], [1440, 'dark']]) {
  test(`intake progress, inline validation and touch targets at ${width}px ${colorScheme} preference`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme });
    await openIntake(page);
    await succeedPrefill(page);

    const progress = page.getByRole('progressbar', { name: 'Intake form progress' });
    await expect(progress).toHaveAttribute('aria-valuenow', '1');
    await expect(progress).toHaveAttribute('aria-valuetext', 'Step 1 of 7: Booking & owner');

    await page.evaluate(() => {
      STEPS[0] = 'A very long localized booking and owner details step title';
      updateWizard(false);
    });
    const title = page.locator('#stepTitle');
    await expect(title).toHaveText('A very long localized booking and owner details step title');
    await expect(title).toHaveCSS('white-space', 'normal');
    expect(await title.evaluate(element => element.scrollWidth <= element.clientWidth)).toBeTruthy();

    await page.evaluate(() => {
      const owner = document.querySelector('#ownerName');
      const hint = document.createElement('span');
      hint.id = 'ownerNameHint';
      hint.textContent = 'Enter the booking owner name.';
      owner.closest('.field').append(hint);
      owner.setAttribute('aria-describedby', hint.id);
      owner.value = '';
    });
    await page.locator('#nextBtn').click();
    const ownerName = page.locator('#ownerName');
    await expect(ownerName).toBeFocused();
    await expect(ownerName).toHaveAttribute('aria-invalid', 'true');
    await expect(ownerName).toHaveAttribute('aria-describedby', /ownerNameHint intake-error-ownerName/);
    await expect(page.locator('#intake-error-ownerName')).toHaveText('Please complete “Owner name” before continuing.');
    await expect(page.locator('#formMessage')).toBeHidden();
    await ownerName.fill('Cino Owner');
    await expect(ownerName).not.toHaveAttribute('aria-invalid', 'true');
    await expect(ownerName).toHaveAttribute('aria-describedby', 'ownerNameHint');
    await expect(page.locator('#intake-error-ownerName')).toHaveCount(0);

    await page.evaluate(() => {
      currentStep = 6;
      updateWizard(false);
    });
    const transportGroup = page.getByRole('group', { name: 'Owner permits sitter to transport the dog by car if reasonably required' });
    await expect(transportGroup).toBeVisible();
    expect(await page.locator('.field-long-question .yesno label').evaluateAll(labels => labels.every(label => label.getBoundingClientRect().height >= 52))).toBeTruthy();
    expect(await page.locator('.section-desc').first().evaluate(element => getComputedStyle(element).fontSize)).toBe('13px');
    await transportGroup.locator('input[value="No"]').evaluate(input => { input.id = 'transportPermissionNoOption'; });
    await transportGroup.locator('input[value="Yes"]').evaluate(input => input.required = true);
    await page.locator('#nextBtn').click();
    await expect(transportGroup.locator('input[value="Yes"]')).toBeFocused();
    expect(await transportGroup.locator('input[type="radio"]').evaluateAll(radios => radios.every(radio => radio.getAttribute('aria-invalid') === 'true'))).toBeTruthy();
    await expect(page.locator('#intake-error-transportPermission')).toHaveText('Please choose a response for “Owner permits sitter to transport the dog by car if reasonably required” before continuing.');
    await expect(page.locator('#intake-error-transportPermission')).toHaveCount(1);
    await transportGroup.locator('input[value="No"]').check();
    await expect(page.locator('#intake-error-transportPermission')).toHaveCount(0);
    expect(await transportGroup.locator('input[type="radio"]').evaluateAll(radios => radios.every(radio => !radio.hasAttribute('aria-invalid')))).toBeTruthy();

    await page.evaluate(() => {
      currentStep = 7;
      updateWizard(false);
    });
    const clearSignature = page.locator('#clearSignature');
    await expect(clearSignature).toBeVisible();
    expect(await clearSignature.evaluate(button => button.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await expect(page.locator('#progressTrack')).toHaveAttribute('aria-valuenow', '7');
    await expect(page.locator('#progressTrack')).toHaveAttribute('aria-valuetext', 'Step 7 of 7: Review & sign');
    await page.locator('[name="accuracyConfirmed"]').check();
    await page.locator('[name="termsAccepted"]').check();
    await page.locator('#submitBtn').click();
    const signature = page.locator('#signatureCanvas');
    await expect(signature).toBeFocused();
    await expect(signature).toHaveAttribute('tabindex', '-1');
    await expect(signature).toHaveAttribute('aria-invalid', 'true');
    await expect(signature).toHaveAttribute('aria-describedby', 'signatureInstructions intake-error-signatureCanvas');
    await expect(page.locator('#intake-error-signatureCanvas')).toHaveText('Please sign inside the electronic signature box.');
    expect(await page.evaluate(() => window.__intakeCalls.filter(call => call.kind === 'submit'))).toHaveLength(0);
  });
}

test('a late success after the wait state opens the form when no retry was started', async ({ page }) => {
  await openIntake(page);
  await fireTimer(page, 30_000);
  await expect(page.getByRole('button', { name: 'Retry loading form' })).toBeVisible();
  await succeedPrefill(page);
  await expect(page.locator('#intakeForm')).toHaveClass(/ready/);
  await expect(page.getByRole('button', { name: 'Retry loading form' })).toBeHidden();
  await page.locator('#ownerAddress').fill('Keep this edit');
  await page.locator('#retryPrefillBtn').evaluate(button => button.click());
  expect(await page.evaluate(() => window.__intakeCalls.filter(call => call.kind === 'prefill').length)).toBe(1);
  await expect(page.locator('#ownerAddress')).toHaveValue('Keep this edit');
});

test('empty and excluded-only session drafts do not claim that answers were restored', async ({ page }) => {
  await openIntake(page);
  await page.evaluate(() => sessionStorage.setItem('waffle-intake-draft:fixture-secure-token', JSON.stringify({
    step: 7,
    fields: { dogName: 'Old name', termsAccepted: true, accuracyConfirmed: true, signatureName: 'Old owner', declarationDate: '2024-01-01' }
  })));
  await succeedPrefill(page);
  await expect(page.locator('#draftRestoredStatus')).toBeHidden();
  await expect(page.locator('#pageCounter')).toHaveText('1 / 7');
  await expect(page.locator('#dogName')).toHaveValue('Cino');
});

test('a failed prefill stays actionable and only retries after an explicit click', async ({ page }) => {
  await openIntake(page);
  await page.evaluate(() => window.__intakeCalls[0].failure({ message: 'Temporary read failure.' }));
  await expect(page.locator('#loadingMessage')).toContainText('Temporary read failure.');
  await expect(page.getByRole('button', { name: 'Retry loading form' })).toBeVisible();
  expect(await page.evaluate(() => window.__intakeCalls.filter(call => call.kind === 'prefill').length)).toBe(1);
  await page.getByRole('button', { name: 'Retry loading form' }).click();
  expect(await page.evaluate(() => window.__intakeCalls.filter(call => call.kind === 'prefill').length)).toBe(2);
  await succeedPrefill(page, 1);
  await expect(page.locator('#intakeForm')).toHaveClass(/ready/);
});

test('restores only permitted draft fields and reports restoration without submitting', async ({ page }) => {
  await openIntake(page);
  await page.evaluate(() => sessionStorage.setItem('waffle-intake-draft:fixture-secure-token', JSON.stringify({
    step: 2,
    fields: {
      ownerAddress: '12 Sample Street',
      dogName: 'Wrong Dog',
      declarationDogName: 'Wrong Dog',
      bookingPeriod: 'Stale dates',
      termsAccepted: true,
      accuracyConfirmed: true,
      signatureName: 'Owner Draft'
    }
  })));
  await succeedPrefill(page, 0, 'Cino', {
    additionalInstructions: 'Use the blue harness.',
    termsAccepted: true,
    accuracyConfirmed: true,
    signatureName: 'Old Owner',
    declarationDate: '2024-01-01'
  });
  await expect(page.locator('#draftRestoredStatus')).toBeVisible();
  await expect(page.locator('#ownerAddress')).toHaveValue('12 Sample Street');
  await expect(page.locator('#dogName')).toHaveValue('Cino');
  await expect(page.locator('#declarationDogName')).toHaveValue('Cino');
  await expect(page.locator('#bookingPeriod')).toHaveValue('1 Nov 2026 – 11 Nov 2026');
  await expect(page.locator('[name="termsAccepted"]')).not.toBeChecked();
  await expect(page.locator('[name="accuracyConfirmed"]')).not.toBeChecked();
  await expect(page.locator('#signatureName')).toHaveValue('Owner One');
  expect(await page.evaluate(() => signatureDirty)).toBe(false);
  expect(await page.evaluate(() => window.__intakeCalls.filter(call => call.kind === 'submit').length)).toBe(0);
  await expect(page.locator('#pageCounter')).toHaveText('2 / 7');
});

test('debounces typing, flushes on change and pagehide, and keeps submit feedback single-flight', async ({ page }) => {
  await openIntake(page);
  await succeedPrefill(page);
  await page.evaluate(() => {
    window.__draftWrites = 0;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'waffle-intake-draft:fixture-secure-token') window.__draftWrites++;
      return original.call(this, key, value);
    };
  });
  const address = page.locator('#ownerAddress');
  await address.fill('First value');
  await address.fill('Final value');
  await expect.poll(() => page.evaluate(() => window.__draftWrites)).toBe(1);
  await address.fill('Flush on change');
  await address.dispatchEvent('change');
  expect(await page.evaluate(() => window.__draftWrites)).toBe(2);
  await address.fill('Flush on pagehide');
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect(await page.evaluate(() => window.__draftWrites)).toBe(3);
  expect(JSON.parse(await page.evaluate(() => sessionStorage.getItem('waffle-intake-draft:fixture-secure-token'))).fields.ownerAddress).toBe('Flush on pagehide');
  const storedFields = JSON.parse(await page.evaluate(() => sessionStorage.getItem('waffle-intake-draft:fixture-secure-token'))).fields;
  for (const forbidden of ['dogName', 'declarationDogName', 'bookingPeriod', 'termsAccepted', 'accuracyConfirmed', 'signatureName', 'declarationDate', 'signatureData']) {
    expect(Object.hasOwn(storedFields, forbidden)).toBe(false);
  }

  await page.evaluate(() => {
    document.querySelectorAll('#intakeForm [required]').forEach(el => {
      if (el.type === 'checkbox') el.checked = true;
      else if (el.type !== 'radio') el.value = el.type === 'date' ? '2026-11-01' : 'Completed';
    });
    signatureAnswerFingerprint = signatureContentFingerprint();
    signatureDirty = true;
    document.querySelector('#intakeForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await expect(page.locator('#formMessage')).toHaveClass(/info/);
  await expect(page.locator('#formMessage')).toContainText('Saving the intake');
  await expect(page.locator('#submitBtn')).toBeDisabled();
  await page.evaluate(() => document.querySelector('#intakeForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(await page.evaluate(() => window.__intakeCalls.filter(call => call.kind === 'submit').length)).toBe(1);
  await page.evaluate(() => window.__intakeCalls.find(call => call.kind === 'submit').failure({ message: 'The server rejected this fixture.' }));
  await expect(page.locator('#formMessage')).toContainText('The server rejected this fixture.');
  await expect(page.locator('#submitBtn')).toBeEnabled();
  await expect(page.locator('#formMessage')).toHaveAttribute('aria-live', 'polite');
  await page.evaluate(() => document.querySelector('#intakeForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(await page.evaluate(() => window.__intakeCalls.filter(call => call.kind === 'submit').length)).toBe(2);
  await page.evaluate(() => window.__intakeCalls.filter(call => call.kind === 'submit')[1].success({ dogName: 'Cino' }));
  await expect(page.locator('.completed h2')).toHaveText('Intake submitted successfully');
  await expect(page.locator('.completed h2')).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('.completed h2')).toBeFocused();
  expect(await page.evaluate(() => sessionStorage.getItem('waffle-intake-draft:fixture-secure-token'))).toBeNull();
});

test('signing context stays tied to the booking and signature clearing requires existing ink', async ({ page }) => {
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await openIntake(page);
    await succeedPrefill(page);
    await page.evaluate(() => { currentStep = 7; updateWizard(false); });
    await expect(page.locator('#signatureName')).toHaveValue('Owner One');
    await expect(page.locator('#declarationDogName')).toHaveValue('Cino');
    expect(await page.locator('#declarationDate').inputValue()).toBe(await page.evaluate(() => isoToday()));

    await expect(page.locator('#signingDog')).toHaveText('Cino');
    await expect(page.locator('#signingDates')).toHaveText('1 Nov 2026 – 11 Nov 2026');
    await page.locator('#declarationDogName').fill('Another dog');
    await expect(page.locator('#signingDog')).toHaveText('Cino');

    const canvas = page.locator('#signatureCanvas');
    await expect(canvas).toHaveAttribute('aria-describedby', 'signatureInstructions');
    await expect(page.locator('#signatureInstructions')).toContainText('finger, stylus, or mouse');
    const clear = page.locator('#clearSignature');
    await expect(clear).toBeDisabled();
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 20, box.y + 20);
    await expect(clear).toBeEnabled();
    await expect(canvas).toHaveAttribute('aria-describedby', 'signatureInstructions');
    await clear.click();
    await expect(clear).toBeDisabled();
    await expect(canvas).toBeFocused();
    await expect(page.locator('#signatureStatus')).toHaveText('Signature cleared. Please sign again.');
    expect(await page.locator('[name="termsAccepted"]').isChecked()).toBe(false);
    expect(await page.locator('[name="accuracyConfirmed"]').isChecked()).toBe(false);
    expect(await page.evaluate(() => window.__intakeCalls.filter(call => call.kind === 'submit').length)).toBe(0);

    const nextBox = await canvas.boundingBox();
    await page.mouse.click(nextBox.x + 30, nextBox.y + 30);
    await expect(clear).toBeEnabled();
    await expect(page.locator('#signatureStatus')).toBeEmpty();
    await clear.click();
    await expect(clear).toBeDisabled();
    await expect(page.locator('#signatureStatus')).toHaveText('Signature cleared. Please sign again.');
  }
});

test('Step 7 reviews all six answer groups safely and edits return to the source step', async ({ page }) => {
  for (const [width, colorScheme] of [[320, 'light'], [320, 'dark'], [390, 'light'], [390, 'dark'], [1440, 'light'], [1440, 'dark']]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme });
    await openIntake(page);
    await page.evaluate(() => sessionStorage.removeItem(answerReviewDisclosureKey()));
    await succeedPrefill(page);
    await page.locator('body').evaluate(element => { element.style.fontSize = '20px'; });
    await page.evaluate(() => {
      const instructions = document.querySelector('#additionalInstructions');
      instructions.value = '<img src=x onerror="alert(1)"> unknown & missing';
      const password = document.createElement('input');
      password.type = 'password';
      password.name = 'fixturePassword';
      password.value = 'never-review-this';
      page(6).append(password);
      currentStep = 7;
      updateWizard(false);
    });
    const review = page.locator('#answerReview');
    const disclosure = page.locator('#answerReviewDisclosure');
    await expect(disclosure).not.toHaveAttribute('open', '');
    await disclosure.locator('summary').click();
    await expect(disclosure).toHaveAttribute('open', '');
    await expect(review.locator('.answer-review-group')).toHaveCount(6);
    await expect(review.locator('.answer-review-group h3')).toHaveText([
      'Booking & owner', 'Dog information', 'Behaviour & safety', 'Food & walks', 'Health & home', 'Daily care & handling'
    ]);
    const answerFieldCount = await page.evaluate(() => new Set(Array.from(document.querySelectorAll('.wizard-page[data-step]:not([data-step="7"]) [name]')).filter(control => control.type !== 'password').map(control => control.name)).size);
    await expect(review.locator('.answer-review-item dd')).toHaveCount(answerFieldCount);
    await expect(review).toContainText('<img src=x onerror="alert(1)"> unknown & missing');
    await expect(review.locator('img, script')).toHaveCount(0);
    await expect(review).not.toContainText('never-review-this');
    await expect(review).not.toContainText('I have read and agree to the Dog Sitting Terms');
    await expect(review).not.toContainText('Owner signature');
    await expect(review).toContainText('Not provided');
    expect(await review.evaluate(element => element.scrollWidth <= element.clientWidth)).toBeTruthy();

    if (width === 320 && colorScheme === 'light') {
      await expect.poll(() => page.evaluate(() => sessionStorage.getItem(answerReviewDisclosureKey()))).toBe('1');
      await openIntake(page);
      await succeedPrefill(page);
      await page.evaluate(() => { currentStep = 7; updateWizard(false); });
      await expect(disclosure).toHaveAttribute('open', '');
    }

    await review.getByRole('button', { name: 'Edit Dog information answers' }).click();
    await expect(page.locator('#pageCounter')).toHaveText('2 / 7');
    await expect(page.locator('#dogName')).toBeFocused();
    await page.locator('#dogName').fill('Updated dog');
    await page.evaluate(() => { currentStep = 7; updateWizard(false); });
    await expect(disclosure).toHaveAttribute('open', '');
    await expect(review).toContainText('Updated dog');
    expect(await page.evaluate(() => window.__intakeCalls.filter(call => call.kind === 'submit').length)).toBe(0);
  }
});

test('answer edits preserve a matching signature and clear ink plus consent after a correction', async ({ page }) => {
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await openIntake(page);
    await page.evaluate(() => sessionStorage.removeItem(answerReviewDisclosureKey()));
    await succeedPrefill(page);
    await page.evaluate(() => { currentStep = 7; updateWizard(false); });
    await page.locator('#answerReviewDisclosure summary').click();
    const canvas = page.locator('#signatureCanvas');
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 20, box.y + 20);
    await expect(page.locator('#clearSignature')).toBeEnabled();
    await page.locator('[name="accuracyConfirmed"]').check();
    await page.locator('[name="termsAccepted"]').check();
    await expect(page.locator('#signatureStatus')).toBeEmpty();

    await page.locator('#answerReview').getByRole('button', { name: 'Edit Dog information answers' }).click();
    await expect(page.locator('#pageCounter')).toHaveText('2 / 7');
    await page.evaluate(() => { currentStep = 7; updateWizard(false); });
    expect(await page.evaluate(() => signatureDirty)).toBe(true);
    await expect(page.locator('[name="accuracyConfirmed"]')).toBeChecked();
    await expect(page.locator('[name="termsAccepted"]')).toBeChecked();

    await page.locator('#answerReview').getByRole('button', { name: 'Edit Daily care & handling answers' }).click();
    await page.locator('#additionalInstructions').fill(`This correction changes the signed intake at ${width}px.`);
    const correctionState = await page.evaluate(() => ({ dirty: signatureDirty, original: signatureAnswerFingerprint, current: signatureContentFingerprint(), answer: document.querySelector('#additionalInstructions').value }));
    expect(correctionState.dirty).toBe(false);
    await expect(page.locator('#clearSignature')).toBeDisabled();
    await expect(page.locator('[name="accuracyConfirmed"]')).not.toBeChecked();
    await expect(page.locator('[name="termsAccepted"]')).not.toBeChecked();
    await expect(page.locator('#signatureStatus')).toContainText('Your signature and confirmations were cleared');
    expect(await page.evaluate(() => window.__intakeCalls.filter(call => call.kind === 'submit').length)).toBe(0);

    await page.evaluate(() => { currentStep = 7; updateWizard(false); });
    await page.locator('[name="accuracyConfirmed"]').check();
    await page.locator('[name="termsAccepted"]').check();
    await canvas.click({ position: { x: 30, y: 30 } });
    await page.locator('#signatureName').fill(`Signer correction ${width}px`);
    expect(await page.evaluate(() => signatureDirty)).toBe(false);
    await expect(page.locator('[name="accuracyConfirmed"]')).not.toBeChecked();
    await expect(page.locator('[name="termsAccepted"]')).not.toBeChecked();

    await page.locator('[name="accuracyConfirmed"]').check();
    await page.locator('[name="termsAccepted"]').check();
    await canvas.click({ position: { x: 40, y: 40 } });
    await page.locator('#declarationDate').fill('2026-11-03');
    expect(await page.evaluate(() => signatureDirty)).toBe(false);
    await expect(page.locator('[name="accuracyConfirmed"]')).not.toBeChecked();
    await expect(page.locator('[name="termsAccepted"]')).not.toBeChecked();
  }
});

test('intake diagnostics expose numeric stages and separately measure browser RPC and form rendering', async ({ page }) => {
  await openIntake(page);
  await page.evaluate(() => {
    window.__intakeDiagnosticEvents = [];
    window.addEventListener('waffle:intake-diagnostics', event => window.__intakeDiagnosticEvents.push(event.detail));
  });
  await page.evaluate(() => window.__intakeCalls[0].success({
    status: 'Awaiting Owner',
    booking: { dogName: 'Cino', breed: 'Jack Russell', startDate: '2026-11-01', endDate: '2026-11-11', ownerName: 'Owner One', phone: '0400000000', bookingType: 'Confirmed Boarding' },
    savedAnswers: { additionalInstructions: 'Fixture answer must not enter diagnostics.' },
    diagnostics: { bookingSheetReadCount: 1, bookingSheetReadExclusiveMs: 2, bookingResolutionCount: 1, bookingResolutionInclusiveMs: 4, auditReadCount: 0, auditReadExclusiveMs: 0, auditVerificationCount: 0, auditVerificationInclusiveMs: 0, timezoneLookupCount: 1, timezoneLookupExclusiveMs: 1, token: 'must-not-leak' }
  }));
  const metrics = await page.evaluate(() => window.__intakeDiagnosticEvents[0]);
  expect(metrics.rpcMs).toEqual(expect.any(Number));
  expect(metrics.renderMs).toEqual(expect.any(Number));
  expect(metrics.bookingSheetReadCount).toBe(1);
  expect(metrics.bookingResolutionInclusiveMs).toBe(4);
  expect(metrics.auditReadCount).toBe(0);
  expect(metrics.timezoneLookupCount).toBe(1);
  expect(Object.values(metrics).every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)).toBe(true);
  expect(JSON.stringify(metrics)).not.toContain('must-not-leak');
  expect(JSON.stringify(metrics)).not.toContain('Fixture answer');
});

test('submission rechecks the signed answer snapshot when an autofill change emits no input event', async ({ page }) => {
  await openIntake(page);
  await succeedPrefill(page);
  await page.evaluate(() => { currentStep = 7; updateWizard(false); });
  await page.locator('[name="accuracyConfirmed"]').check();
  await page.locator('[name="termsAccepted"]').check();
  const canvas = page.locator('#signatureCanvas');
  await canvas.scrollIntoViewIfNeeded();
  await canvas.click({ position: { x: 20, y: 20 } });
  expect(await page.evaluate(() => signatureDirty)).toBe(true);

  await page.evaluate(() => {
    document.querySelector('#additionalInstructions').value = 'Silent autofill correction';
    document.querySelector('#intakeForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  expect(await page.evaluate(() => signatureDirty)).toBe(false);
  await expect(page.locator('#clearSignature')).toBeDisabled();
  await expect(page.locator('[name="accuracyConfirmed"]')).not.toBeChecked();
  await expect(page.locator('[name="termsAccepted"]')).not.toBeChecked();
  await expect(page.locator('#signatureStatus')).toContainText('Your signature and confirmations were cleared');
  expect(await page.evaluate(() => window.__intakeCalls.filter(call => call.kind === 'submit').length)).toBe(0);
});
