# Palz Stay commercial foundation

An isolated **local development application** for the first commercial slice. It does not alter Waffle House, its sign-in experience, Google Sheets, Apps Script or messaging project. It is not a public SaaS launch.

Implemented: verified account access, separate business workspaces, owner/staff permissions, dogs with stable per-business numbers, owners, multi-dog bookings, capacity/overlap checks, staff invitations/revocation, audit events and owner data export. Only a bounded Free pilot is implemented; there are no purchases or paid resources.

## Open the local app

Requires Node.js 24 and npm. From this directory:

```powershell
npm ci
npm run dev
```

Open **http://127.0.0.1:4380**. Keep the terminal open. This starts the loopback Firebase Authentication emulator and server-side local PostgreSQL (PGlite); no cloud credentials, Google login or billing account are needed for email/password testing. `.env.example` documents settings; it is not automatically loaded.

1. Create a synthetic email/password account. Use fake contact and pet information.
2. Open the **local verification link printed in the terminal**, then return and choose **I've verified my email**. No real verification email is sent.
3. Create a business with its name, unique slug, timezone and dog capacity.
4. Add a dog and owner. Use **Choose an existing owner** for another dog from that household. Same-name dogs receive different numbers, e.g. #00001 and #00002.
5. Open Bookings, select dogs and dates, then create the booking. Same-day care is supported. Separate date ranges use separate bookings for the same dog record.
6. In Team, create and copy a staff invitation yourself. Open it in another browser session and sign in with that exact verified email. Invitations expire after seven days and can be used once. Disabling staff blocks their next API request.
7. Export business data from Team if needed. Treat that JSON as private; it is an export, not a restore mechanism.

The browser keeps authentication in memory: reload requires sign-in again. The development command saves emulator identities and database records under ignored `.local/`. Stop with Ctrl+C and allow emulator export to finish. Synthetic test identities live only in their test emulator; they are not exported. Do not expose these emulators to the internet or put real boarding records into them.

## Verify

```powershell
npm run typecheck
npm run build
npm test
npx playwright install chromium webkit
npm run test:emulator
npm audit --omit=dev --audit-level=high
```

The last integration command starts its own local Auth emulator and tests actual Firebase SDK sign-in plus Chromium/WebKit at 320, 390 and 1440px. Close `npm run dev` first so port 9199 is free. CI separately tests the `pg` adapter against a disposable PostgreSQL 17 service; its integration script refuses a non-loopback database or any database name other than `palz_ci`.

See [as-built architecture](docs/as-built.md), [launch backlog](docs/launch-backlog.md) and [test matrix](docs/test-matrix.md). The next step is selecting/configuring dedicated free pilot infrastructure; cloud deployment has deliberately not been enabled.
