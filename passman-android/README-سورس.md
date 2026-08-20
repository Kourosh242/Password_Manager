# 📱 Offline Password Manager — سورس اندروید

نسخهٔ اندروید «مدیر رمز عبور آفلاین» (Korosh and Luna) — وب‌ویو بومی + هستهٔ HTML کاملاً آفلاین.

## 📋 مشخصات

| مورد | مقدار |
|---|---|
| زبان | Java + HTML/CSS/JS داخل assets |
| حداقل اندروید | **اندروید 10** (API 29) |
| حداکثر | اندروید 16 (API 36) — targetSdk 36 |
| پردازنده‌ها | **همه** (ARM/ARM64/x86/x86_64) — بدون کتابخانهٔ نیتیو |
| مجوزها | **صفر** (حتی INTERNET ندارد) |
| package / applicationId | `com.korosh.offlinepasswordmanager` |
| ورژن فعلی | 1.0.2 (versionCode 3) |

## 📁 ساختار

```
passman-android/
├── settings.gradle / build.gradle / gradle.properties
├── gradlew / gradlew.bat / gradle/wrapper/     ← نیازی به نصب Gradle نیست
├── keystore/
│   ├── opm-release.keystore                    ← کلید امضا (حفظش کنید!)
│   └── keystore-info.txt                       ← مشخصات کلید
├── app/
│   ├── build.gradle
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── assets/Index.html                   ← کل اپلیکیشن (همان هستهٔ HTML)
│       ├── java/com/korosh/offlinepasswordmanager/
│       │   ├── MainActivity.java               ← شل WebView (قفل اینترنت، back، فایل‌چوزر)
│       │   └── BackupBridge.java               ← ذخیرهٔ پشتیبان در Downloads بدون مجوز
│       └── res/                                ← آیکون‌ها و تم
└── screenshots/                                ← پیش‌نمایش رابط
```

## 🛠️ ساخت APK

### نیازمندی‌ها
- JDK 17 به بالا (تست‌شده با JDK 21)
- Android SDK با `platforms;android-36` و `build-tools;36.0.0`
  (در Android Studio: Settings → SDK Manager)

### با خط فرمان (لینوکس/مک)
```bash
export ANDROID_HOME=~/Android/Sdk   # یا مسیر SDK خودتان
./gradlew assembleRelease
```
خروجی: `app/build/outputs/apk/release/app-release.apk` (امضاشده و zipalign)

### با Android Studio
1. پوشهٔ پروژه را Open کنید.
2. صبر کنید تا Gradle sync تمام شود (AGP 8.10.1 و Gradle 8.13).
3. Build → Build APK(s) یا Generate Signed App Bundle/APK.

> ⚠️ امضای release به `keystore/opm-release.keystore` متصل است (رمز عبور در `keystore-info.txt`).
> برای انتشار عمومی حتماً رمز را عوض کنید یا keystore جدید بسازید؛ ولی اگر فقط می‌خواهید روی
> همان نصب فعلی «به‌روزرسانی» بدهید، باید با همین کلید امضا کنید (امضای فعلی APK با همین کلید است).

## 🔑 نکات امنیتی پیاده‌سازی‌شده
- **صفر مجوز**: منیفست هیچ مجوزی ندارد؛ حتی INTERNET گرفته نشده.
- **مسدودی دوبل اینترنت**: داخل WebView همهٔ درخواست‌های http/https در `shouldInterceptRequest` بلاک می‌شوند.
- لینک وب‌سایت ورودی‌ها فقط در مرورگر سیستم باز می‌شود.
- رمزنگاری: AES-256-GCM + PBKDF2-SHA-256 (۳۱۰هزار تکرار) — داخل هستهٔ HTML.
- داده‌ها: IndexedDB خصوصی برنامه (حذف دیتای برنامه = حذف گاوصندوق؛ پشتیبان بگیرید!).
- بازیابی خودکار WebView در صورت کرش فرآیند رندر (دستگاه‌های کم‌رم).

## 🧭 رفتارهای بومی
- **پشتیبان‌گیری** → ذخیرهٔ فایل JSON رمزنگاری‌شده در `دانلودها/OfflinePasswordManager/` بدون هیچ مجوزی (MediaStore).
- **بازیابی** → پنجرهٔ بومی انتخاب فایل (ACTION_OPEN_DOCUMENT).
- **دکمهٔ بازگشت** → ناوبری بین صفحات هش‌روتر + Predictive Back اندروید 13+.
- «فراموشی رمز عبور» → پاک‌کردن امن داده و شروع از اول.

---
Created by Korosh and Luna 💜
