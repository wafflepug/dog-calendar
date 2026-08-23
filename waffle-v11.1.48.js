/* ============================================================
   WAFFLE HOUSE V11.1.48 — RELIABLE ORGANIC WAFFLE AI
   ============================================================
   - Online AI/backend failures are visible; they never masquerade as a legacy
     regex answer.
   - Legacy structured fallback is used only when the device is genuinely
     offline.
   - The live Apps Script health route is checked before AI requests.
   - Provider/model/failover state is surfaced in the modal footer.
   - Submit capture runs at window level so older V11.1.38 profile interception
     cannot take ownership of conversational questions.
   - Thinking state uses the user-provided Waffle Thinking artwork.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.48';
  const HISTORY_KEY = 'waffleAiConversationV11147';
  const MAX_HISTORY_TURNS = 4;
  const MAX_HISTORY_CHARS = 600;
  const MAX_QUESTION_CHARS = 1400;
  const HEALTH_MAX_AGE = 60 * 1000;
  const APPS_SCRIPT_WEBAPP_URL =
    'https://script.google.com/macros/s/AKfycbwn4HL49K9c3AZbXJRUjPw3UYWxJt8DmqXwMnTytyqdSstj3ZIJwWdDEC2IsBjetOf3pw/exec';

  /* User-supplied Waffle Thinking artwork, resized for UI delivery while
     preserving the original transparent illustration. */
  const THINKING_ICON = 'data:image/webp;base64,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';

  let healthCache = null;
  let healthFetchedAt = 0;
  let structuredFallback = null;
  let copyFrame = 0;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function modal() {
    return document.getElementById('v11133AskWaffleModal');
  }

  function thread() {
    return modal()?.querySelector('.aw37-thread,.v11133-thread') || null;
  }

  function assets() {
    return window.WAFFLE_AI_ASSETS || {};
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function history() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(item => item && (item.role === 'user' || item.role === 'assistant'))
        .map(item => ({ role: item.role, content: String(item.content || '').slice(0, MAX_HISTORY_CHARS) }))
        .filter(item => item.content.trim())
        .slice(-MAX_HISTORY_TURNS);
    } catch (_) {
      return [];
    }
  }

  function saveTurn(role, content) {
    const rows = history();
    rows.push({ role, content: String(content || '').slice(0, MAX_HISTORY_CHARS) });
    try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(rows.slice(-MAX_HISTORY_TURNS))); } catch (_) {}
  }

  function clearConversation() {
    try { sessionStorage.removeItem(HISTORY_KEY); } catch (_) {}
  }

  function settleFaces(host) {
    const a = assets();
    host?.querySelectorAll('.aw37-face').forEach(image => {
      if (a.closed) image.src = a.closed;
      image.classList.remove('latest');
    });
  }

  function appendUser(question) {
    const host = thread();
    if (!host) return null;
    const row = document.createElement('div');
    row.className = 'aw37-msg user v11148-ai-user';
    row.innerHTML = `<div class="aw37-bubble">${escapeHtml(question)}</div>`;
    host.appendChild(row);
    host.scrollTop = host.scrollHeight;
    return row;
  }

  function appendThinking() {
    const host = thread();
    if (!host) return null;
    settleFaces(host);
    const row = document.createElement('div');
    row.className = 'aw37-msg bot v11148-ai-thinking';
    row.innerHTML =
      `<img class="aw37-face latest v11148-thinking-face" src="${THINKING_ICON}" alt="Waffle thinking">` +
      `<div class="aw37-bubble"><span class="v11148-thinking-dots">Thinking<span>…</span></span></div>`;
    host.appendChild(row);
    host.scrollTop = host.scrollHeight;
    return row;
  }

  function appendAnswer(answer, response = {}) {
    const host = thread();
    if (!host) return null;
    settleFaces(host);
    const a = assets();
    const row = document.createElement('div');
    row.className = 'aw37-msg bot v11148-ai-answer';

    let source = 'Waffle AI';
    if (Array.isArray(response.toolsUsed) && response.toolsUsed.length) source = 'Checked live Waffle data';
    if (response.failoverFrom && response.provider) {
      source += ` · ${String(response.provider).toUpperCase()} failover`;
    } else if (response.provider) {
      source += ` · ${String(response.provider).toUpperCase()}`;
    }

    row.innerHTML =
      `<img class="aw37-face latest" src="${escapeHtml(a.open || '')}" alt="Waffle">` +
      `<div class="aw37-bubble v11148-ai-bubble">${escapeHtml(answer)}<small class="v11148-ai-source">${escapeHtml(source)}</small></div>`;
    host.appendChild(row);
    host.scrollTop = host.scrollHeight;
    return row;
  }

  function appendError(message, diagnostics = []) {
    const host = thread();
    if (!host) return null;
    settleFaces(host);
    const a = assets();
    const cleanDiagnostics = Array.isArray(diagnostics)
      ? diagnostics
          .filter(item => item && item.provider && item.error)
          .slice(0, 3)
          .map(item => `${String(item.provider).toUpperCase()}: ${String(item.error)}`)
      : [];
    const details = cleanDiagnostics.length
      ? `<small class="v11148-ai-error-detail">${cleanDiagnostics.map(escapeHtml).join('<br>')}</small>`
      : '';
    const row = document.createElement('div');
    row.className = 'aw37-msg bot v11148-ai-error';
    row.innerHTML =
      `<img class="aw37-face latest" src="${escapeHtml(a.closed || a.open || '')}" alt="Waffle">` +
      `<div class="aw37-bubble v11148-error-bubble"><b>Waffle AI couldn’t complete that request.</b><br>${escapeHtml(message)}${details}</div>`;
    host.appendChild(row);
    host.scrollTop = host.scrollHeight;
    return row;
  }

  function setBusy(busy) {
    const form = modal()?.querySelector('.aw37-form');
    if (!form) return;
    const input = form.querySelector('input');
    const button = form.querySelector('button');
    if (input) input.disabled = !!busy;
    if (button) {
      button.disabled = !!busy;
      button.textContent = busy ? 'Thinking…' : 'Send';
    }
  }

  function jsonp(payload, timeoutMs = 65000) {
    return new Promise((resolve, reject) => {
      const callback = '__waffleAi48_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
      const script = document.createElement('script');
      let finished = false;
      const cleanup = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        script.remove();
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
      };
      window[callback] = response => { cleanup(); resolve(response); };
      script.onerror = () => { cleanup(); reject(new Error('Could not reach the live Waffle Apps Script endpoint.')); };
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error('The live Waffle Apps Script endpoint did not respond in time.'));
      }, timeoutMs);
      script.src = APPS_SCRIPT_WEBAPP_URL +
        '?callback=' + encodeURIComponent(callback) +
        '&payload=' + encodeURIComponent(JSON.stringify(payload)) +
        '&_ts=' + Date.now();
      script.async = true;
      document.head.appendChild(script);
    });
  }

  async function getHealth(force = false) {
    if (!force && healthCache && Date.now() - healthFetchedAt < HEALTH_MAX_AGE) return healthCache;
    try {
      const response = await jsonp({ action: 'waffle_ai_health' }, 15000);
      if (response?.result !== 'success' || response?.action !== 'waffle_ai_health') {
        throw new Error(String(response?.error || 'The live backend does not expose the Waffle AI health route.'));
      }
      healthCache = { ...response, routeReady: response.routeReady !== false };
    } catch (error) {
      healthCache = {
        result: 'error',
        routeReady: false,
        configured: false,
        error: String(error?.message || error || 'Waffle AI health check failed.')
      };
    }
    healthFetchedAt = Date.now();
    updateCopy();
    return healthCache;
  }

  function footerText() {
    if (navigator.onLine === false) return 'Offline · legacy local assistant available';
    if (!healthCache) return 'Waffle AI · checking live backend…';
    if (!healthCache.routeReady) return 'Waffle AI backend status unavailable';
    if (!healthCache.configured) return 'Waffle AI backend live · AI provider not configured';

    const provider = String(healthCache.preferredProvider || healthCache.provider || 'AI').toUpperCase();
    const failover = healthCache.failoverAvailable ? ' + failover ready' : '';
    return `Waffle AI · ${provider}${failover} · live Waffle House data`;
  }

  function updateCopy() {
    const m = modal();
    if (!m) return;
    const eyebrow = m.querySelector('.aw37-brand small');
    const title = m.querySelector('.aw37-brand h3');
    const subtitle = m.querySelector('.aw37-brand p');
    const input = m.querySelector('.aw37-form input');
    const footer = m.querySelector('.aw37-foot');

    if (eyebrow && eyebrow.textContent !== 'WAFFLE AI') eyebrow.textContent = 'WAFFLE AI';
    if (title && title.textContent !== 'Ask Waffle') title.textContent = 'Ask Waffle';
    if (subtitle && subtitle.textContent !== 'Ask naturally about anything across Waffle House') {
      subtitle.textContent = 'Ask naturally about anything across Waffle House';
    }
    if (input && input.placeholder !== 'Ask Waffle anything…') input.placeholder = 'Ask Waffle anything…';
    const foot = footerText();
    if (footer && footer.textContent !== foot) footer.textContent = foot;

    const promptButtons = Array.from(m.querySelectorAll('.aw37-prompts [data-q]'));
    const prompts = [
      ['What needs my attention today?', 'What needs attention?'],
      ['Can I fit another dog next weekend?', 'Next weekend'],
      ['Anything important about the dogs here now?', 'Dogs here now'],
      ['What changed recently?', 'Recent changes']
    ];
    promptButtons.forEach((button, index) => {
      if (!prompts[index]) return;
      if (button.dataset.q !== prompts[index][0]) button.dataset.q = prompts[index][0];
      if (button.textContent !== prompts[index][1]) button.textContent = prompts[index][1];
    });
  }

  function configurationError(health) {
    if (!health?.routeReady) {
      return health?.error || 'The live Apps Script deployment does not expose the current Waffle AI route yet.';
    }
    if (!health?.configured) {
      return 'The Waffle AI backend is live, but no AI provider is configured. Add GEMINI_API_KEY or OPENAI_API_KEY in Apps Script Script Properties.';
    }
    return '';
  }

  async function ask(question) {
    const q = String(question || '').trim().slice(0, MAX_QUESTION_CHARS);
    if (!q) return;

    if (navigator.onLine === false) {
      if (typeof structuredFallback === 'function') {
        structuredFallback(q);
      } else {
        appendUser(q);
        appendError('This device is offline. Reconnect to use conversational Waffle AI.');
      }
      return;
    }

    const previousHistory = history();
    appendUser(q);
    const thinkingRow = appendThinking();
    setBusy(true);

    try {
      const health = await getHealth(false);
      const configProblem = configurationError(health);
      if (configProblem) {
        thinkingRow?.remove();
        appendError(configProblem);
        return;
      }

      const response = await jsonp({
        action: 'ask_waffle_ai',
        question: q,
        history: previousHistory,
        page: pageName()
      });

      thinkingRow?.remove();

      if (response?.result === 'success' && response?.answer) {
        const answer = String(response.answer).trim();
        appendAnswer(answer, response);
        saveTurn('user', q);
        saveTurn('assistant', answer);
        return;
      }

      appendError(
        String(response?.error || 'The Waffle AI backend returned an unsuccessful response.'),
        response?.providerErrors
      );
      console.warn('Waffle AI online request failed:', response);
    } catch (error) {
      thinkingRow?.remove();
      appendError(String(error?.message || error || 'Waffle AI could not reach its backend.'));
      healthCache = null;
      healthFetchedAt = 0;
      console.warn('Waffle AI online request failed:', error);
    } finally {
      setBusy(false);
      modal()?.querySelector('.aw37-form input')?.focus();
      updateCopy();
    }
  }

  function ensureStyle() {
    if (document.getElementById('v11148WaffleAiStyle')) return;
    const style = document.createElement('style');
    style.id = 'v11148WaffleAiStyle';
    style.textContent = `
      #v11133AskWaffleModal .v11148-ai-bubble,
      #v11133AskWaffleModal .v11148-error-bubble { white-space: pre-wrap; overflow-wrap: anywhere; }
      #v11133AskWaffleModal .v11148-ai-source,
      #v11133AskWaffleModal .v11148-ai-error-detail {
        display:block; margin-top:7px; color:var(--wh-text-muted,#64748b); font-size:8px; font-weight:750;
      }
      #v11133AskWaffleModal .v11148-error-bubble {
        border-color:color-mix(in srgb,#e85d5d 42%,var(--wh-border,#d9e2ec));
      }
      #v11133AskWaffleModal .v11148-thinking-face {
        object-fit:contain !important;
        filter:none !important;
      }
      #v11133AskWaffleModal .v11148-thinking-dots span {
        display:inline-block; animation:v11148Pulse .9s ease-in-out infinite alternate;
      }
      @keyframes v11148Pulse { from{opacity:.3;transform:translateY(0)} to{opacity:1;transform:translateY(-1px)} }
    `;
    document.head.appendChild(style);
  }

  function interceptSubmit(event) {
    const target = event.target instanceof Element ? event.target : null;
    const form = target?.closest?.('#v11133AskWaffleModal .aw37-form');
    if (!form) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const input = form.querySelector('input');
    const q = String(input?.value || '').trim();
    if (!q) return;
    if (input) input.value = '';
    ask(q);
  }

  function interceptClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const prompt = target.closest?.('#v11133AskWaffleModal [data-q]');
    if (prompt) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      ask(prompt.dataset.q);
      return;
    }

    if (target.closest?.('#aw37launch')) {
      window.setTimeout(() => {
        updateCopy();
        getHealth(false);
      }, 0);
    }
  }

  function queueCopy() {
    if (copyFrame) return;
    copyFrame = requestAnimationFrame(() => {
      copyFrame = 0;
      updateCopy();
    });
  }

  function wireModal() {
    const m = modal();
    if (!m) return false;
    ensureStyle();
    updateCopy();

    if (!structuredFallback) {
      structuredFallback = window.v11147StructuredFallback || null;
    }

    if (m.dataset.v11148Observed !== 'true' && typeof MutationObserver === 'function') {
      m.dataset.v11148Observed = 'true';
      const observer = new MutationObserver(queueCopy);
      observer.observe(m, { childList: true, subtree: true, characterData: true });
    }

    window.v11137AskWaffle = ask;
    return true;
  }

  function start() {
    ensureStyle();

    /* Window capture executes before V11.1.38's document capture listener, so
       conversational Waffle AI is the authoritative submit path. */
    window.addEventListener('submit', interceptSubmit, true);
    window.addEventListener('click', interceptClick, true);

    wireModal();
    [60,180,420,900,1800,3600,5400,7600].forEach(delay => setTimeout(wireModal, delay));
    window.addEventListener('pageshow', () => { wireModal(); getHealth(false); });
    window.addEventListener('focus', () => { wireModal(); getHealth(false); });

    window.v11148WaffleAiAsk = ask;
    window.v11148WaffleAiHealth = getHealth;
    window.v11148WaffleAiClearConversation = clearConversation;
    window.v11148WaffleAiVersion = VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
