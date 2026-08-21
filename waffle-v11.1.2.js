/* ============================================================
   WAFFLE HOUSE V11.1.2 — BRAND THEME + REQUEST SOURCE TILES
   ============================================================ */

const V1112_VERSION = '11.1.2';

const V1112_REQUEST_SOURCES = Object.freeze([
  { value: 'MadPaws', label: 'MadPaws', image: "data:image/webp;base64,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" },
  { value: 'Pawshake', label: 'Pawshake', image: "data:image/webp;base64,UklGRj4NAABXRUJQVlA4IDINAADQRgCdASoAAQABPmEwlkekIyIhI7Po2IAMCWNu4WhAfYQPzH9G/Wb2i69/hvJ75Y+Jf7Hy0ea/zh7Xf836m/0R7AHOF8wHmhf6D1J/2f1Dv7r1GvoG+XV7OH9l/9OUTegux3/QdJR7xUKfk/3m/hcJfACdZ2gXezvrNTuKc8LygN4s2hh7AEAokxuBT5Dl8hy+Qf+Xv8IuVPbMU21sytULxcjAdbsjOOBj4K0qn7UJL5Dl8hy+RPbCWVE0rq5npRz5c2pDl8hy+Q5fIi7F1Ws5OuH+Jua7oSCPb5ZKr0EEl59z3JhQUnoFtb8EKQMOWuCS+rbDGXsVxgd2V4IcuTuppyl4qK+auvRkLRb3qCAhsrT1XEUlUsOSlYUlM3EO/i4ViY1I5r0que+OA0O04V6D8yV05cMbd3EwXv1zOfoJKTkR0Cw4ISwDVo9KwCp6/JJdccaraAVZjcBj+W0ZnK++zEFc1BRfOjECJqeasp7BxiAZSPWmBRKC5YQCtSwF3jowXCHuZQmWf7IsJ95sW+HG7CMpUPTN2b03w3XCESyPlfXU+iFaZTpX8KmegmaNrF6L2wVKYv+PSHzdgOTXvlmiB0mNbbMZOxDA6NjDhNABNg2IDGQTuko/wHfPVTaBt7tf2MuxRUDzHnJQGonVavuO+p+9iouhUdiuy8/QMowCwaHBO2YqboYExvnpm11SzEOEwviYXxML4mWuyN8um+XTfLp0Y1DkDY+BsfA2PgcZP4P89uSt/sxf8paEj//5gAD+tWFKI//jMZ0ICV3f/+Tw264s4r9f/XAAAAuQ7w8953AN7mMGKgcitjRqbYHV+mB2ymrBLOE8N5XBWccWYwNF6QjQb9dc9gKXrZF0C/QlZg4q1cblEYKDV/eiG6j2g53u0l/uFAubR6XxmetgkEhk4dPC9NVHmomu07IrIBc5/0+0e1vIJHRkKOizxR/a0nGXzvlqIvlruDCD3jOa+0d8zcEYqTiz/kNz9/WQWK/ZEu2M/ovrl+qj//e6rsOEr0FGJ6+9ThCEEht/e5Oz7ZnG0Swu+q3vm02m+7EMX9coz5Ke8b1V1o7ibVpGj1cwa+Li1JU49/7ZmSxZkRe225EMrgLEsSwtL/luJa+xODK+BFIc6cR/43DkldX4iEMpK4WssyqNLAsj1R3pCmXGzwAV8uhUm8wVBtaHzdkWMp9yfRi4vIhlr42zKnrTtphDBPUnkgFXzQ0lmwFehLyViC7L/nHEswuXVv6PSRG8OpiZFOSFhCxRcLqkULc0z1VjVp40a+kBnSKd5r+qNXt/SUgwo4lbRsHTwfBaHz5785krMPKKIZyjpIc8SvGt0VEqsrnJ9P29IfESSOVQN+Kh11gXqCGOKtED86ZqwpSUDgjpTMSZAmidIwHtsGzFSyiLutanG20M88ITxhQRSacUz+Z/b22TtUniOlsGBbjvIFUlbW+KhadSdTsZElewtL8I2U8XFYG5zAfFyWJSGchjVJ5cG4cOyg94vTI6aEb3cV57mNLq4Ynk9dF6iUTjwQUbEKhvB0aVxFPnKWHV4BDrHfO2bhUY2C3IFixAR5vXi31BD5x/Jyuoh044044kNEO6QqBdZohPCqQcfu103i+cxvnUOUYVVa/hjo7M7UNu5NS5SJLw4SQvZGDRKWxlXRprJZ2sqxUj1GsQpPLHfSu03QZbh5Lbd4oVSVzaUrvH+HS/9dnejlv3rzVTQPidBXmslq/se9xLfmpSnkx3bQuruIBVw5CCl/fYrsc7QEMS98Vtmgp4TzpPhByRPxE9/TZtH2EUSXILB1+rHs62DVo4mgI1NIkh1UEY1mUieIByiNdihFJ0wsmtN1sSb/xss+8XvtTEkiohW/f8K7Z3V43fEkkp7hBZqsjMsUIDL1SGIKO0pXMDuqy+DC8n076GAqX3CGxTLRbKJtvwrMa07cQHoWCcSFDD0MCi1UCueuOwJFyoTtIEinaSpBtqpa94e2fQ+MT8zfL8Go1BC4TIzeFarYj0aNd52lk0E4TtRXAZIakx9Nxo6q4jW1ltRvxpkclxhDBr36f8vDm23Jj5e9C0yKBaj2M0mFyxiptCBdXAgkhe8u2MpuWJuvZdycG/yl54P9NG9Z7tCTZlK1bz5fKo0hzhjw23X33ye/0Plq2lXMPDipi7nWruwncACK1sWx9iTfZ5YuSqV74LBlRGe0kKFrqPDY0BRGcwNtM6iXQpZTvTnVgiWyaeZxWG9soZ4/5jJDCcSgG3q2k2b8pJGtubv4Gz/lFzqIGaBP/Bn4GmALbzBPcax9R7c8YWj/IOGLgI3ObcUSO2JXhHEkU4h8GOCmF8RZUVzecC239qNXL5y/4hRK5v3pIWD7wnzj65gvA9PV0oazuEmfqh6NeMqkCzv7UzJvS9PB6bQ+TgGdE7No9wwhNuYryboQBc2+qEBlSUiGFCOAe4UVojNpvIb5fFNx0YiaLm6QxbQvv/xD94Bo5VXbs4n7o9JAZ8H5vAaz5xzL+d+PfJAVVyYWE/zpyyRStsrrpre/QCoFCefn9ydvmmXS+xxKmJcUx2tjkZhzUU6+CuJmN7Umlvx5JWA116NAjyMbE1PoZHLEmrlwQLqIcnrzeBHi3ALhxh9cd4KCWRzCF2Pg4v0IqhkHh/LhmyblPIB1eDkBHq9pLkZT2qP5kMTJRo3/NZzN35QznmiUUzxPY2crVKLg4Et2GnSg2WDEgaiIzTKozPt4HzAosgVp7+ZpizZNM0/dlSunZR6q0URdW3Zkv9wh1ZtxYLjdUsjWJIPpx7pFUYcuBIp/p/Tnhtl7KotC0xIXjTLb6NFk9pHA6EnF3w4ezbC/RCmhDIj7qpVFVWJKJFSWkZMwS6osyjbvKv1C7dhFQFdvQpVFHHfs9XteUi2NAcsdu379euWLWKb7xSD2PNyH/kydJ9vR4ozPvXyQshXsleUR9LhXOfvGR/psoMwy5uZ/Z04Nj5/zLnoSwSEAVZAoasvA07YwjYqjf77AFqGgssgstotCzN2Pws59jLuVE7Zn5AhQ/LpXsEtSKx5C4cS/KkC0UVjN6whnnIeNsemCWZQeQu+ixGVj2O1URgubWVQoq92xqHcu8rIK+Edc3YNYhidU/qkJ0SfyywKNG9jlPZfOCBNPkXEbFSnvIin9hny4RKoy1VdsE/J/53SD/PcKeZEhpPcQs1eJ5gAJgnx1XmBipAUIodQOjCyLrKIibGso/XGJpuDubKXjsqEzzyPKM+CxyXUuYuv8liv0qjc5y0EZWCEnzonQtmfoZGRJRphCg8OFH1DqAKSso2WH0yp4IC1PareamkCJTEcTquz8BFTko6gjdL2T3W+7g7X+XaBtN0lHPi6EBro2b7W4t5+C/R+FsAD7zo9Z3sYVS7jyoY+nUwFx81LmsVF6TBkqJkKe+ZTdwAmcMbRmegGrQh3t/gzTAM7PxJDUhV6AeSmpY+ncrqTCpfoHBPySdJZ2LjsYl7nx/5ULR9m3ANNwmR2EJjjophguJzP81Mk1w1jkMSvk2IcJUqDgz8yuJFun37vdwNM2Vb2iBLorRC2PfiCYATxtEpZD8ZdPDPbesgX/UrlGnh/c0UgQffh6VcFYw/KCrb5QrdVxzP9rskRw5P1OJlzHoDHkr74M0cIEjwEM837VogQWtxAa+TsZ4kOs8Trk9u6LOhG12kXfD6UR0272gEUN47LyAxncC72aC1RH6uOz15aw3P9qq0bCTkQuI0r4iO0xsRCSnAjlBDDZK5Ugd69b+fKs8wh/sFdwz4waFl3WS+rYzXI4G69ySydjQCm6sYkwmfLCW1nIWO5ymxmUxAtAQ7GZ+pBdgaPc8Tojei7QkgoOrzjLkaLJx0hfiiBaz5M7/rJPYJRga3e3dL/YlwO+ComwSImCci4WNsz3pnrcSrMmOhcx9XIxfy/VW8pkFJJ0FZ5TR0M2VIxiHIHToLk5XtRGZldIBHw2/yeQVrZcO0tNRpuKJYOBXMqky+U0GArKOhyYEmSYibuwG9hzSuGbLRcL33VfaSxcKT7giBgVIPmgdReuHK0p/ai31aHrSfbU8unqLLB0sNuoF/gJylGPFchrRGGuQR8k5xhJpaTSwvHAZY+raHEubcekuii1H9AvNJdzG8PeYECySxM0+D4FUGt6+vnpcw11T90TeP1NbO2KoDlWbNJ9/WOTt8K7H+r+CnEt3vib8aKx6RWzz2WILTYvPN1njdH6PFhVIc4pWHCUpB1jr5YZhjKwL3LzAmP6s925nVtTVkD3E6vBTpSwZalMCW2Rzw/2eHoD3VjbdJyMNeZMqvm4dRD2WpMOl0C18x94NUB/2qpYRGi0v9Ia3/uiAAG/baijM8CIkBDa8EHprIsQBkBJVDkw7NXHjIaaQ45wsjT0sJNj7OXqRvWYv0elQWek92sRe5Fi1flwJl7gV7nGQAAAAAg5vg/z9NI3tCpEruLHKZrDZ+6T9bFy+9IF94Q+fjZQhTTxX1a8YL1eDih12j2MpYRMy8pF6/Zh5PUoWQAAA=" },
  { value: 'Facebook', label: 'Facebook', image: "data:image/webp;base64,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" }
]);

function v1112SourceTilesHtml(selected = '') {
  return V1112_REQUEST_SOURCES.map(source => `
    <button type="button"
      class="v1112-source-tile${source.value === selected ? ' is-selected' : ''}"
      data-v1112-source-value="${source.value}"
      aria-pressed="${source.value === selected ? 'true' : 'false'}">
      <span class="v1112-source-circle">
        <img src="${source.image}" alt="" />
        <span>${source.label}</span>
      </span>
    </button>`).join('');
}

function v1112EnhanceSourceSelect(select) {
  if (!select || select.dataset.v1112Enhanced === 'true') return;
  select.dataset.v1112Enhanced = 'true';
  select.classList.add('v1112-source-native');

  const wrapper = document.createElement('div');
  wrapper.className = 'v1112-source-picker';
  wrapper.setAttribute('role', 'group');
  wrapper.setAttribute('aria-label', 'Request From');
  wrapper.innerHTML = `<span class="v1112-source-title">Request From</span>
    <div class="v1112-source-grid">${v1112SourceTilesHtml(String(select.value || ''))}</div>`;

  select.insertAdjacentElement('afterend', wrapper);

  wrapper.addEventListener('click', event => {
    const button = event.target.closest('[data-v1112-source-value]');
    if (!button) return;
    select.value = String(button.dataset.v1112SourceValue || '');
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    wrapper.querySelectorAll('[data-v1112-source-value]').forEach(other => {
      const active = other === button;
      other.classList.toggle('is-selected', active);
      other.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  });
}

function v1112CandidateSourceSelects(root = document) {
  const selectors = [
    '#potRequestSource',
    '[data-v111-request-source="boarding"]',
    '[data-request-source]',
    'select[name*="requestSource" i]',
    'select[id*="requestSource" i]'
  ];
  const found = new Set();
  selectors.forEach(selector => {
    try { root.querySelectorAll(selector).forEach(node => found.add(node)); } catch (_) {}
  });
  root.querySelectorAll?.('label').forEach(label => {
    if (!/request\s+(came\s+)?from/i.test(label.textContent || '')) return;
    const select = label.querySelector('select');
    if (select) found.add(select);
  });
  return Array.from(found);
}

function v1112EnsureMeetGreetSource(root = document) {
  root.querySelectorAll?.('[role="dialog"], .modal, .v108-modal, form').forEach(container => {
    const text = String(container.textContent || '');
    if (!/meet\s*&\s*greet|meet\s+and\s+greet/i.test(text)) return;
    if (container.querySelector('.v1112-source-picker, [data-v1112-meet-source]')) return;

    const select = document.createElement('select');
    select.setAttribute('data-v1112-meet-source', 'true');
    select.setAttribute('data-request-source', 'meet-greet');
    select.setAttribute('aria-label', 'Request From');
    select.innerHTML = '<option value="">Select source...</option>' +
      V1112_REQUEST_SOURCES.map(source => `<option value="${source.value}">${source.label}</option>`).join('');

    const field = document.createElement('div');
    field.className = 'v1112-meet-source-field';
    field.appendChild(select);

    const footer = container.querySelector('.modal-actions, .v108-modal-actions, [class*="actions"]');
    const textarea = container.querySelector('textarea');
    if (footer?.parentElement) footer.parentElement.insertBefore(field, footer);
    else if (textarea?.parentElement) textarea.parentElement.insertAdjacentElement('afterend', field);
    else container.appendChild(field);

    v1112EnhanceSourceSelect(select);
  });
}

function v1112RemoveScheduledVisitLegend(root = document) {
  root.querySelectorAll?.('span, small, div, p, li').forEach(node => {
    if (node.children.length) return;
    const text = String(node.textContent || '').trim().toLowerCase();
    if (text === 'teal = scheduled visit' || text === 'teal = scheduled\nvisit') node.remove();
  });
}

function v1112EnhanceUi(root = document) {
  v1112CandidateSourceSelects(root).forEach(v1112EnhanceSourceSelect);
  v1112EnsureMeetGreetSource(root);
  v1112RemoveScheduledVisitLegend(root);
}

function v1112ActiveRequestSource() {
  const pickers = Array.from(document.querySelectorAll('.v1112-source-picker'));
  for (let i = pickers.length - 1; i >= 0; i -= 1) {
    const picker = pickers[i];
    const container = picker.closest('[role="dialog"], .modal, .v108-modal, form') || picker.parentElement;
    if (container && (container.hidden || getComputedStyle(container).display === 'none')) continue;
    const native = picker.previousElementSibling;
    if (native?.tagName === 'SELECT' && native.value) return String(native.value);
  }
  return '';
}

function v1112WireRequestSourcePayload() {
  if (typeof sendPayloadToAppsScript !== 'function' || sendPayloadToAppsScript.v1112Wrapped) return;
  const base = sendPayloadToAppsScript;
  const wrapped = function(payload) {
    const prepared = { ...(payload || {}) };
    const action = String(prepared.action || '');
    const source = v1112ActiveRequestSource();
    if (source && /boarding|potential|meet|greet/i.test(action)) prepared.requestSource = source;
    return base(prepared);
  };
  wrapped.v1112Wrapped = true;
  sendPayloadToAppsScript = wrapped;
}

function v1112NormaliseInstallButton() {
  const button = document.getElementById('waffleInstallButton') || document.querySelector('.waffle-install-button');
  if (!button) return;
  button.setAttribute('aria-label', 'Install Waffle House');
  button.setAttribute('title', 'Install Waffle House');
}

function v1112Start() {
  v1112EnhanceUi(document);
  v1112WireRequestSourcePayload();
  v1112NormaliseInstallButton();

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
      if (node.nodeType === 1) v1112EnhanceUi(node);
    }));
    v1112WireRequestSourcePayload();
    v1112NormaliseInstallButton();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', v1112Start, { once: true });
} else {
  v1112Start();
}
