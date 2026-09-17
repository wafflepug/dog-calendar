# Follow-up: privacy-safe read attribution

Local samples produced different cumulative profile attempt counts because background reads can overlap the measured phases. Use the attached JSON report for each run rather than a fixed expected count. These are fixture observations from two browser checks, not a backend or cache claim. The current slice cannot attribute identity, cache hits, callback application, or backend time. Pending fixture requests have null fulfillment timing rather than an invented zero duration.

Next, add an in-memory opaque request identity in the test fixture and caller-side timing hooks. Compare cold repeat reads before any cache coalescing change, then measure warm behavior at an actual cache boundary. Keep identities opaque, omit URLs, keys, names, contacts, notes, and payloads, and continue blocking all mutations.
