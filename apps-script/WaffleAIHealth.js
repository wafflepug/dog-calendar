/* Waffle House V11.1.47 — non-billable conversational AI health check. */
function getWaffleAiHealthResponse_() {
  var properties = PropertiesService.getScriptProperties();
  var openAiKey = String(properties.getProperty('OPENAI_API_KEY') || '').trim();
  var geminiKey = String(properties.getProperty('GEMINI_API_KEY') || '').trim();
  var provider = openAiKey ? 'openai' : (geminiKey ? 'gemini' : 'none');
  var model = '';

  if (provider === 'openai') {
    model = String(properties.getProperty('WAFFLE_AI_MODEL') || 'gpt-5.6-terra').trim();
  } else if (provider === 'gemini') {
    model = String(
      properties.getProperty('WAFFLE_AI_GEMINI_MODEL') ||
      properties.getProperty('GEMINI_LEGACY_INTAKE_MODEL') ||
      'gemini-3.6-flash'
    ).trim();
  }

  return {
    result: 'success',
    action: 'waffle_ai_health',
    version: typeof WAFFLE_AI_VERSION_ !== 'undefined' ? WAFFLE_AI_VERSION_ : '11.1.47',
    configured: provider !== 'none',
    provider: provider,
    model: model,
    readOnly: true
  };
}
