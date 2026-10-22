# Compact returning Care review

Candidate 2026.10.22.03 focuses on three returning-dog onboarding improvements. It uses existing saved Care and booking payloads; no backend deployment or extra startup/profile request is introduced.

## Built deliverables

1. **Compact source overview.** Keep the selected dog's permanent ID and completed source date visible. Open **Review saved care** to see and edit saved instructions. A closed disclosure does not mean the information was reviewed or approved for copying.
2. **Topical saved-care review.** Group populated instructions by topic, with explicit saved alert values clearly labelled. Blank fields were already excluded and remain excluded. Long instructions stay complete, editable and available through the single review control.
3. **Visible copy decision.** Show the current care-copy selection. Copying requires the existing explicit acknowledgement. Changing a reviewed instruction clears acknowledgement and asks for review again; the edited value is retained. Collapsing and reopening the review preserves the same source's values and decision.

Dog identity remains explicit. Same-name guests are not merged. A changed identity or stale history response cannot transfer the previous dog's review. A saved alert of No remains distinct from an unrecorded alert. The displayed completed date can be an actual earlier checkout date, while payload source dates retain the canonical booking reference required by existing backend validation.

The shipped-flow audit also found that the Multiple visits Dogs step could keep its initially empty review container hidden after history loaded. The container now resyncs when context changes: visible on Dogs and in single-booking mode, hidden on other open plan steps. Closing the plan restores the nonempty single-booking context. This changes visibility only and adds no request.

## Steps for a returning guest

1. Open booking and select the correct existing **Dog ID**. Check the owner/breed evidence when choosing between same-name dogs.
2. Read the completed-source date. Open **Review saved care** if you want to reuse those instructions.
3. Review and edit the saved values, then explicitly approve applying them. If you edit again after approval, check them and approve again.
4. Confirm that the visible copy decision matches your intent. Leaving it unapproved creates the booking without inherited care.
5. Enter the new stay's dates and contact details, then use the existing confirmation. Failed or queued saves retain their existing recovery rules; they are not a confirmed booking.

In Multiple visits, **Add current dog** captures that dog's reviewed-care choice. Before confirming the plan, remove and re-add an existing plan dog if you need to change that captured choice. Editing the current form does not rewrite a dog already added to the plan. Successful save intents retain their existing recovery rules.

## Testing matrix

| Area | Steps | Expected result |
| --- | --- | --- |
| Source context | Select an exact Dog ID with completed care | Initially collapsed review; selected ID and actual completed-source date visible; no copy approval by default |
| Long saved profile | Open the review with many populated fields and long medication text | Clear topic headings; full saved values editable; only saved fields shown; no nested disclosure maze |
| Explicit alert values | Supply true, false and absent saved alerts | True and false remain editable; absent does not become No or a safety-clearance claim |
| Copy omitted | Save without approving, including after opening the review | No `inheritCareReview` in the existing booking write |
| Copy approved | Edit, approve and save | Only reviewed populated fields and explicit flags in the existing payload; exact source Dog ID/stay/date retained |
| Edit after approval | Approve, edit a value, collapse and reopen | Edited value retained; acknowledgement cleared; copy decision requests review again |
| Empty edited review | Clear every value, then restore one | Approval disabled while nothing can be copied; restoring a value enables deliberate approval again |
| Identity and async history | Switch between same-name Dog IDs while earlier history is pending | Current identity/source alone can render reusable care; old approval and values cannot cross dogs |
| Missing/failure | Supply no completed source or fail the existing history read | Truthful empty/failure state; no approved source; existing booking remains usable according to identity guards |
| Retry | Fail a save and retry without changing details | Stable save intent and reviewed source retained; no duplicate successful booking |
| Performance | Count existing reads before and after opening/closing/editing review | No new request just for disclosure, grouping or copy-status updates |
| Responsive | Check 320/390/1440px, light/dark, enlarged text and keyboard | No horizontal overflow; wrapping context; reachable review/approval controls and at least 44px targets |
| Shipped Multiple visits flow | Choose an exact returning dog on Dogs, review care, add the dog, move to Dates, then close the plan | Loaded review visible on Dogs; hidden on Dates; retained context visible after returning to single-booking mode; no extra lookup caused by those transitions |

Use synthetic histories and intercepted saves. Run `playwright.returning-dogs.config.js`, the existing booking-plan matrix, and `scripts/check-mvp-readiness.js`. Browser emulation is separate from physical-device validation. Screenshots and runner evidence are under `output/releases/2026.10.22.03/`.

## Next backlog item

Audit per-dog Care context in multi-visit plans. After adding one exact dog and moving through Dates, check that the chosen source and copy decision remain understandable when returning to Dogs or adding another dog. Implement only demonstrated duplicate or ambiguous UI. Preserve the existing per-dog review capture, same-name validation, immutable successful save intents and partial retry; add no automatic inheritance or new reads.
