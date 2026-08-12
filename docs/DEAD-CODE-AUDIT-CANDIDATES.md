# Dead-code audit candidates — Seellie native
Generated before cleanup. Classifications after dependency tracing.

## SAFE TO REMOVE (proven unused)

| Item | Reason |
|------|--------|
| `src/components/private/SafePrivateIncomingAlerts.tsx` | Zero mounts/imports |
| `src/components/private/PrivateIncomingAlerts.tsx` | Only imported by Safe wrapper |
| `src/services/message-tone.ts` | Only used by PrivateIncomingAlerts |
| `assets/sounds/private-message.wav` | Only referenced by message-tone |
| `src/utils/forum-video.ts` | Deprecated re-export; zero imports |
| `src/theme/rtl.ts` | Zero imports; live RTL elsewhere |
| `FloatingChromeProvider.tsx` + AppProviders wrap | Hooks never consumed; scroll uses floating-scroll-bus |
| `takePendingAuthUrl` export | Deprecated; callers use peek+clear |
| `cn`, `appLocaleTag` in utils/index | Zero external uses |
| Unused exports: `isFloatingVisible`, `setSportsDataProvider` | Zero call sites |
| `clearContentAuthorFocus` / `getContentAuthorFocus` | REVIEWED → KEEP (logout/peek API) |
| `uuid`, `@types/uuid` | Zero imports (createId is custom) |
| `expo-crypto` | Zero imports; not in app.config plugins |
| Duplicate QR: `expo-go-qr-latest.png`, `expo-qr.png` | Identical MD5 to `expo-go-qr.png` |
| Empty `src/components/domain/` | Empty placeholder |

## REVIEWED → KEEP (was POTENTIALLY_UNUSED)

| Item | Decision |
|------|----------|
| `console.warn` in cloud/sync | Operational logging — keep |
| Role-scoped duplicate screen names | Intentional per role |
| AdminEntryChip vs AdminEntryButton | Both used |
| `expo-system-ui` | Keep for Expo Android UI / userInterfaceStyle |
| `firebase` + Firebase env | Used by competition-sync |
| `chat.tsx` legacy redirect | Deep-link compatibility |
| Dual `profile/[id]` routes | URL aliases — required |
| Root `locales/*.json` | Referenced by app.config |
| Ops files: `admin-*.png/txt`, `open-app.html`, `expo-go-url.txt` | Dev/ops helpers — keep one set |
| `seellie-logo-source.jpg` | Source asset for branding — keep |
| Unused i18n keys (bulk) | Not exhaustively proven — do not mass-delete |
| Supabase tables/RPC/policies/SQL history | No remote proof of unused — no schema deletes |
| `isAppEnglish` | Used internally by formatters |

## UNKNOWN — do not delete

| Item | Notes |
|------|-------|
| Whether Firestore path still receives production writes vs Supabase only | Parallel sync — leave until product decision |
| Full i18n key orphan set | Needs dedicated key-usage tooling |
| Android/iOS native projects | Managed Expo — no standalone android/ios folders to scrub |
| Edge function season-window copy vs client copy | Both required in their runtimes |
