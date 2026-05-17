# API Contract — Father’s Day MVP

This document describes the intended API shape. Adapt filenames/routes to the current stack, but keep equivalent behavior.

## GET /api/session?token={token}

Returns current creation session.

### Response 200

```json
{
  "session": {
    "id": "sess_xxx",
    "token": "tok_xxx",
    "lp_id": "lp_xxx",
    "status": "draft",
    "max_attempts": 2,
    "attempts_used": 0,
    "selected_artwork_id": null
  },
  "artworks": []
}
```

### Errors

- 403/404 invalid token
- 410 expired token

---

## POST /api/session/start

Marks session as started.

```json
{
  "token": "tok_xxx"
}
```

---

## POST /api/uploads/presign

For R2 direct upload or server-mediated upload.

```json
{
  "token": "tok_xxx",
  "kind": "original_video",
  "filename": "recording.webm",
  "content_type": "video/webm",
  "size": 12345678
}
```

Response:

```json
{
  "upload_url": "https://...",
  "asset_key": "fathers-day-2026/originals/...",
  "public_url": "https://assets.example.com/..."
}
```

If current implementation uses server upload instead of presigned URL, keep the request fields but return saved URL after upload.

---

## POST /api/artworks

Creates an artwork attempt.

```json
{
  "token": "tok_xxx",
  "image_url": "https://assets.example.com/xxx.png",
  "video_url": "https://assets.example.com/xxx.webm",
  "original_media_url": "https://assets.example.com/original.webm",
  "duration_seconds": 45.2,
  "media_type": "recorded_video",
  "width": 1080,
  "height": 1920,
  "aspect_ratio": "9:16"
}
```

### Rules

- Reject if session is already selected/submitted.
- Reject if attempts_used >= max_attempts.
- Increment attempts_used server-side.
- Store attempt_number.

---

## POST /api/artworks/{artworkId}/select

Select final artwork.

```json
{
  "token": "tok_xxx"
}
```

### Rules

- Artwork must belong to session.
- Session must not already be submitted.
- After selection, session status becomes `selected`.

---

## POST /api/gift/submit

Stores message and shipping information.

```json
{
  "token": "tok_xxx",
  "message": {
    "to_display_name": "お父さんへ",
    "from_display_name": "花子より",
    "message": "いつもありがとう。"
  },
  "shipping": {
    "recipient_name": "山田 太郎",
    "postal_code": "100-0001",
    "address_line1": "東京都...",
    "address_line2": "..."
  }
}
```

### Rules

- selected_artwork_id must exist.
- Required fields must be present.
- Session status becomes `submitted`.

---

## GET /api/lp?id={lp_id}

Public LP data.

### Response

```json
{
  "lp_id": "lp_xxx",
  "to_display_name": "お父さんへ",
  "from_display_name": "花子より",
  "message": "いつもありがとう。",
  "image_url": "https://assets.example.com/xxx.png",
  "video_url": "https://assets.example.com/xxx.webm"
}
```

### Must Not Include

- postal code
- address
- phone
- internal token
- payment status
- private office notes

---

## GET /api/office/export.csv

Exports submitted data for office workflow.

Fields:

```csv
session_id,lp_id,lp_url,qr_target_url,to_display_name,from_display_name,message,recipient_name,postal_code,address_line1,address_line2,image_url,video_url,shipping_status
```

Protect this endpoint. For MVP, allow only when a configured `OFFICE_EXPORT_SECRET` is provided.
