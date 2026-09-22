# Care navigation continuity

The directory list origin is held in memory only while a profile is open. On
the first list-to-profile transition, the runtime records the selected stay
key, the search value, the document/window scroll position, and the matching
profile opener. Refreshes and profile switches do not replace that origin.

Back runs the existing filter path, restores the recorded search value, then
uses a bounded layout restore to clamp scroll to the current document height
and focus the matching opener with `preventScroll`. Two short follow-up passes
recover focus only if a compatibility renderer replaced the card and left
focus on the document; they do not override a control the user has selected.
If the stay was removed, the restore focuses the first visible opener, the
search field, or the stay tab/grid as a final fallback. The record is cleared
after that restore, and no state is persisted.

Main and secondary profile tabs retain their existing ARIA tab semantics. Both
have a visible selected state, keyboard focus ring, and at least 44px touch
height in the mobile layout. Tab styling does not trigger profile or belongings
reads.
