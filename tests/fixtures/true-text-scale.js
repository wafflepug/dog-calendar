'use strict';

async function resetTrueTextScale(locator) {
  await locator.evaluate(root => {
    const savedStyles = window.__trueTextScaleInlineStyles;
    const previous = savedStyles?.get(root);
    if (previous) for (const { element, value, priority } of previous) {
      if (value) element.style.setProperty('font-size', value, priority);
      else element.style.removeProperty('font-size');
    }
    savedStyles?.delete(root);
  });
}

async function applyTrueTextScale(locator, factor = 2) {
  await resetTrueTextScale(locator);
  return locator.evaluate((root, scale) => {
    const savedStyles = window.__trueTextScaleInlineStyles || (window.__trueTextScaleInlineStyles = new WeakMap());
    const candidates = [root, ...root.querySelectorAll('*')].filter(element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0
        && style.display !== 'none' && style.visibility !== 'hidden'
        && (String(element.innerText || '').trim() || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName));
    });
    const baselines = candidates.map(element => ({
      element,
      size: parseFloat(getComputedStyle(element).fontSize),
      value: element.style.getPropertyValue('font-size'),
      priority: element.style.getPropertyPriority('font-size')
    }));
    for (const { element, size } of baselines) element.style.setProperty('font-size', `${size * scale}px`, 'important');
    savedStyles.set(root, baselines.map(({ element, value, priority }) => ({ element, value, priority })));
    return baselines.length;
  }, factor);
}

module.exports = { applyTrueTextScale, resetTrueTextScale };
