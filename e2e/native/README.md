# Native video parity flows (P2) — Maestro stubs

These flows are documentation + starter YAML for device CI.
They do **not** replace a real Expo Dev Client / EAS build run.

## Matrix

| Scenario | iOS | Android | Notes |
| --- | --- | --- | --- |
| startup audible/muted fallback | planned | planned | Measure startup_skew_ms |
| pause / resume | planned | planned | |
| seek forward/back | planned | planned | seek_resync_ms |
| background / foreground | planned | planned | audio session DoNotMix |
| route change (leave feed) | planned | planned | single active player |

## Example flow (`startup.yaml`)

```yaml
appId: com.seellie.app # replace with real applicationId
---
- launchApp
- tapOn: "دخول" # or deep link into feed
- extendedWaitUntil:
    visible: ".*"
    timeout: 20000
- takeScreenshot: native-video-startup
```

Run on a wired device/emulator after EAS build; export metrics JSON for `video-quality-gates.ts`.
