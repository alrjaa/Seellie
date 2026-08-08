# استعادة كلمة المرور (Supabase + ويب / Expo)

## لماذا تظهر صفحة فارغة في المتصفح؟

رابط البريد يمرّ أولاً عبر:
`https://YOUR_PROJECT.supabase.co/auth/v1/verify?...&redirect_to=...`

بعد التحقق يعيد التوجيه إلى `redirect_to`. إذا كان:

| redirect_to | النتيجة |
|---|---|
| `http://localhost:…` | صفحة فارغة (لا يوجد موقع) |
| `seellie://…` من متصفح الكمبيوتر | شاشة فارغة (المتصفح لا يفتح التطبيق) |
| `https://seellie.com/reset-password` | يفتح موقع Seellie → شاشة كلمة المرور الجديدة |

إرسال الاستعادة من **لوحة Supabase** يستخدم **Site URL** كـ `redirect_to`.  
لذلك يجب أن يكون Site URL موقعاً حقيقياً على الويب وليس `seellie://`.

## إعداد لمرة واحدة في Supabase

**Authentication → URL Configuration**

1. **Site URL** (مهم جداً):
   ```
   https://seellie.com
   ```

2. **Redirect URLs** — أضف:
   ```
   https://seellie.com/**
   https://seellie.com/reset-password
   https://www.seellie.com/**
   https://*.vercel.app/**
   seellie://reset-password
   exp://**/--/reset-password
   ```

3. احفظ، ثم اطلب رابط استعادة **جديداً** (الروابط القديمة تحتفظ بـ redirect القديم).

## طريقة الاستخدام (ويب / أدمن)

1. من الموقع أو من Supabase: أرسل رابط الاستعادة إلى `alrjaa.ns@gmail.com`.
2. افتح الرسالة من المتصفح واضغط الرابط.
3. يجب أن تفتح: `https://seellie.com/reset-password` مع نموذج كلمة المرور الجديدة.
4. بعد الحفظ ادخل من `/admin`.

## طوارئ للمشرف (بدون بريد)

نفّذ `native/supabase/set-admin-password.sql` في SQL Editor.
