# Task Completion Report and verification matrix

## Built deliverables

Separate local Palz Stay account/workspace app; verified Firebase access; PostgreSQL tenant isolation; stable dog IDs and owner onboarding; atomic multi-dog bookings with overlap/capacity and retry protection; staff invitation/revocation; audit and owner export; mobile/desktop UI; CI, setup and as-built documentation. No cloud resources or paid services activated. Full Care, commercial billing, backups and public launch are future work.

## Testing matrix

Use synthetic accounts only. Start with README local setup. Clear test state by using a new synthetic account/business rather than deleting shared files or changing Waffle data.

| Test | Steps | Expected |
|---|---|---|
| New business | Sign up, follow emulator verification link, refresh verification, create business | Unverified account cannot access workspace; verified owner can |
| Returning account | Sign out, sign in again; restart dev normally and sign in | Workspace rediscovered; no data from another user shown |
| Same-name dogs | Add Coco twice, reuse the owner on the second dog | Distinct #00001 and #00002; one owner record |
| Multiple workspaces | Create a second business, add different dogs, switch repeatedly | Correct dogs/owners/bookings each time; no prior workspace flash |
| Day care | Book one dog with identical check-in/out date | One confirmed same-day booking |
| Multiple stays | Book Dec 8–10 and Dec 15–20 for the same dog | Two stays, one dog ID |
| Household booking | Select two dogs in a single range | One atomic booking linked to both |
| Overlap | Book the same dog on an overlapping or checkout day | Conflict; no partial new booking |
| Capacity | Set capacity 1, attempt overlapping bookings for two different dogs | Only one succeeds, including concurrent requests |
| Retry | Repeat the same booking request/mutation key; then change its dates with the same key | Same result for retry; conflict for changed intent |
| Invitation | Invite exact staff email, sign in as that verified address, accept | Staff sees invited business; wrong email/expired/reused token fails |
| Staff privilege | Open Team/export API as staff | Owner-only access denied |
| Revocation | Owner disables staff while staff remains signed in | Staff's next private request denied |
| Export | Owner exports while belonging to two businesses | Only selected business; no invitation token hashes |
| Logout race | Delay workspace response, sign out, then release response | Sign-in stays visible; no private data repainted |
| Mobile/readability | Run Chromium and WebKit at 320/390 and desktop 1440px | No page overflow, buttons >=44px; long email wraps |
| Bad input | Submit forged UID/plan/role, malformed UUID/date, oversized body and foreign owner ID | Safe 4xx response; no data written |
| Fail closed | Start production with missing config or any emulator host | Startup refused |
| SQL isolation | Query with restricted role and different selected tenant, reset context and shadow temp tables | No cross-tenant rows/writes or privileged bootstrap redirection |
| Legacy isolation | Build GitHub Pages and inspect output | Waffle present; `_platform` server, secrets and source absent |

Automated suites: `npm test` (unit and real local SQL), `npm run test:emulator` (real Auth emulator API integration plus twelve browser tests), and CI-only `tests/postgres.integration.ts` against its disposable PostgreSQL service. Build, TypeScript and production dependency audit are separate checks. Results are recorded in the pull request; do not infer scale or email deliverability from emulator tests.

## Next backlog item

Dedicated free pilot infrastructure and staging deployment, followed by booking lifecycle/Care, then private owner onboarding. See `launch-backlog.md` for self-contained task prompts and acceptance criteria.
