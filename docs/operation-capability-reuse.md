# Faster repeated stay actions

Before: each check-in/out makes a server-capability lookup before its write. After: successful proof of stay-operation schema support is reusable in the same browser tab for 60 seconds. Concurrent lookups share one request. No stay status, booking identity or permission result is cached.

The cache expires, separates endpoint and frontend revision, clears after failed refreshes, and is not persisted. All normal backend validation and exact operation acknowledgement checks remain. The first action still makes its capability request; subsequent actions within the window omit one round-trip. This is a request-count reduction, not a measured live seconds claim.

Focused checks: concurrent deduplication, successful reuse, expiry at 60s, endpoint/build isolation and failure retry passed in a local VM. Syntax/diff checks passed. No production writes or broad regression suite. No layout change; before/after evidence is the request count rather than screenshots. Exact token usage unavailable.
