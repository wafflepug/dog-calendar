# Check-in confirmation reliability

Reported: Bogo and Chiko, Today, first attempt errored/lagged and a second press succeeded. The exact first error text was unavailable. No production action was replayed during investigation.

Code findings: Today performs a current-operation read, capability read and mutation. The JSONP mutation times out after 15 seconds while Apps Script may still be running. Successful operations also scheduled delayed calendar CSV refreshes despite not changing booking dates. Today previously treated a freshly confirmed already-completed status as an error. These are verified code behaviours; attributing the reported incident to a lost acknowledgement remains a hypothesis without its logs.

Changes:
- Exclude checkin_stay, checkout_stay and early_checkout_stay from unnecessary scheduled calendar CSV syncs. Existing exact operation indexing and directory/audit cache invalidation remain.
- On a transport timeout/network failure, read the operation once using the exact Stay ID and key. Do not resend the write. Require one nonconflicting record, the requested status, matching Stay ID/key/dog/dates through the existing response validation.
- If the read cannot confirm, report uncertainty and ask for a status refresh before retrying. Validation rejections are not recovered as successful operations.
- Today confirms an already-completed exact stay status and rerenders rather than showing a false failure.

Focused verification: syntax/diff checks plus local VM simulation: lost acknowledgement recovered with one mutation/one recovery read; duplicate or wrong-dog records rejected; business validation errors not retried. No live dog writes and no broad regression suite. No layout change, so before/after UI screenshots are not applicable. Exact token usage unavailable.

Remaining: Apps Script/Sheets execution latency is still present. Backend follow-up work and the preflight read chain should be profiled separately before further optimisation.
