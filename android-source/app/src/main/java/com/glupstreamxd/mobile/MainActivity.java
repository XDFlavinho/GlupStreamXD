package com.glupstreamxd.mobile;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.widget.FrameLayout;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Collections;
import org.json.JSONObject;

/** Contêiner Android: o protocolo WebRTC permanece em JavaScript/PeerJS. */
public class MainActivity extends Activity {
    private static final String ORIGIN = "https://app.glupstreamxd.local";
    private static final String HOME = ORIGIN + "/index.html";
    private WebView web;
    private FrameLayout root;
    private View fullscreen;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private String pendingInvite;
    private boolean ready;
    private ValueCallback<Uri[]> imagePicker;
    private static final String PIX = "00020126360014br.gov.bcb.pix0114+55169940941255204000053039865802BR5910F3D_STUDIO6009Sao Paulo610901227-20062240520daqr11985267866003686304367B";

    @Override @SuppressLint("SetJavaScriptEnabled")
    public void onCreate(Bundle state) {
        super.onCreate(state);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(18,18,18));
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        // Insets preservam botões/teclado, inclusive com edge-to-edge no Android 15+.
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets padding = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(padding.left, padding.top, padding.right, padding.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return Build.VERSION.SDK_INT >= 30 ? WindowInsets.CONSUMED : insets.consumeSystemWindowInsets();
        });
        web.setBackgroundColor(Color.rgb(18,18,18));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        // Apenas imagens escolhidas no seletor do sistema; navegação externa segue bloqueada.
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportMultipleWindows(false);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        web.addJavascriptInterface(new NativeBridge(), "GlupAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return !HOME.equals(request.getUrl().toString()); }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!"app.glupstreamxd.local".equals(uri.getHost())) return null;
                // Origem HTTPS virtual: arquivos vêm exclusivamente dos assets do APK.
                String file = uri.getPath();
                if (!"https".equals(uri.getScheme()) || file == null || file.contains("..") || !file.matches("/[A-Za-z0-9_./-]+")) return missing();
                String mime = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "application/javascript" : file.endsWith(".css") ? "text/css" : "text/plain";
                try { return new WebResourceResponse(mime, "UTF-8", 200, "OK", Collections.singletonMap("Cache-Control", "no-store"), getAssets().open("web" + file)); }
                catch (IOException exception) { return missing(); }
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (HOME.equals(url)) { ready = true; deliverInvite(); }
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (imagePicker != null) imagePicker.onReceiveValue(null);
                imagePicker = callback;
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/*");
                pick.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/png", "image/jpeg", "image/webp"});
                try { startActivityForResult(Intent.createChooser(pick, "Escolher imagem"), 44); }
                catch (android.content.ActivityNotFoundException exception) { imagePicker.onReceiveValue(null); imagePicker = null; }
                return true;
            }
            // Receber áudio/vídeo não exige câmera ou microfone.
            @Override public void onPermissionRequest(PermissionRequest request) { request.deny(); }
            @Override public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreen != null) { callback.onCustomViewHidden(); return; }
                fullscreen = view; fullscreenCallback = callback; web.setVisibility(View.GONE);
                root.addView(view, new FrameLayout.LayoutParams(-1, -1));
                if (Build.VERSION.SDK_INT >= 30) {
                    getWindow().getInsetsController().hide(WindowInsets.Type.systemBars());
                    getWindow().getInsetsController().setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                } else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
            }
            @Override public void onHideCustomView() { exitFullscreen(); }
        });
        readInvite(getIntent());
        web.loadUrl(HOME);
    }
    private WebResourceResponse missing() { return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), new ByteArrayInputStream(new byte[0])); }
    private void exitFullscreen() {
        if (fullscreen == null) return;
        root.removeView(fullscreen); fullscreen = null; web.setVisibility(View.VISIBLE);
        if (Build.VERSION.SDK_INT >= 30) getWindow().getInsetsController().show(WindowInsets.Type.systemBars());
        else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        WebChromeClient.CustomViewCallback callback = fullscreenCallback; fullscreenCallback = null;
        if (callback != null) callback.onCustomViewHidden();
    }
    private void readInvite(Intent intent) {
        String link = intent == null || intent.getData() == null ? "" : intent.getData().toString();
        if (link.matches("(?i)^glupstreamxd://glup-[a-z0-9]{6,32}/?$")) pendingInvite = link.toLowerCase(java.util.Locale.ROOT);
    }
    private void deliverInvite() {
        if (!ready || pendingInvite == null) return;
        web.evaluateJavascript("window.receiveInvite(" + JSONObject.quote(pendingInvite) + ")", null); pendingInvite = null;
    }
    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); readInvite(intent); deliverInvite(); }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == 44 && imagePicker != null) {
            imagePicker.onReceiveValue(result == RESULT_OK && data != null && data.getData() != null ? new Uri[]{data.getData()} : null);
            imagePicker = null;
        }
    }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onPause() { if (web != null) web.onPause(); super.onPause(); }
    @Override public void onBackPressed() {
        if (fullscreen != null) { exitFullscreen(); return; }
        web.evaluateJavascript("window.hasRoom ? window.hasRoom() : false", value -> {
            if (!"true".equals(value)) { finish(); return; }
            new AlertDialog.Builder(this).setTitle("Sair da sala?").setMessage("A conexão será encerrada e o histórico apagado.")
                .setNegativeButton("Continuar", null).setPositiveButton("Sair", (dialog, which) -> web.evaluateJavascript("window.disconnectRoom()", result -> finish())).show();
        });
    }
    @Override protected void onDestroy() {
        if (imagePicker != null) { imagePicker.onReceiveValue(null); imagePicker = null; }
        if (web != null) { web.removeJavascriptInterface("GlupAndroid"); root.removeAllViews(); web.destroy(); web = null; }
        super.onDestroy();
    }
    /** A página é local, não pode navegar e não aceita frames ou scripts externos. */
    private final class NativeBridge {
        @JavascriptInterface public void copy(String id) {
            if (id == null || !(id.matches("^(glupstreamxd://)?glup-[a-z0-9]{6,32}$") || PIX.equals(id))) return;
            runOnUiThread(() -> ((ClipboardManager)getSystemService(Context.CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("Sala GlupStreamXD", id)));
        }
        @JavascriptInterface public void openLivePix() {
            runOnUiThread(() -> { try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://livepix.gg/xdflaviooo"))); } catch (android.content.ActivityNotFoundException exception) { new AlertDialog.Builder(MainActivity.this).setMessage("Instale um navegador para abrir o LivePix.").setPositiveButton("OK", null).show(); } });
        }
        @JavascriptInterface public void keepAwake(boolean active) {
            runOnUiThread(() -> { if (active) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); });
        }
    }
}
