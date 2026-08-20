package com.korosh.offlinepasswordmanager;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * JS bridge: lets the HTML app save its encrypted backup file into
 * Downloads/OfflinePasswordManager via the MediaStore (no permissions needed
 * on Android 10+, fully offline).
 */
public class BackupBridge {

    private static final int MAX_BYTES = 20 * 1024 * 1024;
    private static final int MAX_NAME = 120;

    private final Activity activity;

    public BackupBridge(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public String saveTextFile(String filename, String text, String mime) {
        try {
            filename = sanitizeFilename(filename);
            mime = sanitizeMime(mime);
            if (text == null) text = "";
            byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
            if (bytes.length > MAX_BYTES) {
                return jsonResult(false, "too-large");
            }

            ContentResolver resolver = activity.getContentResolver();

            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            values.put(MediaStore.MediaColumns.RELATIVE_PATH,
                    Environment.DIRECTORY_DOWNLOADS + "/OfflinePasswordManager");
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);

            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) return jsonResult(false, "insert-failed");

            OutputStream os = resolver.openOutputStream(uri);
            if (os == null) return jsonResult(false, "open-failed");

            try {
                os.write(bytes);
            } finally {
                os.close();
            }

            ContentValues done = new ContentValues();
            done.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(uri, done, null, null);

            return "{\"ok\":true,\"name\":\"" + escape(filename) + "\"}";
        } catch (Exception e) {
            return jsonResult(false, String.valueOf(e.getMessage()));
        }
    }

    private String sanitizeFilename(String filename) {
        if (filename == null) filename = "";
        String name = filename.trim().replace('\\', '/');
        int slash = name.lastIndexOf('/');
        if (slash >= 0) name = name.substring(slash + 1);
        name = name.replaceAll("[^A-Za-z0-9._\\-\\u0600-\\u06FF]", "_");
        if (name.isEmpty() || ".".equals(name) || "..".equals(name)) {
            name = "backup.json";
        }
        if (name.length() > MAX_NAME) name = name.substring(0, MAX_NAME);
        return name;
    }

    private String sanitizeMime(String mime) {
        if (mime == null) return "application/json";
        mime = mime.trim().toLowerCase();
        if ("application/json".equals(mime) || "text/plain".equals(mime)
                || "application/octet-stream".equals(mime)) {
            return mime;
        }
        return "application/json";
    }

    private String jsonResult(boolean ok, String message) {
        return "{\"ok\":" + ok + ",\"error\":\"" + escape(String.valueOf(message)) + "\"}";
    }

    private String escape(String value) {
        if (value == null) return "";

        StringBuilder out = new StringBuilder(value.length() + 16);
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"':  out.append("\\\""); break;
                case '\\': out.append("\\\\"); break;
                case '\n': out.append("\\n");  break;
                case '\r': out.append("\\r");  break;
                case '\t': out.append("\\t");  break;
                case '\b': out.append("\\b");  break;
                case '\f': out.append("\\f");  break;
                default:
                    if (c < 0x20) out.append(String.format("\\u%04x", (int) c));
                    else out.append(c);
            }
        }
        return out.toString();
    }
}
