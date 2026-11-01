# Care operational identity context

## Sitter steps

1. Open **Guests** and use the current-stay roster. Check In, Check Out, and Early Checkout remain on their existing controls.
2. For same-named guests, listen for the action name: it includes the public Dog Number when valid, then the owner and booked dates.
3. Open **Check Out** to review the selected stay. The dialog title names the guest; its description repeats available public identity and booked dates. Confirm only after checking the stay details. Cancel closes without saving.
4. If a public Dog Number is missing or invalid, the UI omits it and uses the available owner and booked-date context. Internal IDs are never shown in these labels.

## Verification matrix

| Scenario | Chromium | WebKit |
| --- | --- | --- |
| Duplicate-name roster actions, same-owner stays without a public Dog Number, rendered Dog Number parsing, and checkout A-to-B context refresh | 320, 390, 1440px | 320, 390, 1440px |
| Guided checkout flow, note and evidence review, retries, cancellation, and completion | 390px | 320, 390, 1440px |
| Roster operation actions and early checkout | 1280px | 1280px |

Generated runtime fixtures verify that opening or cancelling checkout adds no write, identity labels cause no profile read, malformed/zero/UUID Dog Numbers are omitted, and a valid rendered `Dog ID: #18` becomes `#00018`. The MVP source gate covers 431 Node fixtures and five Python contracts. The first-open cache test verifies that the new asset revision works with an older active service worker.
