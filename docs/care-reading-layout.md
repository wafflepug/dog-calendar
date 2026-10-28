# Care reading layout

Release 2026.10.29.02. Builds on PR #275 with three Care-only presentation improvements.

## Built deliverables

1. Bound wide desktop Care content to a comfortable 1040px reading width inside the existing navigation shell. Mobile continues using available width.
2. Align the desktop page heading with the top of search and supporting controls, preserving the stacked phone layout and existing disclosures.
3. Establish readable Care typography for guest names, stay context, owner, Dog ID/status and profile care text. Guest rows and search inherit the existing Care font, including WebKit. Preserve configured themes, complete safety/medication and wrapping.

No new actions, data requests, backend changes or libraries. Today and Calendar remain outside the stylesheet scope.

## Testing matrix

| Journey | Steps | Expected |
| --- | --- | --- |
| Roster | Inspect long and same-name guests, ID/status/dates at 320/390/820/1024/1440/1920px | Readable text, no overlap or horizontal scrolling |
| Desktop | Inspect heading/search alignment and open work/records disclosures | Bounded reading width; heading top-aligned; controls wrap within content |
| Profile | Open a current guest with medication and routine instructions | Exact guest/stay retained; full care text visible and readable |
| Navigation | Return to Guests with search/filter active | Existing query, tab, focus and scroll behavior retained |
| Accessibility | Keyboard controls, double text size, light/dark themes | Visible focus, wrapping, 44px action targets, readable labels |
| Failure state | Review unknown or failed profile read and retry | Truthful missing/unknown states and existing retry remain |
| Performance | Resize and change themes without opening another guest | No profile reads caused by presentation changes |
| Scope | Inspect Today/Calendar and deployment metadata | No Care styling outside Directory; backend unchanged |

Validation: all 412 Node and five Python MVP checks passed. Twelve established readability/toolbar cases passed, followed by six final reading-layout cases across Chromium/WebKit at 320/390/1440px projects; each new case also exercises 820/1024/1920px, both themes and complete profile medication text. Four final search/font and toolbar cases then passed in Chromium/WebKit after extending font inheritance to search.

Automated checks use synthetic records. Physical phones and assistive technology remain manual checks.

## Next backlog item

Observe the arrival-to-profile-to-checkout journey with a sitter and prioritise any remaining scanning bottleneck before adding controls.
