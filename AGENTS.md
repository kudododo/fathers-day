# AGENTS.md — Echo Garden Father’s Day MVP

## Project Goal

Build a Father’s Day MVP by extracting the existing Echo Garden flow that can already save generated images to Cloudflare, then extending it into a user-driven gift creation flow.

The MVP is not a full EC system and not a full admin system. The goal is to let a paid/invited user access a unique creation URL, record or upload audio/video, generate up to 2 artworks/videos, compare them, choose 1 final work, enter message/shipping data, and expose a parameter-based LP.

## Core Principle

Prioritize a working beta for up to 100 community/invited users.

Do not overbuild.
Do not introduce full login, full Shopify integration, Canva replacement, or a complex management UI unless explicitly requested.

## Current Assumption

There is an existing Echo Garden codebase branch/version where:
- Image generation works.
- Image upload/save to Cloudflare R2 works.
- Echo Garden canvas rendering works.
- Shopify handoff may partially exist.
- Video save is not yet working and must be fixed/implemented.

Use that existing implementation as the baseline.

## MVP Scope

### Must Have

1. Token-based creation URL
   - `/create/?token=xxxxxxxx`
   - Token identifies one paid/invited order/session.
   - No account registration.

2. Smartphone-first creation UI
   - Default layout assumes mobile.
   - Camera recording and microphone recording are available where supported.
   - Upload fallback is available.

3. Input modes
   - Record using camera + microphone.
   - Upload audio file.
   - Upload video file.

4. Duration limit
   - Maximum 60 seconds.
   - User can start and stop recording manually.
   - Reject or trim inputs longer than 60 seconds. Prefer reject for MVP.

5. Silent input handling
   - If audio is effectively silent, do not generate.
   - Show a simple error message: `音声が検出できませんでした。もう一度録音してください。`

6. Generation count limit
   - Max 2 generation attempts per token.
   - Browser back should not allow unlimited regeneration.
   - Server-side count must be authoritative.

7. Comparison
   - User can compare up to 2 generated results.
   - Each result should include image preview and video preview when video generation/upload succeeds.

8. Final selection
   - User chooses 1 final work.
   - After confirmation, user cannot change or regenerate.
   - Store selected `artwork_id`.

9. Cloudflare storage
   - R2 stores image, video, audio/original upload, and thumbnails if generated.
   - D1 stores metadata and state.

10. LP display by URL parameter
   - `/lp/?id=xxxxxxxx`
   - `id` is a public random LP ID.
   - The LP fetches display data from D1/API.
   - Do not place personal/private data directly in URL parameters.

11. Message and shipping form
   - To name
   - From name
   - Message
   - Postal code
   - Address
   - Optional phone/email if already part of the operation

12. Office workflow support
   - Data must be exportable or easily copyable for spreadsheet/Canva CSV.
   - Full admin UI is not required for MVP.

### Should Have

1. Basic status values:
   - `draft`
   - `recording_started`
   - `generated_1`
   - `generated_2`
   - `selected`
   - `submitted`
   - `production_checked`
   - `shipped`

2. Simple office list endpoint or CSV endpoint.

3. Noindex on LP pages.

4. Clear upload progress and “do not close this screen” message.

### Not In Scope for This MVP

- Full Shopify checkout automation.
- Full member login / My Page.
- Canva replacement.
- Printful integration.
- Full admin dashboard.
- Advanced video editing engine.
- Person segmentation/background-only Echo Garden rendering.
- MP4 conversion guarantee across all browsers.
- Unlimited retries.
- Public general launch.

## Technical Architecture

### Cloudflare

Use:
- Cloudflare R2 for binary files.
- Cloudflare D1 for metadata and user/order/session state.
- Cloudflare Workers or Pages Functions for API endpoints.

Recommended buckets/directories:

```txt
r2://echo-garden-artworks/
  fathers-day-2026/
    originals/
    audio/
    video/
    images/
    thumbs/
```

### Main Entities

- `gift_sessions`
- `artworks`
- `gift_messages`
- `shipping_addresses`
- `audit_events`

See `docs/db-schema.sql`.

## Route Design

Frontend routes:

```txt
/create/?token=TOKEN
/lp/?id=LP_ID
/thanks/?id=LP_ID
```

API routes:

```txt
GET    /api/session?token=TOKEN
POST   /api/session/start
POST   /api/uploads/presign
POST   /api/artworks
POST   /api/artworks/:artworkId/select
POST   /api/gift/submit
GET    /api/lp?id=LP_ID
GET    /api/office/export.csv
```

If the current app is not using Workers yet, adapt routes to the current API layer. Keep the API contract equivalent.

## Data Safety

- Never expose address data on the public LP.
- LP must only show public-safe data:
  - to display name
  - from display name
  - message
  - image/video URL
- Use long random IDs for `token`, `lp_id`, and `artwork_id`.
- Do not trust client-side generation count. Enforce on server.
- Add `noindex` meta tag to LP.

## Media Rules

- Max duration: 60 seconds.
- Max generation count: 2.
- Accept audio upload: `audio/mpeg`, `audio/mp4`, `audio/wav`, `audio/webm`, `audio/x-m4a`
- Accept video upload: `video/mp4`, `video/webm`, `video/quicktime`
- Prefer WebM recording in browser where supported.
- If MP4 is not reliably creatable client-side, store WebM for MVP.
- Generate a PNG still image for each attempt.
- Store video when possible. If video recording fails but image succeeds, show partial success and allow retry if attempts remain.

## UI Requirements

Creation page state flow:

```txt
1. Validate token
2. Intro / instructions
3. Choose input mode:
   - Record camera + mic
   - Upload audio
   - Upload video
4. Record/upload
5. Validate duration and non-silent audio
6. Generate Echo Garden result
7. Save image + video/original to R2
8. Show result
9. If attempts remain, allow second generation
10. Compare results
11. Select final work
12. Enter message/shipping
13. Confirm
14. Submit complete
```

## Development Rules

1. Preserve existing working image upload behavior.
2. Add video saving without breaking image saving.
3. Prefer small, isolated modules.
4. Avoid large rewrites.
5. Add defensive error handling around browser media APIs.
6. Test on smartphone viewport.
7. Keep MVP stable over clever.
8. Add comments only where they clarify non-obvious behavior.
9. Do not add new heavy dependencies without documenting why.
10. If implementation details are unknown, inspect existing files first and adapt.

## Suggested File/Module Names

Adapt to current structure, but prefer:

```txt
src/mvp/
  session.js
  media-recorder.js
  media-upload.js
  generation-limit.js
  artwork-save.js
  compare-ui.js
  gift-submit.js
  lp-loader.js

api/
  session.js
  uploads.js
  artworks.js
  gift.js
  lp.js
  office-export.js
```

## Acceptance Criteria

The MVP is complete when:

1. A valid token opens the creation page.
2. Invalid token is rejected.
3. User can record or upload media.
4. Media over 60 seconds is rejected.
5. Silent audio does not generate.
6. User can generate max 2 attempts.
7. Browser back/reload does not reset server-side attempt count.
8. Each attempt stores at least image; video is stored when recording/upload succeeds.
9. User can compare 2 results.
10. User can select one final work.
11. Final selected work cannot be changed from the UI.
12. User can submit message and shipping data.
13. `/lp/?id=...` displays selected work and message.
14. Address is not exposed on LP.
15. Office export includes production/shipping data.
16. Existing image save flow still works.
