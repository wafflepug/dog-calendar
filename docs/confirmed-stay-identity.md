# Confirmed stay Calendar identity

V11.0.5 deduplicates only confirmed boarding events that have the same dog,
raw start/end dates, and identical normalized owner/contact/breed fields. Both
non-sentinel owner and contact values are required. Values such as `N/A`,
`Unknown`, empty strings, and placeholders do not prove identity. If both
copies provide an owner, phone, or breed, those values must agree; missing
fields versus populated fields are retained separately rather than guessed. An owner
conflict wins over a matching phone, and a breed conflict is preserved as a
separate same-name dog. Conflicting owner/contact aliases within a record also
make it ambiguous and prevent deduplication. Meet & Greet and Potential events are outside this
dedupe path.

The first event is retained because Calendar composition places the published
sheet before device-local optimistic copies. A missing edit link on that
retained event is backfilled from a duplicate copy. Raw dates remain on the
retained event so early checkout and capacity calculations continue to use
the source stay dates.

This is a bounded presentation-layer merge identity. Operational `stayKey`
values and backend schema still use their existing dog/date form and require a
separate migration before those keys can safely distinguish owners.
