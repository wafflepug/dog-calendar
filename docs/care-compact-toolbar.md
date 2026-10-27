# Care compact toolbar

Candidate 2026.10.27.02. Care-only frontend refinement for a sitter who frequently searches the guest roster.

## Built deliverables

- Use the toolbar's available width for dog, owner and Dog ID search rather than an intrinsic-width field.
- Place the existing Today's work and Manage records disclosures alongside each other when closed on phone/tablet layouts.
- Give expanded tools and search feedback their full width in normal page flow. Preserve the existing controls, keyboard order and profile return behavior.

No new controls, icons, background reads or backend changes. Today and Calendar content is unchanged. Detailed Care's independent collapse, focus return and draft preservation were audited; those behaviors already exist.

In the synthetic 390px comparison, the search/toolbar grew from 225px to 354px, while the closed toolbar height fell from about 158px to 100px. These are layout measurements, not measured sitter time savings.

## Testing matrix

1. Open Care at 320, 390, 768 and 1440px in light and dark themes. Check that search fills its toolbar, headings stay readable and all controls fit the page.
2. Open Today's work, Manage records, and both. Expanded content must fit without overlaying adjacent controls or guest filters; visual and keyboard order must agree.
3. Search for an exact Dog Number, clear the search, and check empty results. Keep the existing filter behavior and readable feedback.
4. Open a profile and return to Guests. The roster toolbar hides during profile mode and returns with the search/filter state intact. These layout actions must not cause an additional profile read.
5. Enlarge text and repeat the supporting disclosure checks. Keep 44px targets and visible keyboard focus. Check Chromium and WebKit. Physical-phone verification remains a separate validation step.

## Next backlog item

Observe arrival, quick care lookup and checkout on physical phones and prioritise actual repeated touchpoints. Estimated frequency: daily; expected benefit: less scanning and scrolling; effort: one bounded sitter observation session. No measured time savings are claimed.
