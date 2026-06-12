// OfflineStatusBanner: Zeigt Online/Offline-Status an
import React, { useState, useEffect } from 'react'
import { Wifi, WifiOff, RefreshCw, CheckCircle } from 'lucide-react'
import { clsx } from 'clsx'
import { offlineSyncService } from '../services/offlineSyncService'

export function OfflineStatusBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [justSynced, setJustSynced] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Auf Sync-Event hören
    const handleSynced = async () => {
      setJustSynced(true)
      const count = await offlineSyncService.getPendingCount()
      setPendingCount(count)
      setTimeout(() => setJustSynced(false), 3000)
    }
    window.addEventListener('bauzeit:synced', handleSynced)

    // BUG-011 Fix: Pending-Count beim Mount laden und ggf. sofort synchronisieren
    const initCheck = async () => {
      const count = await offlineSyncService.getPendingCount()
      setPendingCount(count)
      // Wenn online und noch Einträge ausstehend: direkt synchronisieren
      if (count > 0 && navigator.onLine) {
        await offlineSyncService.syncPendingItems()
        const newCount = await offlineSyncService.getPendingCount()
        setPendingCount(newCount)
      }
    }
    initCheck()

    const interval = setInterval(async () => {
      const count = await offlineSyncService.getPendingCount()
      setPendingCount(count)
    }, 30000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('bauzeit:synced', handleSynced)
      clearInterval(interval)
    }
  }, [])

  const handleSync = async () => {
    if (!isOnline) return
    setSyncing(true)
    await offlineSyncService.syncPendingItems()
    const count = await offlineSyncService.getPendingCount()
    setPendingCount(count)
    setSyncing(false)
  }

  // Nichts anzeigen wenn online und nichts pending
  if (isOnline && pendingCount === 0 && !justSynced) return null

  return (
    <div
      className={clsx(
        'fixed top-0 left-0 right-0 z-50 flex items-center justify-between',
        'px-4 py-2 text-sm font-medium transition-all duration-300',
        isOnline
          ? justSynced
            ? 'bg-working text-white'
            : 'bg-admin text-white'
          : 'bg-stopped text-white'
      )}
    >
      <div className="flex items-center gap-2">
        {isOnline ? (
          justSynced ? (
            <CheckCircle size={16} />
          ) : (
            <Wifi size={16} />
          )
        ) : (
          <WifiOff size={16} />
        )}
        <span>
          {!isOnline
            ? 'Offline – Daten werden lokal gespeichert'
            : justSynced
            ? 'Daten erfolgreich synchronisiert!'
            : `${pendingCount} Einträge warten auf Sync`}
        </span>
      </div>

      {isOnline && pendingCount > 0 && (
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1 bg-white/20 hover:bg-white/30 rounded-lg px-2 py-1 transition-colors"
        >
          <RefreshCw size={14} className={clsx(syncing && 'animate-spin')} />
          <span>Sync</span>
        </button>
      )}
    </div>
  )
}

export default OfflineStatusBanner
