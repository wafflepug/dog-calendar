# Care workspace overhaul

The Care profile now follows one operational hierarchy on phones and desktop:

1. Dog identity and stay dates.
2. **Today’s care plan** with safety, feeding, medication, owner contact and the handover note.
3. One five-section navigator for Overview, Items, Photos, Stay history and Dog record.
4. Detailed routine, behaviour and health information.

The care plan renders from the selected stay and already-available directory data. The existing profile request fills feeding and medication. It does not add a new request. Items, photos, history and the dog record continue to use their existing lazy loaders and are requested only when their section is selected.

Lower-priority intake and legacy-document controls are grouped under **Records & forms**. Safety information remains visible in the care plan while that disclosure is closed.

The navigator keeps the established runtime selectors and loader functions so existing stay selection, caching, editing and Back-navigation continuity remain intact. Its presentation is consistent across phone and desktop, supports keyboard arrow navigation, has 44px targets, wraps or scrolls within its own boundary, and uses the configured accent in both themes.

This release changes information hierarchy and access speed. It does not claim to reduce Apps Script response latency; request attribution and backend performance remain separate measured work.
