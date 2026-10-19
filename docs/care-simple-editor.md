# Care Simple Editor — three refinements

Primary person: a busy boarding carer using a phone. These refinements extend the daily Care summary without adding another read or screen.

## 1. Compact optional editor fields

Only blank age, weight, sex and allowed-treat fields sit under More details inside their existing group. Saved values remain directly visible. Medication, conditions, allergies, handling, emergency contacts, vet details and safety controls stay visible when their category is open. All fields retain the same selectors and save payload; collapsing a disclosure does not remove an input or discard its value. Disclosure state is retained only for the same profile identity.

## 2. Focus-safe category collapse

Food & Walks, Behaviour, Health & Home and Safety remain independent categories. When a category closes while keyboard focus is inside it, focus returns to its heading before the panel is hidden. Reopening preserves draft values and optional disclosure state. Navigation adds no profile requests.

## 3. Accessible optional controls

More details uses a native keyboard disclosure, a 44px minimum touch target, visible focus and wrapping text. Its contents stay hidden when closed on WebKit too. Read-only mode shows no optional editor disclosure. Phone edit fields stack into one column and respect the existing light/dark theme.

## Verification steps

1. Open a Care profile, select Health & Home and Edit. A saved weight appears immediately; blank age and sex sit under More details. Medication and emergency fields remain outside it.
2. Expand More details with Enter. Enter an age, collapse and reopen its category, and confirm the value remains. A programmatic category collapse returns focus to that heading. A background refresh preserves the draft and focused input.
3. Discard changes. Confirm the saved weight is restored and the unsaved age is cleared. No extra profile read is required for these local actions.
4. At 320, 390 and 1440px, enlarge text. Confirm headings, Save/Discard and optional disclosures remain readable, fit the viewport and offer at least 44px targets. Check light/dark and Chromium/WebKit.
5. Check missing, failed and identity-conflict records. Missing safety information must remain unknown; optional fields must never change identity or mask safety warnings.

Automated checks use synthetic data and block production writes. Deterministic text enlargement is not a substitute for a physical phone accessibility-settings check.

## Next backlog item

Review changed Care fields before saving: give the carer one concise list of edits, with explicit Save and Discard, without adding another profile read. Preserve the existing conflict, failure and retry rules.
