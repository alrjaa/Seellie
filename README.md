# Seellie — Native (Expo)

تطبيق Native احترافي مبني بـ **Expo Router + React Native + TypeScript**.

## الهيكل

```
native/
  app/                 # مسارات Expo Router (غلاف رفيع)
  src/
    components/        # UI + feedback + layout
    data/              # بيانات أولية
    hooks/             # useResponsive وغيرها
    providers/         # Theme / Toast / Tournament
    screens/           # شاشات التطبيق
    services/          # storage / firebase
    theme/             # Design System
    types/             # أنواع مشتركة
    utils/             # دوال مساعدة
```

## التشغيل

```bash
cd native
npm install
npm start
```

ثم:
- `i` لمحاكي iOS
- `a` لمحاكي Android
- أو افتح `http://<LAN-IP>:8081` للويب
- أو Expo Go: `exp://<LAN-IP>:8081`

## البيئة

انسخ `.env.example` إلى `.env` وعبّئ مفاتيح Firebase:

```bash
cp .env.example .env
```

ملف `.env` مُستثنى من Git.

## حسابات تجريبية

| الدور | البريد | كلمة المرور | شاشة الدخول |
|------|--------|-------------|-------------|
| متابع | follower@test.com | password123 | `/(auth)/login` |
| منظم | organizer1@test.com | password123 | `/(auth)/login` |
| لاعب حر | freelancer@test.com | password123 | `/(auth)/login` |
| مشرف | حساب Supabase مرقّى | عبر SQL | **`/admin`** فقط |

> المشرف سحابي فقط (لا حساب تجريبي محلي). رقِّ الحساب بـ `supabase/promote-admin.sql` أو عيّن كلمة المرور بـ `set-admin-password.sql`.

> **بوابة المشرف مستقلة عن التطبيق:**
> - دخول التطبيق: `https://www.seellie.com/login`
> - دخول المشرف: `https://www.seellie.com/admin`
> - لوحة المشرف: `https://www.seellie.com/admin/home` ، `/admin/users` ، …
> - اختياري لاحقاً: اربط النطاق `admin.seellie.com` على نفس مشروع Vercel ليصبح المضيف كله لبوابة المشرف.

## الميزات المعمارية

- Design System موحّد (ألوان / مسافات / خطوط / نصف قطر)
- وضع فاتح وداكن
- RTL عربي
- SafeArea + أبعاد ديناميكية (هواتف / أجهزة لوحية)
- Toast احترافي + Empty/Loading states
- جلسة مستخدم عبر SecureStore
- Firebase عبر متغيرات بيئة
