/* ============================================================
   WAFFLE HOUSE V11.1.58 — ASK WAFFLE SPEECH TO TEXT
   Browser speech recognition only; no paid transcription service.
   Transcript remains editable and is never auto-submitted.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.58';
  const LISTENING_ICON = 'data:image/webp;base64,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';
  const PLACEHOLDER = 'Ask Waffle anything...';

  let recognition = null;
  let listening = false;
  let activeModal = null;
  let baseText = '';
  let heardText = '';
  let errorCode = '';

  function SpeechCtor() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function modal() {
    return document.getElementById('v11133AskWaffleModal');
  }

  function form(m) {
    return m?.querySelector('.aw37-form') || null;
  }

  function input(m) {
    return form(m)?.querySelector('input') || null;
  }

  function tidy(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function joined(a, b) {
    return tidy([tidy(a), tidy(b)].filter(Boolean).join(' '));
  }

  function ensureStyle() {
    if (document.getElementById('aw58SpeechStyle')) return;
    const style = document.createElement('style');
    style.id = 'aw58SpeechStyle';
    style.textContent = `
      #v11133AskWaffleModal .aw37-form {
        grid-template-columns:minmax(0,1fr) 44px auto !important;
      }
      #v11133AskWaffleModal .aw37-form input { order:0; }
      #v11133AskWaffleModal .aw37-form>button:not(.aw58-mic) { order:2; }
      #v11133AskWaffleModal .aw58-mic {
        order:1;width:44px!important;min-width:44px!important;max-width:44px!important;
        padding:0!important;display:inline-flex!important;align-items:center;justify-content:center;
        border:1px solid var(--wh-border,#d9e2ec)!important;border-radius:13px!important;
        background:var(--wh-surface-soft,#f8fafc)!important;color:var(--wh-text,#111827)!important;
        cursor:pointer;font-size:18px;line-height:1;
      }
      #v11133AskWaffleModal .aw58-mic:focus-visible { outline:2px solid var(--wh-accent,#0f6292);outline-offset:2px; }
      #v11133AskWaffleModal .aw58-mic.is-listening {
        border-color:var(--wh-accent,#0f6292)!important;
        background:color-mix(in srgb,var(--wh-accent,#0f6292) 16%,var(--wh-surface-soft,#f8fafc))!important;
        box-shadow:0 0 0 4px color-mix(in srgb,var(--wh-accent,#0f6292) 12%,transparent);
        animation:aw58Pulse 1.25s ease-in-out infinite;
      }
      body.dark-theme #v11133AskWaffleModal .aw58-mic { background:#22304a!important;border-color:#334155!important;color:#f8fafc!important; }
      #v11133AskWaffleModal .aw58-listening { display:flex;align-items:flex-end;gap:9px;width:100%; }
      #v11133AskWaffleModal .aw58-listening-avatar { width:62px;height:58px;object-fit:contain;flex:0 0 auto;filter:drop-shadow(0 4px 8px rgba(15,23,42,.16)); }
      #v11133AskWaffleModal .aw58-listening-bubble {
        display:grid;gap:2px;max-width:74%;padding:10px 13px;border:1px solid var(--wh-border,#d9e2ec);
        border-radius:16px 16px 16px 5px;background:var(--wh-surface,#fff);color:var(--wh-text,#111827);font-size:11px;line-height:1.4;
      }
      #v11133AskWaffleModal .aw58-listening-bubble span { color:var(--wh-text-muted,#64748b);font-size:9px; }
      body.dark-theme #v11133AskWaffleModal .aw58-listening-bubble { background:#18253a;border-color:#334155;color:#f8fafc; }
      @keyframes aw58Pulse { 50% { transform:scale(1.05); } }
      @media(max-width:520px) {
        #v11133AskWaffleModal .aw37-form { grid-template-columns:minmax(0,1fr) 42px auto !important; }
        #v11133AskWaffleModal .aw58-mic { width:42px!important;min-width:42px!important;max-width:42px!important;font-size:17px; }
        #v11133AskWaffleModal .aw58-listening-avatar { width:54px;height:51px; }
        #v11133AskWaffleModal .aw58-listening-bubble { max-width:76%;padding:9px 11px;font-size:10px; }
      }
    `;
    document.head.appendChild(style);
  }

  function removeStatus(m) {
    m?.querySelectorAll('.aw58-listening').forEach(node => node.remove());
  }

  function status(m, title, detail, temporary) {
    const host = m?.querySelector('.aw37-thread');
    if (!host) return;
    removeStatus(m);
    const row = document.createElement('div');
    row.className = 'aw58-listening';
    row.setAttribute('role', 'status');
    row.setAttribute('aria-live', 'polite');
    row.innerHTML = `<img class="aw58-listening-avatar" src="${LISTENING_ICON}" alt=""><div class="aw58-listening-bubble"><strong></strong><span></span></div>`;
    row.querySelector('strong').textContent = title;
    row.querySelector('span').textContent = detail;
    host.appendChild(row);
    host.scrollTop = host.scrollHeight;
    if (temporary) setTimeout(() => row.remove(), 3800);
  }

  function listeningUi(m, on) {
    const mic = m?.querySelector('.aw58-mic');
    const field = input(m);
    if (mic) {
      mic.classList.toggle('is-listening', on);
      mic.setAttribute('aria-pressed', on ? 'true' : 'false');
      mic.setAttribute('aria-label', on ? 'Stop listening' : 'Speak to Waffle');
      mic.title = on ? 'Stop listening' : 'Speak to Waffle';
      const icon = mic.querySelector('[data-aw58-mic-icon]');
      if (icon) icon.textContent = on ? '■' : '🎙️';
    }
    if (field) {
      if (on) {
        field.dataset.aw58Placeholder = field.getAttribute('placeholder') || PLACEHOLDER;
        field.setAttribute('placeholder', 'Listening…');
      } else {
        field.setAttribute('placeholder', field.dataset.aw58Placeholder || PLACEHOLDER);
        delete field.dataset.aw58Placeholder;
      }
    }
    if (on) status(m, 'Listening…', 'Speak naturally to Waffle.', false);
    else removeStatus(m);
  }

  function stop() {
    if (!recognition || !listening) return;
    try { recognition.stop(); } catch (_) {}
  }

  function startListening(m) {
    const Ctor = SpeechCtor();
    const field = input(m);
    if (!Ctor || !field || field.disabled) return;
    if (listening) { stop(); return; }

    activeModal = m;
    baseText = tidy(field.value);
    heardText = '';
    errorCode = '';
    recognition = new Ctor();
    recognition.lang = 'en-AU';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      listening = true;
      listeningUi(activeModal, true);
    };

    recognition.onresult = event => {
      let speech = '';
      for (let i = 0; i < event.results.length; i += 1) {
        speech = joined(speech, event.results[i]?.[0]?.transcript || '');
      }
      heardText = speech;
      const fieldNow = input(activeModal);
      if (fieldNow) {
        fieldNow.value = joined(baseText, heardText);
        fieldNow.dispatchEvent(new Event('input', { bubbles:true }));
      }
    };

    recognition.onerror = event => {
      errorCode = String(event?.error || 'unknown');
    };

    recognition.onend = () => {
      const mNow = activeModal;
      listening = false;
      listeningUi(mNow, false);
      const fieldNow = input(mNow);
      if (fieldNow) {
        const completed = joined(baseText, heardText);
        if (completed) fieldNow.value = completed;
        fieldNow.focus();
        try { fieldNow.setSelectionRange(fieldNow.value.length, fieldNow.value.length); } catch (_) {}
      }
      if (errorCode && errorCode !== 'aborted' && errorCode !== 'no-speech') {
        const errors = {
          'not-allowed':['Microphone access is off','Allow microphone access for Waffle House, then tap the mic again.'],
          'service-not-allowed':['Speech recognition is unavailable','Your browser has blocked its speech recognition service.'],
          'audio-capture':['Microphone unavailable','I could not access a microphone on this device.'],
          'network':['Speech recognition could not connect','Check your connection and try the microphone again.']
        };
        const message = errors[errorCode] || ['Speech input stopped','Please try the microphone again.'];
        status(mNow, message[0], message[1], true);
      }
      recognition = null;
      heardText = '';
      baseText = '';
      errorCode = '';
    };

    try { recognition.start(); }
    catch (_) {
      recognition = null;
      status(m, 'Speech input could not start', 'Please try the microphone again.', true);
    }
  }

  function wire(m) {
    if (!m || m.dataset.aw58Speech === VERSION) return;
    const composer = form(m);
    const field = input(m);
    if (!composer || !field) return;
    if (!SpeechCtor()) {
      composer.querySelector('.aw58-mic')?.remove();
      m.dataset.aw58Speech = VERSION + '-unsupported';
      return;
    }
    ensureStyle();
    let mic = composer.querySelector('.aw58-mic');
    if (!mic) {
      mic = document.createElement('button');
      mic.type = 'button';
      mic.className = 'aw58-mic';
      mic.innerHTML = '<span data-aw58-mic-icon aria-hidden="true">🎙️</span>';
      composer.appendChild(mic);
    }
    mic.setAttribute('aria-label', 'Speak to Waffle');
    mic.setAttribute('aria-pressed', 'false');
    mic.title = 'Speak to Waffle';
    mic.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      startListening(m);
    };
    m.dataset.aw58Speech = VERSION;
  }

  function ensure() {
    const m = modal();
    if (m) wire(m);
  }

  function start() {
    ensureStyle();
    ensure();
    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest('#aw37launch,#v11133AskWaffleButton,[data-v11133-ask-waffle]')) {
        setTimeout(ensure, 0);
        setTimeout(ensure, 80);
      }
      if (listening && (target.closest('.aw37-close') || target.id === 'v11133AskWaffleModal')) {
        setTimeout(() => { const m = modal(); if (!m || m.hidden) stop(); }, 0);
      }
    }, true);
    [120, 420, 1000, 2000].forEach(delay => setTimeout(ensure, delay));
    window.addEventListener('pageshow', ensure);
    window.addEventListener('focus', ensure);
    window.v11158WaffleSpeechVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();