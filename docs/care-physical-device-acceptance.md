# Care refinement batch — physical-device acceptance

Browser automation can reproduce viewport geometry, colour themes, enlarged text and reduced viewport height. It cannot establish actual iOS keyboard behavior, VoiceOver, TalkBack, safe-area handling or Fold hinge behavior. Physical-device checks below remain unverified until performed on those devices.

Record device/model, OS version, browser, app revision, pass/fail, screenshot and reproduction steps for each failure. Use a synthetic test guest and the test deployment for saves.

| Check | iPhone | Samsung Fold4 | Expected result |
| --- | --- | --- | --- |
| Open Care and select a guest | Not verified | Not verified | One clear identity header, correct Dog ID and stay |
| Increase system text size / browser text to 200% | Not verified | Not verified | Feeding, medication and section labels wrap; no clipped value |
| Expand two categories, collapse one | Not verified | Not verified | Other category remains expanded; no extra profile loading |
| Type a care draft; visit Belongings and return | Not verified | Not verified | Draft and expanded sections retained; no automatic save |
| Open a long editor with keyboard visible | Not verified | Not verified | Save/Cancel reachable above or by scrolling past navigation; no hidden field |
| Rotate with editor open | Not verified | Not verified | Modal remains contained, scrollable and usable |
| Fold/unfold with an open profile or modal | Not applicable | Not verified | Layout reflows without loss of draft or focus |
| VoiceOver/TalkBack disclosure controls | Not verified | Not verified | Correct section name and expanded/collapsed state announced |
| Staying quick check-in/checkout | Not verified | Not verified | Correct stay, distinct action controls, busy state and retry |
| Failed/offline refresh | Not verified | Not verified | Saved content remains readable with honest freshness/error |

Do not record customer notes, contacts or medication details in shared screenshots. A physical failure should identify the affected control and its route so the fix can be mapped to a focused code regression.