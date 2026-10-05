# Care Contact & Handover

Goal: make the existing owner/contact and handover disclosure readable and easy to edit on narrow phones and desktop. Preserve exact stay targeting, draft restoration, discard confirmation and save payloads. Use existing theme accents and cached values; add no backend reads.

Acceptance and testing matrix:

1. Open Care, choose a dog, expand Stay contact & handover. Owner and contact values have named edit actions; handover notes are clearly separated. Missing values use helpful plain language.
2. Verify 320px, 390px and 1440px widths in light and dark themes. Long names, unbroken contact values and multiline notes wrap. Actions are at least 44px and show visible focus, including Safari.
3. Edit each field, cancel a clean edit, and confirm discarding a dirty edit. Existing saved/unsaved feedback remains accurate.
4. Simulate a failed save and a stay refresh while editing. Keep the typed draft; same-named dogs and duplicate stay keys cannot redirect a write.
5. Reopen the disclosure and switch profiles. Retain current loading policy and contact/note data ownership.

Run the actual-renderer browser checks and existing Care state-preservation tests. Physical iPhone/Fold checks remain a manual follow-up after deployment.

Next bounded backlog: repair quoted multiline CSV records. The current parser splits physical lines before reading quoted fields, which can omit a guest when a handover note contains a newline. Add a shared CSV row reader with quoted commas, escaped quotes, CRLF and multiline fields; verify guest identity, dates and notes remain intact.

Following UI iteration: simplify Detailed Care category summaries. Show a concise saved summary for feeding, walks, behaviour and health while retaining individually collapsible sections and existing edit controls. Verify long and missing information, same-named dogs, keyboard/touch access and draft restoration; do not introduce profile reads or mutations.

Automated browser coverage: long unbroken notes, empty/whitespace values, editor prefill, light/dark contrast, focus and 320/390/1440px geometry in Chromium and WebKit. Multiline data import remains unverified until the CSV reader backlog item is completed; same-name write protection is covered by the existing Care state-preservation suite.
