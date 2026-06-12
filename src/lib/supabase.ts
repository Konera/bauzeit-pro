import { createClient } from '@supabase/supabase-js'

// Umgebungsvariablen aus .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '❌ Supabase-Konfiguration fehlt!\n' +
    'Bitte .env Datei erstellen:\n' +
    'VITE_SUPABASE_URL=https://xxxxx.supabase.co\n' +
    'VITE_SUPABASE_ANON_KEY=eyJ...'
  )
}

// Supabase-Client ohne generische DB-Typen (vermeidet TypeScript-Konflikte)
// Typen werden manuell über die database.ts Typen durchgesetzt
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  }
)

// Hilfsfunktion: Aktuellen User holen
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

// Hilfsfunktion: Profil des aktuellen Users laden
export async function getCurrentProfile() {
  const user = await getCurrentUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (error) throw error
  return data
}

export const auth = supabase.auth
