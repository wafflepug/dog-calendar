# Care gallery refinement

Scope: the active Care Media renderer and its later carousel enhancement. Keep Profile, Stay and Belongings photo ownership and existing upload actions unchanged.

Acceptance and testing matrix:

1. Open each photo group at 320px, 390px and desktop widths in light/dark mode. Captions wrap, image space remains stable and controls have visible keyboard focus and 44px touch targets.
2. Before opening the image viewer, Drive images request a bounded thumbnail. Opening a photo requests its larger preview. No upload or guest-wide read is needed for image retry.
3. Fail one image request. Its error state explains the failure and offers a named retry for that exact image. Other photos remain usable.
4. Switch stays during a delayed Media read. The old response cannot replace the current stay's photos.
5. Verify empty groups, missing image URLs and long labels. Keep category disclosures, carousel navigation and delete actions functional.

Automated checks use the actual renderer, carousel code and shipped styles through `playwright.care-overview.config.js`, plus the release/first-open and media carousel contracts. Physical iPhone and Fold checks remain a manual follow-up; emulation does not establish a device-level speed improvement.

Next backlog candidate: the full-size photo viewer's keyboard focus, loading/error recovery and mobile safe-area layout. Scope it separately from upload persistence and keep existing photo ownership intact.
