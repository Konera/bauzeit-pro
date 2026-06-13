// Login-Seite: E-Mail + Passwort über Supabase Auth
import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../i18n/LanguageContext'

export function LoginPage() {
  const { user, login, loading, error } = useAuth()
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Bereits eingeloggt → Weiterleitung
  if (user) {
    const redirectTo = user.profile.role === 'admin' || user.profile.role === 'manager'
      ? '/admin'
      : '/dashboard'
    return <Navigate to={redirectTo} replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setSubmitting(true)
    await login(email, password)
    setSubmitting(false)
  }

  const isLoading = loading || submitting

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Hintergrund-Gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-construction-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-admin/20 rounded-full blur-3xl" />
      </div>

      <div className="relative flex flex-col items-center justify-center min-h-screen p-6">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl mb-4 shadow-[0_0_40px_rgba(249,115,22,0.4)] overflow-hidden">
            <img src="/icon-512.png" alt="BauZeit Pro" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-black text-white">{t('login_title')}</h1>
          <p className="text-slate-400 mt-1">{t('login_subtitle')}</p>
        </div>

        {/* Login-Formular */}
        <div className="w-full max-w-sm">
          <div className="card bg-slate-800/80 backdrop-blur-sm border-slate-700">
            <h2 className="text-xl font-bold text-white mb-6">{t('login_heading')}</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Fehlermeldung */}
              {error && (
                <div className="flex items-center gap-2.5 p-3 bg-stopped/10 border border-stopped/30 rounded-xl text-stopped text-sm">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* E-Mail */}
              <div>
                <label htmlFor="email" className="label">{t('login_email')}</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t('login_email_placeholder')}
                  autoComplete="email"
                  autoCapitalize="none"
                  className="input"
                  disabled={isLoading}
                  required
                />
              </div>

              {/* Passwort */}
              <div>
                <label htmlFor="password" className="label">{t('login_password')}</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={t('login_password_placeholder')}
                    autoComplete="current-password"
                    className="input pr-12"
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    aria-label={showPassword ? t('login_hide_password') : t('login_show_password')}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading || !email || !password}
                className="w-full py-4 rounded-2xl font-bold text-lg bg-construction-500 hover:bg-construction-600 text-white transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    {t('login_loading')}
                  </>
                ) : (
                  t('login_button')
                )}
              </button>
            </form>
          </div>

          {/* Info-Text */}
          <p className="text-center text-xs text-slate-600 mt-4">
            {t('login_no_access')}
          </p>
        </div>

        {/* Version */}
        <p className="absolute bottom-6 text-xs text-slate-700">
          {t('login_version')}
        </p>
      </div>
    </div>
  )
}

export default LoginPage
