# Care profile at a glance

## First view

Show one dog portrait with dog name, ID, status, and explicitly labeled check-in and check-out dates near the top. Place the existing eligible Check In and Check Out controls immediately below the identity header, preserving confirmations and save behaviour. Keep the existing photo editor reachable. A selected guest's roster tile must not repeat the portrait beside the profile header.

Keep safety, feeding, medication, and owner contact visible in the overview. Long care instructions wrap without clipping; unknown or unresolved details retain honest states. Optional records, detailed care, history and booking tools remain reachable through existing sections/disclosures.

Owner Care Link and Book Again have different purposes: owner information collection versus creating another booking. Group them as booking tools, with distinct labels and existing handlers, outside the overview's primary reading path.

## Manual acceptance

1. Open a staying, arriving, and past guest on phone and desktop. Verify one portrait in the selected profile and labeled dates before the Care overview.
2. Check 320px/360px/390px phone widths, desktop, light/dark mode, and each configured accent. Names, IDs, dates, five section tabs and action labels wrap without horizontal overlap; tab selection and keyboard focus remain visible.
3. Review a guest with medication, a safety alert and a long note. Confirm alerts and saved content stay readable; missing data is not shown as safe or complete.
4. Open booking tools. Owner Care Link selects the exact current dog/stay; Book Again opens a new booking flow without saving immediately.
5. Close/reopen the profile and switch guests. Verify one header, one booking-tools group, preserved section navigation and no stale identity details.
6. Expand detailed care, records and photo editing. Confirm existing edits, uploads and draft retention remain available, with footer-safe scrolling.
7. Confirm the overview presents the owner once, offers a valid Call owner action, and reports an unavailable action when no valid number exists. Open Emergency contact and verify the saved name and number remain reachable in Health & Home; owner and phone editing remain available in stay contact details.
8. Confirm the overview timestamp comes from the validated care record's `updatedAt`. Loading, refresh failure, missing records, unresolved identity, absent/invalid timestamps and saved timestamps must remain distinct; a retrieval time must never appear as a record update time.

## Completed in the Care profile refinements

- The overview keeps the owner name and a single Call owner action; emergency contact opens the existing Health & Home section.
- Five section tabs remain visible in a wrapped three-column phone layout with keyboard selection and focus feedback.
- The overview reports the validated care record update time and separates freshness, loading, refresh errors, missing records and unresolved identity.

- Timestamp semantics for imports, reviewed inheritance and synchronization are documented in `care-record-update-contract.md` and covered by isolated source contract tests.
- Each Care tab controls a uniquely identified, labelled panel; keyboard navigation retains drafts.

- Open profiles no longer scale on press; deep category and handover actions keep stable pointer targets. Compact and reduced-motion Care action navigation uses immediate scrolling.

## Next backlog

- Verify tab and emergency-contact navigation with VoiceOver and TalkBack on physical phones.
- Search now uses loaded dog/owner identity fields and valid dog identifiers, with selected-filter results and a Clear search action. Later arrivals remain an explicit choice; see `care-search-clarity.md`.
- Inspect and simplify repeated empty detail messages in a bounded follow-up; see `next-care-empty-states.md`.
