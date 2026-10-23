# Returning owner follow-up

## Faster Book Again

On a returning dog’s Care profile, open **More tools → Book Again**. The existing action now sits in that list directly, so the separate **Booking tools** disclosure is no longer part of the path. If the guest has no stay history, the empty Booking tools disclosure is hidden. Owner Care Link remains the first-level action; stay history remains available in Booking tools when it exists.

Book Again carries the selected dog’s exact Dog ID, breed, owner and phone into the booking. It leaves the new dates empty and moves focus to the first date field after confirming that exact Dog ID. Same-name records still require the exact Dog ID check. Enter the new dates, then review the saved-care section. Nothing is copied unless you review it and explicitly approve it; editing after approval clears that approval. The existing booking save intent and queued-save recovery remain in place.

## One owner form action with clear context

The selected dog’s existing first-level **Owner Care Link** action stays grouped with its current status. Its short action label and supporting text now reflect the evidence already shown:

| Existing status | Action label | Guidance |
| --- | --- | --- |
| Not prepared | Prepare owner form | No digital intake link is recorded for this stay. |
| Awaiting owner | Follow up with owner | The form has not been received; follow up if the owner still needs to complete it. |
| Link ready | Open sharing options | The link is ready; choose when to copy it and send it. Preparing a link does not mean it was sent. |
| Form received | Owner form options | Review submitted answers in Records & forms. |
| Unknown or legacy care | Check owner form options | Current form completion is not verified; check Records & forms for submitted answers. |

The action reuses the existing control. Opening its options adds no profile/history read, does not send a message, and does not expose the link token in the status badge. Legacy care and a stored profile remain separate from current form receipt; unknown status stays unknown.

## Check the change

1. Choose a returning dog with an exact Dog ID in Care and open **More tools**. Use **Book Again** directly; verify the identity and owner fields are retained, dates are blank, and focus moves to check-in after the identity lookup.
2. Enter new dates and inspect the saved-care review. Save without approval and confirm no inherited care is present. Repeat with explicit review and approval, then edit a reviewed value and confirm approval clears.
3. Inspect the owner action for Not prepared, Awaiting owner, Link ready, Form received, legacy care and unknown status. Verify each label describes the next step and that opening the options adds no reads and sends nothing.
4. Check keyboard access and narrow, standard phone and desktop widths in light and dark themes. Confirm the Book Again action appears once under More tools, the Owner Care Link action appears once at first level, and Booking tools disappears when there is no stay history.
