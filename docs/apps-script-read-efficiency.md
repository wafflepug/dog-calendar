# Apps Script read efficiency — first batch

Scope: check-in/out identity validation, current Care directory operation matching and check-in profile-sync response work. No UI/schema changes or paid dependencies.

| Path | Before | After |
|---|---|---|
| Stable-ID operation identity check | Two full booking data reads | One full booking data read |
| Current directory operation matching | Reads bookings again | Reuses the same request's sheet and rows |
| Check-in profile-sync response | Saves profile then reloads/derives its unused full response | Saves/audits as before; returns a small internal acknowledgement |

Snapshot reuse is explicit and request-local, never a persistent/global cache. Duplicate, quarantine and owner/date identity checks remain. A legacy operation that assigns a new Stay ID still rereads its booking inventory after that mutation. Ordinary master-profile save callers retain their full response.

Verification: JavaScript syntax/diff checks; targeted operation identity and Care backend read-count checks passed. Instrumented synthetic stable-ID operation showed booking full reads 2 → 1. Focused master-save simulation confirmed skipResponse avoids a reload while preserving the write/audit; default callers still reload for their complete response. No live guest writes and no broad regression suite. There is no visual change, so before/after evidence is the read-count table rather than UI screenshots.

Limits: this does not eliminate Apps Script cold starts, lock waits, network round-trips or other Sheets calls. No live timing claim is made. Next: instrument server phases around target lookup, operation scan, audit and profile sync, then optimise the dominant phase using measured production-safe timings.

Token lite: exact usage unavailable.
