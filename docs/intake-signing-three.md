# Owner intake signing refinements

## Built deliverables

The final **Review & sign** step shows the token-prefilled dog and stay dates next to the declaration, so owners can confirm which booking they are signing without returning to the top of the form. The context is read-only and remains tied to the booking if the editable declaration name changes.

The signature pad now has visible instructions for signing by finger, stylus, or mouse, linked to the canvas for assistive technology. **Clear signature** is disabled until ink exists. Clearing removes the mark, disables the action again, focuses the signature pad, and politely announces that a new signature is needed. The existing validation still requires a fresh signature before submission.

Booking identity/date defaults, legal text, explicit consent checkboxes, draft exclusions, and submission payload are unchanged. No new reads, writes, or persistence were added.

## Testing matrix

| Scenario | Expected result |
| --- | --- |
| Review synthetic Cino booking at 320, 390, and 1440px | Signing context shows the canonical dog name and exact dates; editable declaration changes do not change the context |
| Open the signature step | Owner name, dog name and date retain their canonical prefill; canvas instructions are visible and described by its accessible name |
| Leave the signature blank | Clear action is disabled; submission still requires an explicit signature and both explicit consent checks |
| Draw, clear, then draw again | Clear becomes available after ink, announces clearing and focuses the blank pad; a fresh signature is needed before submission |
| Correct a signature validation error | The canvas retains its instruction description alongside the linked error, then restores the original description after correction |

The production `apps-script/Intake.html` template was exercised with a stubbed `google.script.run` in Chromium and WebKit. Manual physical-device and screen-reader acceptance remains outstanding.
