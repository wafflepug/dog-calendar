# Departure completion

The due-today checkout sheet already provides the operational safeguards needed to complete a departure: selected dog and stay identity, booked dates and today's checkout date, an optional note tied to that checkout, one explicit confirmation, and a verified save before the stay moves to Past. The refinement removes repeated visual weight from routine belongings without weakening the handover review.

Loaded belongings now start behind one disclosure labelled with the number of recorded items. Open it to read each item. Medication instructions remain fully visible because they may require action during handover. Missing belongings or medication remain explicitly labelled **Not available in this summary** and share the existing **Review Care · note kept** route. Neither unknown nor recorded details imply an item was returned or medication was completed.

The sheet still uses only evidence already present on the selected stay card. Opening it makes no request and writes nothing. Review Care remains an explicit same-stay action; its draft is restored only for the matching Stay ID, Dog ID and stay key. Cancel discards a normal draft. A failed safe save retains the note for deliberate retry; queued, conflicting, ambiguous and uncertain results do not complete the departure. Early Checkout remains a separate flow, and owner messages remain optional and staff-controlled after verified checkout.

## Controls before and after

Before this refinement, opening checkout expanded all loaded belongings and medication instructions together. Staff had to scan routine listed items every time, even when they only needed to check an actionable medication instruction.

After this refinement, **Belongings** shows a compact count and opens on demand; **Medication** stays readable in full. Missing evidence remains visible in the sheet with the shared Care review action. **Confirm checkout** remains the only primary action, and **Cancel** remains available in the footer.

## Verification

The guided checkout browser suite uses synthetic stays and intercepted saves. It covers confirmation, cancel, retry after transport failure, queued results, ambiguous or replaced identity, missing and explicit-empty evidence, same-name guests, same-stay note recovery, keyboard focus, and complete medication detail. Responsive layout checks and footer hit-testing remain in `care-arrival-checkout-layout.browser.spec.js`.

These checks do not operate on live guest records and do not demonstrate physical-device behavior.
