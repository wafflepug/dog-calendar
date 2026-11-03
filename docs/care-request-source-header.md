# Request source in the Care header — 4 November 2026

Built: move the current request-source control into a right-aligned profile header toolbar beside Photo options. The saved value is readable before opening the source choices. The header toolbar has its own row so dog identity and stay dates keep their space on narrow phones. The source control remains available across profile segments.

Reuse the existing source host, source choices, identity checks, pending-save protection and save handler. Opening the choices does not save. Past stays retain the existing read-only behaviour. Missing source values and read failures remain explicit; source values are not inferred from names. No new backend action or migration.

Manual matrix: open a current dog, read its source, open and dismiss the choices using pointer/keyboard, then verify the correct dog/stay before making an intentional source change. During a failed or queued save, confirm the saved label is unchanged and the error remains available. Open a past dog and confirm its source is read-only. Review narrow phones, desktop, dark mode and long names/source labels; photo options must remain reachable without overlapping identity.

Verification: syntax/diff checks and synthetic previews at 320/390/1440px confirmed one source host in the header, no page errors or horizontal overflow, and source choices surviving viewport changes. Repeated identical hydration preserves the existing control; the legacy source badge renderer defers to its established editor. Opening and dismissal were checked; no source save was attempted.

Screenshot evidence: output/care-source-header-review, fictional local guest data. No real source updates were saved during visual review. No regression suites. One Luna task plus lead review; exact token counts unavailable. Cache revision 2026.11.04.03.

Next: reduce duplicate empty optional fields in detailed Care while preserving explicit safety warnings.
