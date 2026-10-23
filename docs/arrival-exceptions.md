# Arrival exceptions

## Visible change

Before, every same-day unchecked-in arrival received a button with separate Intake and Care rows. A received form was followed by generic “Review instructions” copy, while unknown status carried a generic care-profile prompt. The control also repeated feeding, medication and safety text regardless of whether the intake status supplied an exception.

After, an arrival card with an outstanding or unverified intake status gets one “Review care” action and only the status already available for that exact roster card. A status marked complete removes the extra button; it does not add “ready” copy or imply that staff reviewed care. The component keeps the source label when present; fallback labels distinguish “Link ready,” “Not prepared,” and “Status unknown.” It shows a short detail for those states: refresh Care after the owner submits, no digital intake link is recorded, or current form completion is not verified. Unknown status remains distinct from missing.

Activating Review care opens that card’s existing profile opener. The existing separate Check In control remains available. Next arrival counts and focuses every eligible same-day unchecked-in guest, including guests whose intake is complete. Checked-out, past, future and identity-conflicted stays remain outside both the arrival indicator and Next arrival navigation.

## Scope and evidence

This is a presentation change using the roster card and the existing intake-status helper. It adds no profile fetch, polling loop, or operation. The browser fixture uses mocked status and operation helpers; its local `reads` counter remained at zero during the component interactions. That fixture result describes this synthetic test only.

Focused browser coverage exercises complete, not-prepared, link-ready and unknown states; checked-in and checked-out removal; distinct same-name stays; one-activation profile opening; idempotent refresh; keyboard focus; and 320/390/1440px light/dark layouts. The suite does not assess physical-device rendering.
