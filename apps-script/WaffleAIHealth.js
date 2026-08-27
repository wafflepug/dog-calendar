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
/* Waffle House V11.1.57 — Groq-first non-billable health diagnostics. */
function getWaffleAiHealthResponseV11157_() {
  var properties = PropertiesService.getScriptProperties();
  var groqKey = String(properties.getProperty('GROQ_API_KEY') || '').trim();
  var geminiKey = String(properties.getProperty('GEMINI_API_KEY') || '').trim();
  var openAiKey = String(properties.getProperty('OPENAI_API_KEY') || '').trim();
  var geminiFallbackEnabled = waffleAiPropertyBooleanV11157_(properties, 'WAFFLE_AI_ENABLE_GEMINI_FALLBACK', true);
  var openAiFallbackEnabled = waffleAiPropertyBooleanV11157_(properties, 'WAFFLE_AI_ENABLE_OPENAI_FALLBACK', false);
  var groqModel = String(properties.getProperty('WAFFLE_AI_GROQ_MODEL') || 'openai/gpt-oss-120b').trim();
  var preferred = groqKey
    ? 'groq'
    : (geminiKey && geminiFallbackEnabled
      ? 'gemini'
      : (openAiKey && openAiFallbackEnabled ? 'openai' : 'none'));
  var model = preferred === 'groq'
    ? groqModel
    : (preferred === 'gemini'
      ? String(
          properties.getProperty('WAFFLE_AI_GEMINI_MODEL') ||
          properties.getProperty('GEMINI_LEGACY_INTAKE_MODEL') ||
          'gemini-3.6-flash'
        ).trim()
      : (preferred === 'openai'
        ? String(properties.getProperty('WAFFLE_AI_MODEL') || 'gpt-5.6-terra').trim()
        : ''));

  return {
    result: 'success',
    action: 'waffle_ai_health',
    version: '11.1.57',
    routeReady: true,
    readOnly: true,
    configured: preferred !== 'none',
    preferredProvider: preferred,
    provider: preferred,
    model: model,
    groqArchitecture: true,
    groqConfigured: !!groqKey,
    groqModel: groqModel,
    groqFreeTierOptimized: true,
    migrationPending: !groqKey,
    geminiConfigured: !!geminiKey,
    geminiFallbackEnabled: geminiFallbackEnabled,
    openaiConfigured: !!openAiKey,
    openaiFallbackEnabled: openAiFallbackEnabled,
    paidOpenAiFallbackOptInOnly: true,
    failoverAvailable: !!groqKey && (
      (!!geminiKey && geminiFallbackEnabled) ||
      (!!openAiKey && openAiFallbackEnabled)
    ),
    fallbackChain: [
      groqKey ? 'groq' : '',
      geminiKey && geminiFallbackEnabled ? 'gemini' : '',
      openAiKey && openAiFallbackEnabled ? 'openai' : ''
    ].filter(Boolean),
    freeTierUserPromptLimitPerMinute: Math.max(
      1,
      Number(properties.getProperty('WAFFLE_AI_MAX_PER_MINUTE') || 10)
    ),
    freeTierUserPromptLimitPerDay: Math.max(
      1,
      Number(properties.getProperty('WAFFLE_AI_MAX_PER_DAY') || 400)
    ),
    calendarFastPath: true,
    calendarFastPathMode: 'targeted-B-L-month-filter',
    completeMonthRosters: true,
    calendarFastNoAiRoundTrip: true
  };
}
