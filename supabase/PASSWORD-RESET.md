# استعادة كلمة المرور (Supabase + Expo)

## لماذا تظهر صفحة فارغة في المتصفح؟

رابط البريد يمرّ أولاً عبر:
`https://YOUR_PROJECT.supabase.co/auth/v1/verify?...&redirect_to=...`

بعد التحقق يعيد التوجيه إلى `redirect_to`. إذا كان:

| redirect_to | النتيجة |
|---|---|
| `http://localhost:3000` | صفحة فارغة (لا يوجد موقع) |
| `seellie://...` بدون تطبيق مثبت | المتصفح يبقى فارغاً (Expo Go لا يفتح `seellie://`) |
| `exp://IP:8081/--/reset-password` | يفتح Expo Go → شاشة تعيين كلمة المرور |

## إعداد لمرة واحدة في Supabase

**Authentication → URL Configuration**

1. **Site URL** — ضع أحد الخيارين (ليس localhost):
   - للتطوير مع Expo Go: نفس رابط `exp://...` الذي يظهر بعد إرسال الاستعادة من التطبيق
   - أو: `seellie://reset-password`

2. **Redirect URLs** — أضف الكل:
   ```
   seellie://reset-password
   exp://**/--/reset-password
   ```

3. احفظ، ثم من التطبيق اطلب رابط استعادة **جديداً** (الروابط القديمة تحتفظ بـ localhost).

## طريقة الاستخدام الصحيحة

1. شغّل Expo على الكمبيوتر وافتح التطبيق على الهاتف.
2. من شاشة الدخول → نسيت كلمة المرور → أرسل الرابط.
3. انسخ من رسالة النجاح قيمة Redirect إن ظهرت، وتأكد أنها في قائمة Redirect URLs.
4. افتح رسالة البريد **من الهاتف** (Gmail/Mail على الجوال)، وليس من متصفح الكمبيوتر.
5. يفترض أن يفتح Expo ويعرض شاشة كلمة المرور الجديدة.

## طوارئ للمشرف

نفّذ `native/supabase/set-admin-password.sql` في SQL Editor إن احتجت تعيين كلمة المرور فوراً بدون البريد.
