# Release A — R&D Environment

Release A is developed on the long-lived `release-a-rnd` branch and is intentionally isolated from the live Waffle House production runtime.

## Safety boundaries

- `main` remains the production code line used by Waffle House day-to-day.
- The existing Google Apps Script deploy workflow deploys only from `main`.
- Release A R&D must not point at the production Apps Script project, production Google Sheet, or production Drive folders.
- The R&D app uses a separate Supabase project and a separate tenant named `Waffle R&D Lab`.
- No Release A application change is merged to `main` until tenant isolation, authentication, migration and regression tests are complete.

## R&D preview

The supported browser preview is:

`https://wafflepug.github.io/dog-calendar/rnd-preview/`

GitHub Pages serves only the small R&D preview wrapper. The Release A CSS, configuration and application JavaScript remain sourced from `release-a-rnd`, while authentication and tenant data live exclusively in the dedicated `Waffle Release A R&D` Supabase project.

The preview contains only a browser-safe Supabase publishable key. Actual tenant data access requires Supabase Auth and PostgreSQL Row Level Security.

A nested pass-through service worker owns `/rnd-preview/` and caches nothing, preventing the production Waffle PWA service worker from offline-fallbacking or caching the R&D lab after the preview has claimed its scope.

The legacy Supabase Edge Function URL remains only as a compatibility redirect to the Pages preview. Supabase Edge Functions are not used to host HTML because their GET HTML responses are rewritten to plain text.

## Release A scope

1. Authentication and session handling.
2. Business/workspace creation.
3. Tenant isolation using `business_id` plus PostgreSQL Row Level Security.
4. Business onboarding and settings.
5. Commercial empty states for a brand-new sitter workspace.
6. R&D tenant used to validate the commercial architecture.
7. A later migration path that makes Waffle House a tenant without disrupting current operations.

## R&D topology

```text
release-a-rnd branch
        |
        +--> R&D CSS / config / app JS
        |             |
        |             v
main --> /rnd-preview/ static wrapper on GitHub Pages
                      |
                      v
             Dedicated Supabase Free project
                      |
                      +-- Auth
                      +-- Postgres + RLS
                      +-- private tenant data

Production Waffle remains:
main -> existing Pages app -> existing Apps Script -> existing Waffle House Sheets/Drive
```

## Tenant model

A signed-in person is represented by `auth.users`. Businesses are represented by `businesses`. Membership is explicit in `business_members`.

Every operational row includes `business_id`. Database policies verify the authenticated user is an active member of that business before any row can be read or changed. The browser is never trusted to enforce tenant isolation.

## R&D acceptance criteria

- A user can sign up/sign in through the supported preview URL.
- A user with no business sees onboarding.
- Onboarding creates `Waffle R&D Lab` and grants the user the owner role.
- The owner can update business settings.
- A brand-new business sees empty Calendar/Care-style states rather than Waffle House data.
- A user from Business A cannot read or change Business B records even by modifying requests manually.
- No R&D push can deploy the production Apps Script backend.
- The R&D preview contains no Supabase secret/service-role credential.

## Production migration later

Waffle House remains on the existing stack throughout R&D. Once Release A is proven, production data will be migrated into a `Waffle House` tenant in the commercial datastore using a controlled, rehearsed migration. Until that cutover, the live installation remains unchanged.
