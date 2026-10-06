# Care later-arrival accessibility

Later-arrival profile controls now name the dog and include its available Dog Number or stable dog/stay ID, plus owner and stay dates. The current roster uses the same naming helper, including when the care-status text refreshes. Dog Number values are accepted only when numeric; invalid legacy text is omitted.

Back restores focus to the originating card by Stay ID, then Dog ID with its dates, or a unique legacy owner/name/date match. If the original cannot be identified uniquely, focus returns to the search control. The originating query and scroll position continue to be restored. The card focus ring uses the Care accent and remains visible inside the clipped card.

The browser regressions cover keyboard opening and return, filtered-query preservation, same-name later arrivals, all detail sections remaining lazy, no profile reads before opening, and 320px light/dark layouts. Later arrivals still use the existing natural stay key; identical dog-name/date entries remain subject to that legacy de-duplication behavior.

## Manual verification

1. In Care, search for a guest and open its profile using the keyboard. Check that
   the focus ring is visible and Back retains the query and returns to that card.
2. Expand later arrivals. Check profile button names with the browser accessibility
   inspector: same-name guests include existing identifiers, owner and stay dates.
   Legacy text such as “Other” must not appear as a Dog Number.
3. With a profile open, refresh or remove its original booking in a fixture. Back
   must find the same stable ID, or focus search if missing or ambiguous.
4. Check 320px and normal phone/desktop widths in both themes. Verify no horizontal
   page overflow and no profile/media request until a profile is opened.

Browser emulation does not replace physical iPhone and Samsung Fold4 verification.
The next item is search coverage and identity-safe later-arrival deduplication;
see `next-care-search-consistency.md` for the bounded follow-up.
