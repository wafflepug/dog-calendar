/* Waffle House V11.1.48 — non-billable conversational AI health diagnostics. */
function getWaffleAiHealthResponseV11148_() {
  var properties = PropertiesService.getScriptProperties();
  var openAiKey = String(properties.getProperty('OPENAI_API_KEY') || '').trim();
  var geminiKey = String(properties.getProperty('GEMINI_API_KEY') || '').trim();
  var preferred = openAiKey ? 'openai' : (geminiKey ? 'gemini' : 'none');
  var model = '';

  if (preferred === 'openai') {
    model = String(properties.getProperty('WAFFLE_AI_MODEL') || 'gpt-5.6-terra').trim();
  } else if (preferred === 'gemini') {
    model = String(
      properties.getProperty('WAFFLE_AI_GEMINI_MODEL') ||
      properties.getProperty('GEMINI_LEGACY_INTAKE_MODEL') ||
      'gemini-3.6-flash'
    ).trim();
  }

  return {
    result: 'success',
    action: 'waffle_ai_health',
    version: '11.1.48',
    routeReady: true,
    configured: !!(openAiKey || geminiKey),
    preferredProvider: preferred,
    provider: preferred,
    model: model,
    openaiConfigured: !!openAiKey,
    geminiConfigured: !!geminiKey,
    failoverAvailable: !!(openAiKey && geminiKey),
    readOnly: true
  };
}
