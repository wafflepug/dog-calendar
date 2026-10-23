# Multi-visit completion and owner sharing

The Review results keep the existing Saved, Queued and Needs attention counts and each dog/date outcome. A short next-action line describes whether the plan is still saving, has queued or failed work to review, has unfinished visits to resume, or is ready for owner sharing.

After a stay is confirmed saved and its response includes a safe HTTPS intake link, the collapsed **Share a saved stay’s care form** disclosure offers that exact stay. Choose the dog and dates, verify the displayed readable Dog ID and stay dates, then copy the care form link. The disclosure does not generate links, send messages or combine links from different stays. Queued, failed and missing-link rows do not become copy options. If a saved row has no returned care link, prepare one later from Owner Care Link in Care. If the saved row has no readable Dog ID, the in-plan copy action stays disabled.

The existing Resume action continues to use the frozen plan intents. Successful rows remain skipped; only unfinished rows are retried. A queued response is not reported as saved. The selected stay remains selected when result rows refresh, and keyboard focus returns to the same control when it still exists. Clipboard failure reveals the selected link in a read-only field and focuses it for manual copying.

## Demonstrated onboarding steps

1. Confirm the plan once and review the saved, queued and needs-attention counts and row outcomes.
2. If work is queued or needs attention, check sync status or review the error, then use **Resume planned visits** only for unfinished rows. Do not create a replacement plan for saved visits.
3. Expand **Share a saved stay’s care form**, choose one saved dog/date result, and check its Dog ID and dates before copying.
4. Paste the copied link into that owner’s usual chat and verify the recipient before sending. Copying does not send a message.
5. If a saved stay has no returned link, prepare it later from **Care → Owner Care Link**. A queued or failed stay has no sharing action.

Browser coverage uses synthetic write responses and validates one dog across two dates, two dogs across two dates, saved/queued/failed result states, a missing link, clipboard failure, long labels, keyboard focus, and 320/390/1440px in light and dark themes. The browser suite is not evidence of a real guest write or a production release.

## Task Completion Report

**Built Deliverables:** Compact completion guidance, one exact saved-stay sharing selector, explicit copy with manual fallback, retained selection/focus during save updates, coordinated candidate assets, and updated onboarding guides. Luna implemented the UI; the lead reviewed it and added the browser tests.

**Testing Matrix:** All 66 planner/runtime cases and 12 single-booking sharing cases passed in Chromium/WebKit. All 374 Node checks and five Python contracts passed. To verify manually: save two dogs across two dates, choose each saved stay and check its copied link; simulate a queued/failed response and resume only unfinished intents; deny clipboard access and check the selected fallback. Cover missing links/IDs, keyboard, 320/390/1440px, both themes and enlarged text. Physical-phone validation remains manual.

**Next Backlog Item:** Resolve the existing phone-regression gate before release, then audit truthful queued-plan recovery guidance. This candidate depends on PR #242 and is not deployed. See PR #243 for the current branch and CI status.
