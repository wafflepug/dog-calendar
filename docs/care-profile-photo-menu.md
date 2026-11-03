# Care profile photo menu — 3 November 2026

Built: a compact Photo options dropdown at the top-right of the selected Care profile. Change profile photo activates the existing current-card editor; its duplicate button in Tools is hidden only after successful menu mounting. Photo gallery stays in Tools. No backend or upload behaviour changes.

Interaction: native details/summary keyboard activation, 44px touch target, Escape closes and returns focus, outside click dismisses without taking focus. Opening the editor first focuses the visible menu trigger. The menu is removed when the profile deactivates. The original photo control remains available if mounting cannot find its required nodes. Identity spacing reserves room for the trigger.

Verification: syntax/diff review; synthetic phone390/320 and desktop1440 captures; Escape dismissal; no page overflow/errors; clicked the menu action, confirmed the established editor opened and cancelled it. No uploads, production writes or regression suites. Physical phone/screen-reader verification remains manual.

Manual matrix: open a current and past profile, open Photo options, choose Change profile photo, cancel; confirm gallery remains under Tools. Repeat at narrow width/dark mode and with a long name; use Enter/Space, Tab and Escape. Switch guests and confirm the old menu closes and the new action refers to the selected guest.

Before/after gallery: output/care-photo-menu-review/review.html. Asset revision 2026.11.03.10. Next backlog: simplify repeated empty optional fields in detailed Care without hiding safety warnings. One Luna task plus lead review; exact tokens unavailable.
