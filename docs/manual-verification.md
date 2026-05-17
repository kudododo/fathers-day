# Manual Verification

## Existing Echo Garden flow

1. Start the local server with `npm start`.
2. Open `/`.
3. Generate an artwork from the existing Echo Garden UI.
4. Trigger the existing save flow with `グッズ作成する`.
5. Confirm `POST /api/artworks` still succeeds with `multipart/form-data` and returns `artwork_master_url`.

## Father’s Day MVP shells

1. Open `/create/?token=test`.
2. Confirm the page validates the session and shows the remaining attempt count.
3. Confirm the page offers all three media modes: record camera + microphone, upload audio, upload video.
4. In mobile viewport, confirm the live recording preview is portrait-oriented. In desktop viewport, confirm it switches to landscape.
5. Confirm recording can be started and stopped manually and auto-stops at 60 seconds.
6. Confirm audio/video files over 60 seconds are rejected.
7. Confirm silent audio is rejected with `音声が検出できませんでした。もう一度録音してください。`
8. Confirm processing state shows `アップロード中です。画面を閉じないでください。`
9. Open `/lp/?id=test`.
10. Confirm the placeholder LP renders and includes the `noindex,nofollow` meta tag.
11. Generate two attempts and confirm both result cards appear with image preview, optional video preview, and attempt number.
12. Confirm the third generation attempt is rejected.
13. Confirm selecting one artwork hides regeneration controls and shows the message/shipping form.
14. Confirm a second selection cannot be made from the UI.

## API skeleton smoke checks

1. `GET /api/session?token=test`
2. `POST /api/uploads` with multipart `file` plus `metadata.asset_kind=image|video|audio|original`
3. Confirm assets land under `fathers-day-2026/images/`, `video/`, `audio/`, `originals/`
4. `POST /api/artworks` with JSON body including `token=test`, asset URLs, and media metadata
5. `POST /api/artworks/{artworkId}/select` with JSON body including `token=test`
6. `POST /api/gift/submit` with JSON body including message and shipping data
7. `GET /api/lp?id=test`
