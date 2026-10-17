# Condensed Care Profiles — release candidate

Requested items: 1–4. Build 2026.10.17.03.

**Built Deliverables**

- A smaller selected-profile header keeps one photo and identity block, adjacent stay dates, and the relevant primary stay action. Secondary checkout actions use a native More actions disclosure when Check In is available. Existing exact-stay targeting and operation safeguards remain in place.
- Safety and full medication instructions appear before routine care. Stable-ID safety uses the validated profile for the selected stay; conflicting identities and malformed safety flags remain unavailable rather than appearing clear. Populated handover text stays fully visible.
- One Feeding & walks card uses labelled values from the already-loaded profile. Only long food descriptions use an optional disclosure; full medication instructions remain visible. Owner name and Call owner share one compact row.
- Detailed Care uses compact read-only rows. Blank optional fields share a Missing information disclosure within each category. Loading, failed refresh, missing profile and identity conflict remain distinct. The existing editor controls and unsaved drafts are preserved.

**Testing Matrix**

1. Open a current guest on 320px and 390px phones and a 1440px desktop, in light and dark themes. Check one photo/identity, readable dates, no horizontal overflow, and 44px action targets.
2. Exercise Check In plus secondary checkout actions, then a sole checkout action. Expand More actions with keyboard input. Verify the selected Stay ID and Dog ID remain unchanged, including same-name guests. Past profiles must not gain live stay actions.
3. Compare safety, full medication instructions, feeding and walks against the saved profile. Test clear, populated, malformed and conflicting safety records; none may borrow another guest's information. Expand a long food description and repeat an unchanged render; retain its open state and focus.
4. Expand Detailed Care categories and Missing information. Edit a populated field, keep a draft, and repeat the same-data render. Confirm the draft and focused input survive. Refresh failure must retain saved values without confirming missing information. Switching identities resets local disclosure state.
5. Count profile reads during opening, disclosure changes and editing. Opening may use the existing cache or one shared read; disclosure and edit presentation must add no profile requests. Synthetic fixtures block all writes; live verification is read-only.

Validation results, final CI and deployment attribution are recorded in the verified report after release. This candidate document does not claim deployment.

**Next Backlog Item**

Consolidate secondary profile tools into one clearly labelled location, keeping common actions prominent and avoiding new reads. Scope: output/backlog/after-condensed-care-profiles.md.
