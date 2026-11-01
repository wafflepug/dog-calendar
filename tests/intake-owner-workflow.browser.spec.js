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
