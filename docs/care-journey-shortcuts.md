# Care journey shortcuts

Release 2026.10.29.03. Three changes reduce navigation in the existing Care journey without adding controls or background reads.

## Built deliverables

1. Due-today Check Out is visible beside Check In when both existing actions are eligible. It still opens the same checkout review and requires explicit confirmation. Early Checkout remains under More actions when Check In is primary.
2. Enter in a nonblank Care search opens the existing profile action only when exactly one loaded, visible result remains after the active tab and work filters. Same-name matches, zero results, composition/repeat/modified keys, disabled controls and an open modal do not open a profile. Searching alone adds no profile reads; opening a result uses the existing lazy profile read.
3. A meaningful saved handover note of up to 120 Unicode code points and at most two stored lines opens immediately in checkout review. Longer notes remain collapsed. Original text stays complete and escaped; missing/placeholder notes stay hidden. The sitter can toggle the disclosure. Each checkout resets it using the selected stay's note.

Identity resolution, save locks, failure/retry behavior, the optional departure note and owner messages are unchanged. No new backend deployment, notifications, icons or libraries.

## Sitter steps

- Search by name, owner or Dog ID. If one result remains, press Enter to open it; otherwise choose the correct row.
- For a dog leaving today, choose Check Out directly on the Staying card, review identity, medication and belongings, optionally add a departure note, then Confirm checkout.
- Read the saved handover note near the top. Short notes are already open; expand longer notes when needed. This saved note is separate from this departure's optional note.

## Testing matrix

| Case | Steps | Expected |
| --- | --- | --- |
| Due today | View a same-day stay not operationally checked in | Both existing actions reachable directly; Check Out opens review, no write before confirmation |
| Early departure | View an eligible ongoing stay | Check In remains primary; early action stays in More actions with existing warning flow |
| Unique result | Search a permanent Dog ID and press Enter | Correct existing row opens once, one lazy profile read, query retained on Back |
| Ambiguous / no query | Search a duplicate name, absent name, or blank | Enter does not guess or open a profile |
| Filters | Filter Leaving today then search a shared name | Only one visible matching stay can open; hidden matches ignored |
| Keyboard / dialog | Use modified/repeating/composing Enter or keep a dialog open | No profile opens behind another task |
| Saved notes | Test 120/121 code points, long lines, multiple/blank lines, whitespace-heavy notes, placeholders, markup-shaped text and another stay | Short safe disclosure opens; longer one closes; full escaped text and selected identity retained |
| Save / failure | Confirm, delay/fail save, retry or cancel a noted checkout | Existing identity checks, one mutation, note protection and retry retained |
| Responsive | Inspect 320/390/1440px, light/dark, enlarged text and long names | Direct actions wrap, readable 44px targets, sheet footer reachable |

Executed checks: 412 Node and five Python MVP checks; 56 checkout/layout cases; 12 final handover/legacy boundary cases across six projects; 12 roster/operation checks; 12 full-runtime search/checkout cases across six projects; and two full-runtime card clarity cases passed.

Automated fixtures block live writes. Physical phone keyboards and native viewport behavior remain manual checks.

## Next backlog item

Review phone arrival and pickup action placement with representative long-name and missing-data cases before adding more controls.
