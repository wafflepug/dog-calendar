# Saved profile photo editing

Release candidate 2026.10.24.06.

## Operator steps

1. Open the dog's Care profile, expand More tools and select Change profile photo.
2. The editor loads the stored photo. Drag to reposition it and use Zoom to adjust the crop.
3. Save the positioned photo when satisfied, or close the editor to leave the saved profile unchanged.
4. To use another image, select Choose a different photo, then Take Photo or Choose from Library. Cancelling the file picker retains the current preview and adjustments.

Older profiles may contain only the previously saved square crop. The editor identifies this limitation: it cannot recover parts of an image that were already removed. New uploads retain an uncropped working copy for later edits. Repositioning reuses the server-owned source rather than requiring another import.

## Acceptance and verification

| Scenario | Expected behaviour |
| --- | --- |
| Open a saved photo | Load the photo for the exact selected dog and stay; no file import required and no record write merely from opening |
| Adjust and save | The current profile photo reflects the new crop; avoid extra gallery entries representing the same adjustment |
| Close or cancel | Preserve the previously saved photo; cancelling a replacement picker retains the local preview |
| Slow stored-photo load | A late response cannot replace a newly selected file or a newer load |
| Saved source unavailable | Try the current saved crop, explain its limits and keep replacement available |
| Read fails | Show a scoped retry and replacement option without changing the profile |
| First photo | Choosing and explicitly saving a photo still works when no Care photo record exists |
| Concurrent replacement | Reject a stale adjustment when the saved current photo has changed |
| Upload retry | Keep existing receipt and identity protections; avoid duplicate files or gallery entries on a confirmed retry |
| Phone and desktop | Verify the actual generated editor in Chromium and WebKit; controls wrap and remain reachable at narrow widths |

Verification uses synthetic records and intercepted uploads. Production photo writes are not part of automated checks. This feature changes the hosted Apps Script uploader as well as the frontend; merging frontend assets alone does not make an older deployed uploader support saved-photo adjustment. Confirm both deployment attributions before reporting the feature live.

Executed locally: 16 generated-editor cases passed in Chromium and WebKit, covering 320px, 390px and desktop widths, saved/legacy sources, replacement races, picker cancellation, frozen pending controls and repeated saves. The 11 backend receipt and photo tests passed, including source fallback, private source retention, gallery replacement, stable-identity rejection before preparation and stale-current-photo rejection. The four Care quick-action cases passed. The full MVP suite passed all 380 Node tests and five Python contracts. No test imports or edits a production guest photo.

## Next bounded backlog item

Review photo-editor keyboard operation and its crop instructions with real phone users. Preserve the compact editor, keep original image loading on demand and use standard labelled controls without new AI-generated icons.
