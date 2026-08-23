# Waffle AI — conversational architecture

Version: 11.1.47

## Behaviour

Ask Waffle is free-form. Users can ask natural questions such as:

- “What needs my attention today?”
- “Can I fit another dog next weekend?”
- “Anything important about Kuro tonight?”
- “Who leaves before Luna arrives?”
- “What changed recently?”

The user does not need to learn commands or intent phrases.

## Provider selection

The Apps Script backend chooses the first configured provider:

1. `OPENAI_API_KEY` → OpenAI Responses API (optional)
2. `GEMINI_API_KEY` → existing Waffle House Gemini integration

This means an existing Gemini configuration can power conversational Waffle AI without adding a second API credential.

Optional Script Properties:

- `WAFFLE_AI_MODEL` — OpenAI model; default `gpt-5.6-terra`
- `WAFFLE_AI_GEMINI_MODEL` — Gemini model; otherwise uses `GEMINI_LEGACY_INTAKE_MODEL`, then `gemini-3.6-flash`
- `WAFFLE_AI_MAX_PER_MINUTE` — global AI request limit; default `20`
- `WAFFLE_AI_MAX_PER_DAY` — global AI request limit; default `250`

API keys stay in Apps Script Script Properties and are never sent to browser JavaScript or committed to GitHub.

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

## Fallback

If the configured AI provider is unavailable, the browser falls back to the previous local structured Ask Waffle logic so core booking/capacity questions still work.

## Deployment

`apps-script/Code.js` is a historical monolith. The deployment workflow runs `scripts/patch-waffle-ai-router.py` before `clasp push` to inject the `ask_waffle_ai` route into `processReadOnlySheetAction_` and classify the action as read-only. The patch is idempotent and CI verifies the dispatcher anchors before every release.

## UI stability

`waffle-v11.1.47.js` rewires the existing Ask Waffle modal after the V11.1.37 UI has mounted. It preserves the established launcher/modal styling while replacing command-first handling with the conversational backend. Conversation context is kept in `sessionStorage` for the current browser session and is capped before being sent to Apps Script.
