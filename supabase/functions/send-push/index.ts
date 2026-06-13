// Supabase Edge Function: Web Push Notifications senden
// Deployment: supabase functions deploy send-push
//
// Verwendung:
// POST /functions/v1/send-push
// Body: { userId: string, title: string, body: string }
//
// VAPID Keys generieren:
// npx web-push generate-vapid-keys
//
// Secrets setzen:
// supabase secrets set VAPID_PRIVATE_KEY=<private_key>
// supabase secrets set VAPID_PUBLIC_KEY=<public_key>
// supabase secrets set VAPID_SUBJECT=mailto:admin@bauzeit.de

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@bauzeit.de'

Deno.serve(async (req: Request) => {
  // CORS Headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { userId, title, body } = await req.json()

    if (!userId || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'userId, title und body sind Pflicht' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Supabase Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    )

    // Push Subscriptions für User laden
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)

    if (subError) {
      return new Response(
        JSON.stringify({ error: 'Subscriptions laden fehlgeschlagen', detail: subError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Keine Push-Subscriptions gefunden', sent: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Push Notifications senden
    // HINWEIS: In einer Produktionsumgebung würde hier die Web Push API
    // (web-push npm Paket / Deno-kompatible Alternative) verwendet.
    // Für die initiale Vorbereitung wird die Subscription-Infrastruktur bereitgestellt.
    // Die eigentliche Push-Implementierung erfordert den VAPID_PRIVATE_KEY.

    const results = {
      total: subscriptions.length,
      sent: 0,
      failed: 0,
      message: 'Push-Infrastruktur vorbereitet. VAPID Keys müssen konfiguriert werden.',
    }

    // TODO: Web Push mit VAPID Keys implementieren wenn Secrets gesetzt sind
    if (VAPID_PRIVATE_KEY && VAPID_PUBLIC_KEY) {
      // Hier Web Push Logik einfügen
      results.message = 'VAPID Keys konfiguriert – Push bereit.'
    }

    return new Response(
      JSON.stringify(results),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Interner Fehler', detail: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
