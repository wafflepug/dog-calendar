# Care profile state preservation

Directory refreshes preserve UI state only for the exact existing `stayKey`.
The selected dog, main Profile/Belongings tab, secondary Care tab, and profile
edit mode are captured before cards are rebuilt and restored after the response
is rendered. New profiles still open on Profile. The restored desktop Care tab
is placed on the replacement card before the existing scheduled `care.js`
preparation runs, so only that selected lazy panel can load.

An open guest detail modal keeps its DOM draft. Its mutation context is rebound
only when exactly one replacement card has the same stay key, field key, and
compatible breed/owner/contact evidence. Missing or conflicting evidence is
ambiguous: the draft remains visible, Save is disabled, and the user must
cancel it explicitly. The final save guard repeats the connected-card, exact
stay key, field, and identity checks immediately before sending the existing
`update_guest_detail` payload.

This preserves the current booking, media, and mutation schemas. Belongings
upload drafts, broader cache invalidation, and backend identity migration remain
separate follow-up work. CI verification in this worktree used the focused
state-preservation fixtures and existing Care/readiness fixtures; physical
iPhone/Fold verification is tracked separately.
