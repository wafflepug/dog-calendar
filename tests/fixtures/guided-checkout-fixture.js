const { expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const runtime = fs.readFileSync(path.join(__dirname, '..', '..', 'waffle-v11.2.17.js'), 'utf8');

async function setup(page, options = {}) {
  const evidence = options.loadedEvidence === false ? '' :
    '<section data-belongings-summary><ul class="belongings-summary-list"><li>Blue lead</li><li>Food tub</li></ul></section><span data-care-brief-medication>Return blue inhaler</span>';
  const additionalGuest = options.secondCheckout ? '<article class="directory-card" data-directory-stay-id="stay-c" data-directory-stay-key="other|2026-10-18|2026-10-18|c" data-directory-dog-id="dog-c" data-directory-dog-name="Solo" data-directory-start-date="2026-10-18" data-directory-end-date="2026-10-18"><button class="directory-guest-tile-open">Solo</button></article>' : '';
  await page.setContent(`<!doctype html><html><body data-waffle-page="directory"><main class="directory-dashboard-fused"><div id="directory-grid" class="directory-grid directory-grid-fused">
    <article class="directory-card" data-testid="selected-card" data-directory-stay-id="stay-a" data-directory-stay-key="twin|2026-10-18|2026-10-18|a" data-directory-dog-id="dog-a" data-directory-dog-number="#0017" data-directory-dog-name="Twin" data-directory-start-date="2026-10-18" data-directory-end-date="2026-10-18"><button class="directory-guest-tile-open">Twin</button>${evidence}<div class="directory-care-brief-actions"><button type="button" data-p4-dir="owner">Owner Care Link</button></div></article>
    <article class="directory-card" data-directory-stay-id="stay-b" data-directory-stay-key="twin|2026-10-18|2026-10-20|b" data-directory-dog-id="dog-b" data-directory-dog-name="Twin" data-directory-start-date="2026-10-18" data-directory-end-date="2026-10-20"><button class="directory-guest-tile-open">Twin</button></article>
    ${additionalGuest}
  </div></main></body></html>`);
  await page.evaluate(() => {
    window.getLocalTodayDateString = () => '2026-10-18';
    window.writes = [];
    window.detailReads = [];
    window.movedIds = [];
    window.pending = null;
    window.v110OperationDisplayState = card => ({ code: card.dataset.checked === 'true' ? 'checked_in' : 'date_active' });
    window.v110EnsureCareOperationBar = () => {};
    window.v110EnhanceCareCard = () => {};
    window.v110ShowActionFeedback = (host, message, retry) => {
      const el = document.createElement('div'); el.className = 'feedback'; el.textContent = message; host.appendChild(el);
      if (retry) { const b = document.createElement('button'); b.textContent = 'Retry'; b.onclick = retry; el.appendChild(b); }
    };
    window.v110ClearActionFeedback = () => {};
    window.v110SaveOperationalStatus = async (payload, status) => {
      window.writes.push({ ...payload, status });
      if (window.pending) await window.pending;
      if (window.failNext) { window.failNext = false; throw new TypeError('Network connection failed'); }
      if (window.queued) return { queued: true };
      return { result: 'success', record: { stayId: payload.stayId, stayKey: payload.stayKey, dogName: payload.dogName, status, startDate: payload.startDate, endDate: payload.endDate } };
    };
    window.v1086MoveCheckedOutStayToPast = (card, payload) => { window.movedIds.push(payload.stayId); card.dataset.v1082PastStay = 'true'; card.remove(); };
    window.WAFFLE_CARE_PROFILE_READS = {
      matches: (card, record) => ['resolved', 'not_found'].includes(record?.resolution?.status) && record.identity?.stayId === card.dataset.directoryStayId && record.identity?.dogId === card.dataset.directoryDogId && record.identity?.stayKey === card.dataset.directoryStayKey,
      read: async card => {
        window.detailReads.push({ source: 'profile', stayId: card.dataset.directoryStayId });
        if (window.profileReadFailure) throw new Error(window.profileReadFailure);
        return { data: { record: { identity: { stayId: card.dataset.directoryStayId, dogId: card.dataset.directoryDogId, stayKey: card.dataset.directoryStayKey }, resolution: { status: window.profileNotFound ? 'not_found' : 'resolved' }, intakeAttributes: window.profileNotFound ? {} : { medicationInstructions: 'Give medicine with dinner' } } } };
      }
    };
    window.WAFFLE_CARE_BELONGINGS_READS = {
      read: async card => {
        window.detailReads.push({ source: 'belongings', stayId: card.dataset.directoryStayId });
        if (window.belongingsReadFailure) throw new Error(window.belongingsReadFailure);
        return { data: { record: { stayKey: card.dataset.directoryStayKey, identityResolution: { status: 'resolved', identity: { stayId: card.dataset.directoryStayId, dogId: card.dataset.directoryDogId, stayKey: card.dataset.directoryStayKey } }, items: { lead: { present: true, description: 'Blue lead' }, food: { present: true, description: 'Food tub' } } } } };
      }
    };
  });
  await page.addScriptTag({ content: runtime });
  await page.evaluate(() => {
    document.querySelectorAll('.directory-card').forEach(card => {
      if (card.dataset.directoryEndDate > '2026-10-18' || card.querySelector('[data-v11217-roster-actions]')) return;
      const actions = document.createElement('div');
      actions.dataset.v11217RosterActions = '';
      actions.dataset.renderSignature = JSON.stringify([card.dataset.directoryStayId, card.dataset.directoryStayKey, card.dataset.directoryDogId, true, true, false, 'date_active']);
      actions.innerHTML = '<button type="button" data-v11217-roster-checkin>Check In</button><details class="v11217-roster-more-actions"><summary>More actions</summary><button type="button" data-v11217-roster-checkout>Check Out</button></details>';
      card.appendChild(actions);
    });
  });
  await expect(page.locator('#directory-grid')).toBeVisible();
  return { grid: page.locator('#directory-grid'), selected: page.getByTestId('selected-card'), other: page.locator('[data-directory-stay-id="stay-b"]') };
}

module.exports = { setup };
