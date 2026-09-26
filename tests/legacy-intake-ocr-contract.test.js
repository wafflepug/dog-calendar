const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'apps-script', 'Code.js'), 'utf8');
const freeOcr = fs.readFileSync(path.join(root, 'apps-script', 'V11206LegacyIntakeFreeOcr.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'apps-script', 'LegacyIntake.html'), 'utf8');

assert.match(code, /GEMINI_LEGACY_INTAKE_MODEL_DEFAULT_[\s\S]*?"gemini-2\.5-flash"/);
assert.match(code, /function decodeLegacyPdfData_\(fileData, fileName\)/);
assert.match(code, /application\/octet-stream/);
assert.match(code, /Please upload a valid PDF file/);
assert.match(code, /bytes\[0\] !== 37/);
assert.match(freeOcr, /function legacyFreeOcrIsPdfDataUrlV11206_/);
assert.match(freeOcr, /legacyFreeOcrIsPdfDataUrlV11206_\(fileData\)/);
assert.match(freeOcr, /meta\.rawText/);
assert.match(freeOcr, /LEGACY_INTAKE_FREE_OCR_STORED_TEXT_MAX_V11206_/);
assert.match(html, /const pdfText=usableEmbedded\[index\]\|\|'';/);
assert.match(html, /if\(pdfText\.length>=40\)/);
assert.match(html, /Tesseract did not load/);

console.log('Legacy intake OCR contract checks passed.');
