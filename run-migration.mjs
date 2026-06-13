// Migration Runner: Führt die Phase 2 SQL-Migration gegen Supabase aus
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const supabaseUrl = 'https://lhfotjxzdhxugqpgpeuc.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!serviceRoleKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY nicht gesetzt!')
  console.log('Aufruf: SUPABASE_SERVICE_ROLE_KEY=eyJ... node run-migration.mjs')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// SQL-Statements einzeln ausführen (supabase.rpc unterstützt kein Multi-Statement)
const statements = [
  `ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS gps_warning BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS start_distance_m NUMERIC(10, 2)`,
  `ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS end_distance_m NUMERIC(10, 2)`,
  `ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL`,
  `ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ`,
  `ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS rejected_reason TEXT`,
  `ALTER TABLE public.time_entries DROP CONSTRAINT IF EXISTS time_entries_status_check`,
  `ALTER TABLE public.time_entries ADD CONSTRAINT time_entries_status_check CHECK (status IN ('open', 'submitted', 'approved', 'corrected', 'rejected'))`,
]

console.log('🔄 BauZeit Pro – Phase 2 Migration')
console.log('=' .repeat(50))

for (const sql of statements) {
  const shortSql = sql.substring(0, 80) + (sql.length > 80 ? '...' : '')
  try {
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql })
    if (error) {
      // Fallback: Direkt über REST API
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ sql_query: sql }),
      })
      if (!res.ok) {
        console.log(`  ⚠️  ${shortSql}`)
        console.log(`     RPC nicht verfügbar – manuell im Supabase SQL Editor ausführen`)
      } else {
        console.log(`  ✅ ${shortSql}`)
      }
    } else {
      console.log(`  ✅ ${shortSql}`)
    }
  } catch (err) {
    console.log(`  ⚠️  ${shortSql}`)
    console.log(`     ${err.message}`)
  }
}

console.log('')
console.log('💡 Falls RPC nicht verfügbar: SQL manuell im Supabase Dashboard ausführen:')
console.log(`   ${supabaseUrl}/project/lhfotjxzdhxugqpgpeuc/sql`)
console.log('')

// Verifizierung: Prüfe ob die Spalten existieren
const { data, error } = await supabase
  .from('time_entries')
  .select('gps_warning, start_distance_m, end_distance_m, approved_by, approved_at, rejected_reason')
  .limit(0)

if (error) {
  console.log('❌ Verifizierung fehlgeschlagen:', error.message)
  console.log('')
  console.log('👉 Bitte führe diese SQL-Befehle im Supabase SQL Editor aus:')
  console.log('   https://supabase.com/dashboard/project/lhfotjxzdhxugqpgpeuc/sql/new')
  console.log('')
  console.log(readFileSync('./supabase/migrations/003_phase2_columns.sql', 'utf-8'))
} else {
  console.log('✅ Alle Phase 2 Spalten sind vorhanden!')
}
