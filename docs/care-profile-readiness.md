# Care profile read readiness

Profile details keep the Directory shell and the selected dog's saved details
usable while a fresh read runs. The profile-only read uses one 15-second
attempt; mutation timeouts and the shared read policy are unchanged.

The inline status distinguishes `Loading care details…`, `Saved details shown
· refreshing`, `Saved details current`, and `Unable to refresh saved details`.
When a refresh fails, cached attributes remain visible and the scoped Retry
button retries only that profile. A cold failure keeps the existing error
surface and explains that care details could not load. No status treats missing
care fields as clear or safe.

This is a client readiness refinement. It does not change Apps Script reads,
backend schemas, mutation behavior, or media keys. The shared JSONP lifecycle
keeps existing behavior, with an opt-in late-callback grace window used only
by the profile read; the broad retry and timeout policy remains unchanged.
