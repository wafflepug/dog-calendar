/* ============================================================
   WAFFLE HOUSE V11.1.47 — ORGANIC CONVERSATIONAL ASK WAFFLE
   ============================================================
   Replaces command/regex-first interaction with a server-side tool-using AI.
   The existing structured assistant remains available only as a fallback when
   the AI backend is unavailable, unconfigured, or the device is offline.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.47';
  const HISTORY_KEY = 'waffleAiConversationV11147';
  const MAX_HISTORY_TURNS = 4;
  const MAX_HISTORY_CHARS = 600;
  const MAX_QUESTION_CHARS = 1400;
  const APPS_SCRIPT_WEBAPP_URL =
    'https://script.google.com/macros/s/AKfycbwn4HL49K9c3AZbXJRUjPw3UYWxJt8DmqXwMnTytyqdSstj3ZIJwWdDEC2IsBjetOf3pw/exec';

  let structuredFallback = null;
  let wiringTimer = 0;

  function pageName() {
    return String(
      window.WAFFLE_PAGE ||
      document.body?.dataset?.wafflePage ||
      'calendar'
    );
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function assets() {
    return window.WAFFLE_AI_ASSETS || {};
  }

  function history() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(item => item && (item.role === 'user' || item.role === 'assistant'))
        .map(item => ({
          role: item.role,
          content: String(item.content || '').slice(0, MAX_HISTORY_CHARS)
        }))
        .filter(item => item.content.trim())
        .slice(-MAX_HISTORY_TURNS);
    } catch (_) {
      return [];
    }
  }

  function saveTurn(role, content) {
    const rows = history();
    rows.push({ role, content: String(content || '').slice(0, MAX_HISTORY_CHARS) });
    try {
      sessionStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(rows.slice(-MAX_HISTORY_TURNS))
      );
    } catch (_) {}
  }

  function clearConversation() {
    try { sessionStorage.removeItem(HISTORY_KEY); } catch (_) {}
  }

  function modal() {
    return document.getElementById('v11133AskWaffleModal');
  }

  function thread() {
    return modal()?.querySelector('.aw37-thread,.v11133-thread') || null;
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
    row.className = 'aw37-msg user v11147-ai-user';
    row.innerHTML = `<div class="aw37-bubble">${escapeHtml(question)}</div>`;
    host.appendChild(row);
    host.scrollTop = host.scrollHeight;
    return row;
  }

  function appendThinking() {
    const host = thread();
    if (!host) return null;

    settleFaces(host);
    const a = assets();
    const row = document.createElement('div');
    row.className = 'aw37-msg bot v11147-ai-thinking';
    row.innerHTML =
      `<div class="aw37-bubble"><span class="v11147-thinking-dots" aria-label="Waffle is thinking">Thinking<span>…</span></span></div>` +
      `<img class="aw37-face latest" src="${escapeHtml(a.open || '')}" alt="">`;
    host.appendChild(row);
    host.scrollTop = host.scrollHeight;
    return row;
  }

  function appendAnswer(answer, toolsUsed) {
    const host = thread();
    if (!host) return null;

    settleFaces(host);
    const a = assets();
    const row = document.createElement('div');
    row.className = 'aw37-msg bot v11147-ai-answer';

    const toolNote = Array.isArray(toolsUsed) && toolsUsed.length
      ? `<small class="v11147-ai-source">Checked live Waffle data</small>`
      : `<small class="v11147-ai-source">Waffle AI</small>`;

    row.innerHTML =
      `<div class="aw37-bubble v11147-ai-bubble">${escapeHtml(answer)}</div>` +
      toolNote +
      `<img class="aw37-face latest" src="${escapeHtml(a.open || '')}" alt="">`;

    host.appendChild(row);
    host.scrollTop = host.scrollHeight;
    return row;
  }

  function setBusy(busy) {
    const m = modal();
    const form = m?.querySelector('.aw37-form');
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
      if (!APPS_SCRIPT_WEBAPP_URL) {
        reject(new Error('Waffle AI backend URL is not configured.'));
        return;
      }

      const callback =
        '__waffleAi47_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
      const script = document.createElement('script');
      let finished = false;

      const cleanup = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        script.remove();
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
      };

      window[callback] = response => {
        cleanup();
        resolve(response);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error('Could not reach the Waffle AI backend.'));
      };

      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error('Waffle AI took too long to respond.'));
      }, timeoutMs);

      const separator = APPS_SCRIPT_WEBAPP_URL.includes('?') ? '&' : '?';
      script.src =
        APPS_SCRIPT_WEBAPP_URL + separator +
        'callback=' + encodeURIComponent(callback) +
        '&payload=' + encodeURIComponent(JSON.stringify(payload)) +
        '&_ts=' + Date.now();
      script.async = true;
      document.head.appendChild(script);
    });
  }

  async function ask(question) {
    const q = String(question || '').trim().slice(0, MAX_QUESTION_CHARS);
    if (!q) return;

    const previousHistory = history();
    const userRow = appendUser(q);
    const thinkingRow = appendThinking();
    setBusy(true);

    try {
      if (navigator.onLine === false) {
        throw new Error('offline');
      }

      const response = await jsonp({
        action: 'ask_waffle_ai',
        question: q,
        history: previousHistory,
        page: pageName()
      });

      if (response?.result === 'success' && response?.answer) {
        thinkingRow?.remove();
        const answer = String(response.answer).trim();
        appendAnswer(answer, response.toolsUsed);
        saveTurn('user', q);
        saveTurn('assistant', answer);
        return;
      }

      const error = String(response?.error || 'Waffle AI is unavailable.');
      throw new Error(error);

    } catch (error) {
      /* Preserve the dependable local intent assistant as a graceful fallback.
         Remove our pending rows first because the legacy assistant renders its
         own user turn and answer. */
      thinkingRow?.remove();
      userRow?.remove();

      if (typeof structuredFallback === 'function') {
        structuredFallback(q);
      } else {
        appendUser(q);
        appendAnswer(
          navigator.onLine === false
            ? 'I’m offline right now. I can answer once the Waffle app is back online.'
            : 'I could not reach Waffle AI just now. Please try again.',
          []
        );
      }

      console.warn('Conversational Waffle AI fallback:', error);

    } finally {
      setBusy(false);
      modal()?.querySelector('.aw37-form input')?.focus();
    }
  }

  function ensureStyle() {
    if (document.getElementById('v11147WaffleAiStyle')) return;

    const style = document.createElement('style');
    style.id = 'v11147WaffleAiStyle';
    style.textContent = `
      #v11133AskWaffleModal .v11147-ai-bubble {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }

      #v11133AskWaffleModal .v11147-ai-source {
        align-self: flex-start;
        margin: -4px 0 3px 46px;
        color: var(--wh-muted, #64748b);
        font-size: 9px;
        font-weight: 700;
      }

      #v11133AskWaffleModal .v11147-thinking-dots span {
        display: inline-block;
        animation: v11147Pulse 1s ease-in-out infinite alternate;
      }

      #v11133AskWaffleModal .aw37-form button:disabled,
      #v11133AskWaffleModal .aw37-form input:disabled {
        opacity: .68;
        cursor: wait;
      }

      @keyframes v11147Pulse {
        from { opacity: .35; transform: translateY(0); }
        to { opacity: 1; transform: translateY(-1px); }
      }
    `;
    document.head.appendChild(style);
  }

  function updateCopy(m) {
    const subtitle = m.querySelector('.aw37-brand p');
    if (subtitle) subtitle.textContent = 'Ask naturally about anything across Waffle House';

    const small = m.querySelector('.aw37-brand small');
    if (small) small.textContent = 'WAFFLE AI';

    const input = m.querySelector('.aw37-form input');
    if (input) input.placeholder = 'Ask Waffle anything…';

    const footer = m.querySelector('.aw37-foot');
    if (footer) footer.textContent = 'AI answers · live Waffle House data when needed';

    const promptButtons = Array.from(m.querySelectorAll('.aw37-prompts [data-q]'));
    const prompts = [
      ['What needs my attention today?', 'What needs attention?'],
      ['Can I fit another dog next weekend?', 'Next weekend'],
      ['Anything important about the dogs here now?', 'Dogs here now'],
      ['What changed recently?', 'Recent changes']
    ];

    promptButtons.forEach((button, index) => {
      if (!prompts[index]) return;
      button.dataset.q = prompts[index][0];
      button.textContent = prompts[index][1];
    });
  }

  function wireModal() {
    const m = modal();
    if (!m) return false;

    ensureStyle();

    if (!structuredFallback && typeof window.v11137AskWaffle === 'function' &&
        window.v11137AskWaffle !== ask) {
      structuredFallback = window.v11137AskWaffle;
      window.v11147StructuredFallback = structuredFallback;
    }

    updateCopy(m);

    const form = m.querySelector('.aw37-form');
    if (form && form.dataset.v11147Ai !== 'true') {
      form.dataset.v11147Ai = 'true';
      form.onsubmit = event => {
        event.preventDefault();
        const input = form.querySelector('input');
        const q = String(input?.value || '').trim();
        if (!q) return;
        input.value = '';
        ask(q);
      };
    }

    if (m.dataset.v11147Ai !== 'true') {
      m.dataset.v11147Ai = 'true';
      m.onclick = event => {
        if (event.target === m) {
          m.hidden = true;
          return;
        }

        if (event.target.closest?.('.aw37-close')) {
          m.hidden = true;
          return;
        }

        const prompt = event.target.closest?.('[data-q]');
        if (prompt) {
          event.preventDefault();
          ask(prompt.dataset.q);
        }
      };
    }

    window.v11137AskWaffle = ask;
    return true;
  }

  function queueWire() {
    if (wiringTimer) return;
    wiringTimer = window.setTimeout(() => {
      wiringTimer = 0;
      wireModal();
    }, 20);
  }

  function start() {
    ensureStyle();
    wireModal();

    [80, 200, 500, 1000, 2200, 5000].forEach(delay => setTimeout(wireModal, delay));

    if (document.body && typeof MutationObserver === 'function') {
      const observer = new MutationObserver(mutations => {
        const relevant = mutations.some(mutation =>
          Array.from(mutation.addedNodes || []).some(node =>
            node instanceof Element &&
            (node.id === 'v11133AskWaffleModal' || !!node.querySelector?.('#v11133AskWaffleModal'))
          )
        );
        if (relevant) queueWire();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    window.addEventListener('pageshow', wireModal);
    window.addEventListener('focus', wireModal);

    window.v11147WaffleAiAsk = ask;
    window.v11147WaffleAiClearConversation = clearConversation;
    window.v11147WaffleAiVersion = VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
