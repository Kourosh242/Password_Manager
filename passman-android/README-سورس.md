# 📱 Offline Password Manager — سورس اندروید

نسخهٔ اندروید «مدیر رمز عبور آفلاین» (Korosh and Luna) — وب‌ویو بومی + هستهٔ HTML کاملاً آفلاین.

## 🖼 پیش‌نمایش

![صفحه قفل](screenshots/android-01-lock.png)

![داشبورد](screenshots/android-02-dashboard.png)

![جزئیات ورودی](screenshots/android-03-entry-details.png)

![جستجو](screenshots/android-04-search-closed.png)

![فیلترهای جستجو](screenshots/android-05-search-filters-open.png)

![تولید رمز](screenshots/android-08-generator.png)

![تم تیره](screenshots/android-09-dark-lock.png)

![دیالوگ موبایل](screenshots/android-07-bottom-sheet-dialog.png)

## 📋 مشخصات

| مورد | مقدار |
|---|---|
| زبان | Java + HTML/CSS/JS داخل assets |
| حداقل اندروید | **اندروید 10** (API 29) |
| حداکثر | اندروید 16 (API 36) — targetSdk 36 |
| پردازنده‌ها | **همه** (ARM/ARM64/x86/x86_64) — بدون کتابخانهٔ نیتیو |
| مجوزها | **صفر** (حتی INTERNET ندارد) |
| package / applicationId | `com.korosh.offlinepasswordmanager` |
| ورژن فعلی | 1.0.3 (versionCode 4) |

## 📁 ساختار

```
passman-android/
├── settings.gradle / build.gradle / gradle.properties
├── gradlew / gradlew.bat / gradle/wrapper/     ← نیازی به نصب Gradle نیست
├── keystore.properties.example                 ← الگوی امضا (فایل واقعی gitignore است)
├── keystore/README.md                          ← نحوهٔ ساخت کلید محلی
├── app/
│   ├── build.gradle
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── assets/Index.html                   ← کل اپلیکیشن (همان هستهٔ HTML)
│       ├── java/com/korosh/offlinepasswordmanager/
│       │   ├── MainActivity.java               ← شل WebView سخت‌شده
│       │   └── BackupBridge.java               ← ذخیرهٔ پشتیبان در Downloads بدون مجوز
│       └── res/                                ← آیکون‌ها، تم، قوانین بکاپ/شبکه
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
خروجی: `app/build/outputs/apk/release/app-release.apk`

### امضای انتشار (اختیاری، فقط روی دستگاه خودتان)

کلید امضا **داخل گیت نیست**. برای APK امضاشده:

```bash
cp keystore.properties.example keystore.properties
# طبق keystore/README.md کلید محلی بسازید و رمزها را فقط در keystore.properties بگذارید
./gradlew assembleRelease
```

اگر `keystore.properties` نباشد، بیلد release بدون امضای انتشار انجام می‌شود.

### با Android Studio
1. پوشهٔ پروژه را Open کنید.
2. صبر کنید تا Gradle sync تمام شود (AGP 8.10.1 و Gradle 8.13).
3. Build → Build APK(s) یا Generate Signed App Bundle/APK.

## 🔑 نکات امنیتی پیاده‌سازی‌شده
- **صفر مجوز**: منیفست هیچ مجوزی ندارد؛ حتی INTERNET گرفته نشده.
- **مسدودی چندلایهٔ شبکه**: فقط `file:///android_asset/` داخل WebView مجاز است؛ http/https بلاک و در مرورگر سیستم باز می‌شود.
- دسترسی فایل‌به‌فایل و content در WebView بسته است؛ دیباگ WebView فقط در بیلد debug.
- بکاپ ابری / انتقال دستگاه با `dataExtractionRules` و `allowBackup=false` مسدود است.
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
