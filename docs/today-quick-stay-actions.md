# Today arrival and departure actions

## Built deliverables
Today actions expose Check in on an arrival day and Check out on a departure day. Profile and Meet & Greet links remain available. Actions use the existing confirmed-stay operation service, preserving booking identity, offline protection and verified server responses. Completion is shown only after confirmation.

## Testing matrix
1. On an arrival day, check in the selected dog from Today; verify only that stay changes and duplicate taps cannot create another write.
2. On a departure day, choose Check out, review the dog/stay and confirm. Cancel must make no change.
3. For a same-day visit, check in first, then check out; a checked-out stay must not offer another operation.
4. Other dates, potential bookings and Meet & Greets must not offer stay-operation buttons.
5. Test same-name dogs with different IDs and dates. Only the selected identity may change.
6. Test offline, rejected, missing-identity and unconfirmed responses: show feedback, preserve state and avoid claiming success.
7. At 320px, 390px and desktop widths, verify readable wrapping, keyboard focus, touch targets and no button inside a link.
8. Use synthetic fixtures for automated writes. Production verification is read-only.

## Automated verification
- 22 Today queue and shipped-page browser checks passed in Chromium and WebKit.
- 12 bootstrap/release tests passed; active runtime contract and JavaScript syntax checks passed.
- Reviewed the real 320px Today screenshot: complete labels and separate, readable action buttons.
- All automated data is synthetic; production bookings were not changed.

## Next backlog item
Keep completed daily actions clear and easy to audit without competing with the remaining arrivals and departures.
