# VIDEO_P1_REMEDIATION_REPORT.md

**Branch:** `fix/p1-video-player-unification-2026-09-06`  
**Base audit:** `2acad29`  
**Date (UTC):** 2026-09-06  

## What was unified

| Area | Change |
| --- | --- |
| Shared defaults | `src/services/video-player-defaults.ts` — `playsInline`, `preload=auto`, volume, late-unmute guard (800ms) |
| Telemetry | `src/services/video-playback-telemetry.ts` — startup skew, unmute latency, muted fallback, late unmute blocked, rebuffer |
| Autoplay engine | Audible-first + metrics; **late unmute without gesture blocked** after muted-fallback ages |
| Feed / Inline | `applyWebVideoDefaults` + surface tags (`fullscreen-feed` / `inline`) |
| Forums feed | Replaced raw `expo-av` `<Video useNativeControls>` with **`InlineVideoPlayer`** |
| Private lightbox (web) | Uses `startVisibleWebVideo` + shared defaults (controls kept) |
| AdPhonePreview (web) | Uses `attemptAudibleAutoplay` / muted path / gesture unmute via engine |

Compose preview on Forums still uses expo-av `Video` for `onLoad` duration validation (intentional exception).

## Measurements before / after

| Metric | Before (audit `2acad29`) | After (P1 unit harness) |
| --- | --- | --- |
| Live production unmute latency | Not measurable (E2E blocked by `/complete-profile`) | N/A live |
| Unit: muted fallback recorded | No | Yes (`muted_fallback` sample) |
| Unit: unmute after gesture | Allowed | Allowed + `unmute_latency_ms` recorded |
| Unit: late auto-unmute (>800ms, no gesture) | Would unmute if unlocked | **Blocked** (`late_unmute_blocked`) |
| Startup skew | Untagged | Recorded as `startup_skew_ms` when play completes |

**Note:** ms values in unit tests are synthetic (mock `play()`). Production median unmute latency still requires a completed-profile E2E feed run (P2 / ops).

## Screens affected

- FullScreenFeed hosts: general, highlights, personality, unique, shares  
- InlineVideoPlayer hosts (including Forums feed cards)  
- Private chat lightbox (web)  
- Ad phone preview (ads + admin ads)

## Remaining exceptions → P2

- Native device parity matrix not executed in P1  
- Golden media assets / CI latency gates  
- Forums compose preview still direct expo-av  
- Production feed probe needs E2E account past profile gate  

## Validation

- `npm test` — PASS (incl. 3 new video tests)  
- `npx tsc --noEmit` — PASS  
- `npm run build:web` — PASS  
- Playwright `e2e/video-consistency.spec.ts` — 2/2 PASS (forums + ads shells)

## Residual Risks (→ P2)

1. No growing-drift / 5-minute native measurement yet.  
2. Unmute latency SLOs (median &lt;120ms) not enforced in CI.  
3. Profile-completion gate blocks live feed instrumentation.
