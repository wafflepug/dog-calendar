# Solo sitter Organiser

Release: 2026.11.04.05. Frontend only; uses existing shared Organiser storage.

## Daily workflow
1. Open Organiser → Today. Complete due tasks and see arrivals/departures with recorded stay status.
2. Use Arrivals to review the next seven days and prepare each stay. Care profile opens the specific booking.
3. Use Departures to gather belongings, food and medication and prepare the owner handover.
4. Add a task with an optional linked stay, date, time, priority and daily repeat. Templates provide editable starting text. Complete or reopen tasks; edit/delete in Tasks.
5. Workspace contains shelves, sleeping areas, shared notes and the existing floorplan. Existing stored items are preserved.

Preparation ticks and task completion are planning aids. They do not record medication, send owner messages or perform check-in/out. Use Care for those operations.

## Behaviour and architecture
- Tasks and stays render independently; current directory responses supply operations without another read. No individual Care profile fan-out.
- Independent source errors, retained last-loaded data, bounded refresh and explicit retry replace misleading zero counts or indefinite loading.
- Daily completion uses Sydney calendar dates; future-start daily tasks are excluded from today. Historical completed dates are retained.
- Stable item IDs survive a failed composer save/retry. Server acknowledgement is required before local completion. Per-item locks prevent overlapping writes within a client.
- Ambiguous legacy stay keys cannot share preparation/assignment updates. Same-name dogs retain separate stable stay IDs and readable dog numbers.
- Modals preserve drafts on failure, trap keyboard focus and sit above the phone footer, adapting to visual viewport height.
- Five primary sections; storage/layout tools are secondary. CSS follows existing light/dark tokens and reduced motion settings.

## Focused verification matrix
| Scenario | Steps | Expected |
|---|---|---|
| Daily work | Open Today with fixture stays/tasks | Due work first, exact Care links, no profile fan-out |
| Same-name dogs | Inspect two Milo stays | Separate IDs, owners and exact links |
| Task retry | Simulate save failure; retry | Draft retained, one stable ID, one stored item |
| Future repeat | Add daily task starting tomorrow | Absent from Today until its start day |
| Complete task | Tick a due task | Leaves open list only after acknowledged save |
| Preparation | Tick arrival checklist | Only selected stay's checklist changes |
| Partial failure | Make one source unavailable | Other sources usable; unavailable/stale label, no false empty state |
| Responsive UI | Inspect 320/390 phone and 1440 desktop | No horizontal page overflow; readable actions |
| Task dialog | Open on phone; scroll to actions | Save/cancel accessible above footer |
| Navigation | Use arrows/Home/End in tab row | Keyboard moves between sections |

Screenshots use fictional local data dated 18 October 2026. No production guest writes were used. Screenshot evidence and executed checks are recorded in the local review gallery. No regression suite was run.

## Limits and next backlog
The backend uses whole-item replacement with no version comparison. Two devices editing the same item simultaneously can overwrite each other; local locks do not solve cross-device concurrency. Next high-value item: server version checks and a conflict/reload flow. Task due times are planning labels, not new push notifications. Stay horizon follows the existing seven-day directory contract.

## Token lite
Development: three Luna subtasks (implementation, styling, audit), followed by higher-model review and focused verification. Exact per-feature token usage is not exposed by this session and is not estimated.
