package in.opiius.demo;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/* The whole app is a local web page in assets/, shown full screen. No internet needed. */
public class MainActivity extends Activity {
  private WebView web;

  @Override protected void onCreate(Bundle state) {
    super.onCreate(state);
    web = new WebView(this);
    web.setBackgroundColor(0xFF000000);
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setSupportZoom(false);
    web.setWebViewClient(new WebViewClient());
    web.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
    setContentView(web);
    if (state != null) web.restoreState(state); else web.loadUrl("file:///android_asset/index.html");
  }

  @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

  /* Back goes back inside the app first; the page decides what "back" means. */
  @Override public void onBackPressed() {
    web.evaluateJavascript("window.appBack ? window.appBack() : false", new ValueCallback<String>() {
      @Override public void onReceiveValue(String v) { if (!"true".equals(v)) finish(); }
    });
  }
}
