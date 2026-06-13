// useAuth Hook: Authentifizierung und Profil-Management
import { useState, useEffect, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile, AppUser } from '../types/database'
import { useTranslation } from '../i18n/LanguageContext'

interface AuthState {
  user: AppUser | null
  loading: boolean
  error: string | null
}

export function useAuth() {
  const { t } = useTranslation()

  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  })

  // Profil laden
  const loadProfile = useCallback(async (authUser: User): Promise<AppUser | null> => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (error) {
        console.error('Profil laden fehlgeschlagen:', error)
        setState(prev => ({ ...prev, error: t('error_profile_load_failed') }))
        return null
      }

      // K7 FIX: Deaktivierte Mitarbeiter blocken
      if (!(profile as Profile).active) {
        console.warn('Zugang verweigert: Mitarbeiter deaktiviert', authUser.id)
        await supabase.auth.signOut()
        setState(prev => ({ ...prev, error: t('error_account_deactivated') }))
        return null
      }

      return {
        id: authUser.id,
        email: authUser.email || '',
        profile: profile as Profile,
      }
    } catch (err) {
      console.error('Unerwarteter Fehler beim Laden des Profils:', err)
      return null
    }
  }, [t])

  // Auth-State Listener
  useEffect(() => {
    // Initiale Session prüfen
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        const appUser = await loadProfile(session.user)
        setState({ user: appUser, loading: false, error: null })
      } else {
        setState({ user: null, loading: false, error: null })
      }
    }

    initAuth()

    // Auth-Änderungen abonnieren
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const appUser = await loadProfile(session.user)
          setState({ user: appUser, loading: false, error: null })
        } else if (event === 'SIGNED_OUT') {
          setState({ user: null, loading: false, error: null })
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [loadProfile])

  // Login-Funktion
  const login = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      // Fehlermeldungen über i18n übersetzen
      const errorMessages: Record<string, string> = {
        'Invalid login credentials': t('error_invalid_credentials'),
        'Email not confirmed': t('error_email_not_confirmed'),
        'Too many requests': t('error_too_many_attempts'),
      }
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessages[error.message] || error.message,
      }))
      return false
    }

    if (data.user) {
      const appUser = await loadProfile(data.user)
      setState({ user: appUser, loading: false, error: null })
      return true
    }

    return false
  }, [loadProfile, t])

  // Logout-Funktion
  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setState({ user: null, loading: false, error: null })
  }, [])

  // Rollen-Prüfungen
  const isAdmin = state.user?.profile.role === 'admin'
  const isManager = state.user?.profile.role === 'manager'
  const isEmployee = state.user?.profile.role === 'employee'
  const isAdminOrManager = isAdmin || isManager

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    login,
    logout,
    isAdmin,
    isManager,
    isEmployee,
    isAdminOrManager,
  }
}
