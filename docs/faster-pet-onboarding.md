# Faster pet onboarding — 2026.10.24.04

## Built deliverables

**Add → Boarding** opens on the current page, including Care. It no longer navigates to Calendar and boots the application again. A confirmed Care save refreshes the existing roster quietly; the saved result and owner-form sharing remain available in the popup. A roster refresh failure never turns a confirmed save into a failed booking or offers a duplicate save.

Closing an unfinished popup keeps its entries in the current page session. Reopen Add → Boarding to continue. **Start over** explicitly clears an unfinished draft. This is in-memory convenience, not durable storage: reloading or closing the page can lose an unsaved draft. Pending, queued and confirmed save intents retain their existing protections.

After a confirmed save, **Add dog for same owner** copies the saved owner name, phone and dates into a fresh form. Review or edit them and enter the next dog's name and breed. Dog identity, notes, care details and owner-form links are not copied. **Add another dog** starts a clean booking for a different owner. The same-owner shortcut is unavailable for queued or failed saves. Save confirmation occupies the existing summary instead of a repeated disabled save button.

Typing a name or phone no longer sends the old speculative `get_returning_guest_prefill` request. That request only produced a possible-name-match hint. **Choose returning dog** still opens the explicit Dog ID flow with the typed details, retaining its exact identity check and optional reviewed care inheritance. No care or identity is silently matched by name.

No backend deployment, schema change, paid dependency, automatic owner message or live guest write is part of verification. These changes remove a document navigation, repeated field entry and speculative queries; fixture tests do not establish a production elapsed-time improvement.

## Testing matrix

| Journey | Verification |
| --- | --- |
| Add from Care | Open Care, select a guest, then Add → Boarding. The URL and selected profile remain; no document request is made |
| Interrupted draft | Enter fields, close and reopen. Values remain; Start over clears them explicitly. Repeat after a save failure |
| New dog | Complete required fields and save once. A confirmed result presents owner sharing; repeated save cannot create another intent |
| Several dogs for one owner | Save the first dog, choose Add dog for same owner, review copied contacts/dates and enter the next dog. Verify notes, Dog ID and owner link are clear |
| Different owner | Choose Add another dog after saving. Previous owner contact and dates do not remain |
| Returning dog | Choose returning dog and verify exact Dog ID/owner/breed. A failed or unavailable selector keeps the unfinished basic form |
| Offline or failed save | Queued state stays truthful and locked; no same-owner shortcut or confirmed roster refresh. Failed values remain editable and retryable |
| Narrow phone and desktop | All footer actions wrap, remain reachable above navigation and have at least 44px touch height; check both themes |
| Confirmed save with failed refresh | Stay remains confirmed and locked; the user must not recreate it to refresh the roster |

Local verification passed: MVP Node and five Python contracts; 84 boarding/handoff and full-runtime cases across Chromium/WebKit at 320/390/1440px; four final same-owner/privacy and returning-draft-transfer cases across both engines. The runtime checks observe zero document navigations on Care entry, no speculative prefill/history reads while typing, and one consolidated roster refresh after confirmed save while retaining the selected profile. Both themes and the narrow-phone success footer were reviewed. Lead review fixed a fixture's scoped-function binding and prevented a successfully transferred draft from remaining available in the basic popup. No live guests were created or changed.

Additional success-screen checks require each footer action to be at least 44px high and pass a real hit test at all six configurations. Five passed initially; the WebKit 320px run missed popup entry before reaching these assertions. Its unchanged targeted rerun passed all footer assertions and the screenshot review. No forced clicks, assertion removal or timeout increase was introduced. This observation does not establish the cause of the intermittent entry failure.

## Next backlog item

Review the transition from selecting an exact returning Dog ID to entering dates. Keep care history optional and on demand, reuse already verified context only within the current action, and focus the next required field without stealing focus from edits. Measure unnecessary requests before adding a cache; preserve exact identity and explicit care-copy approval.
