import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'de.konera.bauzeitpro',
  appName: 'BauZeit Pro',
  webDir: 'dist',

  // Server: HTTPS-Schema für Android WebView
  // Damit funktionieren Supabase API-Calls, CORS und Auth-Cookies korrekt
  server: {
    androidScheme: 'https',
  },

  plugins: {
    // GPS: Hohe Genauigkeit für Geofencing
    Geolocation: {
      // Android: Fine Location Permission
    },

    // Lokale Benachrichtigungen
    LocalNotifications: {
      // Kleines Icon für Android-Benachrichtigungen
      smallIcon: 'ic_stat_icon',
      // Icon-Farbe (BauZeit Orange)
      iconColor: '#F97316',
      // Notification-Sound
      sound: 'default',
    },

    // Push Notifications
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },

    // Haptics: Keine spezielle Konfiguration nötig
  },

  // Android-spezifische Konfiguration
  android: {
    // WebView-Einstellungen
    allowMixedContent: false,
    backgroundColor: '#0f172a',
  },

  // iOS-spezifische Konfiguration (vorbereitet)
  ios: {
    backgroundColor: '#0f172a',
    contentInset: 'automatic',
  },
}

export default config
