// TypeScript-Typen für die BauZeit Pro Datenbank
// Entspricht den Supabase-Tabellen exakt

export type UserRole = 'admin' | 'manager' | 'employee'
export type TimeEntryStatus = 'open' | 'submitted' | 'approved' | 'corrected'
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
  created_at: string
  updated_at: string
  // Joins
  employee?: Profile
  site?: ConstructionSite
  breaks?: BreakEntry[]
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
