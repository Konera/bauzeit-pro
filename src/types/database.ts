// TypeScript-Typen für die BauZeit Pro Datenbank
// Entspricht den Supabase-Tabellen exakt

export type UserRole = 'admin' | 'manager' | 'employee'
export type TimeEntryStatus = 'open' | 'submitted' | 'approved' | 'corrected' | 'rejected'
export type WorkingStatus = 'not_started' | 'working' | 'paused' | 'finished'

// =========================================
// Datenbank-Tabellen
// =========================================

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  phone: string | null
  pin: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface ConstructionSite {
  id: string
  name: string
  address: string | null
  manager_id: string | null
  gps_lat: number | null
  gps_lng: number | null
  gps_radius_m: number
  active: boolean
  created_at: string
}

export interface SiteAssignment {
  id: string
  site_id: string
  employee_id: string
  created_at: string
  // Joins
  site?: ConstructionSite
  employee?: Profile
}

export interface TimeEntry {
  id: string
  employee_id: string
  site_id: string
  start_time: string
  end_time: string | null
  pause_minutes: number
  total_minutes: number
  status: TimeEntryStatus
  start_lat: number | null
  start_lng: number | null
  end_lat: number | null
  end_lng: number | null
  source: string
  admin_comment: string | null
  // Phase 2: Genehmigungs-Felder
  approved_by: string | null
  approved_at: string | null
  rejected_reason: string | null
  // Phase 2: GPS-Felder
  gps_warning: boolean
  start_distance_m: number | null
  end_distance_m: number | null
  created_at: string
  updated_at: string
  // Joins
  employee?: Profile
  site?: ConstructionSite
  breaks?: BreakEntry[]
  approved_by_profile?: Profile
}

export interface BreakEntry {
  id: string
  time_entry_id: string
  start_time: string
  end_time: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  entity_type: string
  entity_id: string
  action: string
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  changed_by: string
  created_at: string
  // Joins
  changed_by_profile?: Profile
}

export interface Notification {
  id: string
  employee_id: string
  type: string
  title: string
  message: string
  read: boolean
  created_at: string
}

// =========================================
// App-spezifische Typen
// =========================================

export interface AppUser {
  id: string
  email: string
  profile: Profile
}

export interface ActiveTimeEntry {
  entry: TimeEntry
  currentBreak: BreakEntry | null
  status: WorkingStatus
  workedMinutes: number
  pausedMinutes: number
}

export interface DailyStats {
  date: string
  entries: TimeEntry[]
  totalWorkedMinutes: number
  totalPauseMinutes: number
  entryCount: number
}

export interface WeeklyStats {
  weekStart: string
  weekEnd: string
  days: DailyStats[]
  totalWorkedMinutes: number
  totalPauseMinutes: number
}

// Offline-Queue Eintrag
export interface OfflineQueueItem {
  id: string
  action: 'create' | 'update' | 'delete'
  table: string
  data: Record<string, unknown>
  timestamp: number
  retryCount: number
}

// Einstellungen
export interface AppSettings {
  maxWorkHours: number          // Standard: 8
  reminderAfterMinutes: number  // Standard: 15 nach Arbeitsende
  pushNotifications: boolean
  vibration: boolean
  language: 'de' | 'ru' | 'en'
  theme: 'dark' | 'system'
  // Phase 3: Smart Automation
  maxPauseMinutes: number          // Max. Pausendauer (Standard: 45)
  pauseWarningBeforeMinutes: number  // Vorwarnung vor Pause-Ende (Standard: 5)
  autoPauseEnd: boolean            // Auto-Ende bei Überschreitung
  workStartReminderEnabled: boolean  // Arbeitsbeginn-Erinnerung aktiv
  workStartTime: string            // Planmäßiger Arbeitsbeginn (z.B. "07:00")
  workDays: number[]               // Arbeitstage [1,2,3,4,5,6] = Mo-Sa
  // Phase 3B: Geofence & Bewegungserkennung
  backgroundGpsEnabled: boolean      // Hintergrund-GPS Hauptschalter
  geofenceAutoClockIn: boolean       // Auto-Einstempeln bei Baustellen-Betreten
  geofenceAutoClockOut: boolean      // Auto-Ausstempeln bei Baustellen-Verlassen
  geofenceNotifyOnly: boolean        // Nur Notification statt Auto-Stempel
  motionDetectionEnabled: boolean    // Losfahrt-Erkennung
  autoStopEnabled: boolean            // Auto-Stop nach maxWorkHours
}

// GPS Position
export interface GeoPosition {
  lat: number
  lng: number
  accuracy: number
}

// Export-Optionen
export interface ExportOptions {
  format: 'pdf' | 'csv'
  dateFrom: string
  dateTo: string
  employeeIds?: string[]
  siteIds?: string[]
  statuses?: TimeEntryStatus[]
}

// Supabase Datenbank-Typen (für den Supabase-Client)
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      construction_sites: {
        Row: ConstructionSite
        Insert: Omit<ConstructionSite, 'id' | 'created_at'>
        Update: Partial<Omit<ConstructionSite, 'id' | 'created_at'>>
      }
      site_assignments: {
        Row: SiteAssignment
        Insert: Omit<SiteAssignment, 'id' | 'created_at'>
        Update: Partial<Omit<SiteAssignment, 'id' | 'created_at'>>
      }
      time_entries: {
        Row: TimeEntry
        Insert: Omit<TimeEntry, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<TimeEntry, 'id' | 'created_at'>>
      }
      break_entries: {
        Row: BreakEntry
        Insert: Omit<BreakEntry, 'id' | 'created_at'>
        Update: Partial<Omit<BreakEntry, 'id' | 'created_at'>>
      }
      audit_logs: {
        Row: AuditLog
        Insert: Omit<AuditLog, 'id' | 'created_at'>
        Update: never
      }
      notifications: {
        Row: Notification
        Insert: Omit<Notification, 'id' | 'created_at'>
        Update: Partial<Pick<Notification, 'read'>>
      }
    }
  }
}
