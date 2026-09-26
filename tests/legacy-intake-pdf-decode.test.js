const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.js'), 'utf8');
const match = source.match(/function decodeLegacyPdfData_\(fileData, fileName\) \{[\s\S]*?\n\}/);
assert.ok(match, 'PDF decoder is present');
const sandbox = { Utilities: { base64Decode: value => Buffer.from(value, 'base64'), newBlob: (bytes, mimeType, name) => ({ bytes, mimeType, name }) }, MimeType: { PDF: 'application/pdf' } };
vm.runInNewContext(`${match[0]}\nthis.decode = decodeLegacyPdfData_;`, sandbox);

function dataUrl(size, mime = 'application/pdf', header = '%PDF-') {
  const bytes = Buffer.alloc(size, 65);
  Buffer.from(header).copy(bytes);
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

assert.equal(sandbox.decode(dataUrl(9 * 1024 * 1024), 'Legacy.pdf').bytes.length, 9 * 1024 * 1024);
assert.throws(() => sandbox.decode(dataUrl(10 * 1024 * 1024 + 1), 'Too large.pdf'), /larger than 10 MB/);
assert.throws(() => sandbox.decode(dataUrl(64, 'image/png'), 'wrong mime.pdf'), /valid PDF/);
assert.throws(() => sandbox.decode(dataUrl(64, 'application/pdf', 'NOTPD'), 'wrong header.pdf'), /not a readable PDF/);

console.log('Legacy intake PDF decoder runtime checks passed.');
