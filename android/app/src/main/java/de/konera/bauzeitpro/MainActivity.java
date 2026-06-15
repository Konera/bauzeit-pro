package de.konera.bauzeitpro;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final int GPS_PERMISSION_REQUEST_CODE = 1001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // WebView-Cache leeren bei jedem Start
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.clearCache(true);
                webView.getSettings().setCacheMode(android.webkit.WebSettings.LOAD_NO_CACHE);
            }
        } catch (Exception e) {
            // Non-blocking
        }

        // GPS-Permission direkt auf Android-Level anfragen
        // Umgeht den Capacitor-Plugin-Lifecycle und zeigt den System-Dialog GARANTIERT
        requestGpsPermission();
    }

    private void requestGpsPermission() {
        try {
            boolean fineGranted = ContextCompat.checkSelfPermission(this,
                    Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            boolean coarseGranted = ContextCompat.checkSelfPermission(this,
                    Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;

            if (!fineGranted || !coarseGranted) {
                // Android System-Dialog anzeigen
                ActivityCompat.requestPermissions(this,
                        new String[]{
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                        },
                        GPS_PERMISSION_REQUEST_CODE);
            }
        } catch (Exception e) {
            // Permission-Request darf App nicht crashen
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == GPS_PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                // GPS-Permission erteilt — WebView neu laden damit GPS funktioniert
                try {
                    WebView webView = getBridge().getWebView();
                    if (webView != null) {
                        webView.reload();
                    }
                } catch (Exception e) {
                    // Non-blocking
                }
            }
        }
    }
}
