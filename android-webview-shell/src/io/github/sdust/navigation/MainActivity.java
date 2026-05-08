package io.github.sdust.navigation;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.view.Gravity;
import android.view.ViewGroup;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://2830500285.github.io/sdust-qingdao-campus-navigation/";
    private static final int LOCATION_PERMISSION_REQUEST = 1001;
    private static final int MAX_RETRY_COUNT = 5;
    private static final long BASE_RETRY_DELAY_MS = 1200L;

    private WebView webView;
    private Handler retryHandler;
    private TextToSpeech textToSpeech;
    private boolean ttsReady = false;
    private String pendingSpeech = "";
    private String ttsStatus = "initializing";
    private int retryCount = 0;
    private boolean showingErrorPage = false;
    private final Runnable retryRunnable = new Runnable() {
        @Override
        public void run() {
            if (webView == null) {
                return;
            }
            showingErrorPage = false;
            webView.loadUrl(APP_URL);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        retryHandler = new Handler(Looper.getMainLooper());
        requestLocationPermissionIfNeeded();
        setupNativeTts();
        setupWebView();
        if (savedInstanceState == null) {
            webView.loadUrl(APP_URL);
        } else {
            retryCount = savedInstanceState.getInt("retryCount", 0);
            showingErrorPage = savedInstanceState.getBoolean("showingErrorPage", false);
            webView.restoreState(savedInstanceState);
        }
    }

    private void setupWebView() {
        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.addJavascriptInterface(new NativeTtsBridge(), "SDUSTNativeTTS");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                if (url != null && url.startsWith("https://")) {
                    showingErrorPage = false;
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (url != null && url.startsWith("https://")) {
                    retryCount = 0;
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request != null && request.isForMainFrame()) {
                    handleMainFrameLoadError();
                }
            }

            @SuppressWarnings("deprecation")
            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                super.onReceivedError(view, errorCode, description, failingUrl);
                handleMainFrameLoadError();
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }
        });

        FrameLayout root = new FrameLayout(this);
        root.setForegroundGravity(Gravity.CENTER);
        root.addView(
            webView,
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );
        setContentView(root);
    }

    private void setupNativeTts() {
        textToSpeech = new TextToSpeech(this, new TextToSpeech.OnInitListener() {
            @Override
            public void onInit(int status) {
                if (status != TextToSpeech.SUCCESS || textToSpeech == null) {
                    ttsReady = false;
                    ttsStatus = "error";
                    return;
                }

                int languageResult = textToSpeech.setLanguage(Locale.CHINA);
                if (
                    languageResult == TextToSpeech.LANG_MISSING_DATA ||
                    languageResult == TextToSpeech.LANG_NOT_SUPPORTED
                ) {
                    textToSpeech.setLanguage(Locale.getDefault());
                    ttsStatus = "fallback-language";
                } else {
                    ttsStatus = "ready";
                }

                ttsReady = true;
                if (pendingSpeech != null && !pendingSpeech.isEmpty()) {
                    String nextSpeech = pendingSpeech;
                    pendingSpeech = "";
                    speakText(nextSpeech);
                }
            }
        });
    }

    private void speakText(String text) {
        if (text == null) {
            return;
        }

        String cleanText = text.trim();
        if (cleanText.isEmpty()) {
            return;
        }

        if (!ttsReady || textToSpeech == null) {
            pendingSpeech = cleanText;
            return;
        }

        textToSpeech.speak(
            cleanText,
            TextToSpeech.QUEUE_FLUSH,
            null,
            "sdust-navigation-" + System.currentTimeMillis()
        );
    }

    private void stopTts() {
        if (textToSpeech != null) {
            textToSpeech.stop();
        }
        pendingSpeech = "";
    }

    public class NativeTtsBridge {
        @JavascriptInterface
        public void speak(final String text) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    speakText(text);
                }
            });
        }

        @JavascriptInterface
        public void stop() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    stopTts();
                }
            });
        }

        @JavascriptInterface
        public boolean isAvailable() {
            return textToSpeech != null;
        }

        @JavascriptInterface
        public String getStatus() {
            return ttsStatus;
        }
    }

    private void handleMainFrameLoadError() {
        if (retryHandler == null || webView == null) {
            return;
        }
        retryHandler.removeCallbacks(retryRunnable);
        if (retryCount < MAX_RETRY_COUNT) {
            retryCount++;
            showingErrorPage = true;
            showRetryingPage(retryCount);
            retryHandler.postDelayed(retryRunnable, BASE_RETRY_DELAY_MS * retryCount);
            return;
        }
        showFinalErrorPage();
    }

    private void showRetryingPage(int attempt) {
        String html = "<!doctype html><html><head><meta charset='utf-8'>"
            + "<meta name='viewport' content='width=device-width,initial-scale=1'>"
            + "<style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;"
            + "font-family:sans-serif;background:#f7fbff;color:#16345f}.box{text-align:center;padding:28px}"
            + ".title{font-size:20px;font-weight:700}.sub{margin-top:10px;font-size:14px;color:#60779a}</style>"
            + "</head><body><div class='box'><div class='title'>正在重新连接</div>"
            + "<div class='sub'>网络暂时不可用，正在第 " + attempt + " 次自动刷新。</div>"
            + "</div></body></html>";
        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
    }

    private void showFinalErrorPage() {
        showingErrorPage = true;
        String html = "<!doctype html><html><head><meta charset='utf-8'>"
            + "<meta name='viewport' content='width=device-width,initial-scale=1'>"
            + "<style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;"
            + "font-family:sans-serif;background:#f7fbff;color:#16345f}.box{text-align:center;padding:28px}"
            + ".title{font-size:20px;font-weight:700}.sub{margin-top:10px;font-size:14px;color:#60779a}"
            + "button{margin-top:20px;border:0;border-radius:999px;background:#2f80ed;color:white;"
            + "font-size:15px;font-weight:700;padding:12px 22px}</style>"
            + "</head><body><div class='box'><div class='title'>页面暂时打不开</div>"
            + "<div class='sub'>请检查网络后重新加载。</div>"
            + "<button onclick=\"location.href='" + APP_URL + "'\">重新加载</button>"
            + "</div></body></html>";
        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
    }

    private void requestLocationPermissionIfNeeded() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            if (
                checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED ||
                checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED
            ) {
                requestPermissions(
                    new String[] {
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    },
                    LOCATION_PERMISSION_REQUEST
                );
            }
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        outState.putInt("retryCount", retryCount);
        outState.putBoolean("showingErrorPage", showingErrorPage);
        webView.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (retryHandler != null) {
            retryHandler.removeCallbacksAndMessages(null);
            retryHandler = null;
        }
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
            textToSpeech = null;
        }
        super.onDestroy();
    }
}
