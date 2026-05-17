# Codex Prompt 04 — Implement max 2 attempts, compare UI, and final selection

Goal:
Implement the core Father’s Day MVP creation rules.

Read first:
- AGENTS.md
- docs/mvp-requirements.yaml
- docs/api-contract.md

Rules:
- Max 2 generation attempts per token.
- Server-side count is authoritative.
- Browser back/reload must not allow extra attempts.
- User can compare generated results.
- Final selection is locked.

Tasks:
1. Enforce generation limit in POST /api/artworks.
2. Show attempts_used / max_attempts in UI.
3. After each successful generation, show result card:
   - image preview
   - video preview when available
   - attempt number
4. If attempts_used < 2 and session is not selected, allow second generation.
5. Build compare UI for 1 or 2 attempts.
6. Implement final selection:
   - POST /api/artworks/:artworkId/select
   - Store selected_artwork_id
   - Update session status to selected
7. After selection:
   - hide regeneration controls
   - show selected work
   - proceed to message/shipping form

Acceptance:
- Third generation attempt is rejected.
- User can compare 2 attempts.
- User can select exactly 1 final artwork.
- Selection cannot be changed from the UI.
