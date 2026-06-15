package de.konera.bauzeitpro;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
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
        requestGpsPermission();

        // Notification Channels erstellen (Android 8+)
        createNotificationChannels();
    }

    /**
     * GPS-Permission direkt auf Android-Level anfragen.
     * Umgeht den Capacitor-Plugin-Lifecycle und zeigt den System-Dialog GARANTIERT.
     */
    private void requestGpsPermission() {
        try {
            boolean fineGranted = ContextCompat.checkSelfPermission(this,
                    Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            boolean coarseGranted = ContextCompat.checkSelfPermission(this,
                    Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;

            if (!fineGranted || !coarseGranted) {
                ActivityCompat.requestPermissions(this,
                        new String[]{
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                        },
                        GPS_PERMISSION_REQUEST_CODE);
            }
        } catch (Exception e) {
            // Non-blocking
        }
    }

    /**
     * Erstellt Notification Channels mit Sound und Vibration.
     * Ab Android 8 (API 26) werden Notifications über Channels gesteuert.
     * Ohne Channel → kein Sound, keine Vibration, keine Heads-Up Anzeige.
     */
    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                NotificationManager manager = getSystemService(NotificationManager.class);
                if (manager == null) return;

                // Kanal 1: Pausen-Alarme (LAUT — Sound + Vibration + Heads-Up)
                NotificationChannel pauseChannel = new NotificationChannel(
                        "pause_alerts",
                        "Pausen-Alarme",
                        NotificationManager.IMPORTANCE_HIGH
                );
                pauseChannel.setDescription("Alarme wenn die Pausenzeit abläuft");
                pauseChannel.enableVibration(true);
                pauseChannel.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500});
                pauseChannel.enableLights(true);
                pauseChannel.setLightColor(0xFFFF6B00); // Orange
                manager.createNotificationChannel(pauseChannel);

                // Kanal 2: Arbeitszeit-Erinnerungen (MITTEL-HOCH)
                NotificationChannel workChannel = new NotificationChannel(
                        "work_reminders",
                        "Arbeitszeit-Erinnerungen",
                        NotificationManager.IMPORTANCE_HIGH
                );
                workChannel.setDescription("Erinnerungen wenn du noch eingestempelt bist");
                workChannel.enableVibration(true);
                workChannel.setVibrationPattern(new long[]{0, 300, 200, 300});
                manager.createNotificationChannel(workChannel);

                // Kanal 3: Standard (für sonstige Notifications)
                NotificationChannel defaultChannel = new NotificationChannel(
                        "default",
                        "Allgemein",
                        NotificationManager.IMPORTANCE_DEFAULT
                );
                defaultChannel.setDescription("Allgemeine App-Benachrichtigungen");
                manager.createNotificationChannel(defaultChannel);

            } catch (Exception e) {
                // Non-blocking: Channel-Erstellung darf App nicht crashen
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == GPS_PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
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
