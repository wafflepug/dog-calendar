# Care profile: daily carer first

The primary person is a busy boarding carer, often using a phone while handling dogs. Opening a profile should answer: **Who is this dog? What do I need to do? What must I watch for?**

The daily view presents one identity/photo and stay dates, the current check-in/out action, safety, full medication instructions, feeding and walks, owner contact and handover. These instructions are readable without pressing a Review button for every topic. Medication and safety text is never clipped to force a shorter screen.

Call owner and Owner Care Link remain directly accessible. Care details opens the full routine, behaviour and health sections; their independent collapsible controls and editor remain available. More tools contains occasional actions: edit care, update handover, emergency details, refresh records, contact editing, booking setup, records/forms and existing booking tools. Destructive actions remain separated.

The selected profile omits the roster-wide alert total and large refresh toolbar. Duplicate roster badges disappear only when the profile has a known safety state; the roster warnings remain a fallback while safety is unavailable. Due reminders always remain visible. Returning to Guests restores the roster's original warnings and filters.

## Check the experience

1. In Care, open a dog. Identify the dog, dates, safety and medication without opening a category.
2. Read feeding/walks and handover; call the owner or open Owner Care Link directly when needed.
3. Open More tools for editing or records; close it again with a tap, Enter or Space. Closed nested controls must remain hidden on Safari too.
4. Open Care details and expand the relevant category. Editing a value should retain an unsaved draft and keyboard focus during a background refresh.
5. Return to Guests. Confirm original filters/position and warnings are restored.

Validation uses synthetic records at 320, 390 and 1440px, light/dark, Chromium/WebKit. It covers full critical text, no overflow, owner sharing, closed tools, keyboard access, due reminders, unavailable-safety fallback, unchanged read counts and draft/focus preservation. No production records are changed by these tests.

Next refinement: review representative short and long care plans against this daily-carer layout, then simplify the full Care editor's optional fields without hiding important instructions or introducing extra startup reads.
