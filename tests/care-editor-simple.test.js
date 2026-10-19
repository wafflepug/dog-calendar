const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync('waffle-app.js', 'utf8');

function editorFieldHarness() {
    const start = source.indexOf('    const DIRECTORY_PROFILE_OPTIONAL_FIELDS = new Set(');
    const end = source.indexOf('    let careRiskRecordsCache', start);
    assert.ok(start >= 0 && end > start);
    const sandbox = {};
    vm.runInNewContext(`${source.slice(start, end)}\nthis.groupFields = directoryCareEditorGroupFields;`, sandbox);
    return sandbox.groupFields;
}

function subtabHarness() {
    const start = source.indexOf('    const directoryCareSectionChoices = new Map();');
    const end = source.indexOf('    async function openDirectoryGuestProfile(', start);
    assert.ok(start >= 0 && end > start);

    const activeElement = {};
    let focused;
    activeElement.parent = null;
    const makePanel = (key, isHidden) => ({
        dataset: { profileSubpanel: key },
        hidden: isHidden,
        contains: element => element === activeElement,
        closest: () => ({ classList: { toggle() {} } })
    });
    const panels = [makePanel('foodWalks', false), makePanel('behaviour', false)];
    const buttons = ['foodWalks', 'behaviour', 'healthHome', 'safety'].map(key => {
        let ariaExpanded = key === 'foodWalks' || key === 'behaviour' ? 'true' : 'false';
        return {
            dataset: { profileSubtab: key },
            classList: { toggle() {} },
            getAttribute(name) { return name === 'aria-expanded' ? ariaExpanded : null; },
            setAttribute(name, value) { if (name === 'aria-expanded') ariaExpanded = value; },
            focus(options) { focused = { key, options }; }
        };
    });
    const card = {
        dataset: {
            directoryStayId: 'stay-1', directoryDogId: 'dog-1', directoryStayKey: 'stay-key',
            profileCareSectionsIdentity: JSON.stringify(['stay-1', 'dog-1', 'stay-key']),
            profileCareSectionsInitialized: 'true', profileSubTabs: 'foodWalks,behaviour', profileSubTab: 'foodWalks'
        },
        querySelectorAll(selector) { return selector === '[data-profile-subtab]' ? buttons : panels; },
        querySelector(selector) {
            const match = selector.match(/data-profile-subtab="([^"]+)"/);
            return buttons.find(button => button.dataset.profileSubtab === match?.[1]) || null;
        }
    };
    activeElement.parent = panels[0];
    const sandbox = {
        document: { activeElement, querySelectorAll: () => [card] },
        DIRECTORY_PROFILE_SECONDARY_TABS: ['foodWalks', 'behaviour', 'healthHome', 'safety'].map(key => ({ key }))
    };
    vm.runInNewContext(`${source.slice(start, end)}\nthis.switchTab = switchDirectoryProfileSubTab;`, sandbox);
    return { switchTab: sandbox.switchTab, card, panels, activeElement, get focused() { return focused; } };
}

test('only blank descriptive fields enter More details; saved and safety-relevant values stay visible', () => {
    const groupFields = editorFieldHarness();
    const fields = [
        { key: 'age' }, { key: 'weight' }, { key: 'sex' }, { key: 'allowedTreats' },
        { key: 'friendlyCats' }, { key: 'offLeashAllowed' }, { key: 'foodAllergies' },
        { key: 'medicationInstructions' }
    ];
    const group = { fields };
    const tab = { fields: fields.map(field => field.key) };
    const result = groupFields(group, tab, {
        weight: '18 kg', friendlyCats: 'No', foodAllergies: 'Chicken', medicationInstructions: 'With dinner'
    });
    assert.deepEqual(Array.from(result.optional, field => field.key), ['age', 'sex', 'allowedTreats']);
    assert.deepEqual(Array.from(result.visible, field => field.key), [
        'weight', 'friendlyCats', 'offLeashAllowed', 'foodAllergies', 'medicationInstructions'
    ]);
});

test('collapsing a focused profile panel returns focus to its toggle and leaves other panels open', () => {
    const h = subtabHarness();
    h.switchTab(h.card, 'foodWalks', true);
    assert.equal(h.focused.key, 'foodWalks');
    assert.equal(h.focused.options.preventScroll, true);
    assert.equal(h.panels[0].hidden, true);
    assert.equal(h.panels[1].hidden, false);
});

