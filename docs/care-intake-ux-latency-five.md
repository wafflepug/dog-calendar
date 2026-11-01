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
