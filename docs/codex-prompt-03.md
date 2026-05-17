# Codex Prompt 03 — Add video/original media saving to Cloudflare R2

Goal:
Extend the existing image save implementation so Father’s Day MVP can save video/original media alongside generated images.

Read first:
- AGENTS.md
- docs/api-contract.md
- docs/backlog.yaml

Tasks:
1. Locate existing Cloudflare R2 image upload implementation.
2. Add a reusable upload helper for:
   - image/png
   - video/webm
   - video/mp4
   - video/quicktime
   - audio/mpeg
   - audio/mp4
   - audio/wav
   - audio/webm
3. Store files under:
   - fathers-day-2026/images/
   - fathers-day-2026/video/
   - fathers-day-2026/audio/
   - fathers-day-2026/originals/
4. Ensure an artwork attempt can store:
   - image_url
   - video_url
   - original_media_url
   - audio_url
   - duration_seconds
   - width
   - height
   - aspect_ratio
5. Keep image save behavior backward compatible.
6. Add robust error handling:
   - image saved but video failed
   - upload retry
   - user-friendly failure messages

Acceptance:
- Generated PNG still saves to R2.
- Recorded/uploaded video saves to R2.
- Uploaded audio saves to R2 when audio mode is used.
- D1 artwork row stores asset URLs.
- Existing code paths are not broken.
