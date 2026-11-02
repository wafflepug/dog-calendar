# Owner-update templates — 3 November 2026

Built: Arrival, Daily check-in and Pickup templates within the existing Owner sharing options panel. Choose Care form or Owner update so only one purpose is displayed at a time. Edit the message preview, then explicitly Copy update or use native Share when supported. Clipboard failure selects the message for manual copying; share cancellation retains the draft. No sending integration or new network requests are introduced.

Customise saved templates on this device supports {owner}, {dog}, {start} and {end}. Only custom template text is stored in browser localStorage; guest drafts are retained in memory per template for the selected stay. They are not cloud-synced. Changing the guest/stay/owner context resets those drafts. Editing a preview clears old copy status. Async results cannot overwrite another stay/draft's status. Opening the existing care-form flow defaults to Care form.

Daily updates include a prompt for a verified observation. The feature does not infer or claim that care tasks were performed. Review and replace prompts before sharing, and choose the correct recipient in the owner's chat. The app never sends automatically.

Checks: edited JavaScript syntax/diff review; read-only phone/desktop before-and-after previews; one simulated clipboard copy containing the selected fictional dog's name. No regression suites, real messages, production booking writes or backend changes. Native OS sharing itself was not exercised.

Use: Care > open guest > Owner sharing options > Share: Owner update > select template > review/edit preview > Copy update; paste in the owner's usual conversation. Customise saved templates is optional and local to this browser.

Screenshot summary: output/care-owner-updates-review/review.html includes sharing before/after, phone/desktop arrival previews, and daily/pickup samples.

Next: timestamped routine logging, kept separate from saved care instructions.

Token report: Luna development; exact input/output usage is not exposed and is not estimated.
