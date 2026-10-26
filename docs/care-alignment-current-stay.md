# Care alignment and current-stay selection

Release candidate: 2026.10.26.03.

A missing current roster card is not evidence of a past stay. Historical fallback reads remain quiet until an exact historical card is found; a slow current link must remain in Staying.

Daily priority: keep the stay selected by the sitter visible and make Care identity, dates and actions readable at phone and desktop widths. No additional profile/history reads, backend changes or new icons are required.

The layout keeps stay dates and their edit control together, aligns Safety and handover actions with their labels, and lets More tools use the full profile width so Records & forms is not squeezed into an action-sized column. Critical care information stays visible and complete.

## Verification matrix

1. Open Care with a dog who has current and previous bookings. Select the Staying card. Check the current dates and stay identity remain selected after background reads finish.
2. Begin opening an old profile link, select a current guest before its delayed data arrives, then release the delayed response. The current selection must remain active; a startup handler must not switch back to Past.
3. Open an explicit historical stay directly without another selection. Confirm the historical dates and read-only Past controls remain available.
4. Repeat with two dogs sharing a name but different Dog IDs. Never substitute a name match for the selected stay identity. Preserve existing missing/ambiguous-link handling.
5. Check roster and profile layouts at 320, 390, 768 and 1440px with long names, IDs, source badges, multiple safety flags and long medication/handover text. Labels and actions must not overlap or clip; dates should remain a coherent pair.
6. Repeat in dark and system high-contrast modes. Verify visible keyboard focus and controls at least 44px high.
7. Open handover and routine editors, cancel and return to Guests. Existing draft guards, selected tabs and focus restoration must remain intact.

Use synthetic records for automated mutations. Browser emulation supplements physical-phone testing and does not certify every device.

Next backlog item: measure the sitter's arrival, care lookup and checkout journeys on a physical phone before adding controls.
