# مدیر رمز عبور آفلاین

برنامهٔ کاملاً **آفلاین** برای نگهداری رمزهای عبور — بدون اینترنت، بدون حساب کاربری، بدون سرور.

نسخهٔ اندروید (WebView بومی) و نسخهٔ ویندوز (Electron 22، سازگار با Windows 7 تا 11). هستهٔ رمزنگاری و رابط در HTML مشترک است.

**Created by Korosh and Luna**

## پیش‌نمایش

| قفل / ساخت گاوصندوق | داشبورد | جزئیات ورودی |
|---|---|---|
| ![صفحه قفل](passman-android/screenshots/android-01-lock.png) | ![داشبورد](passman-android/screenshots/android-02-dashboard.png) | ![جزئیات](passman-android/screenshots/android-03-entry-details.png) |

| جستجو | فیلترها | تولید رمز |
|---|---|---|
| ![جستجو](passman-android/screenshots/android-04-search-closed.png) | ![فیلتر](passman-android/screenshots/android-05-search-filters-open.png) | ![رمزساز](passman-android/screenshots/android-08-generator.png) |

| تم تیره | دیالوگ موبایل |
|---|---|
| ![قفل تیره](passman-android/screenshots/android-09-dark-lock.png) | ![باتم‌شیت](passman-android/screenshots/android-07-bottom-sheet-dialog.png) |

## امنیت

- AES-256-GCM + PBKDF2-SHA-256 (۳۱۰٬۰۰۰ تکرار)
- رمز اصلی هیچ‌جا ذخیره نمی‌شود
- بدون مجوز INTERNET روی اندروید؛ درخواست‌های شبکه در WebView و Electron مسدود می‌شوند
- CSP سخت‌گیرانه، بدون منبع خارجی
- بکاپ سیستم اندروید غیرفعال است
- کلید امضای APK **داخل مخزن نیست** — هر توسعه‌دهنده کلید خودش را محلی می‌سازد

جزئیات: [SECURITY.md](SECURITY.md)

## ساختار

```
passman-android/   نسخهٔ اندروید (راهنما: passman-android/README-سورس.md)
passman/           نسخهٔ ویندوز / Electron
```

## ساخت

**اندروید** (JDK 17+ و Android SDK):

```bash
cd passman-android
# اختیاری: keystore.properties را از روی example بسازید تا APK امضا شود
./gradlew assembleRelease
```

**ویندوز / دسکتاپ:**

```bash
cd passman
npm install
npm start
npm run dist
```

مستندات کامل:

- [اندروید — راهنمای سورس](passman-android/README-سورس.md)
- [اندروید — توضیح کامل کد](passman-android/توضیحات-کامل-کد.md)
- [ویندوز — توضیح کامل کد](passman/توضیحات-کامل-کد-ویندوز.md)
