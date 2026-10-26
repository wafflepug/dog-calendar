const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

const app = fs.readFileSync('waffle-app.js', 'utf8');
const navStart = app.indexOf('window.WAFFLE_DIRECTORY_PROFILE_NAV =');
const navEnd = app.indexOf('let waffleDeferredInstallPrompt', navStart);
const cardStart = app.indexOf('function getDirectoryProfileCard(stayKey');
const cardEnd = app.indexOf('function getDirectoryWindowScrollTop()', cardStart);
assert(navStart >= 0 && navEnd > navStart && cardStart >= 0 && cardEnd > cardStart);

function card(stayKey, stayId, dogId) {
    return { dataset: { directoryStayKey: stayKey, directoryStayId: stayId, directoryDogId: dogId } };
}

function harness(search, initialCards) {
    let clickListener;
    let intervalCallback;
    let intervalCleared = false;
    const cards = [...initialCards];
    const opened = [];
    const document = {
        addEventListener: (name, listener, capture) => { if (name === 'click' && capture) clickListener = listener; },
        querySelectorAll: () => cards,
        querySelector: () => null,
        getElementById: () => null,
        createElement: () => ({ dataset: {}, setAttribute() {}, textContent: '' })
    };
    const window = {
        WAFFLE_PAGE: 'directory',
        location: { search },
        setInterval: callback => { intervalCallback = callback; return 44; },
        clearInterval: () => { intervalCleared = true; }
    };
    const sandbox = {
        window,
        document,
        WAFFLE_PAGE: 'directory',
        URLSearchParams,
        setInterval: window.setInterval,
        clearInterval: window.clearInterval,
        openDirectoryGuestProfile: async selected => { opened.push(selected.dataset.directoryStayId); }
    };
    vm.runInNewContext(`${app.slice(navStart, navEnd)}\n${app.slice(cardStart, cardEnd)}\nthis.startDeepLink = maybeOpenDirectoryPushDeepLink;`, sandbox);
    return {
        cards, opened, window,
        start: sandbox.startDeepLink,
        tick: () => intervalCallback?.(),
        clickRosterCard: selected => clickListener({ isTrusted: true, target: { closest: selector => selector === '[data-open-directory-profile], [data-v1082-stay-tab], #directoryBackToGuestsBtn' ? selected : null } }),
        get intervalCleared() { return intervalCleared; }
    };
}

test('a pending historical auto-open is cancelled by an explicit current roster selection', () => {
    const flow = harness('?stayKey=old-key&stayId=old-id&dogId=dog-id', []);
    flow.start();
    const current = card('current-key', 'current-id', 'dog-id');
    const historical = card('old-key', 'old-id', 'dog-id');
    flow.cards.push(historical);
    flow.clickRosterCard(current);
    flow.tick();
    assert.deepEqual(flow.opened, []);
    assert.equal(flow.intervalCleared, true);
});

test('an explicit historical stay link still opens the exact requested stay', () => {
    const historical = card('old-key', 'old-id', 'dog-id');
    const flow = harness('?stayKey=old-key&stayId=old-id&dogId=dog-id', [historical]);
    flow.start();
    assert.deepEqual(flow.opened, ['old-id']);
});


test('a startup handler beginning after a roster selection cannot reopen the old URL', () => {
    const historical = card('old-key', 'old-id', 'dog-id');
    const flow = harness('?stayKey=old-key&stayId=old-id&dogId=dog-id', [historical]);
    flow.clickRosterCard(card('current-key', 'current-id', 'dog-id'));
    flow.start();
    flow.tick();
    assert.deepEqual(flow.opened, []);
    assert.equal(flow.intervalCleared, true);
});
