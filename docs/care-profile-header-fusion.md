# Care profile header fusion

Opening a Care profile hides its duplicate roster opener and keeps the editable photo, dog name, Dog ID, breed, stay dates and native stay-status label in one profile header. Existing source badges and care warning groups move into that header; their active renderers update the selected header rather than the hidden roster button. Returning to Guests restores the same badge nodes to the roster. Check-in/out actions and identity-safe editor handlers retain their existing behavior.

The Handover note template no longer inserts formatting whitespace into the preserved-whitespace paragraph. Notes align at the start of the row, wrap long text and retain deliberate saved line breaks.

## Verification

The actual runtime contact/handover fixture covers source and warning preservation, one selected identity header, access to photo editing, labeled stay dates, multiline notes and returning to the roster. It checks phone and desktop widths in light/dark modes and blocks live writes. The extracted state-preservation fixture includes the production badge helpers; all 227 Node tests pass. Full browser CI and deployed asset verification are release gates. Physical phone and screen-reader testing remains a separate manual check.

## Manual checks

1. Open a staying guest: verify one photo/name/ID/status identity header, readable warning chips and source label, with stay actions directly below.
2. Check 320px, 390px, Fold/tablet and desktop in both themes. Long names, dates and warning labels must wrap without overlap.
3. Open an arriving and past guest; retain accurate saved identity and stay context, with existing eligible actions.
4. Open Handover Update: verify the exact saved note and deliberate line breaks. Discard without changing the record.
5. Refresh a selected profile's source/warnings, then return to Guests. Show current badges exactly once and restore search/filter/focus/scroll state.

Next bounded UI backlog: concise empty detail messages, preserving the distinction between missing, loading, failed and unresolved records.