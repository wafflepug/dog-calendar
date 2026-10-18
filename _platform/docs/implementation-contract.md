# Commercial foundation contract

This is a separate local application, excluded from the Waffle House runtime and Jekyll website by the `_platform` directory name. No live Sheets, Apps Script, Firebase messaging project, subscription provider or cloud infrastructure is changed. Firebase Authentication emulator + server-side PGlite provide real identity and PostgreSQL policies without billing; production uses Firebase Admin verification and a PostgreSQL connection supplied separately. Never expose emulator identity verification on a public host.

## Interfaces (TypeScript, ESM, Node 22+)

`src/database.ts` exports `createStore({dataDir?: string, databaseUrl?: string})`, `Store`, `DomainError(status:number,code:string,message:string)`. Default memory PGlite; dataDir persists locally. databaseUrl uses pg Pool with a non-owner, non-superuser, non-BYPASSRLS app role. Migrations are local/demo automatic only; production migrations run separately with migration credentials.

Store methods (all async; return camelCase JSON):
- `listBusinesses(uid)` => array `{id,slug,name,timezone,capacity,plan:'free',role:'owner'|'staff'}`
- `createBusiness(uid,{name,slug,timezone,capacity})` => business above; owner membership and audit event are atomic. No client-provided plan/role/user UID.
- `getWorkspace(uid,businessId)` => `{business,role,dogs,owners,bookings,members}`; members owner-only, staff gets []
- `createDog(uid,businessId,{name,breed,ownerId?,owner?:{name,email?,phone?}})` => `{id,businessId,number,name,breed,ownerId}`; owner+dog atomic; number unique within business, formatted #00001 in UI
- `createBooking(uid,businessId,{dogIds:string[],startDate,endDate,mutationId})` => `{id,businessId,dogIds,startDate,endDate,status:'confirmed'}`; exact same-intent retry returns same result, changed-intent key conflicts; same-day valid; inclusive overlaps for same dog reject; tenant-scoped composite FKs
- `createInvite(uid,businessId,{email})` => `{token,expiresAt}`; only owner; role always staff; token random, hashed at rest, expires, one-time
- `acceptInvite(uid,email,token)` => business; verified email must match, concurrent acceptance safe; no automatic email delivery
- `disableMember(uid,businessId,userId)` => `{ok:true}`; owner only, cannot disable owner/self; next request denied regardless of existing token
- `exportBusiness(uid,businessId)` => tenant-scoped JSON; owner only, no invitation token hashes
- `close()`

Dogs and owners include UUID IDs. Owners `{id,name,email,phone}`. Workspace bookings include array dogIds, dates, status. Members `{userId,role,status}`. Every tenant method checks active membership in a transaction and runs actual SQL under restricted application role and transaction-local user/business context; RLS independently prevents another tenant's data access. Do not mock SQL isolation tests.

`src/api.ts` exports `createHandler({store,verifyToken,publicConfig})` returning Node HTTP handler. `verifyToken(token)` => `{uid,email,email_verified}`; protected routes reject unverified email. JSON errors `{error:{code,message},requestId}`; successful objects normal JSON. All protected responses no-store, no permissive CORS, no auth tokens in logs/errors. Rate/body limits, request IDs, strict input validation, query/URL rejection where appropriate. Anonymous `/health` and `/api/config`; `GET /api/businesses`, `POST /api/businesses`, `GET /api/businesses/:id/workspace`, `POST .../dogs`, `POST .../bookings`, `POST .../invites`, `POST /api/invites/accept` body {token}, `POST .../members/:uid/disable`, `GET .../export`. Create returns 201, ordinary reads/actions 200. `publicConfig` contains only Firebase web config, emulator URL (local only), and mode. No demo impersonation endpoint.

`src/auth.ts` exports `createTokenVerifier({projectId,emulatorHost?,mode})`, Firebase Admin verifyIdToken(token,true), issuer/project checks delegated SDK; production rejects emulator env. `src/server.ts` root owns launch/static serving/boot config. Root owns package, TS build, emulator config, scripts, CI and docs. Security agent owns API/auth tests; database agent owns migrations/database tests; UI agent owns web app files only.

## Browser app

`web/index.html`, `web/style.css`, `web/app.ts`; esbuild bundles app.ts to ignored public/app.js (root build). UI imports Firebase app/auth SDK directly, in-memory persistence, sign-in/create-account/Google popup/password reset/verification resend/logout. Read /api/config first. No localStorage tokens or sensitive caches. Session/workspace epoch guards prevent stale responses after switch/logout. First-use business creation then workspace picker, dogs/owners list, add dog and create booking (multiple dogs, one date range), owner-only staff invite/copy + member disable + JSON export. Clear distinction this is local development. No paid plan purchase; plan display is Free. Never send messages automatically. Invitation URL token is read once into memory, removed with replaceState and accepted explicitly after matching verified sign-in. 320px readable, 44px controls, accessible labels/status/focus, no stale previous-workspace data. Firebase Auth emulator email links are local console/emulator links, not real delivered mail.

## Scope/rollout

Build/test a usable secure local foundation plus as-built and go-live checklist. Do not claim public launch readiness. Billing, private uploads, full Care migration, owner portal, automated backups, load certification and cloud pilot remain bounded next stages. Current Waffle House continues as before, with no links to the platform or authentication gate added. No paid resources, new domains or production tenant data are provisioned.
