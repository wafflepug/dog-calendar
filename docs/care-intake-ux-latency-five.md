# Owner intake loading and draft recovery

## Changes

The owner form reports neutral progress after 10 seconds and exposes an explicit retry after 30 seconds or an earlier read failure. Retrying increments the attempt generation, so callbacks from an older request cannot replace the newer result. A successful callback from the current attempt still opens the form if it arrives after the wait state and before a retry. Once the form is open, an extra or stale retry action is ignored so saved answers are not reapplied over current edits.

Google Apps Script does not provide cancellation for an in-flight `google.script.run` call. A manual retry can therefore overlap the timed-out request; the attempt guard discards the old result. The 10-second progress message and 30-second retry point are interface budgets, not backend latency measurements. No server read or cache change is included.

Session drafts remain in tab-scoped `sessionStorage`, keyed by the secure intake token. Allowed answer fields restore with a short notice. Booking identity and dates, legal consent, signature name/date, and signature pixels are not saved or restored. Restoring a draft never submits it. Text entry writes are coalesced for 300ms and flushed on field change, page hide, or tab backgrounding. Confirmed submission removes the draft and prevents queued writes from recreating it.

Loading, pending submission, failures, restored-draft status, and completion use polite live announcements. Submission stays single-flight while the server result is pending; an uncertain write is not automatically retried.

## Testing matrix

| Scenario | Expected result |
| --- | --- |
| Prefill is still pending at 10 seconds | Neutral progress is announced |
| Prefill reaches 30 seconds or fails | A focused user action is available to retry; no automatic retry occurs |
| A late result arrives before retry | The current successful result opens the form |
| A late result arrives after retry | The older result is ignored |
| Retry is triggered twice or after the form has opened | Only one new request starts; current inputs remain unchanged |
| Draft has permitted answers | Those answers and the saved step restore, with a status notice |
| Draft has only excluded fields or no usable fields | No restored-draft notice or step change appears |
| Saved answers or draft contain consent, signature, identity, or date values | Those values do not restore |
| Several keystrokes happen within 300ms | One trailing draft write stores the final value |
| Field changes or the page is hidden | Pending draft state is written immediately |
| Submission is pending, fails, or succeeds | Pending state stays neutral and single-flight; failure is actionable; confirmed success announces completion and removes the draft |

The actual seven-step template was exercised with a stubbed `google.script.run` in Chromium and WebKit, at 320, 390, and 1440 pixels, in light and dark themes. Browser timings from this stub verify state handling only. They do not represent live server speed or physical-device latency.

## Review before signing and timing diagnostics

Step 7 keeps six read-only answer groups inside one collapsed-by-default “Review your answers” disclosure ahead of the existing declaration, consent checkboxes and signature. Each group has one Edit action that returns to its source step and focuses its first field. The disclosure state survives a form reload in the same tab. Empty answers are shown as “Not provided”; answer text is inserted as text, not interpreted as markup. Consent and signature values are not repeated in the review. Editing a value does not submit the form. If care answers, signer name or declaration date changes after ink is added, the ink and both confirmations clear while the answers remain; moving between steps without changing signed content keeps the ink.

The prefill response includes numeric timings for intake-sheet setup, token lookup, booking-sheet read, inclusive booking resolution, exclusive audit read, inclusive audit verification, timezone lookup and total `getIntakePrefill_` execution. Audit reading is inside audit-verification time; timezone lookup is inside booking-resolution time. Do not add nested durations together. The server total covers this helper only; it excludes Apps Script invocation setup and response serialization. Durations use server `Date.now()` and can be zero or reflect clock adjustments, so they are diagnostic values, not latency guarantees. The browser emits a transient `waffle:intake-diagnostics` event with only numeric fields: `rpcMs` ends when the prefill callback starts, and `renderMs` measures `populatePrefill` separately. These browser timings are not physical-device measurements. No answer, token, booking identity, URL, audit content or duration is stored by this event.

### Live read-only baseline — 2 November 2026

Six sequential HTTP GET prefill calls to the deployed read endpoint all returned success. The expected Cino identity, confirmed booking type and 1–11 November dates matched in all six; only those match booleans were retained. The first three client elapsed times were 4,710, 3,189 and 3,203 ms. Across those calls, booking-sheet reads took 185–228 ms; booking resolution took 281–352 ms inclusive of migration proof; audit reads took 90–135 ms; audit verification took 168–235 ms inclusive of the audit read; timezone lookup took 2–3 ms. A second three-call set varied (booking read 233–452 ms, booking resolution 306–725 ms, audit read 127–171 ms, audit verification 215–576 ms, timezone lookup 2–4 ms). These were direct GET measurements, not browser `google.script.run`, controlled cold/warm runs or device measurements. They confirm a successful exact-stay read and show variation in sheet work; they do not identify a code-local bottleneck or support an optimization yet. The new intake-setup/token and helper-total stages must be measured on the deployed revision before making a performance claim.
