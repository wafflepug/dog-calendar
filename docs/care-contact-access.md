# Care contact access

Release 2026.10.28.06. Four bounded improvements for a solo sitter using the existing Care overview and saved profile. No new backend reads, schema changes, paid services or new icons.

## Built deliverables

1. Show the saved, human-readable owner number beside the existing Call owner action, wrapping on narrow phones.
2. Offer Add number when the existing owner-phone editor is available but no callable number is saved. Open that exact card's existing editor and return focus on discard.
3. Turn validated saved emergency and vet phone values into direct call links in read-only Detailed Care. Preserve the original number and label; invalid or unverified values never become callable.
4. Emergency details opens Health & Home and focuses the saved emergency contact row. Fall back to the section heading if no saved contact exists or a draft is open. Preserve drafts and identity guards.

## Testing matrix

| Case | Verification steps | Expected result |
| --- | --- | --- |
| Owner phone | Open a current profile with a saved phone | Original formatted number and correct normalized tel target beside Call owner |
| Missing phone | Use Add number, type a value, cancel and reject discard | Exact selected dog's phone editor; typed draft remains |
| Confirmed discard | Cancel again and accept discard | No write; focus returns to Add number |
| Emergency lookup | Press Emergency details | Saved emergency row receives focus with category expanded read-only |
| Emergency/vet calling | Review both saved numbers | Full formatted values and 44px links; dial occurs only on explicit activation |
| Invalid values | Supply placeholders, malformed numbers and HTML-like strings | Escaped readable text; no unsafe call link |
| Unverified record | Load conflicting identity, loading or not-found state | No leaked saved contact number or call action |
| Failed refresh | Show a previously saved contact while refresh fails | Existing refresh warning remains beside usable saved details |
| Responsive | Check 320px, 390px, desktop, light and dark | No overlaps or horizontal overflow; focus visible |
| Performance | Compare profile-read and mutation counts before/after contact actions | No new profile reads or writes from lookup, opening or discarding |

Synthetic browser fixtures block live mutations. Native dialing and real phone keyboards require physical-device verification.

## Next backlog item

Review pickup/handover tasks using representative solo-sitter flows; consolidate redundant instructions only where the current explicit action is clear.
