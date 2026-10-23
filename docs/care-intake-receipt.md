# Care intake receipt context — 2026.10.24.03

## Built deliverables

The existing **Form received** status includes the verified submission date in its details, beside the owner-form action and in the existing booking setup details. No extra card, button, startup read or polling is added. Records & forms remains the place to review submitted answers.

The source is the existing digital intake `submittedAt` field. The owner submission handler in `apps-script/Code.js` writes the server's submission time to the intake row; the existing status reader serializes it. Only completed digital records with a valid timezone-bearing ISO date-time and matching guest/stay context contribute a receipt date. Impossible calendar dates, missing values and untrusted strings retain generic completion wording. A copied link is never treated as delivery or receipt.

Stored profile fallbacks can contain a profile update date rather than a form submission date. They remain **Saved care available** / **Care profile available**, with current form completion unverified. Their update date is not presented as a receipt. A context mismatch removes old receipt evidence and reports unknown status until current evidence replaces it. Dates display in the browser's local timezone, consistently with existing record timestamps.

Records & forms retains a valid stored-profile date with an explicit **Updated** label. It carries no receipt metadata and cannot supply the compact form-received date. This preserves useful record age while keeping form submission distinct.

No backend deployment, schema change, live guest write, external message or paid service is involved. This candidate includes the owner guidance from PR #249; its current-head CI and publication attribution remain required before calling the candidate live.

## Testing matrix

| Check | Expected result |
| --- | --- |
| Open a profile with a completed digital intake and valid submission time | Form received remains compact; its existing details show the submission date; Records & forms retains its PDF/link actions |
| Complete record without a valid timestamp | Form received remains truthful; no guessed date or raw timestamp string appears |
| Stored profile, legacy intake or profile update only | Current form completion remains unverified; no receipt date is shown |
| Awaiting, unavailable, loading or no intake evidence | Existing state and action remain appropriate; no prior received date remains in the compact details |
| Change dog/stay context, including a same-name guest with the same legacy key | Old receipt metadata cannot populate the new selection |
| Refresh identical data while editing Care | No duplicate status, unnecessary DOM mutations, lost focus or additional read |
| Narrow phone, standard phone and desktop, both themes | Existing owner action/status group remains readable; no additional touchpoint is introduced |

Automated fixtures cover producer-to-status metadata, invalid and impossible values, transitions, identity matching, changed-only rendering and request counts. Physical-device and production data verification remain separate; synthetic tests do not establish a production speed improvement.

Local verification passed: the MVP Node/contract suite, 42 intake-status browser cases across Chromium/WebKit at 320/390/1440px, 16 summary/rendering cases, and six arrival/checkout layout cases. Two additional final identity/provenance checks passed across both engines, and a focused WebKit 320px screenshot check passed. Lead review corrected request-spy setup in the fixture and preserved newly loaded current receipt evidence when an identity update and receipt render happen in the same observer batch. The narrow-phone owner action/status screenshot was reviewed; the status remains singular and readable.

## Next backlog item

Audit Records & forms for repeated completion messaging after a verified owner form is received. Prefer one concise status and the existing submitted-answer action; preserve legacy documents, missing/unknown states and all PDF/link access. Use existing data only, with no startup reads or automatic messages.
