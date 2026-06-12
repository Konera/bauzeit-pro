// useAuth Hook: Authentifizierung und Profil-Management
import { useState, useEffect, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile, AppUser } from '../types/database'

interface AuthState {
  user: AppUser | null
  loading: boolean
  error: string | null
}

export function useAuth() {
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
  }, [])

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
      const errorMessages: Record<string, string> = {
        'Invalid login credentials': 'E-Mail oder Passwort falsch',
        'Email not confirmed': 'E-Mail nicht bestätigt',
        'Too many requests': 'Zu viele Versuche. Bitte warten.',
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
  }, [loadProfile])

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
