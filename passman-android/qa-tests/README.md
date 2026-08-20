# تست‌های خودکار (headless)

اپ را در یک شبیه‌سازِ WebView اندروید (jsdom + Web Crypto + IndexedDB) بوت می‌کند
و ۱۶ سناریوی کاربری واقعی را اجرا می‌کند.

## اجرا
```bash
npm install jsdom fake-indexeddb
node test.js     # بوت، pagehide، فیلترها، تاریخچه
node test2.js    # رمزساز، افزودن ورودی، پشتیبان‌گیری
node test3.js    # تغییر رمز اصلی، بازیابی، طول رمز
```

برای تست HTML داخل یک APK ساخته‌شده:
```bash
unzip -o app.apk assets/Index.html -d /tmp/apkx
APP_HTML=/tmp/apkx/assets/Index.html node test.js
```
