#!/usr/bin/env node
/**
 * BauZeit Pro – Vollständiges Supabase Setup Script
 * Führt Migrationen aus und erstellt Test-User via Admin API
 * 
 * Verwendung:
 *   1. SERVICE_ROLE_KEY in .env.setup eintragen
 *   2. node setup-supabase.mjs ausführen
 */

const SUPABASE_URL = 'https://lhfotjxzdhxugqpgpeuc.supabase.co'

// SERVICE_ROLE_KEY aus Umgebungsvariable oder .env.setup
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error(`
❌ SUPABASE_SERVICE_ROLE_KEY fehlt!

So findest du ihn:
1. Gehe zu: https://supabase.com/dashboard/project/lhfotjxzdhxugqpgpeuc/settings/api
2. Kopiere den "service_role" Key (NICHT den anon Key!)
3. Führe aus:
   SUPABASE_SERVICE_ROLE_KEY=dein_key node setup-supabase.mjs
`)
  process.exit(1)
}

const headers = {
  'Content-Type': 'application/json',
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
}

// =========================================
// Hilfsfunktionen
// =========================================

async function supabaseQuery(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: sql }),
  })
  return res.json()
}

async function createUser(email, password, fullName, role) {
  console.log(`\n👤 Erstelle User: ${email} (${role})`)
  
  // User anlegen
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    }),
  })
  
  const data = await res.json()
  
  if (data.error || res.status >= 400) {
    if (data.message?.includes('already been registered') || data.msg?.includes('already')) {
      console.log(`  ⚠️  User existiert bereits: ${email}`)
      return null
    }
    console.error(`  ❌ Fehler: ${JSON.stringify(data)}`)
    return null
  }
  
  console.log(`  ✅ User erstellt: ${data.id}`)
  return data.id
}

async function setUserRole(userId, fullName, role) {
  if (!userId) return
  
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
    {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify({ full_name: fullName, role }),
    }
  )
  
  const data = await res.json()
  if (res.ok) {
    console.log(`  ✅ Rolle gesetzt: ${role}`)
  } else {
    // Fallback: INSERT
    const ins = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ id: userId, full_name: fullName, role }),
    })
    if (ins.ok) {
      console.log(`  ✅ Profil erstellt: ${role}`)
    } else {
      console.error(`  ❌ Profil-Fehler: ${await ins.text()}`)
    }
  }
}

async function createSite(name, address, managerId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/construction_sites`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify({
      name,
      address,
      manager_id: managerId,
      active: true,
    }),
  })
  const data = await res.json()
  if (res.ok && Array.isArray(data) && data[0]) {
    console.log(`  ✅ Baustelle erstellt: ${name} → ${data[0].id}`)
    return data[0].id
  }
  console.error(`  ❌ Baustelle Fehler: ${JSON.stringify(data)}`)
  return null
}

async function assignEmployee(siteId, employeeId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/site_assignments`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ site_id: siteId, employee_id: employeeId }),
  })
  if (res.ok) {
    console.log(`  ✅ Mitarbeiter zugewiesen`)
  } else {
    const t = await res.text()
    if (t.includes('duplicate')) {
      console.log(`  ⚠️  Bereits zugewiesen`)
    } else {
      console.error(`  ❌ Zuweisung Fehler: ${t}`)
    }
  }
}

// =========================================
// MAIN SETUP
// =========================================

console.log(`
╔══════════════════════════════════════════╗
║   BauZeit Pro – Supabase Setup           ║
║   Projekt: lhfotjxzdhxugqpgpeuc         ║
╚══════════════════════════════════════════╝
`)

try {
  // ── Schritt 1: Users erstellen ──────────────────
  console.log('\n📋 SCHRITT 1: Test-User erstellen\n' + '─'.repeat(40))
  
  const adminId = await createUser(
    'admin@bauzeit.de',
    'BauZeit2024!',
    'Admin Chef',
    'admin'
  )
  await setUserRole(adminId, 'Admin Chef', 'admin')
  
  const managerId = await createUser(
    'bauleiter@bauzeit.de', 
    'BauZeit2024!',
    'Max Bauleiter',
    'manager'
  )
  await setUserRole(managerId, 'Max Bauleiter', 'manager')
  
  const worker1Id = await createUser(
    'hans@bauzeit.de',
    'BauZeit2024!',
    'Hans Meier',
    'employee'
  )
  await setUserRole(worker1Id, 'Hans Meier', 'employee')
  
  const worker2Id = await createUser(
    'ibrahim@bauzeit.de',
    'BauZeit2024!',
    'Ibrahim Yilmaz',
    'employee'
  )
  await setUserRole(worker2Id, 'Ibrahim Yilmaz', 'employee')
  
  const worker3Id = await createUser(
    'stefan@bauzeit.de',
    'BauZeit2024!',
    'Stefan Koch',
    'employee'
  )
  await setUserRole(worker3Id, 'Stefan Koch', 'employee')

  // ── Schritt 2: Baustellen erstellen ─────────────
  console.log('\n🏗️  SCHRITT 2: Baustellen erstellen\n' + '─'.repeat(40))
  
  const site1Id = await createSite(
    'Neubau Hauptstraße 12',
    'Hauptstraße 12, 80333 München',
    managerId
  )
  
  const site2Id = await createSite(
    'Sanierung Marktplatz',
    'Marktplatz 5, 80331 München',
    managerId
  )
  
  const site3Id = await createSite(
    'Brücke B2 Nord',
    'Bundesstraße 2, 85748 Garching',
    managerId
  )

  // ── Schritt 3: Mitarbeiter zuweisen ─────────────
  console.log('\n👥 SCHRITT 3: Mitarbeiter zuweisen\n' + '─'.repeat(40))
  
  if (site1Id && worker1Id) {
    console.log(`Weise Hans Meier → ${site1Id}`)
    await assignEmployee(site1Id, worker1Id)
  }
  if (site1Id && worker2Id) {
    console.log(`Weise Ibrahim Yilmaz → ${site1Id}`)
    await assignEmployee(site1Id, worker2Id)
  }
  if (site2Id && worker2Id) {
    console.log(`Weise Ibrahim Yilmaz → ${site2Id}`)
    await assignEmployee(site2Id, worker2Id)
  }
  if (site2Id && worker3Id) {
    console.log(`Weise Stefan Koch → ${site2Id}`)
    await assignEmployee(site2Id, worker3Id)
  }
  if (site3Id && worker3Id) {
    console.log(`Weise Stefan Koch → ${site3Id}`)
    await assignEmployee(site3Id, worker3Id)
  }
  if (site3Id && worker1Id) {
    console.log(`Weise Hans Meier → ${site3Id}`)
    await assignEmployee(site3Id, worker1Id)
  }

  // ── Fertig! ──────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════╗
║   ✅ SETUP ABGESCHLOSSEN!                        ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║   Login-Daten (alle mit Passwort BauZeit2024!): ║
║                                                  ║
║   👑 Admin:                                      ║
║      admin@bauzeit.de                            ║
║                                                  ║
║   👷 Bauleiter:                                   ║
║      bauleiter@bauzeit.de                        ║
║                                                  ║
║   🔧 Mitarbeiter:                                 ║
║      hans@bauzeit.de                             ║
║      ibrahim@bauzeit.de                          ║
║      stefan@bauzeit.de                           ║
║                                                  ║
║   🌐 App: https://bauzeit-pro.netlify.app        ║
║   🌐 Lokal: http://localhost:5173                ║
╚══════════════════════════════════════════════════╝
`)

} catch (err) {
  console.error('\n❌ Unerwarteter Fehler:', err.message)
  process.exit(1)
}
