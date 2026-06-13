// main.tsx: Einstiegspunkt der Anwendung
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

// Service Worker – NUR im Browser/PWA registrieren, NICHT in der nativen App
// Im Capacitor WebView kann der SW Supabase API-Requests blockieren
import { Capacitor } from '@capacitor/core'

if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    console.log('✅ Service Worker wird von Vite PWA Plugin verwaltet')
  })
} else if (Capacitor.isNativePlatform()) {
  // Native App: Bestehenden SW deregistrieren falls vorhanden
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(reg => {
        reg.unregister()
        console.log('🔄 Service Worker deregistriert (native App)')
      })
    })
  }
  console.log('📱 Native App – Service Worker übersprungen')
}

// React App rendern
const root = document.getElementById('root')
if (!root) throw new Error('Root-Element nicht gefunden!')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
