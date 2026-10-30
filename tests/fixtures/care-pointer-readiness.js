async function settlePointerTargetAfterScroll(page, locator) {
  // Compact read views can leave a fully in-viewport target behind the fixed footer.
  // Perform an ordinary native scroll to the centre before real pointer hit-testing.
  // Sample stable geometry after scrolling, not only before the native scroll.
  await locator.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
  const selector = await locator.evaluate(element => {
    const attribute = ['data-profile-subtab', 'data-v11160-tab', 'data-belongings-checklist-summary']
      .find(name => element.hasAttribute(name));
    if (!attribute) throw new Error('Unsupported Care pointer target');
    return `.directory-card.is-profile-active [${attribute}="${CSS.escape(element.getAttribute(attribute))}"]`;
  });
  await page.evaluate(targetSelector => {
    window.__carePointerTargetReadiness ||= Object.create(null);
    window.__carePointerTargetReadiness[targetSelector] = null;
  }, selector);
  try {
    await page.waitForFunction(targetSelector => {
      const target = document.querySelector(targetSelector);
      if (!target?.isConnected) return false;
      const rect = target.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      const hitReady = hit === target || target.contains(hit);
      const visible = rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
      const previous = window.__carePointerTargetReadiness[targetSelector];
      const unchanged = previous &&
        Math.abs(previous.left - rect.left) <= 0.25 &&
        Math.abs(previous.top - rect.top) <= 0.25 &&
        Math.abs(previous.width - rect.width) <= 0.25 &&
        Math.abs(previous.height - rect.height) <= 0.25;
      const stableFrames = visible && hitReady ? (unchanged ? previous.stableFrames + 1 : 1) : 0;
      const sample = { left: rect.left, top: rect.top, width: rect.width, height: rect.height, centerX: x, centerY: y, hitTag: hit?.tagName?.toLowerCase() || null, hitReady, visible, stableFrames };
      window.__carePointerTargetReadiness[targetSelector] = sample;
      if (stableFrames < 3) return false;
      (window.__carePointerTargetReadinessLog ||= []).push({ selector: targetSelector, ...sample });
      return true;
    }, selector, { polling: 'raf', timeout: 10_000 });
  } catch (error) {
    const lastSample = await page.evaluate(targetSelector => window.__carePointerTargetReadiness?.[targetSelector] || null, selector).catch(() => null);
    throw new Error(`Care pointer target did not reach stable, hit-ready geometry: ${JSON.stringify({ selector, lastSample })}. ${error.message}`);
  }
}

module.exports = { settlePointerTargetAfterScroll };
