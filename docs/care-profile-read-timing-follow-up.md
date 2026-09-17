# Follow-up: privacy-safe read attribution

The one local sample produced cold profile attempts `1`, warm-first `3`, and warm-reopen `3` (reopen delta `0`). These are fixture observations from two browser checks, not a backend or cache claim. The current slice cannot attribute identity, cache hits, callback application, or backend time.

Next, add an in-memory opaque request identity in the test fixture and caller-side timing hooks. Compare cold repeat reads before any cache coalescing change, then measure warm behavior at an actual cache boundary. Keep identities opaque, omit URLs, keys, names, contacts, notes, and payloads, and continue blocking all mutations.
