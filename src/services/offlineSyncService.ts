// Offline-Sync Service: IndexedDB + Supabase Sync
// Speichert Daten offline und synchronisiert sobald Netzwerk verfügbar
import { get, set, del, keys, createStore } from 'idb-keyval'
import { supabase } from '../lib/supabase'
import type { TimeEntry, OfflineQueueItem } from '../types/database'

// IndexedDB Stores mit eindeutigen Datenbank-Namen (BUG-004 Fix)
const offlineStore = createStore('bauzeit-entries-db', 'entries')
const queueStore  = createStore('bauzeit-queue-db',   'sync-queue')

class OfflineSyncService {
  private isOnline: boolean = navigator.onLine
  private syncInProgress: boolean = false

  constructor() {
    // Online/Offline Events abonnieren
    window.addEventListener('online', () => {
      this.isOnline = true
      console.log('🌐 Online - Starte Synchronisierung...')
      this.syncPendingItems()
    })
    window.addEventListener('offline', () => {
      this.isOnline = false
      console.log('📴 Offline - Daten werden lokal gespeichert')
    })
  }

  // =========================================
  // Lokale Datenspeicherung
  // =========================================

  /**
   * Speichert einen Zeiteintrag lokal (IndexedDB)
   */
  async saveLocalEntry(entry: TimeEntry): Promise<TimeEntry> {
    await set(entry.id, entry, offlineStore)
    return entry
  }

  /**
   * Lädt offenen Zeiteintrag aus lokalem Speicher
   */
  async getLocalOpenEntry(employeeId: string): Promise<TimeEntry | null> {
    const allKeys = await keys(offlineStore)
    for (const key of allKeys) {
      const entry = await get(key as string, offlineStore) as TimeEntry
      if (
        entry?.employee_id === employeeId &&
        entry?.end_time === null
      ) {
        return entry
      }
    }
    return null
  }

  /**
   * Aktualisiert einen lokalen Zeiteintrag
   */
  async updateLocalEntry(entryId: string, updates: Partial<TimeEntry>): Promise<void> {
    const existing = await get(entryId, offlineStore) as TimeEntry
    if (existing) {
      await set(entryId, { ...existing, ...updates, updated_at: new Date().toISOString() }, offlineStore)
    }
  }

  /**
   * Löscht einen lokalen Zeiteintrag
   */
  async deleteLocalEntry(entryId: string): Promise<void> {
    await del(entryId, offlineStore)
  }

  // =========================================
  // Sync-Queue
  // =========================================

  /**
   * Fügt eine Operation zur Sync-Queue hinzu
   */
  async addToQueue(item: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    const queueItem: OfflineQueueItem = {
      ...item,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retryCount: 0,
    }
    await set(queueItem.id, queueItem, queueStore)
    console.log('📦 Zur Sync-Queue hinzugefügt:', item.action, item.table)
  }

  /**
   * Synchronisiert alle ausstehenden Operationen
   */
  async syncPendingItems(): Promise<{ success: number; failed: number }> {
    if (this.syncInProgress || !this.isOnline) {
      return { success: 0, failed: 0 }
    }

    this.syncInProgress = true
    let success = 0
    let failed = 0

    try {
      const queueKeys = await keys(queueStore)
      console.log(`🔄 Synchronisiere ${queueKeys.length} ausstehende Operationen...`)

      for (const key of queueKeys) {
        const item = await get(key as string, queueStore) as OfflineQueueItem
        if (!item) continue

        try {
          await this.processQueueItem(item)
          await del(key as string, queueStore)
          success++
        } catch (error) {
          console.error('Sync-Fehler für Item:', item.id, error)
          // Retry-Counter erhöhen
          if (item.retryCount < 3) {
            await set(key as string, { ...item, retryCount: item.retryCount + 1 }, queueStore)
          } else {
            // Nach 3 Versuchen: Item löschen und loggen
            console.error('Item nach 3 Versuchen fehlgeschlagen:', item)
            await del(key as string, queueStore)
          }
          failed++
        }
      }

      if (success > 0) {
        console.log(`✅ ${success} Operationen erfolgreich synchronisiert`)
        // Event feuern damit UI sich aktualisiert
        window.dispatchEvent(new CustomEvent('bauzeit:synced', { detail: { success, failed } }))
      }
    } finally {
      this.syncInProgress = false
    }

    return { success, failed }
  }

  /**
   * Verarbeitet ein einzelnes Queue-Item
   */
  private async processQueueItem(item: OfflineQueueItem): Promise<void> {
    switch (item.action) {
      case 'create': {
        const { error } = await supabase.from(item.table as 'time_entries' | 'break_entries').insert(item.data as never)
        if (error) throw error
        break
      }
      case 'update': {
        const { id, ...updates } = item.data as { id: string } & Record<string, unknown>
        const { error } = await supabase.from(item.table as 'time_entries' | 'break_entries').update(updates as never).eq('id', id)
        if (error) throw error
        break
      }
      case 'delete': {
        const { id } = item.data as { id: string }
        const { error } = await supabase.from(item.table as 'time_entries' | 'break_entries').delete().eq('id', id)
        if (error) throw error
        break
      }
    }
  }

  // =========================================
  // Hilfsmethoden
  // =========================================

  isCurrentlyOnline(): boolean {
    return this.isOnline
  }

  async getPendingCount(): Promise<number> {
    const queueKeys = await keys(queueStore)
    return queueKeys.length
  }

  async clearAllLocal(): Promise<void> {
    const allKeys = await keys(offlineStore)
    for (const key of allKeys) {
      await del(key as string, offlineStore)
    }
    const queueKeys = await keys(queueStore)
    for (const key of queueKeys) {
      await del(key as string, queueStore)
    }
  }
}

// Singleton-Instanz
export const offlineSyncService = new OfflineSyncService()
