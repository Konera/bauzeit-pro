package de.konera.bauzeitpro;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // WebView-Cache leeren bei jedem Start
        // Damit wird immer der aktuelle Code aus den Assets geladen
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.clearCache(true);
                webView.getSettings().setCacheMode(android.webkit.WebSettings.LOAD_NO_CACHE);
            }
        } catch (Exception e) {
            // Non-blocking: Cache-Clearing darf App nicht crashen
        }
    }
}
