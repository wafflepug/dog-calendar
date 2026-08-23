/* ============================================================
   WAFFLE HOUSE V11.1.48 — PROVIDER FAILOVER + DIAGNOSTICS
   ============================================================
   This wrapper leaves the V11.1.47 provider implementation intact and becomes
   the live router target. It prefers OpenAI, automatically fails over to Gemini
   when both providers are configured, and returns safe diagnostics instead of
   hiding online failures behind the legacy regex assistant.
   ============================================================ */

function getWaffleAiConversationResponseV11148_(data) {
  var properties = PropertiesService.getScriptProperties();
  var openAiKey = String(properties.getProperty('OPENAI_API_KEY') || '').trim();
  var geminiKey = String(properties.getProperty('GEMINI_API_KEY') || '').trim();

  if (!openAiKey && !geminiKey) {
    return {
      result: 'error',
      aiConfigured: false,
      version: '11.1.48',
      provider: 'none',
      providerErrors: [],
      error: 'Waffle AI backend is live, but no AI provider is configured. Add OPENAI_API_KEY or GEMINI_API_KEY in Apps Script Script Properties.'
    };
  }

  var allowance = waffleAiConsumeAllowance_(properties);
  if (!allowance.ok) {
    return {
      result: 'error',
      aiConfigured: true,
      version: '11.1.48',
      provider: openAiKey ? 'openai' : 'gemini',
      providerErrors: [],
      error: allowance.message
    };
  }

  var failures = [];

  if (openAiKey) {
    var openAiResult = getWaffleAiResponse_(data);
    if (openAiResult && openAiResult.result === 'success') {
      openAiResult.version = '11.1.48';
      openAiResult.provider = 'openai';
      return openAiResult;
    }

    failures.push({
      provider: 'openai',
      error: String(openAiResult && openAiResult.error || 'OpenAI returned an unknown error.')
    });

    if (geminiKey) {
      var geminiFallback = getWaffleAiGeminiResponseV11148Fixed_(data, geminiKey);
      if (geminiFallback && geminiFallback.result === 'success') {
        geminiFallback.version = '11.1.48';
        geminiFallback.provider = 'gemini';
        geminiFallback.failoverFrom = 'openai';
        geminiFallback.providerErrors = failures;
        return geminiFallback;
      }

      failures.push({
        provider: 'gemini',
        error: String(geminiFallback && geminiFallback.error || 'Gemini returned an unknown error.')
      });
    }
  } else {
    var geminiResult = getWaffleAiGeminiResponseV11148Fixed_(data, geminiKey);
    if (geminiResult && geminiResult.result === 'success') {
      geminiResult.version = '11.1.48';
      geminiResult.provider = 'gemini';
      return geminiResult;
    }

    failures.push({
      provider: 'gemini',
      error: String(geminiResult && geminiResult.error || 'Gemini returned an unknown error.')
    });
  }

  return {
    result: 'error',
    aiConfigured: true,
    version: '11.1.48',
    provider: openAiKey && geminiKey ? 'openai+gemini' : (openAiKey ? 'openai' : 'gemini'),
    providerErrors: failures,
    error: failures.length > 1
      ? 'Both configured Waffle AI providers failed.'
      : (failures[0] ? failures[0].error : 'The configured Waffle AI provider failed.')
  };
}
