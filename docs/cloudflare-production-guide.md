# Cloudflare Production Guide

This guide is written for the current Father’s Day MVP state.

## What Cloudflare service does what

- `Pages`: hosts the frontend files such as `/`, `/create`, and `/lp`
- `Pages Functions` or `Workers`: runs API endpoints
- `R2`: stores images, audio, video, and original uploads
- `D1`: stores sessions, artworks, messages, and shipping data

## Current project status

The repo now includes the **deployment foundation**:

- `wrangler.toml` with `Pages`, `D1`, and `R2` bindings
- `.dev.vars.example` for local secret setup
- `scripts/prepare-cloudflare.mjs` to stage only deployable frontend files into `.cloudflare/public`

Important:

- The local `server.mjs` flow still exists for development.
- The production Cloudflare API layer is **not fully migrated yet**.
- Token issuance is **not implemented yet** for production.

## First-time setup

### 1. Install Wrangler

If you do not already have it:

```bash
npm install -g wrangler
```

Or use `npx wrangler ...` if you prefer not to install globally.

### 2. Login to Cloudflare

```bash
wrangler login
```

This opens the browser and connects the CLI to your Cloudflare account.

### 3. Create the D1 database

```bash
wrangler d1 create echo-garden-mvp
```

After this command, Cloudflare prints a `database_id`.

Copy that value into:

- `wrangler.toml` → `database_id`
- your team notes or password manager

### 4. Create the R2 buckets

Create the production bucket:

```bash
wrangler r2 bucket create echo-garden-artworks
```

Create the preview bucket too:

```bash
wrangler r2 bucket create echo-garden-artworks-preview
```

### 5. Apply the D1 migration

Local preview database:

```bash
wrangler d1 migrations apply echo-garden-mvp --local
```

Remote production database:

```bash
wrangler d1 migrations apply echo-garden-mvp --remote
```

### 6. Prepare local Cloudflare secrets

Copy:

```bash
cp .dev.vars.example .dev.vars
```

Then edit `.dev.vars` and fill in:

- `OFFICE_EXPORT_SECRET`
- `R2_PUBLIC_BASE_URL`
- any local host URLs you want for testing

Do not commit `.dev.vars`.

## Preparing the frontend for Pages

The app is not bundled yet, so we stage only the files Pages needs.

Run:

```bash
npm run cf:prepare
```

This creates:

```txt
.cloudflare/public/
```

with the frontend files copied from this repo.

## Previewing with Cloudflare Pages

After preparing assets:

```bash
npm run cf:pages:dev
```

This is useful for checking:

- static file routing
- `/create/?token=...`
- `/lp/?id=...`

Note:

- until the API endpoints are migrated to Cloudflare Functions or Workers, the frontend preview alone is not the full production stack.

## Deploying the frontend shell

After `npm run cf:prepare`:

```bash
npm run cf:pages:deploy
```

This deploys the current staged frontend to Cloudflare Pages.

## Recommended next implementation steps

Do these next, in order:

1. Move `/api/session`, `/api/artworks`, `/api/uploads`, `/api/lp`, and `/api/gift/submit` into Cloudflare Functions or a Worker entrypoint.
2. Replace the in-memory `test` session behavior with real `D1` reads/writes.
3. Add a protected token issuance path that creates rows in `gift_sessions`.
4. Wire `POST /api/artworks` and `POST /api/artworks/:artworkId/select` to `D1`.
5. Add protected office export access.

## Suggested production checklist

- `D1` exists and migration applied
- `R2` production and preview buckets exist
- `wrangler.toml` has the correct `database_id`
- `.dev.vars` exists locally and is not committed
- `npm run cf:prepare` succeeds
- static Pages preview works
- API migration plan is agreed before public release
