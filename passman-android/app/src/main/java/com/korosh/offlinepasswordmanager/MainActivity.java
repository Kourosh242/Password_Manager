package com.korosh.offlinepasswordmanager;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.view.View;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.window.OnBackInvokedDispatcher;

import java.io.ByteArrayInputStream;

/**
 * Offline Password Manager — Android shell (v1.0.1).
 * Loads the fully-offline HTML app from assets inside a hardened, mobile-tuned WebView.
 * Supported: Android 10 (API 29) up to Android 16 (API 36), all CPU architectures
 * (the APK contains no native binaries).
 */
public class MainActivity extends Activity {

    private static final String ASSET_URL = "file:///android_asset/Index.html";
    private static final int REQUEST_OPEN_BACKUP = 1001;

    private FrameLayout rootContainer;
    private WebView webView;
    private ValueCallback<Uri[]> pendingFileChooserCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        rootContainer = findViewById(R.id.root);

        createWebView();

        // Android 13+ predictive back (enforced for targetSdk 36 on Android 16)
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        }
    }

    private void createWebView() {
        webView = new WebView(this);
        webView.setBackgroundColor(0xFFF5F6FA);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSafeBrowsingEnabled(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    openExternal(url);
                    return true;
                }
                return false;
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                // hard offline policy: block every http/https request inside the app
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    return new WebResourceResponse("text/plain", "utf-8",
                            new ByteArrayInputStream(new byte[0]));
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // auto-recover on low-end devices where the renderer may be killed.
                // FIX: act on the view the system actually reported (and only rebuild
                // when it is the live one), instead of assuming it is the current field.
                rootContainer.removeView(view);
                view.destroy();
                if (view == webView) {
                    webView = null;
                    createWebView();
                }
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture,
                                          Message resultMsg) {
                // entry website links (target=_blank) open in the system browser, never in-app
                WebView.HitTestResult hit = view.getHitTestResult();
                String url = (hit != null) ? hit.getExtra() : null;
                if (url != null && (url.startsWith("http://") || url.startsWith("https://"))) {
                    openExternal(url);
                }
                return false;
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
                                             FileChooserParams fileChooserParams) {
                // FIX: a previous callback that was never answered permanently blocks
                // every future file-chooser request (the restore screen's file picker
                // would silently stop opening). Always release the old one first.
                if (pendingFileChooserCallback != null) {
                    pendingFileChooserCallback.onReceiveValue(null);
                    pendingFileChooserCallback = null;
                }

                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES,
                        new String[]{"application/json", "application/octet-stream", "text/plain"});
                try {
                    pendingFileChooserCallback = filePathCallback;
                    startActivityForResult(intent, REQUEST_OPEN_BACKUP);
                    return true;
                } catch (Exception e) {
                    // FIX: the callback must be answered, otherwise the input stays stuck.
                    pendingFileChooserCallback = null;
                    filePathCallback.onReceiveValue(null);
                    return false;
                }
            }
        });

        webView.addJavascriptInterface(new BackupBridge(this), "AndroidBridge");

        rootContainer.addView(webView,
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT));

        webView.loadUrl(ASSET_URL);
    }

    private void handleBack() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            finish();
        }
    }

    /**
     * FIX: previously this delegated to super.onBackPressed() whenever SDK_INT >= 33,
     * assuming the OnBackInvokedCallback registered above would handle it. But the
     * platform only dispatches to that callback when the app opts in via
     * android:enableOnBackInvokedCallback (now added to the manifest). On Android
     * 13, 14 and 15 the flag defaulted to false, so the callback never fired AND
     * onBackPressed() finished the activity — the back button closed the whole app
     * instead of navigating back inside the WebView.
     *
     * handleBack() is now always correct: when the dispatcher IS enabled the system
     * never calls this method, and when it is not, this is the only path.
     */
    @Override
    public void onBackPressed() {
        handleBack();
    }

    private void openExternal(String url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (Exception ignored) {
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQUEST_OPEN_BACKUP && pendingFileChooserCallback != null) {
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                results = new Uri[]{data.getData()};
            }
            pendingFileChooserCallback.onReceiveValue(results);
            pendingFileChooserCallback = null;
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) webView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onDestroy() {
        // FIX: never leave a file-chooser callback unanswered when the activity dies.
        if (pendingFileChooserCallback != null) {
            pendingFileChooserCallback.onReceiveValue(null);
            pendingFileChooserCallback = null;
        }
        if (webView != null) {
            rootContainer.removeView(webView);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
