# Release A — R&D Environment

Release A is developed on the long-lived `release-a-rnd` branch and is intentionally isolated from the live Waffle House production runtime.

## Safety boundaries

- `main` remains the production code line used by Waffle House day-to-day.
- The existing Google Apps Script deploy workflow deploys only from `main`.
- Release A R&D must not point at the production Apps Script project, production Google Sheet, or production Drive folders.
- The R&D app uses a separate Supabase project and a separate tenant named `Waffle R&D Lab`.
- No Release A change is merged to `main` until tenant isolation, authentication, migration and regression tests are complete.

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
        v
R&D frontend (/rnd)
        |
        v
Dedicated Supabase Free project
        |
        +-- Auth
        +-- Postgres + RLS
        +-- private tenant data

Production remains:
main -> GitHub Pages -> existing Apps Script -> existing Waffle House Sheets/Drive
```

## Tenant model

A signed-in person is represented by `auth.users`. Businesses are represented by `businesses`. Membership is explicit in `business_members`.

Every operational row includes `business_id`. Database policies verify the authenticated user is an active member of that business before any row can be read or changed.

The browser is never trusted to enforce tenant isolation.

## R&D acceptance criteria

- A user can sign up/sign in.
- A user with no business sees onboarding.
- Onboarding creates `Waffle R&D Lab` and grants the user the owner role.
- The owner can update business settings.
- A brand-new business sees empty Calendar/Care-style states rather than Waffle House data.
- A user from Business A cannot read or change Business B records even by modifying requests manually.
- No R&D push can deploy the production Apps Script backend.

## Production migration later

Waffle House remains on the existing stack throughout R&D. Once Release A is proven, production data will be migrated into a `Waffle House` tenant in the commercial datastore using a controlled, rehearsed migration. Until that cutover, the live installation remains unchanged.
