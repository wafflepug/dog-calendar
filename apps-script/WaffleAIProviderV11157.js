/* ============================================================
   WAFFLE HOUSE V11.1.57 — GROQ-FIRST CONVERSATIONAL AI
   ============================================================
   Provider order:
   1. Groq (GROQ_API_KEY) using openai/gpt-oss-120b.
   2. Gemini fallback when configured (enabled by default).
   3. OpenAI fallback only when explicitly opted in, to avoid accidental cost.

   Calendar month/count/capacity fast answers still bypass AI entirely through
   V11.1.50 before this provider is called.
   ============================================================ */

var WAFFLE_AI_GROQ_MODEL_DEFAULT_V11157_ = 'openai/gpt-oss-120b';
var WAFFLE_AI_GROQ_MAX_ROUNDS_DEFAULT_V11157_ = 3;
var WAFFLE_AI_GROQ_TOOL_OUTPUT_CHARS_DEFAULT_V11157_ = 16000;
var WAFFLE_AI_GROQ_USER_RPM_DEFAULT_V11157_ = 10;
var WAFFLE_AI_GROQ_USER_RPD_DEFAULT_V11157_ = 400;

function getWaffleAiConversationResponseV11157_(data) {
  var fastCalendar = waffleAiTryFastCalendarAnswerV11150_(data);
  if (fastCalendar) {
    fastCalendar.version = '11.1.57';
    fastCalendar.provider = 'waffle-data';
    return fastCalendar;
  }

  var properties = PropertiesService.getScriptProperties();
  var groqKey = String(properties.getProperty('GROQ_API_KEY') || '').trim();
  var geminiKey = String(properties.getProperty('GEMINI_API_KEY') || '').trim();
  var openAiKey = String(properties.getProperty('OPENAI_API_KEY') || '').trim();
  var geminiFallbackEnabled = waffleAiPropertyBooleanV11157_(properties, 'WAFFLE_AI_ENABLE_GEMINI_FALLBACK', true);
  var openAiFallbackEnabled = waffleAiPropertyBooleanV11157_(properties, 'WAFFLE_AI_ENABLE_OPENAI_FALLBACK', false);

  var hasUsableProvider = !!groqKey || (!!geminiKey && geminiFallbackEnabled) || (!!openAiKey && openAiFallbackEnabled);
  if (!hasUsableProvider) {
    return {
      result: 'error',
      aiConfigured: false,
      version: '11.1.57',
      provider: 'none',
      providerErrors: [],
      error: 'Waffle AI is ready for Groq, but GROQ_API_KEY is not configured yet. Add GROQ_API_KEY in Apps Script Script Properties. Gemini fallback can also be used when GEMINI_API_KEY is present.'
    };
  }

  var allowance = waffleAiConsumeGroqArchitectureAllowanceV11157_(properties);
  if (!allowance.ok) {
    return {
      result: 'error',
      aiConfigured: true,
      version: '11.1.57',
      provider: groqKey ? 'groq' : (geminiKey && geminiFallbackEnabled ? 'gemini' : 'openai'),
      providerErrors: [],
      error: allowance.message
    };
  }

  var failures = [];

  if (groqKey) {
    var groqResult = getWaffleAiGroqResponseV11157_(data, groqKey);
    if (groqResult && groqResult.result === 'success') {
      groqResult.version = '11.1.57';
      groqResult.provider = 'groq';
      return groqResult;
    }

    failures.push({
      provider: 'groq',
      error: String(groqResult && groqResult.error || 'Groq returned an unknown error.')
    });
  }

  if (geminiKey && geminiFallbackEnabled) {
    var geminiResult = getWaffleAiGeminiResponseV11148Fixed_(data, geminiKey);
    if (geminiResult && geminiResult.result === 'success') {
      geminiResult.version = '11.1.57';
      geminiResult.provider = 'gemini';
      if (failures.length) geminiResult.failoverFrom = failures[0].provider;
      geminiResult.providerErrors = failures;
      return geminiResult;
    }

    failures.push({
      provider: 'gemini',
      error: String(geminiResult && geminiResult.error || 'Gemini returned an unknown error.')
    });
  }

  if (openAiKey && openAiFallbackEnabled) {
    var openAiResult = getWaffleAiResponse_(data);
    if (openAiResult && openAiResult.result === 'success') {
      openAiResult.version = '11.1.57';
      openAiResult.provider = 'openai';
      if (failures.length) openAiResult.failoverFrom = failures[0].provider;
      openAiResult.providerErrors = failures;
      return openAiResult;
    }

    failures.push({
      provider: 'openai',
      error: String(openAiResult && openAiResult.error || 'OpenAI returned an unknown error.')
    });
  }

  return {
    result: 'error',
    aiConfigured: true,
    version: '11.1.57',
    provider: groqKey ? 'groq' : (geminiKey ? 'gemini' : 'openai'),
    providerErrors: failures,
    error: failures.length > 1
      ? 'All configured Waffle AI providers failed.'
      : (failures[0] ? failures[0].error : 'The configured Waffle AI provider failed.')
  };
}

function getWaffleAiGroqResponseV11157_(data, apiKey) {
  data = data || {};

  var question = String(data.question || data.query || '').trim();
  if (!question) {
    return {
      result: 'error',
      aiConfigured: true,
      version: '11.1.57',
      provider: 'groq',
      error: 'Please ask Waffle a question.'
    };
  }
  if (question.length > 4000) question = question.slice(0, 4000);

  var properties = PropertiesService.getScriptProperties();
  var model = String(
    properties.getProperty('WAFFLE_AI_GROQ_MODEL') ||
    WAFFLE_AI_GROQ_MODEL_DEFAULT_V11157_
  ).trim();
  var maxRounds = Math.max(
    1,
    Math.min(
      5,
      Number(properties.getProperty('WAFFLE_AI_GROQ_MAX_ROUNDS') || WAFFLE_AI_GROQ_MAX_ROUNDS_DEFAULT_V11157_)
    )
  );
  var page = String(data.page || '').trim().toLowerCase();
  var history = waffleAiSanitiseHistory_(data.history);
  var instructions = waffleAiInstructions_(waffleAiTodayContext_(), page);
  var messages = [{ role: 'system', content: instructions }];

  history.forEach(function(item) {
    messages.push({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: String(item.content || '')
    });
  });
  messages.push({ role: 'user', content: question });

  var toolNamesUsed = [];
  var tools = waffleAiGroqToolDefinitionsV11157_();

  try {
    for (var round = 0; round < maxRounds; round += 1) {
      var response = waffleAiCallGroqV11157_(apiKey, {
        model: model,
        messages: messages,
        tools: tools,
        tool_choice: 'auto',
        parallel_tool_calls: true,
        reasoning_effort: 'low',
        max_completion_tokens: 1200
      });

      var choice = response && Array.isArray(response.choices) ? response.choices[0] : null;
      var message = choice && choice.message ? choice.message : null;
      if (!message) throw new Error('Groq returned no assistant message.');

      var calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
      if (!calls.length) {
        var answer = String(message.content || '').trim();
        if (!answer) answer = 'I could not produce a reliable answer from the available Waffle House data.';
        return {
          result: 'success',
          aiConfigured: true,
          version: '11.1.57',
          provider: 'groq',
          model: model,
          answer: answer,
          toolsUsed: waffleAiUnique_(toolNamesUsed),
          source: 'groq-chat-completions'
        };
      }

      messages.push({
        role: 'assistant',
        content: message.content || '',
        tool_calls: calls
      });

      calls.forEach(function(call) {
        var fn = call && call.function ? call.function : {};
        var name = String(fn.name || '').trim();
        if (!name) return;

        toolNamesUsed.push(name);
        var args = waffleAiParseArguments_(fn.arguments);
        var result = waffleAiRunTool_(name, args);
        messages.push({
          role: 'tool',
          tool_call_id: String(call.id || ''),
          name: name,
          content: waffleAiGroqSafeToolOutputV11157_(result, properties)
        });
      });
    }

    return {
      result: 'error',
      aiConfigured: true,
      version: '11.1.57',
      provider: 'groq',
      error: 'Waffle AI used too many data lookups for one question. Try asking a slightly narrower question.'
    };
  } catch (error) {
    console.error('Groq Waffle AI request failed', error);
    return {
      result: 'error',
      aiConfigured: true,
      version: '11.1.57',
      provider: 'groq',
      error: waffleAiPublicError_(error)
    };
  }
}

function waffleAiGroqToolDefinitionsV11157_() {
  return waffleAiToolDefinitions_().map(function(tool) {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    };
  });
}

function waffleAiGroqSafeToolOutputV11157_(value, properties) {
  var output = waffleAiSafeToolOutput_(value);
  var limit = Math.max(
    4000,
    Math.min(
      30000,
      Number(
        properties.getProperty('WAFFLE_AI_GROQ_TOOL_OUTPUT_CHARS') ||
        WAFFLE_AI_GROQ_TOOL_OUTPUT_CHARS_DEFAULT_V11157_
      )
    )
  );

  if (output.length <= limit) return output;
  return output.slice(0, limit) + '\n[Groq tool output truncated to stay inside the free-tier token budget.]';
}

function waffleAiCallGroqV11157_(apiKey, payload) {
  var response = UrlFetchApp.fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var status = response.getResponseCode();
  var body = response.getContentText() || '';
  var parsed = null;
  try { parsed = JSON.parse(body); } catch (_) { parsed = null; }

  if (status < 200 || status >= 300) {
    var message = parsed && parsed.error && parsed.error.message
      ? String(parsed.error.message)
      : ('Groq request failed with HTTP ' + status + '.');

    if (status === 429) {
      var headers = {};
      try { headers = response.getAllHeaders() || {}; } catch (_) {}
      var retryAfter = String(headers['Retry-After'] || headers['retry-after'] || '').trim();
      message = 'Groq free-tier rate limit reached.' +
        (retryAfter ? (' Try again in about ' + retryAfter + ' seconds.') : ' Please try again shortly.');
    }

    throw new Error(message);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Groq returned an unreadable response.');
  }
  return parsed;
}

function waffleAiPropertyBooleanV11157_(properties, name, defaultValue) {
  var raw = String(properties.getProperty(name) || '').trim().toLowerCase();
  if (!raw) return defaultValue;
  return !['0', 'false', 'no', 'off'].includes(raw);
}

function waffleAiConsumeGroqArchitectureAllowanceV11157_(properties) {
  var perMinute = Math.max(
    1,
    Number(properties.getProperty('WAFFLE_AI_MAX_PER_MINUTE') || WAFFLE_AI_GROQ_USER_RPM_DEFAULT_V11157_)
  );
  var perDay = Math.max(
    perMinute,
    Number(properties.getProperty('WAFFLE_AI_MAX_PER_DAY') || WAFFLE_AI_GROQ_USER_RPD_DEFAULT_V11157_)
  );

  var timezone = 'Australia/Sydney';
  try { timezone = Session.getScriptTimeZone() || timezone; } catch (_) {}

  var now = new Date();
  var minuteKey = 'waffle-ai-v11157-minute-' + Utilities.formatDate(now, timezone, 'yyyyMMddHHmm');
  var day = Utilities.formatDate(now, timezone, 'yyyyMMdd');
  var dayKey = 'WAFFLE_AI_V11157_RATE_DAY';
  var cache = CacheService.getScriptCache();
  var lock = LockService.getScriptLock();

  if (!lock.tryLock(1500)) {
    return { ok: false, message: 'Waffle AI is busy with another request. Please try again in a moment.' };
  }

  try {
    var minuteCount = Number(cache.get(minuteKey) || 0);
    if (minuteCount >= perMinute) {
      return {
        ok: false,
        message: 'Waffle AI has reached its short-term free-tier safety limit. Please try again in about a minute.'
      };
    }

    var dayState = { day: day, count: 0 };
    try {
      var saved = JSON.parse(properties.getProperty(dayKey) || 'null');
      if (saved && saved.day === day) dayState.count = Number(saved.count || 0);
    } catch (_) {}

    if (dayState.count >= perDay) {
      return {
        ok: false,
        message: 'Waffle AI has reached today’s configured free-tier safety limit.'
      };
    }

    minuteCount += 1;
    dayState.count += 1;
    cache.put(minuteKey, String(minuteCount), 90);
    properties.setProperty(dayKey, JSON.stringify(dayState));
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}
