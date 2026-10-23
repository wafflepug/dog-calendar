# Owner sharing helper clarity

The compact booking handoff puts one action first: **Copy owner care link**. Its hint identifies the dog and stay dates, while “More options” keeps the message and native share action available without repeating the primary instruction. The owner link textarea stays hidden unless the explicit copy action fails. Failure reveals the field and selects it when focus remains on the handoff controls; if the user moved elsewhere while the copy was pending, the helper leaves focus there and tells them the field is available.

While the clipboard write is pending, the primary button is disabled and duplicate clicks are ignored. A successful retry hides the fallback and returns focus to the copy button when focus remained on the handoff controls. If the host rerenders while an operation is pending, its late result cannot change the detached card or take focus from the new view. Native share cancellation leaves a neutral cancellation status and never claims delivery.

The noncompact message helper keeps its existing copy and share behavior. Focused synthetic browser coverage is in `tests/owner-sharing-clarity.browser.spec.js`.
