# Codex Prompt 01 — Prepare Father’s Day MVP from existing Cloudflare save baseline

You are working in the Echo Garden repository.

Goal:
Create the Father’s Day MVP foundation by extracting the existing Cloudflare image save implementation and adding the MVP route/API structure without breaking current behavior.

Read first:
- AGENTS.md
- docs/README-MVP.md
- docs/mvp-requirements.yaml
- docs/backlog.yaml
- docs/db-schema.sql
- docs/api-contract.md

Context:
A previous version already supports saving generated images to Cloudflare R2. Use that as the baseline. Do not rewrite the app. Locate and preserve the working image upload path.

Tasks:
1. Inspect the repository and identify:
   - Current image generation module
   - Current image upload/R2 module
   - Current API route handling artwork upload
   - Current environment variables
2. Add Father’s Day MVP route shells:
   - /create/?token=...
   - /lp/?id=...
3. Add or prepare D1 migration using docs/db-schema.sql.
4. Add API skeletons equivalent to:
   - GET /api/session?token=...
   - POST /api/artworks
   - POST /api/artworks/:artworkId/select
   - POST /api/gift/submit
   - GET /api/lp?id=...
5. Do not implement advanced UI yet.
6. Keep all existing image save behavior working.
7. Add minimal tests or manual verification notes.

Acceptance:
- Existing Echo Garden page still works.
- Existing image save still works.
- /create/?token=test renders a basic MVP page.
- /lp/?id=test renders a basic LP placeholder.
- D1 schema/migration is present.
- No secrets are committed.
