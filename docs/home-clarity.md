# Home clarity and continuity

Release candidate 2026.10.28.02. Three refinements build on the compact desktop Home.

1. Pin the existing calendar in the wide desktop column only while its complete rendered height fits the visible viewport with 16px clearance above and below. Recompute on size changes and calendar content growth; tall months, short windows and stacked/mobile views keep natural page scrolling. No internal scroll trap or duplicated calendar.
2. Condense acknowledged empty guest, arrival and potential sections into concise messages. Preserve waiting/error states, populated care actions and existing loaded/cached data evidence. Do not infer an empty schedule from an unfinished load.
3. Reuse the mobile Palz Stay masks and theme colours in the desktop sidebar, retain Waffle House as workspace context, and align Home headings, card spacing and existing button targets. No new icons or images.

## Verification matrix

- At 1440/1920px in both themes, scroll a long Home column and confirm Calendar remains fully visible. Make the calendar taller or shorten the viewport: pinning must switch off so every date/control remains reachable. Re-enable after restoring enough space.
- At 1024px verify stacking, then resize to 820/390px and back. Retain the same calendar host, month and original mobile Today/Calendar routes. No duplicate IDs or speculative profile reads.
- Check confirmed empty tiles on desktop and mobile, then simulate pending, unknown and failed reads. Empty messages stay concise and visible; failures retain guidance. Returning populated data restores guest cards and actions.
- Check both sidebar logo masks in light/dark themes and the original mobile header. Verify headings, button targets, keyboard focus, wrapping and source/identity links.

Automated checks use isolated read-only fixtures. Measured time savings and physical-phone checks remain separate.

## Next backlog item

Review busy-day layouts using many guests, long names and simultaneous arrivals, keeping the current condensed hierarchy and exact identities.
