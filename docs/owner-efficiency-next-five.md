# Owner efficiency next five

Candidate release 2026.11.02.02, service worker 168. This release combines one CI runtime improvement, two deferred-arrival refinements, and two owner-intake refinements.

## Changes

1. **Three-way Care workflow sharding.** The existing `care-daily-workflows` Playwright configuration runs in three named shards in CI. The local command still runs the full configuration. Shards partition the same test identities, with no removed tests or retries.
2. **Arrival-date range context.** The deferred-arrivals control displays the earliest and latest valid arrival start dates in its loaded events. Single-day and cross-year ranges use complete dates. Invalid calendar dates do not become normalized, plausible dates. Checkout dates do not influence this summary.
3. **Recover a search miss from later arrivals.** When Arriving search finds no loaded match while later arrivals are deferred, the existing empty state offers an explicit “View later arrivals” action. It retains the query and current tab, activates the existing expansion handler only after the click, and leaves profile details unloaded.
4. **Reset a restored owner draft to saved answers.** A restored local draft offers a contextual action and an inline confirmation. Confirming clears only the current booking token's draft, blanks permitted fields that are absent from the canonical saved-answer snapshot, then applies the loaded booking defaults and saved answers. Booking identity and dates stay canonical. Pending submission locks and completion hide the action. Actual answer changes clear the current signature and confirmations; unchanged answers keep them. A queued or pagehide save cannot recreate the discarded draft before the owner edits again.
5. **Readable long intake notes.** Visible owner-form textareas grow when prefilled, edited, or revealed, up to 12rem. Longer notes remain fully stored and scroll inside the capped field. Selection and focus remain untouched, and the textarea retains its native vertical resize control.

## Verification

- The default Care daily workflow configuration lists 354 project/test identities; each shard lists 118. The three `--list --shard` outputs have zero duplicate, missing, or extra identities compared with the unsharded list.
- Run Care arrival tests against the full `directory.html` runtime and fixture-based date-bound tests, including invalid dates, single dates, and a cross-year range.
- Run intake draft recovery in Chromium and WebKit for restored, pending, and previously completed prefill states. Check stale draft-only answers, token isolation, pagehide behavior, signature/confirmation invalidation, bounded textarea growth, selection/focus, and narrow/200% layouts.
- Run the required full CI on the final candidate head, with all three named Care shards green.

## Preserved behavior

No owner intake is submitted and no notification or guest record is written by these changes. Stay and Dog identity, current booking dates, complete Safety and Medication content, durable submission intent and receipt behavior, explicit operations, lazy profile reads, signatures and consent boundaries remain intact. Today and Calendar are unchanged.
