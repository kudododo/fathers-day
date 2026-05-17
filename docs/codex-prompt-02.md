# Codex Prompt 02 — Implement recording/upload UI with 60-second limit

Goal:
Implement smartphone-first media input for the Father’s Day MVP.

Read first:
- AGENTS.md
- docs/mvp-requirements.yaml
- docs/api-contract.md

Tasks:
1. On /create/?token=..., validate session using GET /api/session.
2. Add media mode selection:
   - Record camera + microphone
   - Upload audio
   - Upload video
3. Implement MediaRecorder recording:
   - Camera + microphone
   - Manual start/stop
   - Auto-stop at 60 seconds
   - Show timer
   - Use 9:16 layout for mobile viewport and 16:9 for desktop viewport.
4. Implement file upload:
   - Accept audio/video only.
   - Reject unsupported types.
   - Reject duration > 60 seconds.
5. Implement silent audio detection:
   - If audio is effectively silent, block generation and show:
     `音声が検出できませんでした。もう一度録音してください。`
6. Add clear upload/processing states:
   - `アップロード中です。画面を閉じないでください。`
7. Keep this implementation isolated in MVP modules when possible.

Acceptance:
- Mobile viewport can record camera+mic.
- Upload audio works.
- Upload video works.
- >60 sec media is rejected.
- Silent audio is rejected.
- No generation attempt is consumed before media passes validation.
