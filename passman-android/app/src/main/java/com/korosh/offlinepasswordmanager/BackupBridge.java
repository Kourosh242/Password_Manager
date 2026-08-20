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

    private final Activity activity;

    public BackupBridge(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public String saveTextFile(String filename, String text, String mime) {
        try {
            if (filename == null || filename.trim().isEmpty()) filename = "backup.json";
            if (mime == null || mime.trim().isEmpty()) mime = "application/json";
            if (text == null) text = "";

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
                os.write(text.getBytes(StandardCharsets.UTF_8));
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

    private String jsonResult(boolean ok, String message) {
        return "{\"ok\":" + ok + ",\"error\":\"" + escape(String.valueOf(message)) + "\"}";
    }

    /**
     * FIX: the old version only handled backslashes and turned double quotes into
     * single quotes. A filename or an exception message containing a newline, tab or
     * other control character produced malformed JSON, so JSON.parse() on the web side
     * threw and a successful save was reported to the user as a failure.
     * This is now a correct JSON string escaper.
     */
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
