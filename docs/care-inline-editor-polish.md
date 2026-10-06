# Care inline editor polish

Scope: the existing dog name, breed, owner, contact and handover editors on Care. No backend, payload, OCR or loading changes.

The editor uses Settings surfaces and accents, 16px editable controls, 13px labels/context/status, 44px close and action targets, wrapping for long names, and explicit keyboard focus. Inputs and the handover textarea share their field label and status description. Closing restores focus to the connected edit trigger while retaining existing dirty-draft and saving guards. Shared modal viewport sizing remains owned by quick-add-touch-scroll.js.

## Manual verification
1. Open a Care profile and edit each of the five field types. Read its label and existing value; unchanged Save remains disabled.
2. Enter a change. Check the unsaved state, discard confirmation, and return focus. Discard must preserve the saved value.
3. Save a valid change in a safe test environment; verify the updated record. Simulate a rejected save and confirm the draft and error remain available for retry. Try blank dog name validation and an ambiguous stay without sending a write.
4. Check 320/390/412px portrait and desktop, both themes, and all Settings accents. Long dog/owner names and handover notes must wrap without page overflow.
5. On a physical iPhone and Samsung Fold4, open the keyboard, rotate to landscape, scroll the dialog, and reach Discard/Save above the navigation. Browser viewport emulation is not physical keyboard verification.

Automation: the actual directory runtime browser fixture measures editor sizing, palette contrast, focus return, reduced-height reachability and accessible labels with production writes blocked. Existing unit tests cover save/draft/reconciliation rules. Style-state fixtures do not themselves prove a successful production save.
