# Care navigation continuity

The directory list origin is held in memory only while a profile is open. On
the first list-to-profile transition, the runtime records the selected stay
key, the search value, the document/window scroll position, and the matching
profile opener. Refreshes and profile switches do not replace that origin.

Back runs the existing filter path, restores the recorded search value, then
uses a bounded layout restore to clamp scroll to the current document height.
It also retains the opener's viewport position and adjusts the current scroll
when rows above it were inserted or removed during an operation or refresh.
The matching opener receives focus with `preventScroll`. Two short follow-up passes
recover focus only if a compatibility renderer replaced the card and left
focus on the document; they do not override a control the user has selected.
If the stay was removed or filtered out, the restore focuses the search field,
the selected stay tab, or the grid as a final fallback. The record is cleared
after that restore, and no state is persisted.

Main and secondary profile tabs retain their existing ARIA tab semantics. Both
have a visible selected state, keyboard focus ring, and at least 44px touch
height in the mobile layout. Tab styling does not trigger profile or belongings
reads.
