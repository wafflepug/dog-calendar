const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync('waffle-app.js', 'utf8');
const start = source.indexOf('    const directorySummaryHtmlState =');
const end = source.indexOf('    function renderDirectoryCareBrief(', start);
assert.ok(start >= 0 && end > start);
const sandbox = {};
vm.runInNewContext(`${source.slice(start, end)}\nthis.setText = setDirectorySummaryText; this.setHtml = setDirectorySummaryHtml;`, sandbox);

test('unchanged summary output does not rewrite the text or HTML host', () => {
    let textWrites = 0;
    let htmlWrites = 0;
    const textHost = { _text: 'Ready', get textContent() { return this._text; }, set textContent(value) { textWrites++; this._text = value; } };
    const htmlHost = {
        _html: '<b>Saved</b>', dataset: {}, get innerHTML() { return this._html; },
        set innerHTML(value) { htmlWrites++; this._html = value; }
    };
    sandbox.setText(textHost, 'Ready');
    sandbox.setText(textHost, 'Changed');
    sandbox.setText(textHost, 'Changed');
    sandbox.setHtml(htmlHost, '<b>Saved</b>', 'generated');
    sandbox.setHtml(htmlHost, '<b>Saved</b>', 'generated');
    assert.equal(textWrites, 1);
    assert.equal(htmlWrites, 0);
});

test('legacy refresh failure survives unchanged output and a changed status redraw', () => {
    const failure = { attached: false, remove() { this.attached = false; } };
    const host = {
        dataset: {}, _html: '<div>Saved</div>',
        get innerHTML() { return this._html; },
        set innerHTML(value) { this._html = value; },
        querySelector(selector) { return selector === '[data-legacy-refresh-failure]' && failure.attached ? failure : null; },
        append(node) { this.appended = node; node.attached = true; }
    };
    sandbox.setHtml(host, '<div>Saved</div>', 'legacy', true);
    sandbox.setHtml(host, '<div>Saved</div>', 'legacy', true);
    assert.equal(host.innerHTML, '<div>Saved</div>');
    host.append(failure);
    sandbox.setHtml(host, '<div>Saved</div>', 'legacy', true);
    assert.equal(failure.attached, true);
    sandbox.setHtml(host, '<div>Updated</div>', 'legacy', true);
    assert.equal(host.innerHTML, '<div>Updated</div>');
    assert.equal(host.appended, failure);
    assert.equal(failure.attached, true);
});
