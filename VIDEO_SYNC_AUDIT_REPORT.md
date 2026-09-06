# VIDEO_SYNC_AUDIT_REPORT.md

**Repo:** `alrjaa/Seellie`  
**Commit:** `44d1ca5` (docs tip; release reference `b6ad0ab` / v1.0.179)  
**Mode:** Read + Test + Report only (no application code changes)  
**Date (UTC):** 2026-09-06  

---

## Executive Summary

| Question | Answer |
| --- | --- |
| هل توجد مشكلة A/V Desync عامة على كل الشاشات؟ | **لا.** لا يوجد مسار واحد يفصل مسار الصوت عن مسار الفيديو في مشغّل موحّد؛ على الويب يعتمد الـ feed على عنصر `HTMLVideoElement` واحد (ساعة زمنية واحدة للصوت والصورة). |
| هل يوجد خطر / سلوك يُحسب كـ desync مُدرَك؟ | **نعم، جزئيًا وبشكل غير موحّد:** مسار **audible-first → muted fallback** قد يُشغّل الصورة بدون صوت ثم يُلحق الصوت لاحقًا (startup skew مُدرَك). مسارات **Forums** و**AdPhonePreview** و**Private lightbox** تتجاوز المحرك الموحّد. |
| هل الإعدادات موحّدة عبر كل الشاشات؟ | **لا.** مكدسان: Feed/Inline (محرك مشترك) مقابل Forums / Ads / Private (مسارات مستقلة). |
| أين الأولوية؟ | **P1:** توحيد Forums + قياس unmute latency. **P2:** توثيق/اختبار أصلي native. لا يوجد P0 lip-sync مثبت بقياس ms على إنتاج الويب في هذه الجولة. |

**Verdict:** لا يوجد دليل على **lip-sync drift ميكانيكي عام**. توجد **فجوات توحيد وتشغيل** قد تُفسَّر كعدم تزامن صوت/صورة من منظور المستخدم، خاصة عند سياسة autoplay والـ unmute المتأخر.

---

## 1) Inventory — كل نقاط تشغيل الفيديو

### 1.1 مشغّلات مشتركة

| Screen / Route hosts | Component | File | Player | Source |
| --- | --- | --- | --- | --- |
| `/(follower)/general`, `/highlights`, `/personality`, `/unique`, `/shares` (هاتف) | `FullScreenFeed` / `Slide` | `src/components/media/FullScreenFeed.tsx` | Web: HTML5 · Native: expo-av | Remote `https` |
| نفس الشاشات (تابلت) + تفاصيل مباراة/تحليل/وسائط/خاص/بطاقة لاعب/مشاركة | `InlineVideoPlayer` | `src/components/media/InlineVideoPlayer.tsx` | Web: HTML5 · Native: expo-av · Modal: expo-av | Remote / محلي (preview) |

### 1.2 مسارات مباشرة (outliers)

| Screen / Route | Component | File | Player | Source |
| --- | --- | --- | --- | --- |
| `/(follower)/private` | `AttachVideoThumb`, `ChatMediaThumb`, `ChatMediaLightbox` | `src/screens/follower/PrivateScreen.tsx` | expo-av thumbs · Lightbox HTML5/expo-av | محلي / URL محادثة |
| `/(follower)/private` composer | pending thumb | `src/components/private/PrivateChatComposer.tsx` | expo-av | pick محلي |
| `/forums` | `CommentCard` + compose preview | `src/screens/shared/ForumsScreen.tsx` | expo-av + `useNativeControls` | Remote / محلي |
| `/ads/home`, `/ads/ad/new`, `/ads/ad/[id]`, `/admin/(console)/ads` | `AdPhonePreview` | `src/components/ads/AdPhonePreview.tsx` | HTML5 / expo-av | Remote / محلي |
| Ads editor (غير واجهة تشغيل) | `probeHtmlVideo` / `captureHtmlFrame` | `src/screens/ads/AdsAdEditorScreen.tsx` | HTML5 offscreen | محلي |

### 1.3 غير مشمول كمشغّل واجهة
- اختيار رابط فقط (`CreateAnalysisScreen`)، عدّادات، بيانات seed `.mp4`، لا HLS/`m3u8`، لا `expo-video` / `react-native-video`.

### 1.4 طبقة A/V العالمية
- `media-autoplay-engine.ts` — audible-first ثم muted fallback  
- `web-media-sound.ts` — تسجيل الفيديو النشط / unlock  
- `media-user-activation.ts` — إيماءة المستخدم  
- `native-feed-autoplay.ts` + `useNativeFeedVideoAutoplay.ts` — مشغّل أصلي واحد unmuted  
- `app/_layout.tsx` — تثبيت unlock (web) + audio session (native)

---

## 2) Evidence — ماذا قيس وماذا لم يُقس

### 2.1 Unit / policy tests (محلي، PASS)
على الأقل **18** اختبارًا متعلقًا بالمشغّل/الصوت نجحت، منها:
- audible-first ثم muted fallback  
- `startVisibleWebVideo` / attach sound لا يوقف الفيديو  
- native feed: مشغّل واحد، hysteresis 50%/20%  
- أخطاء autoplay ≠ فشل وسائط  

→ يؤكد أن **سياسة التشغيل مقصودة ومختبرة**، لا أن lip-sync للملف سليم على الجهاز.

### 2.2 Playwright production probe (2026-09-06)
- Desktop: `video` count = 0 على `/`, `/general`, `/highlights`, `/unique`, `/forums` (غالبًا تخطيط تابلت/لا mount لـ FullScreenFeed أو لا محتوى).  
- Mobile viewport: بعد الدخول يُعاد التوجيه إلى **`/complete-profile`** لحساب E2E → **تعذّر قياس feed الحي**.  
- Login page: 0 videos (متوقع).

**حدود القياس:** على عنصر HTML5 واحد، `currentTime` مشترك للصوت والصورة؛ فرق lip-sync الحقيقي يحتاج جهاز/ملف مرجعي أو أدوات native. التقديرات أدناه تعتمد على **تحليل الكود + سيناريوهات سلوكية + اختبارات السياسة**.

### 2.3 تصنيف التقدير (عند غياب ms دقيقة)

| Band | ms |
| --- | --- |
| Excellent | &lt;80 |
| Acceptable | 80–150 |
| Noticeable | 150–300 |
| Bad | &gt;300 |

---

## 3) نتائج لكل سطح (Pass/Warn/Fail)

| Surface | Result | Severity | تقدير التزامن | ملاحظات |
| --- | --- | --- | --- | --- |
| FullScreenFeed (web) | **PASS** (lip-sync عنصر واحد) / **WARN** (unmute متأخر) | P1 | Excellent clock · startup skew Noticeable إن muted-fallback | `attemptAudibleAutoplay` + `promoteWebVideoSound` |
| FullScreenFeed (native) | **PASS*** | P2 | Excellent متوقع (expo-av A/V موحّد) | *لم يُختبر على جهاز في هذه الجولة |
| InlineVideoPlayer (web/native) | **PASS** / **WARN** unmute | P1 | كالسابق | نفس المحرك + IntersectionObserver |
| Inline fullscreen modal | **PASS** | P2 | Excellent | expo-av + native controls |
| Private thumbs (muted, no play) | **PASS** | — | N/A | لا تشغيل A/V |
| Private lightbox | **WARN** | P1 | Acceptable–Noticeable | مسار منفصل (`autoPlay`/`shouldPlay`) خارج المحرك |
| Forums `CommentCard` | **WARN** | P1 | Acceptable–Unknown | expo-av + native controls؛ **لا** `web-media-sound` |
| Forums compose preview | **PASS** | P2 | N/A (معاينة) | |
| AdPhonePreview | **WARN** | P1 | Noticeable ممكن عند unmute يدوي | `playWithSound` مستقل |
| Ads probe/frame | **PASS** | — | N/A | muted offscreen |

---

## 4) توحيد الإعدادات — `global_consistency`

**`is_unified`: false**

| Setting | Feed / Inline (shared) | Forums | Private lightbox | AdPhonePreview |
| --- | --- | --- | --- | --- |
| Autoplay policy | audible-first → muted fallback | لا autoplay (controls) | `autoPlay` / `shouldPlay` مباشرة | `autoPlay`/`shouldPlay` + muted prop |
| muted default | `false` ثم قد يُ Mute للسياسة | غير مضبوط صراحة | unmuted عند التشغيل | من prop |
| playsInline | نعم (web) | غير مضبوط في Forums | نعم (web) | نعم |
| preload | `auto` (web feed/inline) | — | — | — |
| useNativeControls | لا (feed) / شرطي (inline) | **نعم دائمًا** | نعم (lightbox) | لا |
| buffering / ABR | لا إعدادات ABR (ملفات progressive) | نفسه | نفسه | نفسه |
| rate / progressUpdateInterval | **غير مستخدم** في المشروع | — | — | — |
| audio focus | native: `DoNotMix` session | منفصل | منفصل | منفصل |
| Event handling | playGen stale guard, IO visibility | onLoad للمدة فقط | AppState pause | timeupdate للـ trim |

---

## 5) Root Causes المحتملة

1. **سياسة autoplay (مقصودة):** الفيديو قد يعمل muted بينما الصوت ينتظر إيماءة/`promoteWebVideoSound` → يُدرَك كـ startup desync.  
2. **تعدد مكدسات التشغيل:** Forums/Ads/Private لا تمر عبر `media-autoplay-engine` → سلوك غير متسق عند pause/seek/unmute.  
3. **سباق الأجيال (playGen) / AbortError:** سحب سريع بين الشرائح يلغي `play()`؛ قد يُعاد التشغيل مع تأخير صوت.  
4. **لا قياس `progressUpdateInterval` / لا مزامنة يدوية:** الاعتماد كامل على ساعة المنصة — جيد للـ lip-sync، ضعيف للتشخيص.  
5. **محتوى المصدر:** ملفات progressive MP4؛ أي desync داخل الملف نفسه سيظهر على كل المشغّلات (لم يُختبر بملف مرجعي).  
6. **بوابة complete-profile:** منعت قياس الإنتاج الحي للـ feed في هذه الجولة.

---

## 6) توصيات مرتبة

### P0
- لا يوجد إصلاح lip-sync طارئ مثبت بقياس ms على الإنتاج في هذه الجولة.

### P1
1. توحيد Forums (و/أو Private lightbox web) على `InlineVideoPlayer` أو نفس `attemptAudibleAutoplay` + registry.  
2. إضافة مقياس تشغيلي: زمن من `playing` إلى `muted===false` (unmute latency) في telemetry/dev-only.  
3. حساب E2E مكتمل الملف أو مسار bypass آمن للاختبار حتى يمكن إعادة probe الموبايل.  
4. وثّق للمستخدمين أن الصمت الأولي قد يكون سياسة المتصفح وليس عطل مزامنة.

### P2
1. اختبار أصلي (iOS/Android) لـ FullScreenFeed: pause/resume/seek/background.  
2. مراجعة `AdPhonePreview` لدمج `media-autoplay-engine`.  
3. ملفات اختبار Golden (قصير/طويل) مع lip-sync معروف في CI.  
4. إزالة التضارب النصي: تعليق الملف يقول "muted-first" بينما الكود **audible-first**.

---

## 7) إجابات صريحة لمعايير القبول

1. **هل يوجد عدم تزامن؟** لا كخلل ميكانيكي عام مثبت؛ نعم كـ **سلوك مُدرَك محتمل** عند muted-fallback / مسارات غير موحّدة.  
2. **أين؟** أساسًا عند **unmute المتأخر** في Feed/Inline web؛ و**Forums / Ads / Private lightbox** كمسارات متباينة.  
3. **موحّد أم محدد؟** **محدد بالمسارات** + سياسة autoplay المشتركة للـ feed — ليس فشلًا واحدًا لكل الشاشات.  
4. **أولويات الإصلاح؟** P1 توحيد + قياس unmute؛ P2 native + golden media؛ لا P0 عاجل.

---

## READY-TO-APPLY FIX COMMANDS

### اصلح الآن
- أكمل ملف حساب E2E (أو عيّن مستخدم feed جاهز) وأعد تشغيل probe الموبايل على `/general` و`/highlights`.  
- راقب في DevTools: `video.muted` بعد أول `playing` — إن بقي `true` لثوانٍ فهذه **startup skew** وليست lip-sync drift.  
- لا تخلط تقرير المستخدم عن «الصوت متأخر» مع عطل الملف قبل قياس unmute latency.

### خلال الأسبوع
- انقل `/forums` feed video إلى `InlineVideoPlayer` (أو غلاف يشارك `web-media-sound`).  
- أضف log مؤقت/علم `EXPO_PUBLIC_DEBUG_MEDIA=1`: `performance.now()` عند `play()` / `playing` / أول `muted=false`.  
- وحّد Private lightbox web مع نفس محرك autoplay.

### تحسين لاحق
- Suite أصلي (Detox/Maestro) لـ seek/background.  
- Golden MP4 short/long في CI.  
- دمج `AdPhonePreview` مع المحرك المشترك.  
- تصحيح تعليق "muted-first" ليطابق audible-first.

---

## Related artifacts
- `VIDEO_SYNC_MATRIX.json` (نفس المجلد / جذر المستودع)  
- Unit evidence: `npm test` (media/autoplay cases)
