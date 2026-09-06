# Golden media set (P2)

Stable assets for A/V regression. Prefer HTTPS progressive MP4 (no HLS in app).

| Id | Duration | Purpose | URL / path |
| --- | --- | --- | --- |
| `short-speech` | ~6s | Startup + unmute latency | `https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4` |
| `mid-action` | ~15s | Seek / pause-resume | `https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4` |
| `long-scenic` | ~60s+ | Drift over time (sample window 5 min looped) | Use app-hosted long clip when available; fallback loop `ForBiggerJoyrides.mp4` |

## Local mirrors (optional)

Place optional copies under `e2e/golden/media/` (gitignored binaries) named:
- `short-speech.mp4`
- `mid-action.mp4`
- `long-scenic.mp4`

## How to use

1. Web Playwright: load feed/forums with golden URLs injected via test fixtures / seed.  
2. Native: Maestro flows in `e2e/native/` open the same URLs in Inline/FullScreen.  
3. Record metrics → write `e2e/golden/fixtures/<platform>-metrics.json` → `npm run test:video-gates`.
