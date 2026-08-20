# کلید امضای انتشار (محلی)

کلید امضا **هرگز نباید داخل مخزن گیت باشد**. فایل‌های `.keystore` / `.jks` و `keystore.properties` در `.gitignore` هستند.

## ساخت کلید روی دستگاه خودتان

```bash
cd passman-android
keytool -genkeypair -v \
  -keystore keystore/release.keystore \
  -alias opm \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10950
```

سپس:

```bash
cp keystore.properties.example keystore.properties
# storeFile، storePassword، keyAlias و keyPassword را پر کنید
./gradlew assembleRelease
```

اگر `keystore.properties` وجود نداشته باشد، بیلد release بدون امضای انتشار ساخته می‌شود (برای توسعه).

> کلید قبلی که اشتباهاً در گیت منتشر شده بود **افشا شده و باید دور انداخته شود**. برای انتشار عمومی یا به‌روزرسانی فروشگاهی، کلید کاملاً جدید بسازید.
