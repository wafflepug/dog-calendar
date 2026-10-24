# Returning booking flow — 2026.10.24.05

## Built deliverables

Selecting an exact returning Dog ID no longer automatically fetches its care history. The selected identity remains visible and the sitter can enter dates immediately. **Review saved care** explicitly fetches that dog's dated history and opens the existing review in one action. Copying care still requires reviewing the source and checking the approval box; skipping the review copies nothing.

The optional request coalesces repeated actions for the current selection, shows progress and offers a scoped retry after failure. Selecting the same Dog ID preserves edited review fields and their approval. Switching dog, replacing the form, closing the booking or editing/cancelling a planned dog invalidates pending responses. Restored multi-visit prompts remain usable; captured care and per-dog approvals remain separate. There is no persistent or cross-dialog history cache.

An explicit identity choice moves focus to the first missing date only while the identity control still owns focus. Existing entered dates remain intact. Automatic source identity confirmation retains its existing focus guards, and a history response never moves focus away from a phone/date edit.

The exact identity-registry check, save locks, immutable retry intents, offline queue, source-date rules and explicit owner sharing remain in place. No backend deployment, schema change, paid service, background history polling or live guest write is added. The request reduction is observable in fixtures; no production elapsed-time improvement is claimed.

## Operator steps

1. Choose **Add → Boarding → Choose returning dog**, or use **Book Again** from Care.
2. Confirm the exact Dog ID, owner and breed. Enter the new dates.
3. If reusing prior care, choose **Review saved care**, check the completed-source date and edit the instructions if needed. Explicitly approve copying the reviewed details. Edits clear that approval until reviewed again.
4. Create the stay once. Use the existing owner-link sharing action after confirmation.

For a multi-visit plan, review care before adding the dog if you want that care captured in the plan. Editing a captured dog retains its own review; cancelling an edit restores the prior in-progress selection. A queued or failed stay is not treated as confirmed.

## Testing matrix

| Case | Expected result |
| --- | --- |
| Select returning Dog ID, enter dates and save without care review | Zero care-history reads from selection; exact Dog ID retained; no care-copy payload |
| Explicit review | One exact-ID history read; review opens; copy approval starts unchecked |
| Repeated action or same-ID selection during a pending read | One request; progress stays visible; optional read does not block ordinary booking |
| Same-ID selection after editing and approval | Existing controls, values and approval remain; no extra read |
| Failure and retry | Clear retry action for the same selected Dog ID; no inherited care from a failure |
| Change dog, close or edit/cancel plan while waiting | Late response cannot replace the current guest or restored draft |
| Plan edit and cancel | Captured per-dog instructions and source remain; restored pending/idle prompt can be used explicitly |
| Focus | Missing date receives focus on explicit identity choice; existing dates/phone edits and focus survive asynchronous results |
| Phone/desktop and both themes | Review action, source details, disclosure and approval remain readable and reachable; long instructions wrap |

Verification: MVP Node fixtures and five Python contracts passed. The final booking-flow coverage passed 44 cases across its matrix and corrected fixture checks; 18 returning-care inheritance cases passed in Chromium/WebKit. The broader plan matrix also passed all completion/queue cases. The shipped runtime was checked at 320px and desktop, including a visible 44px review action, hit testing and no horizontal overflow. Lead review preserved same-selection edits, repaired delegated actions after plan restore, cleared old source provenance on dog changes, and isolated repeated fixture setup in a fresh page. No forced clicks or relaxed identity/read-count assertions were introduced. Synthetic results demonstrate request reduction and flow correctness, not production elapsed-time measurements.

## Next backlog item

Simplify the returning booking panel's optional enquiry-import area. Keep the selected dog and dates prominent, make paste/screenshot tools available on demand, and retain parsing, error correction and multi-visit draft state. Do not add network calls or remove any identity safeguards.

Bounded Luna implementation prompt: work in `phase4-booking.js` and the existing booking/returning runtime fixtures. Use a native disclosure for enquiry tools in an already selected returning-dog action, keep every current field/action available, and leave generic new-enquiry parsing discoverable. Never collapse a field with a current validation error or move focus on an asynchronous reply. Acceptance: Book Again exposes selected identity and date entry without traversing the enquiry panel; opening/closing optional tools preserves pasted text, screenshot reference and unsaved booking/plan values; parsing still requires explicit review before save; light/dark 320px and desktop remain readable with 44px targets; opening or toggling tools adds no read or write.
