const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'apps-script', 'V11203LegacyIntakeGroq.js'),
  'utf8'
);

function runtime(properties = {}) {
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties[key] }) }
  });
  vm.runInContext(source, context);
  return context;
}

test('default and retired model properties resolve to the supported successor', () => {
  for (const properties of [
    {},
    { GROQ_LEGACY_INTAKE_MODEL: 'qwen/qwen3.6-27b' },
    { WAFFLE_AI_GROQ_VISION_MODEL: ' QWEN/QWEN3.6-27B ' }
  ]) {
    assert.equal(runtime(properties).getLegacyIntakeProviderConfigV11203_().groqModel, 'qwen/qwen3.8-27b');
  }
});

test('explicit model overrides and disabled Gemini fallback are preserved', () => {
  const config = runtime({ GROQ_LEGACY_INTAKE_MODEL: ' custom/vision ', WAFFLE_AI_GROQ_VISION_MODEL: 'other/vision', LEGACY_INTAKE_ENABLE_GEMINI_FALLBACK: 'false' }).getLegacyIntakeProviderConfigV11203_();
  assert.equal(config.groqModel, 'custom/vision');
  assert.equal(config.geminiFallbackEnabled, false);
});

test('five pages use the successor model in batches of three and two', () => {
  const context = runtime({ GROQ_API_KEY: 'test-only', GROQ_LEGACY_INTAKE_MODEL: 'qwen/qwen3.6-27b' });
  const requests = [];
  context.legacyIntakeCallGroqChunkWithRetryV11203_ = (key, model, images, offset, total) => {
    requests.push({ model, count: images.length, offset, total });
    return { profile: {}, care: {}, details: {}, warnings: [], extractionConfidence: 0.8 };
  };
  context.normalizeGeminiLegacyIntakeExtraction_ = value => value;
  const result = context.callGroqLegacyIntakeExtractionV11203_(Array(5).fill('data:image/png;base64,test'));
  assert.deepEqual(requests, [
    { model: 'qwen/qwen3.8-27b', count: 3, offset: 0, total: 5 },
    { model: 'qwen/qwen3.8-27b', count: 2, offset: 3, total: 5 }
  ]);
  assert.equal(result.model, 'qwen/qwen3.8-27b');
  assert.equal(result.pageCount, 5);
});
