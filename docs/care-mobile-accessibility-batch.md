# Care access and record clarity

## Scope

1. Keep Care actions reachable after navigating history and expanding detailed categories on phones and Fold/tablet widths. The roster press animation previously scaled an entire open profile and moved a control between pointer-down and pointer-up; open profiles now remain stationary, while roster cards retain press feedback. Verify real pointer hit-testing and footer clearance using a deterministic read-only fixture; do not bypass the action under test with a DOM click.
2. Associate each of the five Care tabs with its own labelled panel. Preserve selected state, arrow/Home/End keyboard navigation and existing drafts. Mobile category disclosures keep their separate expanded state; the emergency shortcut opens Health & Home without closing other categories.
3. Document and test the shared record update contract for imports, reviewed inheritance and booking synchronization. Explain its meaning accessibly without adding another visible information block to the overview.

## Verification matrix

| Path | Verification | Failure or edge case |
| --- | --- | --- |
| Deep Care navigation | Open a guest, visit Stay history, return to Overview, expand Health & Home and Safety, then open Update handover with a real pointer click | Footer must not intercept actions; cancel must preserve the note and exact selected stay |
| Care tabs | Navigate with ArrowRight, Home and End; inspect selected panel | Two profiles must have distinct IDs; navigating must retain a field draft |
| Emergency contact | Activate the overview shortcut and read Health & Home | Missing contact remains honest; another open category stays open |
| Record update time | Read a saved record and inspect its update label | Missing/invalid timestamps, unresolved identity and refresh errors stay distinct; retrieval time is never substituted |
| Imports and inheritance | Execute backend source functions against isolated sheet stubs | Destination write gets its own time; source time is not copied; reads perform no writes |
| Responsive layout | Browser-check narrow phones, Fold/tablet and desktop in light/dark mode | Physical devices, VoiceOver and TalkBack require separate manual verification |

Tests use synthetic bookings and block production mutations. Backend schema and deployment are unchanged.

## Next bounded backlog

1. Physical VoiceOver/TalkBack and Fold verification: record actual focus announcements, emergency navigation and footer clearance, then fix only observed gaps.
2. Care search clarity: make dog ID and owner matches understandable without adding more roster buttons; preserve on-demand future-arrival loading.
3. Simplify empty Care detail states: one concise explanation and a relevant action, while retaining unknown safety/medication states and draft recovery.
