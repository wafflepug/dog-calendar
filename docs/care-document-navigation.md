# Care Document Recovery & Navigation

Release candidate: 2026.10.09.03. Seven bounded improvements follow PR204. Development was delegated to Luna with lead integration and review. No OCR provider, Apps Script deployment or stored care values change.

## Built deliverables

1. PDF uploader return checks target the original stay instead of clearing every document cache or rebuilding the guest directory. Source-window and origin checks validate completion messages; closing and returning after leaving the app provide fallback read paths.
2. Failed document refresh retains the available PDF, displays an honest failure message and offers a scoped Retry. Request versions and identity checks before and after reads prevent older responses and same-key guest replacements from receiving another document.
3. Blocked popup opens show an accessible Open uploader link next to the existing document. Native-link returns retain a scoped guest context; opening or cancelling never claims an upload succeeded.
4. Care arrow/Home/End navigation moves focus without loading a panel. Enter/Space or click activates it; the selected panel is keyboard reachable and legacy hidden tabs are inert.
5. Mobile section icons sit above readable whole-word labels, with an accent selection indicator. Delayed panel preparation preserves keyboard focus and saved care details.
6. Records & forms actions use equal-width desktop slots and full-width phone rows. The old upload-only full-row span is removed. Actions remain at least 44px.
7. File status, OCR status and metadata use separate left-aligned lines; processing messages wrap. Primary action colours use the configured accent's tested soft/ink pair, avoiding the old dark-text/blue-fill contrast issue.

Scoped upload-return and Retry status reads use one 15-second attempt; broader background status reads keep their existing policy. Existing independent directory background refresh remains; this change adds no document polling or eager profile reads.

## Testing matrix

| Journey | Verification steps | Edge / failure checks |
| --- | --- | --- |
| PDF return | Open a guest, expand Records & forms, upload in the existing uploader, return; check the original stay's document status | Cancel without upload; an unfamiliar document must not be claimed as saved; delayed response followed by another guest |
| Recovery | Simulate failed status read, keep View PDF available, click Retry | Previously available PDF stays visible; response for another stay is ignored; older read cannot replace a newer document |
| Blocked popup | Block new windows, choose Upload PDF for OCR, follow Open uploader | Keyboard can reach the fallback; return check is scoped; no success claim before server read |
| Keyboard sections | Focus Overview; press Right, Home and End; press Enter or Space to activate | Focus-only navigation adds no read; hidden panels/tabs cannot take focus; drafts survive return to Overview |
| Layout | Check 320/390px and 1440px, light/dark, all five Settings accents | Full labels, long OCR review message, equal desktop actions, 44px targets, text contrast at least 4.5:1 |
| Physical devices | Repeat PDF return and Care navigation on iPhone and Samsung Fold4, portrait and landscape | PWA opener loss, safe areas, large text and footer clearance; emulation is not physical-device evidence |

Automated tests use read-only synthetic backend fixtures. Local verification: 242 Node checks, five Python contracts, ten Records & forms browser cases across Chromium/WebKit (including all five accents and action contrast), four actual-runtime Care navigation cases across both engines, and the keyboard accessibility journey passed. Final CI and deployment verification are reported with the pull request. No customer records are uploaded during tests.

## Next backlog item

Detailed Care category navigation: inspect collapse/reopen and focus while editing with long summaries, missing attributes and refreshed profiles. Fix only demonstrated inconsistencies; preserve drafts, saved values and the existing lazy-load policy. Keep persisted-ID backend reads and legacy migration as a separate correctness project.
