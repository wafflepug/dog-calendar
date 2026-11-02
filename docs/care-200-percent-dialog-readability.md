# Care profile and dialog readability at 200% text

Candidate release 2026.11.02.04, service worker 170. Audited the selected Care profile and existing stay-date and guest-detail dialogs at per-element 200% computed text. The fixture intercepts writes; this change does not alter guest data or dialog actions.

## Changes

1. Profile stay-date labels wrap as a pair when their own text size needs more room. At narrow widths, Check-in and Check-out become separate full-width rows while retaining one action target for the dates.
2. Safety and handover headings use a wrapping row with their existing actions, so a larger label keeps its full word and moves the action below when required.
3. The selected owner name, phone and Call owner action use a wrapping contact row. The phone keeps an unbroken readable line when the call action needs its own row.
4. The Directory stay-date dialog keeps the native `type=date` fields and values. Its nested padding leaves enough width for native date text and calendar controls, and its sticky actions wrap based on their own text size. The title scrolls with the card so it cannot cover a keyboard-focused field; the action footer stays sticky.
5. The single-field guest editor wraps its existing Discard and Save Changes buttons by their text size. Draft values and explicit-save behavior are unchanged.

The CSS is scoped to the Directory page. Today, Calendar, Apps Script, identity, receipts, persistence, complete Safety and Medication content, lazy reads, and draft state remain unchanged.

## Verification matrix

| Surface | Viewports | Themes | Browser coverage | Checks |
|---|---|---|---|---|
| Selected Care profile | 320×568, 390×844, 1440×900 | Light and dark | Chromium and WebKit | True per-node 2× baseline, whole Check-in/Check-out and Safety/Handover words, owner phone and Call owner do not overlap, no page horizontal overflow, fixture records no writes |
| Stay-date and guest-detail dialogs | 320×568, 390×320, 1440×900 | Light and dark | Chromium and WebKit | Exact 2× computed font size after restoring prior inline sizes, native date value and input width, keyboard Tab from Check-in to Check-out, full input above sticky footer, centered target hit, footer buttons at least 44px, whole action words, retained guest draft |

Browser tests run with synthetic local fixtures and blocked writes. Playwright Chromium and WebKit do not replace physical iPhone or Android verification; native date controls can vary by OS/browser version.

Visual evidence is saved under the ignored `output/care-readability-next-five/visual-review/` folder during review; those captures are not release assets.
