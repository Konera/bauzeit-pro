-- Phase 3: Push Subscriptions + Mobile App Erweiterungen
-- Push-Abonnements für Web Push Notifications

-- Push Subscriptions Tabelle
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'web', -- 'web', 'android', 'ios'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- RLS aktivieren
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- User kann nur eigene Subscriptions sehen/erstellen/löschen
CREATE POLICY "push_sub_select_own" ON push_subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "push_sub_insert_own" ON push_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "push_sub_delete_own" ON push_subscriptions
  FOR DELETE USING (user_id = auth.uid());

-- Admin kann alle sehen (für serverseitigen Push)
CREATE POLICY "push_sub_select_admin" ON push_subscriptions
  FOR SELECT USING (is_admin());

-- Index für schnelle Abfragen nach user_id
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
