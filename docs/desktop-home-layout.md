# Compact desktop Home

Candidate release 2026.10.28.01. Desktop Home keeps the mobile card hierarchy in one compact left column, with the existing full calendar in the right column when the workspace is wide enough. Smaller desktop windows stack the calendar below the summary. Mobile Today and Calendar remain separate views.

The same calendar instance, event handlers, exact guest/stay links and loaded data are retained. This layout adds no backend reads, permission prompts or data writes. The redesign prototype is not changed.

## Verification matrix

1. Open Home at 1440 and 1920px in light and dark themes. Check that the compact Home column aligns at the top beside the calendar, uses the same heading/card treatment as mobile, and stays within the available workspace after the sidebar.
2. At 1024px and with enlarged text, check readable wrapping and a stacked calendar without page-level horizontal overflow. Calendar day columns, search and previous/next/view controls must remain usable.
3. Resize desktop to 820/390px and back. Retain one calendar, one set of cards and original mobile order. Today hides the calendar on mobile; Calendar hides the Today cards. Verify both explicit routes and the default route.
4. Search by a fixture dog, navigate a month and open a guest. Keep existing behavior and exact dog/stay identity. Confirm no extra profile/background reads were introduced.
5. Use keyboard navigation. No duplicated IDs or hidden focus targets; touch targets remain at least 44px for important actions. Confirm safe clipping/scrolling within intentional horizontal portrait and tracker strips.

Automated browser checks use synthetic read-only fixtures. Physical-device validation and measured task-time improvements remain separate.

## Next backlog item

Observe the side-by-side Home view during a sitter's arrival and departure planning. Prioritise any repeated scrolling or searching found in actual use before adding dashboard controls.
