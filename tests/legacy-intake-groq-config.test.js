const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'apps-script', 'V11203LegacyIntakeGroq.js'),
  'utf8'
);

assert.match(source, /LEGACY_INTAKE_GROQ_MODEL_DEFAULT_V11203_\s*=\s*'qwen\/qwen3\.8-27b'/);
assert.match(source, /value\.toLowerCase\(\)\s*===\s*'qwen\/qwen3\.6-27b'/);
assert.doesNotMatch(source, /default qwen\/qwen3\.6-27b/);
assert.match(source, /return LEGACY_INTAKE_GROQ_MODEL_DEFAULT_V11203_/);

console.log('Legacy intake Groq model configuration checks passed.');
