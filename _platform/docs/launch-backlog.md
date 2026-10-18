# Market-readiness backlog

The first local slice is implemented. Public registration/deployment remains gated by dedicated resources and the work below. Waffle House remains operational independently.

| Area | Implemented here | Remaining before a public launch |
|---|---|---|
| Business accounts | Business setup, workspace selection, owner/staff membership and SQL isolation | Dedicated cloud pilot, business settings, ownership recovery/transfer |
| Secure access | Verified Firebase tokens, revocation, strict input and role controls | Real provider/email tests, account abuse controls, security review and stronger privileged-account policy |
| Commercial data layer | PostgreSQL schema, RLS, scoped FKs and production adapter | Provider-specific TLS, migrations/rollbacks, pooling and operations |
| Onboarding | Add pet and household owner, stable pet ID, multi-dog booking | Rich Care/intake migration, consent and import preview with rollback |
| Bookings | Same-day/range, repeated bookings using same pet, overlap/capacity checks and retry safety | Edit/cancel, check-in/out, recurrence, availability calendar and booking policies |
| Owner experience | Nothing connected to live owner links | Revocable owner portal links, safe file access, consent and streamlined forms |
| Billing | Free pilot limits enforced server-side | Final tier packaging, provider choice, AUD subscriptions, signed idempotent webhooks, downgrade/grace paths |
| Privacy | Tenant isolation, no browser cache, owner export and minimal audit | Retention/deletion, privacy/terms review, data processing arrangements and region decisions |
| Files | None | Private storage, signed URLs, file validation and malware controls |
| Recovery | JSON export | Encrypted backup and proven restore, recovery objectives and incident runbooks |
| Support | Safe errors and request IDs | Redacted monitoring, alerts, support process and audit viewer |
| Performance | Local transaction/pool safeguards and responsive UI | Pagination, representative load tests and measured service objectives |
| Marketing | Palz Stay identity in isolated UI | Positioning, domain, pricing page, pilot feedback and support expectations |
| Release quality | Local/CI security and six browser/viewport combinations, Pages isolation check | Staging promotion, migration rehearsal, independent security review and pilot sign-off |

## Next three bounded implementation tasks

### 1. Dedicated free pilot deployment

**Implementation prompt:** Work only in `_platform` and its workflow. Read README and as-built first. The existing Waffle House Firebase, Sheets, Apps Script and Pages app must remain untouched. Select infrastructure only after the owner supplies/authorizes dedicated pilot resources; confirm current free limits and do not enable billing. Add provider-specific secret references, validated database TLS, restricted runtime role, migration status/version check and a reproducible staging deployment. Keep local demo emulators available. Do not store secrets in Git. Deliver deployment/runbook, provider usage budgets, rollback procedure and staging smoke tests with synthetic tenants. Acceptance: verified real sign-in, wrong-tenant denial, immediate staff revocation, database role startup checks and a restore rehearsal pass on the dedicated staging environment; existing Waffle still works without authentication friction.

### 2. Booking lifecycle and compact daily Care

**Implementation prompt:** Extend `_platform` PostgreSQL/API/UI with edit/cancel and explicit check-in/out for the selected booking, never names. Add state transitions, current membership checks, atomic capacity recalculation, mutation retry semantics, audit events and narrow RLS permissions. Reuse a stable dog across returning stays. Keep daily mobile actions compact with status, dates and distinct dog number; details expand on demand. Do not import live Waffle data. Acceptance: same-day checkout moves the selected stay to Past immediately, cancel frees capacity, concurrent edit/checkout conflicts are safe, retry does not duplicate events or bookings, same-name dogs remain distinct, and Chromium/WebKit 320/390/1440px journeys pass.

### 3. Owner onboarding and private Care records

**Implementation prompt:** Following task 2, add revocable, time-limited owner intake access using scoped credentials and separate private file storage. A pet's clinical/contact records must never be in public URLs, static assets, logs or persistent browser caches. Start with structured intake and safe review/save; defer OCR until it has its own acceptance criteria. Use a single top-level Share owner link action and one clean status summary. No actual owner messages may be sent in tests. Acceptance: intended-owner scope, expiry/revocation, anonymous/wrong-business denial, upload validation if files are included, consent record, accessible mobile form and database/storage recovery drill. Use only authorized free pilot resources.

Parallel work should be limited to non-overlapping API/store/UI files with a shared contract. Use Luna for implementation and the lead model for integrated review and release. Release only after actual exact-head checks pass.
