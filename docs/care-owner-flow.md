# Care owner flow

Release 2026.10.29.04. Five Care improvements reuse existing loaded records and native actions.

## Built deliverables

1. Loaded owner phone numbers appear inside More actions on guest rows, including read-only future/Past rows when available. The number is validated and the current row identity/contact is checked again on activation. No profile fetch or new permanent Call button.
2. Active work-filter summaries distinguish visible search matches from the loaded total, for example Arriving today · 1 of 2. The filter choices retain loaded totals and unknown/collision guidance.
3. A verified check-in under Arriving today can move keyboard focus from the disappearing action to the next pending arrival, then previous or filter/search fallback. Unchanged identity, query, tab, focus and scroll are required. Failed saves and later user actions cannot claim completion focus.
4. Normal and early checkout use Keep editing / Discard note inside the existing sheet instead of a native browser confirmation. The choice preserves the note and caret, blocks writes while pending and remains guarded during saves. Discard closes without saving; verified checkout closes without discard prompts.
5. Long saved handover notes retain their existing disclosure and gain a brief single-line preview. The complete original escaped note remains in the expansion; short notes still open immediately and missing notes remain hidden.

No new backend deployment, background reads, automatic messages, icons or dependencies. Native phone dialing is explicit and requires a device-supported calling app.

## Sitter steps

- Open More actions on the correct guest and choose Call owner when a saved number is available.
- Read filtered counts as visible matches out of loaded stays. Clear search to restore the full active work list.
- Check in from Arriving today. A successful focused action can leave you at the next pending arrival without activating it.
- Close a checkout with a draft note: choose Keep editing to retain it, or Discard note to close. Closing alone never saves the checkout.
- Read the handover preview, then expand the existing Saved handover note to see the complete note.

## Testing matrix

| Case | Steps | Expected |
| --- | --- | --- |
| Owner contact | Expand current/future/Past secondary actions | Valid saved tel link; no operational actions added to historical/future rows |
| Missing/stale contact | Use invalid number, change row identity/contact before activating a saved link | No invalid or stale call; no profile or data writes |
| Counts | Choose work filter, search one/zero/multiple matches, clear query | Visible out of loaded totals; choices and unknown guidance remain truthful |
| Check-in | Focus pending action, confirm one synthetic check-in | Exact stay acknowledged once; row leaves filter; useful focus/scroll retained |
| Delayed/failure | Fail save or move focus/query/tab/scroll before acknowledgement | No unverified focus movement or stale completion; retry behavior remains |
| Draft protection | Close normal/early checkout with a note; keep, repeat close, discard | Inline choice, caret/text retained, no native prompt or write |
| Busy/detail loading | Hold save/detail read while closing or choosing discard | Save locks remain; detail completion cannot enable checkout behind a discard choice |
| Handover | Short, long, whitespace-heavy, markup-shaped and next-stay notes | Correct preview/reset, complete escaped original text |
| Responsive | 320/390/1440px, light/dark, enlarged text and keyboard | 44px controls, visible focus and reachable sheet actions above navigation |

Executed verification: 412 Node and five Python MVP checks; 36 integrated owner/filter/check-in/checkout cases across six Chromium/WebKit projects; 36 standalone filter/continuity cases across six projects; 50 guided checkout cases in Chromium/WebKit; two async review/discard guard cases; 13 roster/operation cases; and two full-runtime card readability cases passed. Visual review covered light/dark inline choices.

Automated fixtures block live writes. Physical-device dialing, native keyboard and assistive technology checks remain manual.

## Next backlog item

Review owner handoff and arrival preparation on physical phones before adding more controls.
