# Care status, empty states and section navigation

Release candidate: 2026.10.17.02. These changes address items 5, 8 and 9 from the enhancement list. Use synthetic fixtures for write/failure testing; live verification is read-only.

| Journey | Steps | Expected result |
| --- | --- | --- |
| Record freshness | Open a saved Care profile, then exercise background refresh, offline cached access and failed refresh. | One concise state distinguishes saved data, refreshing, offline and failure. Record update time is not presented as the last fetch time. |
| Unknown timestamps | Use a saved record with no timestamp, an invalid timestamp and a future timestamp. | Update time stays unknown; the UI does not invent a recent save. |
| Pending edits | Edit a field without saving, then refresh its metadata in the fixture. | The draft and its unsaved/save/error feedback remain visible and attributable. |
| Loaded empty roster | Load no Staying guests while Arriving contains guests; use the empty-state action. | The message is contextual, and the action uses the existing Arriving view without opening a profile or loading details automatically. |
| Loading and failure | Hold or fail directory/Past reads with no existing cards. | Loading or unavailable data is not described as a confirmed empty roster. |
| Search and later arrivals | Search for no matching guest, clear the query, and explicitly open later arrivals. | Search/reset retains the selected view and focus; future loading remains intentional and bounded. |
| Section memory | Open/close several Detailed Care sections, close the profile and return. Switch to another guest, including a same-name guest. | Each verified stay retains its own choices, including all sections closed. Choices are not transferred by name. |
| Identity changes | Reuse a card for changed IDs or an ambiguous legacy identity. | State is not silently inherited from another stay; mounted legacy cards remain usable. |
| Keyboard and layout | At 320/390/1440px, use keyboard and touch in light/dark themes. | Actions, status text and section controls are readable, reachable and visibly focused. |

Automated checks must include Chromium and WebKit, actual DOM identity/focus and read counts, existing Care continuity/overview/Records regressions, and the full PR gate. Section memory is scoped to the current page session; no backend or persistent care-data store is introduced. These UI changes do not change Apps Script/Sheets processing time.
