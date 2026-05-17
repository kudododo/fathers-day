# Implementation Notes

## Recommended MVP Order

1. Protect current image save.
2. Add D1 schema.
3. Add session/token lookup.
4. Add recording/upload UI.
5. Add video/original media upload.
6. Add attempt count.
7. Add comparison and selection.
8. Add message/shipping form.
9. Add LP.
10. Add CSV export.

## About URL Parameters

Use URL parameters only as lookup keys.

Good:
```txt
/lp/?id=lp_abc123
/create/?token=tok_abc123
```

Bad:
```txt
/lp/?to=山田太郎&address=...
```

## About Public LP

LP should be public-by-unguessable-link, not authenticated.

Add:
```html
<meta name="robots" content="noindex,nofollow">
```

## About Media Duration

For uploads, determine duration by loading into `audio` or `video` element and reading `duration`.
For recordings, auto-stop at 60 seconds.

## About Silent Audio

MVP detection can be simple:
- Decode audio buffer.
- Calculate average RMS.
- If RMS below threshold, reject.

Tune threshold by testing with actual smartphone recordings.

## About Aspect Ratio

Default:
- Mobile viewport: 9:16
- Desktop viewport: 16:9

Do not ask user unless necessary. Less choice is better for this MVP.

## About Person Segmentation

Do not include person segmentation in the MVP acceptance criteria.
Track it as a future enhancement.

Future feature:
- Use camera video as foreground.
- Use segmentation mask to separate person.
- Render Echo Garden only in background.
- Composite final video.

This is valuable but too risky for the one-week MVP.
