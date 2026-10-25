# Simpler rebooking — 25 October 2026

## Scope

Three refinements to the existing booking form: dates-first returning bookings with optional enquiry tools, one editable section for supporting guest details, and inline single-booking validation. Keep the selected Dog ID visible and retain explicit saves and reviewed care inheritance.

No backend, subscription, OCR or identity migration changes are included. Disclosure navigation must not add data reads or writes. Copying previous care still requires a separate explicit review and approval.

## Testing matrix

| Journey | Happy path | Edge or failure checks |
| --- | --- | --- |
| Returning booking | Use Book Again, verify the exact Dog ID and enter new dates without traversing enquiry fields | Delay/fail identity lookup; change a field while waiting; switch to another same-name dog; no stale response may replace edits or permit an unverified save |
| Optional enquiry | Expand enquiry tools, paste text or attach a screenshot, collapse and reopen | Retain text, file reference and preview; parsing remains explicit and its results require review; generic new enquiries remain discoverable |
| Guest details | Expand the supporting details once, review/edit the source, breed, owner, phone and notes | Keep focused or edited fields visible during identity resolution; missing identity and new-dog flows remain editable; planner/restored drafts retain their values |
| Inline validation | Attempt a single booking with missing dates, correct the highlighted field and save once | End before start; missing dog; Potential Stay without owner/phone; reveal errors inside closed details, focus the first invalid field, no invalid write and no unhandled rejection |
| Phone and desktop | Repeat at 320px, 390px and 1440px, light/dark | Wrapping labels, visible keyboard focus, 44px targets, no horizontal overflow, reachable modal footer; disclosure toggles add zero reads/writes |

Automated checks use synthetic records and intercepted transport. Emulation does not certify physical phones. No live guest should be created for release smoke testing.

## Executed verification

The local MVP check passed 380 Node tests and five Python contracts. The broader booking/plan suite passed 104 browser cases. Twelve final focused Chromium/WebKit cases passed after review, including the real shipped modal at 320/390/1440px in light/dark themes. Booking tools and focus continuity passed 39 cases; all inheritance cases were covered, including a final two-engine check that unresolved identities keep focus on identity selection. Synthetic mobile and desktop screenshots were reviewed.

The tests verify that toggling the new disclosures adds no booking/profile reads or writes, pasted text and an attached screenshot survive toggles, edited details survive a delayed identity reply, invalid fields remain visible, and corrected valid booking data writes once. Physical-phone checks in the matrix remain manual.

## Next backlog item

Observe a sitter rebooking a returning guest and preparing an owner link on a physical phone. Use the observed friction to choose the next placement refinement; avoid adding another top-level control without evidence.
