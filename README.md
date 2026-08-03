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
| مشرف | super.admin@test.com | superadmin123 | **`/admin`** فقط |

> دخول المشرف منفصل: افتح المسار `/admin` (لا يعمل من شاشة دخول التطبيق).

## الميزات المعمارية

- Design System موحّد (ألوان / مسافات / خطوط / نصف قطر)
- وضع فاتح وداكن
- RTL عربي
- SafeArea + أبعاد ديناميكية (هواتف / أجهزة لوحية)
- Toast احترافي + Empty/Loading states
- جلسة مستخدم عبر SecureStore
- Firebase عبر متغيرات بيئة
