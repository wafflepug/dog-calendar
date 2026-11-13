# Invite-only Palz Stay pilot at A$0

Use a separate Firebase Spark project, a free PostgreSQL project that allows a restricted database login, and a free Node web service without a payment method. Render Free can host the combined API and browser build using its provided HTTPS address. Its free service can sleep and take about a minute to wake. Use synthetic data for the hosted rehearsal.

## Prepare the services

1. Select or create a dedicated Firebase Spark project. Register a Web app, enable email/password sign-in, and add the pilot HTTPS hostname under Authentication authorized domains. Give the runtime a dedicated Firebase Admin credential that can read users and verify token revocation. Store that credential as a secret file in the host and point `GOOGLE_APPLICATION_CREDENTIALS` at the file. The Web app config is public. Keep the Admin credential private.
2. Create an empty, dedicated PostgreSQL database. Apply `migrations/001_initial.sql` in one transaction as a migration owner. Enable LOGIN for the resulting `palz_app` role and set a generated password through the database provider. Keep the runtime URL separate from the migration-owner URL. Require verified TLS and set `sslmode=verify-full` in the runtime URL. If the provider cannot run the migration or provision the required restricted role, stop before deploying.
3. Create a Free Node web service from this repository. Set root directory to `_platform`, Node to 24, build command to `npm ci --include=dev && npm run build && npm prune --omit=dev`, start command to `npm start`, and health check path to `/health`. Use the generated HTTPS origin as `PLATFORM_ORIGIN`. Disable automatic deployment during the rehearsal if you need to control promotion.
4. Set the production environment values from `../.env.example`. Set `PLATFORM_PILOT_EMAILS` to the comma-separated addresses of the pilot accounts. The API rejects unlisted users even if they have verified Firebase accounts. Add or remove addresses in the hosting environment and restart the service to apply the change.

## Verify before sharing

- Confirm the host reports Free, Firebase reports Spark, and the database reports Free. Stop if setup asks for a paid plan, a payment method, or a billing account.
- From an external browser, create two synthetic accounts, verify both emails, and create two separate workspaces. Add a dog and a booking in each workspace.
- Attempt to open the other workspace using its exact ID and confirm the API denies access. Verify that an unlisted email also gets denied. Invite and revoke a staff member and confirm their next workspace request fails.
- Export the synthetic workspace and rehearse restoring a disposable database from a database backup. Check the generated HTTPS URL again after a service restart.
- Share the URL with the invited boarder yourself using the same verified email on the allowlist. Start with a guided, synthetic-data session. This release supports creating bookings and managing pets, owners and team access. Live Care, owner intake and operational check-in/out are outside this slice.

No Waffle House resources are used. To withdraw the pilot, remove the boarder's allowlist entry and restart, or suspend the pilot web service. Preserve any permitted exports according to the pilot's retention agreement.
