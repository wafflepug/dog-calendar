# Care roster stay actions

Staying guest cards expose operational check-in and checkout without opening a Care profile. Actions retain the selected booking identity and use the existing verified online write pipeline. Early departures use the existing early-checkout confirmation and preserve original booking dates.

## Acceptance and verification

- Active date-based stays offer Check In. Already checked-in stays omit it.
- Checkout today uses confirmation; departures before the booked end use Early Checkout.
- Successful checkout immediately moves the stay to Past.
- Future and Past cards expose no roster actions.
- Buttons remain readable on narrow phones, touch accessible, and separate from profile opening.
- Duplicate clicks cannot submit a second concurrent status write. Failed or offline writes retain the stay and allow retry.
- Two dogs sharing a name retain distinct Dog ID / Stay ID payloads.
- No profile details need fetching to use these controls.

Browser tests use synthetic bookings and stub writes. Production checks are read-only.
