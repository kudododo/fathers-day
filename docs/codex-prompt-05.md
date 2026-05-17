# Codex Prompt 05 — Implement gift message, shipping form, LP, and office export

Goal:
Complete the Father’s Day MVP flow after artwork selection.

Read first:
- AGENTS.md
- docs/api-contract.md
- docs/db-schema.sql

Tasks:
1. Add message/shipping form after final artwork selection.
2. Required fields:
   - to_display_name
   - from_display_name
   - message
   - recipient_name
   - postal_code
   - address_line1
3. Optional:
   - address_line2
   - phone
4. Submit via POST /api/gift/submit.
5. Change session status to submitted.
6. Implement LP API:
   - GET /api/lp?id=...
   - Return only public-safe data.
   - Do not return address/token.
7. Implement /lp/?id=... page:
   - noindex
   - display selected image/video
   - display to/from/message
8. Implement office export:
   - CSV endpoint or script
   - Include Canva/shipping-friendly columns
   - Protect with OFFICE_EXPORT_SECRET or equivalent

Acceptance:
- User can complete final submission.
- LP works with URL parameter.
- Address is not exposed on LP.
- Office CSV can be generated.
