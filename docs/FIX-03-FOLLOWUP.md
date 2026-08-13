# FIX-03 FOLLOW-UP (out of scope — recorded only)

Items discovered during FIX-03 closure that were **not** fixed in this pass:

1. **Firestore still initialized on web when env present**  
   Even with skip of `getDoc` during Supabase boot, Firebase SDK may still load if other paths call `getDb()`. Consider a follow-up to fully gate Firestore behind `!isSupabaseConfigured()` for web production.

2. **TournamentProvider still a large god-context**  
   Auth is now unlocked independently of catalog hydrate, but selective context split remains a FIX-04 / architecture item.

3. **Production deploy lag**  
   Live `www.seellie.com` may still serve an older bundle until Vercel/host deploy of `1.0.76`. Local Metro + `expo export` verified this closure.

4. **Admin table horizontal scroll**  
   Intentional `minWidth` table scrolling not re-audited on every admin screen in this pass; treat as intentional unless a specific overflow bug is filed.

5. **iOS / Android device matrix**  
   NOT TESTED — no `android/` / `ios/` native projects and no adb/simulator in this environment.

Do not start FIX-04 from this list automatically.
