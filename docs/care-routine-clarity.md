# Care routine clarity

Six bounded improvements clarify the selected guest profile without adding backend reads or writes:

1. Medication distinguishes saved wording, empty instructions, loading, failed reads, missing profiles and identity review. Negative owner responses remain verbatim.
2. Feeding uses Times, Amount and Food labels for populated values; blank profiles show one concise empty state.
3. Empty Food & Walks, Behaviour and Health & Home categories explain which details are missing. Safety handling remains unchanged.
4. Edit and Discard accessible names identify the dog and Detailed Care section.
5. Selected-profile source/count badges use readable 12px text and wrap. Existing field labels already passed the readability check and remain unchanged.
6. Curated category summaries use at least 13px text and wrap without a two-line clamp on phones.

## Testing matrix

1. Open populated profiles: check labeled feeding values and exact medication wording, including an explicit saved negative response.
2. Open a blank profile: check specific empty messages and an available Edit action.
3. Simulate slow, failed, missing and ambiguous reads: each state remains distinct; identity review must not expose another dog's instructions. Saved values survive failed refreshes where validated.
4. Edit unsaved details, collapse/reopen categories, then discard: drafts and existing controls behave consistently. A screen reader identifies the dog on Edit/Discard.
5. Check 320px, 390px, tablet and desktop in light/dark modes with settings accents: source badges and summaries wrap, controls remain reachable and no horizontal page overflow occurs.

Automated fixtures block live writes. Physical-phone and screen-reader checks remain manual.

The scroll-access fixture waits for three consecutive animation frames with stable button geometry and a matching hit target after scrolling. Its deterministic booking date uses a Date-only override rather than Playwright's clock, which also replaces performance timing and animation frames. A failing WebKit trace showed non-monotonic pointer timestamps and native hit targets disagreeing with JavaScript hit tests. Native pointer-down, pointer-up and click target assertions remain unchanged; scrolling and rendering use native timing.

Next backlog item: make Owner Care Link and Book Again clearly distinct in the selected-profile actions, retaining the compact identity header and existing navigation.
