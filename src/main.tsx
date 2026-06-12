// main.tsx: Einstiegspunkt der Anwendung
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

// Service Worker – wird automatisch von vite-plugin-pwa registriert
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    console.log('✅ Service Worker wird von Vite PWA Plugin verwaltet')
  })
}

// React App rendern
const root = document.getElementById('root')
if (!root) throw new Error('Root-Element nicht gefunden!')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
