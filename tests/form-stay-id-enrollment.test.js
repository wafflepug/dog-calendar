const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const stable = fs.readFileSync(path.join(root, 'apps-script', 'StableStayIdentity.js'), 'utf8');
const code = fs.readFileSync(path.join(root, 'apps-script', 'Code.js'), 'utf8');
const start = code.indexOf('function enrollFormBookingStayIdV11225_');
const end = code.indexOf('function waffleAuditOnFormSubmit', start);
assert.ok(start >= 0 && end > start);

function fixture(row) {
  const rows = [
    ['Timestamp','Dog Name','Breed','Start Date','End Date','Owner','Phone','Likes','Dislikes','Notes','Edit Link','Booking Type','Dog ID'],
    row.slice()
  ];
  let maxColumns = 30, uuid = 0, locked = false;
  const sheet = {
    rows,
    getLastRow: () => rows.length,
    getLastColumn: () => Math.max(0, ...rows.map(item => item.length)),
    getMaxColumns: () => maxColumns,
    insertColumnsAfter(after, count) { maxColumns += count; rows.forEach(item => { for (let i=0;i<count;i++) item.splice(after,0,''); }); },
    getDataRange() { const width = this.getLastColumn(); return { getValues: () => rows.map(item => Array.from({length:width},(_,i)=>item[i] ?? '')) }; },
    getRange(r,c,nr=1,nc=1) {
      const cell = (rr,cc) => { while(rows.length<rr) rows.push([]); while(rows[rr-1].length<cc) rows[rr-1].push(''); return rows[rr-1][cc-1] ?? ''; };
      return {
        getValues: () => Array.from({length:nr},(_,y)=>Array.from({length:nc},(_,x)=>cell(r+y,c+x))),
        getDisplayValues() { return this.getValues().map(line=>line.map(String)); },
        getValue: () => cell(r,c),
        setValue(value) { cell(r,c); rows[r-1][c-1]=value; }
      };
    }
  };
  const sandbox = {
    getTargetSheet_: () => sheet,
    LockService: { getScriptLock: () => ({ tryLock() { if(locked) return false; locked=true; return true; }, releaseLock() { locked=false; } }) },
    Utilities: { getUuid: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12,'0')}` },
    touchWaffleDataVersion_() {},
    normalizeDateValue_: value => value instanceof Date ? value.toISOString().slice(0,10) : String(value || '').slice(0,10)
  };
  vm.createContext(sandbox);
  vm.runInContext(`${stable}\n${code.slice(start,end)}`, sandbox);
  return { sheet, enroll: sandbox.enrollFormBookingStayIdV11225_ };
}

const good = fixture(['2026-10-01','Milo','Cavoodle','2026-10-10','2026-10-12','Ari','', '', '', '', '', 'Confirmed Boarding','']);
const first = good.enroll(good.sheet, 2);
assert.match(first, /^[0-9a-f-]{36}$/i);
assert.equal(good.sheet.rows[1][12], '', 'form enrollment does not guess or assign Dog ID');
assert.equal(good.enroll(good.sheet, 2), first, 'a repeated trigger keeps the row identity');
assert.equal(good.sheet.rows[0][13], 'Stay ID');

const bad = fixture(['2026-10-01','Nori','Poodle','bad-date','2026-10-12','Bea','', '', '', '', '', 'Confirmed Boarding','']);
assert.throws(() => bad.enroll(bad.sheet, 2), /incomplete dog or stay dates/i);
assert.equal(bad.sheet.rows[1][13] || '', '', 'invalid form rows remain unassigned');

console.log('Form stay identity enrollment tests passed.');
