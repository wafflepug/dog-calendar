# Care profile read optimisation report

The uncached `get_guest_profile` builder reads the booking sheet once to prove a unique Stay Key and verify any requested Stay ID / Dog ID. It then reads the Care sheet. Before this change, the Care helper fetched the header row and body rows through two separate `getRange().getValues()` calls. It now fetches one bounded range covering the existing Care header and rows, then validates the same header prefix and filters matching records in memory.

| Path | Booking data reads | Care data reads | Total data reads |
| --- | ---: | ---: | ---: |
| Before, uncached | 1 | 2 | 3 |
| After, uncached | 1 | 1 | 2 |

The synthetic fixture invokes the actual `getGuestProfileDetail_` and `readGuestProfileRowsReadOnly_` source and counts spreadsheet data-range reads. It confirms the successful path performs one booking `getDataRange()` and one Care `getRange()`, with no writes. The fixture also checks duplicate identity rows, duplicate identity headers (covered by the existing identity fixture), malformed Care headers, and equal legacy keys with conflicting identity records remain unresolved. Existing identity and record-update contract suites pass with the single-snapshot fixture shape.

The change leaves the existing directory version cache and the 90-second profile TTL untouched; it adds no cache. The invocation-count fixture exercises the uncached builder directly. It makes no claim about deployed CacheService cold/warm behavior or backend execution time. Existing directory mutation invalidation coverage remains in `tests/dog-id-backend.test.js`.
