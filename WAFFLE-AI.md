# Waffle AI — conversational architecture

Version: 11.1.57

## Behaviour

Ask Waffle is free-form. Users can ask natural questions such as:

- “What needs my attention today?”
- “Can I fit another dog next weekend?”
- “Anything important about Kuro tonight?”
- “Who leaves before Luna arrives?”
- “What changed recently?”

The user does not need to learn commands or intent phrases.

## Provider architecture

Waffle AI is Groq-first.

1. `GROQ_API_KEY` → Groq using `openai/gpt-oss-120b` by default.
2. `GEMINI_API_KEY` → Gemini fallback when available. This fallback is enabled by default.
3. `OPENAI_API_KEY` → OpenAI fallback only when `WAFFLE_AI_ENABLE_OPENAI_FALLBACK=true` is explicitly set. This prevents accidental paid OpenAI API usage.

The Groq adapter uses the OpenAI-compatible Chat Completions endpoint with local function/tool calling. Calendar month/count/capacity questions continue to use the deterministic V11.1.50 fast path and make no AI-provider request.

API keys stay in Apps Script Script Properties and are never sent to browser JavaScript or committed to GitHub.

## Required Groq setup

In the Google Apps Script project, open Project Settings → Script Properties and add:

- `GROQ_API_KEY` — required to activate Groq.

Optional properties:

- `WAFFLE_AI_GROQ_MODEL` — default `openai/gpt-oss-120b`.
- `WAFFLE_AI_GROQ_MAX_ROUNDS` — default `3` tool/answer rounds per user question.
- `WAFFLE_AI_GROQ_TOOL_OUTPUT_CHARS` — default `16000`; keeps tool context inside free-tier token headroom.
- `WAFFLE_AI_MAX_PER_MINUTE` — default `10` user prompts/minute.
- `WAFFLE_AI_MAX_PER_DAY` — default `400` user prompts/day.
- `WAFFLE_AI_ENABLE_GEMINI_FALLBACK` — default `true`.
- `WAFFLE_AI_ENABLE_OPENAI_FALLBACK` — default `false`; set to `true` only if paid OpenAI API fallback is intentionally wanted.

If `GROQ_API_KEY` has not been added yet, an existing Gemini configuration remains usable while migration is pending.

## Read-only Waffle tools

The AI can choose among these data tools:

- `get_booking_calendar`
- `get_guest_profile`
- `get_guest_belongings`
- `get_stay_operations`
- `get_potential_stays`
- `get_organiser`
- `get_recent_logs`
- `get_notifications`

No write/mutation tools are exposed to Waffle AI. The model cannot create, edit, confirm or delete bookings or care records through this agent.

## Free-tier optimisation

The Groq provider deliberately uses a maximum of three model rounds by default and caps large tool outputs before they are sent back to the model. This reduces latency and helps avoid Groq free-tier token-per-minute limits. Straightforward Calendar month/count/capacity questions bypass the model entirely.

Provider-side quotas are separate from Waffle's own user-prompt safety limits. The Waffle defaults can be adjusted through Script Properties if usage patterns justify it.

## Deployment

`apps-script/Code.js` is a historical monolith. The deployment workflow runs `scripts/patch-waffle-ai-router.py` before `clasp push` to inject the `waffle_ai_health` and `ask_waffle_ai` routes and classify them as read-only.

The live deployment health check verifies V11.1.57, the Groq-first architecture, the free-tier optimisation marker, the paid-OpenAI opt-in rule and the existing deterministic Calendar fast path. The deployment does not require `GROQ_API_KEY` to exist yet; health reports `migrationPending=true` until the key is configured.

## UI

The existing Waffle AI modal remains provider-agnostic. It reads the backend health/provider response and displays the active provider in the footer, so once Groq is configured responses will report `GROQ` without another frontend architecture change.
