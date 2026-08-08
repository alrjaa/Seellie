# استعادة كلمة المرور (موثوقة عبر رمز OTP)

روابط البريد (`ConfirmationURL`) غالباً تُفتح تلقائياً من ماسحات Gmail/Outlook فتصبح `otp_expired`
قبل أن يضغطها المستخدم. لذلك المسار الصحيح هو **رمز 6 أرقام** وليس الرابط.

## 1) قالب الإيميل في Supabase (إلزامي)

**Authentication → Email Templates → Reset password**

استبدل المحتوى بما يلي (أو أضف سطر الرمز على الأقل):

```html
<h2>استعادة كلمة المرور — Seellie</h2>
<p>رمز الاستعادة (انسخه فقط، لا تفتح أي رابط تحقق):</p>
<p style="font-size:28px;letter-spacing:4px;"><strong>{{ .Token }}</strong></p>
<p>
  افتح صفحة التعيين وأدخل الرمز:
  <a href="https://www.seellie.com/reset-password">https://www.seellie.com/reset-password</a>
</p>
<p>الرمز ينتهي خلال ساعة تقريباً. اطلب رمزاً جديداً إن انتهت صلاحيته.</p>
```

مهم: **لا تستخدم** `{{ .ConfirmationURL }}` كزر رئيسي — ذلك يستهلك الرمز فور فتحه.

## 2) URL Configuration

**Authentication → URL Configuration**

- **Site URL:** `https://www.seellie.com`
- **Redirect URLs:**
  ```
  https://www.seellie.com/**
  https://www.seellie.com/reset-password
  https://seellie.com/**
  https://*.vercel.app/**
  seellie://reset-password
  exp://**/--/reset-password
  ```

## 3) طريقة الاستخدام

1. من `/admin` أو الدخول → «نسيت كلمة المرور»
2. أدخل الإيميل → إرسال رمز الاستعادة
3. ستفتح شاشة التعيين تلقائياً
4. انسخ **الرمز** من الإيميل (ليس الرابط)
5. أدخل الرمز + كلمة المرور الجديدة → حفظ
6. سجّل الدخول

## طوارئ للمشرف فقط

`native/supabase/set-admin-password.sql` في SQL Editor.
