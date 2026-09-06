# Native Video Hardening — Device Verification Schedule

**Trigger:** After merge of video P1+P2 to `main` (`9579f6b`)  
**Owner:** Mobile release / QA  
**Goal:** Close remaining P2 native gaps from `VIDEO_P2_HARDENING_REPORT.md`

## Window

| Slot | When (local SA) | Platform | Build |
| --- | --- | --- | --- |
| N1 | Within **48 hours** of this merge | Android physical device | EAS preview or production |
| N2 | Same window or next business day | iOS physical device | EAS preview or TestFlight |
| N3 | After N1+N2 | Optional emulator/simulator regression | Local Expo Dev Client |

## Checklist (each device)

1. Startup on FullScreenFeed (`/general` or `/highlights`) — note muted fallback vs audible  
2. Pause / resume  
3. Seek forward / back (inline or lightbox)  
4. Background app 10s → foreground  
5. Leave feed route and return (single active player)  
6. Forums video card + Ad preview unmute tap  
7. Record metrics into `e2e/golden/fixtures/android-metrics.json` / `ios-metrics.json`  
8. Run `VIDEO_GATE_FIXTURE=… npm run test:video-gates`

## Exit criteria

- No growing A/V drift reports from testers  
- Gates PASS against device fixtures  
- Update `VIDEO_P2_HARDENING_REPORT.md` matrix from SKIP → PASS/FAIL  

## Tracking

- Issue / checklist: use this file + PR comment on merge commit `9579f6b`  
- Maestro stubs: `e2e/native/README.md`
