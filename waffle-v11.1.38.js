/* ============================================================
   WAFFLE HOUSE V11.1.38 — WAFFLE AI PROFILE INTELLIGENCE
   Refines the global Ask Waffle UI and adds read-only dog-profile
   answers for walking and feeding from the existing Care data model.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.38';
  const PROFILE_SNAPSHOT_KEY = 'waffleAiProfileSnapshotV11138';
  const PROFILE_SNAPSHOT_MAX_AGE = 30 * 60 * 1000;
  const PROFILE_FIELDS = [
    'walksPerDay',
    'walkDuration',
    'offLeashAllowed',
    'pullsOnLeash',
    'foodBrandType',
    'feedingTimes',
    'foodAmount',
    'allowedTreats',
    'foodAllergies'
  ];

  const assets = () => window.WAFFLE_AI_ASSETS || {};

  function clean(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9\s&/.-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function esc(value) {
    try {
      if (typeof window.escapeDashboardHtml === 'function') {
        return window.escapeDashboardHtml(String(value ?? ''));
      }
    } catch (_) {}
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function isFilled(value) {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    const text = String(value).trim();
    return text !== '' && !/^(not recorded|n\/a|na|none|unknown)$/i.test(text);
  }

  function displayValue(value) {
    if (Array.isArray(value)) return value.filter(isFilled).join(', ');
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value && typeof value === 'object') {
      return Object.values(value).filter(isFilled).join(', ');
    }
    return String(value ?? '').trim();
  }

  function safeProfile(record, fallback = {}) {
    const attrs = record?.intakeAttributes || record?.attributes || {};
    const care = {};
    PROFILE_FIELDS.forEach(key => {
      if (isFilled(attrs[key])) care[key] = attrs[key];
    });
    return {
      stayKey: String(record?.stayKey || fallback.stayKey || ''),
      dogName: String(record?.dogName || fallback.dogName || fallback.name || '').trim(),
      care
    };
  }

  function mergeProfiles(rows) {
    const byKey = new Map();
    (rows || []).forEach(row => {
      if (!row?.dogName) return;
      const key = clean(row.dogName);
      if (!key) return;
      const current = byKey.get(key) || { dogName: row.dogName, stayKeys: [], care: {} };
      if (row.stayKey && !current.stayKeys.includes(row.stayKey)) current.stayKeys.push(row.stayKey);
      PROFILE_FIELDS.forEach(field => {
        if (isFilled(row.care?.[field])) current.care[field] = row.care[field];
      });
      byKey.set(key, current);
    });
    return Array.from(byKey.values()).sort((a, b) => a.dogName.localeCompare(b.dogName));
  }

  function memoryProfiles() {
    const rows = [];
    try {
      if (typeof directoryProfileDetailCache !== 'undefined' && directoryProfileDetailCache) {
        Object.entries(directoryProfileDetailCache).forEach(([stayKey, record]) => {
          const summary = (typeof directorySummaryRecordsCache !== 'undefined' && directorySummaryRecordsCache)
            ? directorySummaryRecordsCache[stayKey]
            : null;
          rows.push(safeProfile(record, { stayKey, dogName: summary?.dogName || summary?.name || '' }));
        });
      }
    } catch (_) {}
    return mergeProfiles(rows);
  }

  function readSnapshot() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROFILE_SNAPSHOT_KEY) || 'null');
      if (!parsed || !Array.isArray(parsed.profiles)) return { profiles: [], stale: true };
      const stale = !parsed.savedAt || Date.now() - Number(parsed.savedAt) > PROFILE_SNAPSHOT_MAX_AGE;
      return { profiles: parsed.profiles, stale };
    } catch (_) {
      return { profiles: [], stale: true };
    }
  }

  function saveSnapshot(profiles) {
    if (!Array.isArray(profiles) || !profiles.length) return;
    try {
      localStorage.setItem(PROFILE_SNAPSHOT_KEY, JSON.stringify({ savedAt: Date.now(), profiles }));
    } catch (_) {}
  }

  function unwrapSWR(result) {
    return result?.data || result || {};
  }

  async function fetchDirectorySummaries(action, cacheKey) {
    if (typeof queryAppsScriptSWR !== 'function') return [];
    try {
      const result = await queryAppsScriptSWR(
        { action },
        { cacheKey, maxAttempts: 2, maxStaleMs: 6 * 60 * 60 * 1000 }
      );
      const data = unwrapSWR(result);
      return Array.isArray(data?.summaries) ? data.summaries : [];
    } catch (_) {
      return [];
    }
  }

  async function fetchProfileRecord(summary) {
    const stayKey = String(summary?.stayKey || '');
    if (!stayKey) return null;

    try {
      if (typeof directoryProfileDetailCache !== 'undefined' && directoryProfileDetailCache?.[stayKey]) {
        return safeProfile(directoryProfileDetailCache[stayKey], summary);
      }
    } catch (_) {}

    if (typeof queryAppsScriptSWR !== 'function') return null;
    try {
      const result = await queryAppsScriptSWR(
        { action: 'get_guest_profile', stayKey },
        { cacheKey: 'directory:profile:' + stayKey, maxAttempts: 2, maxStaleMs: 6 * 60 * 60 * 1000 }
      );
      const data = unwrapSWR(result);
      return safeProfile(data?.record || {}, summary);
    } catch (_) {
      return null;
    }
  }

  async function fetchAllProfiles() {
    const [current, past] = await Promise.all([
      fetchDirectorySummaries('get_guest_directory', 'directory:summary'),
      fetchDirectorySummaries('get_past_guest_directory', 'directory:past-summary')
    ]);

    const summariesByStay = new Map();
    [...current, ...past].forEach(summary => {
      if (summary?.stayKey) summariesByStay.set(String(summary.stayKey), summary);
    });

    try {
      if (typeof directorySummaryRecordsCache !== 'undefined' && directorySummaryRecordsCache) {
        Object.values(directorySummaryRecordsCache).forEach(summary => {
          if (summary?.stayKey) summariesByStay.set(String(summary.stayKey), summary);
        });
      }
    } catch (_) {}

    const queue = Array.from(summariesByStay.values());
    const rows = [];
    let cursor = 0;

    async function worker() {
      while (cursor < queue.length) {
        const index = cursor++;
        const record = await fetchProfileRecord(queue[index]);
        if (record?.dogName) rows.push(record);
      }
    }

    await Promise.all(Array.from({ length: Math.min(4, Math.max(1, queue.length)) }, worker));
    const merged = mergeProfiles([...memoryProfiles(), ...rows]);
    if (merged.length) saveSnapshot(merged);
    return merged;
  }

  async function getProfiles(force = false) {
    const memory = memoryProfiles();
    const snapshot = readSnapshot();
    const combined = mergeProfiles([...snapshot.profiles, ...memory]);

    if (!force && combined.length && !snapshot.stale) {
      if (memory.length) saveSnapshot(combined);
      return combined;
    }

    const fetched = await fetchAllProfiles();
    return fetched.length ? fetched : combined;
  }

  function selectedStayKey() {
    try {
      if (typeof directorySelectedProfileStayKey !== 'undefined' && directorySelectedProfileStayKey) {
        return String(directorySelectedProfileStayKey);
      }
    } catch (_) {}
    const selected = document.querySelector('[data-stay-key][aria-current="true"], [data-stay-key].is-selected, [data-stay-key].active');
    return String(selected?.dataset?.stayKey || '');
  }

  function selectedProfile(profiles) {
    const stayKey = selectedStayKey();
    if (!stayKey) return null;
    return profiles.find(profile => Array.isArray(profile.stayKeys) && profile.stayKeys.includes(stayKey)) || null;
  }

  function profileQuestion(question) {
    const q = clean(question);
    return /\b(walk|walks|walking|exercise|feed|feeding|food|eat|eats|meal|meals|breakfast|lunch|dinner|treat|treats)\b/.test(q);
  }

  function findDog(question, profiles) {
    const q = clean(question);
    const explicit = [...profiles]
      .sort((a, b) => b.dogName.length - a.dogName.length)
      .find(profile => q.includes(clean(profile.dogName)));
    return explicit || selectedProfile(profiles);
  }

  function careAnswer(question, profile) {
    const q = clean(question);
    const name = profile.dogName;
    const care = profile.care || {};

    if (/\b(walk|walks|walking|exercise)\b/.test(q)) {
      const duration = displayValue(care.walkDuration);
      const perDay = displayValue(care.walksPerDay);
      if (!duration && !perDay) {
        return { text: `${name}'s profile does not currently record walking duration or walks per day.`, tone: 'muted' };
      }
      if (/\b(how long|duration|minutes?|mins?)\b/.test(q) && duration) {
        return { text: `${name}'s profile says each walk should be ${duration}${perDay ? `. They are listed for ${perDay} walk${String(perDay) === '1' ? '' : 's'} per day.` : '.'}` };
      }
      const list = [];
      if (perDay) list.push(`Walks per day: ${perDay}`);
      if (duration) list.push(`Walk duration: ${duration}`);
      if (isFilled(care.offLeashAllowed)) list.push(`Off-leash allowed: ${displayValue(care.offLeashAllowed)}`);
      if (isFilled(care.pullsOnLeash)) list.push(`Pulls on leash: ${displayValue(care.pullsOnLeash)}`);
      return { text: `Here are ${name}'s walking instructions from their profile:`, list };
    }

    if (/\b(feed|feeding|food|eat|eats|meal|meals|breakfast|lunch|dinner|treat|treats)\b/.test(q)) {
      const times = displayValue(care.feedingTimes);
      const amount = displayValue(care.foodAmount);
      const food = displayValue(care.foodBrandType);

      if (/\b(when|what time|times?)\b/.test(q)) {
        return times
          ? { text: `${name}'s profile says feeding time${times.includes(',') ? 's are' : ' is'} ${times}.` }
          : { text: `${name}'s feeding times are not currently recorded in the profile.`, tone: 'muted' };
      }

      if (/\b(how much|amount|quantity|portion)\b/.test(q)) {
        return amount
          ? { text: `${name}'s profile says to give ${amount}${food ? ` of ${food}` : ''}.` }
          : { text: `${name}'s food amount is not currently recorded in the profile.`, tone: 'muted' };
      }

      if (/\b(what food|which food|brand|type)\b/.test(q)) {
        return food
          ? { text: `${name}'s recorded food is ${food}${amount ? `, with an amount of ${amount}` : ''}.` }
          : { text: `${name}'s food brand or type is not currently recorded in the profile.`, tone: 'muted' };
      }

      const list = [];
      if (food) list.push(`Food: ${food}`);
      if (amount) list.push(`Amount: ${amount}`);
      if (times) list.push(`Feeding times: ${times}`);
      if (isFilled(care.allowedTreats)) list.push(`Treats allowed: ${displayValue(care.allowedTreats)}`);
      if (isFilled(care.foodAllergies)) list.push(`Food allergies: ${displayValue(care.foodAllergies)}`);
      return list.length
        ? { text: `Here are ${name}'s feeding instructions from their profile:`, list }
        : { text: `${name}'s profile does not currently contain feeding instructions.`, tone: 'muted' };
    }

    return null;
  }

  function ensureStyle() {
    if (document.getElementById('aw38style')) return;
    const style = document.createElement('style');
    style.id = 'aw38style';
    style.textContent = `
      #v11133AskWaffleModal .aw37-msg.bot {
        align-items: flex-start !important;
        justify-content: flex-start !important;
        flex-direction: row !important;
      }
      #v11133AskWaffleModal .aw37-msg.bot .aw37-face {
        order: 0 !important;
        flex: 0 0 auto !important;
        margin-top: 1px;
      }
      #v11133AskWaffleModal .aw37-msg.bot .aw37-bubble {
        order: 1 !important;
        border-bottom-right-radius: 16px !important;
        border-bottom-left-radius: 5px !important;
      }
      #v11133AskWaffleModal .aw37-brand small {
        letter-spacing: .1em;
      }
      #v11133AskWaffleModal .aw38-profile-source {
        display: block;
        margin-top: 7px;
        color: var(--wh-text-muted, #64748b);
        font-size: 8px;
        font-weight: 750;
      }
      @media (max-width: 768px) {
        #v11133AskWaffleModal .aw37-msg.bot { gap: 7px !important; }
        #v11133AskWaffleModal .aw37-bubble { max-width: calc(100% - 62px) !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function settleFaces(thread) {
    const A = assets();
    thread?.querySelectorAll('.aw37-face').forEach(img => {
      if (A.closed) img.src = A.closed;
      img.classList.remove('latest');
    });
  }

  function appendUser(thread, question) {
    const row = document.createElement('div');
    row.className = 'aw37-msg user';
    row.innerHTML = `<div class="aw37-bubble">${esc(question)}</div>`;
    thread.appendChild(row);
  }

  function appendBot(thread, answer) {
    const A = assets();
    settleFaces(thread);
    const row = document.createElement('div');
    row.className = 'aw37-msg bot';
    const list = Array.isArray(answer?.list) && answer.list.length
      ? `<ul>${answer.list.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`
      : '';
    row.innerHTML = `<img class="aw37-face latest" src="${A.open || ''}" alt="Waffle"><div class="aw37-bubble">${esc(answer?.text || '')}${list}<small class="aw38-profile-source">Dog Profile · read only</small></div>`;
    thread.appendChild(row);
  }

  async function answerProfileQuestion(question) {
    let profiles = await getProfiles(false);
    let profile = findDog(question, profiles);

    if (!profile && typeof queryAppsScriptSWR === 'function') {
      profiles = await getProfiles(true);
      profile = findDog(question, profiles);
    }

    if (!profile) {
      const names = profiles.map(item => item.dogName).filter(Boolean).slice(0, 10);
      return {
        text: names.length
          ? 'Which dog do you mean? I can check walking and feeding instructions from the dog profiles.'
          : 'I cannot read a dog profile yet. Open Care once so the profiles can sync, then ask me again.',
        list: names.length ? names : undefined,
        tone: 'muted'
      };
    }

    return careAnswer(question, profile) || {
      text: `I found ${profile.dogName}'s profile, but I could not match that question to a recorded walking or feeding field.`,
      tone: 'muted'
    };
  }

  function applyCopy() {
    ensureStyle();
    const modal = document.getElementById('v11133AskWaffleModal');
    if (!modal) return;

    const eyebrow = modal.querySelector('.aw37-brand small');
    const title = modal.querySelector('.aw37-brand h3');
    const subtitle = modal.querySelector('.aw37-brand p');
    if (eyebrow) eyebrow.textContent = 'WAFFLE AI';
    if (title) title.textContent = 'Ask Waffle';
    if (subtitle) subtitle.textContent = "I'm Waffle AI, ask me anything for boarding";

    const firstBot = modal.querySelector('.aw37-thread .aw37-msg.bot .aw37-bubble');
    if (firstBot && /Hi\s*[—-]\s*I[’']?m Waffle\.?/i.test(firstBot.textContent || '')) {
      firstBot.innerHTML = '<b>Hi — I’m Waffle AI.</b><br>Ask me anything about boarding, bookings, care, walks or feeding.';
    }

    const footer = modal.querySelector('.aw37-foot');
    if (footer) footer.textContent = 'Live/saved Waffle Calendar + Dog Profile data';
  }

  function onSubmit(event) {
    const target = event.target instanceof Element ? event.target : null;
    const form = target?.closest('#v11133AskWaffleModal .aw37-form');
    if (!form) return;
    const input = form.querySelector('input');
    const question = String(input?.value || '').trim();
    if (!question || !profileQuestion(question)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const modal = form.closest('#v11133AskWaffleModal');
    const thread = modal?.querySelector('.aw37-thread');
    if (!thread) return;
    if (input) input.value = '';

    appendUser(thread, question);
    thread.scrollTop = thread.scrollHeight;

    answerProfileQuestion(question)
      .then(answer => {
        appendBot(thread, answer);
        thread.scrollTop = thread.scrollHeight;
      })
      .catch(() => {
        appendBot(thread, { text: 'I could not read that dog profile just now. Please try again.', tone: 'muted' });
        thread.scrollTop = thread.scrollHeight;
      });
  }

  function snapshotMemoryProfiles() {
    const profiles = memoryProfiles();
    if (!profiles.length) return;
    const existing = readSnapshot().profiles;
    saveSnapshot(mergeProfiles([...existing, ...profiles]));
  }

  function apply() {
    applyCopy();
    snapshotMemoryProfiles();
  }

  function start() {
    ensureStyle();
    document.addEventListener('submit', onSubmit, true);
    apply();
    [120, 350, 900, 1800, 3600, 7000].forEach(delay => setTimeout(apply, delay));
    window.addEventListener('pageshow', apply);
    window.addEventListener('focus', apply);
    window.v11138WaffleAiProfiles = getProfiles;
    window.v11138WaffleAiVersion = VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
