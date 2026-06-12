// React Router v6 Konfiguration mit geschützten Routen
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { LoginPage } from '../pages/LoginPage'
import { EmployeeDashboard } from '../pages/EmployeeDashboard'
import { AdminDashboard } from '../pages/AdminDashboard'
import { SitesPage } from '../pages/SitesPage'
import { EmployeesPage } from '../pages/EmployeesPage'
import { TimesheetsPage } from '../pages/TimesheetsPage'
import { SettingsPage } from '../pages/SettingsPage'

// =========================================
// Route-Schutz Komponenten
// =========================================

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner w-10 h-10 mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Lade...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return null

  if (!user || (user.profile.role !== 'admin' && user.profile.role !== 'manager')) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

// BUG-003 Fix: Verhindert dass Admins/Manager versehentlich auf /dashboard landen
function RequireEmployee({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return null

  // Admins und Manager → Admin-Dashboard
  if (user && (user.profile.role === 'admin' || user.profile.role === 'manager')) {
    return <Navigate to="/admin" replace />
  }

  return <>{children}</>
}

// =========================================
// App Router
// =========================================

export function AppRouter() {
  const { user } = useAuth()

  return (
    <Routes>
      {/* Öffentliche Routen */}
      <Route path="/login" element={<LoginPage />} />

      {/* Root: Weiterleitung basierend auf Rolle */}
      <Route
        path="/"
        element={
          user
            ? user.profile.role === 'employee'
              ? <Navigate to="/dashboard" replace />
              : <Navigate to="/admin" replace />
            : <Navigate to="/login" replace />
        }
      />

      {/* Mitarbeiter-Routen */}
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            {/* BUG-003 Fix: Admin/Manager werden zu /admin geleitet */}
            <RequireEmployee>
              <EmployeeDashboard />
            </RequireEmployee>
          </RequireAuth>
        }
      />

      {/* Admin/Manager-Routen */}
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          </RequireAuth>
        }
      />

      <Route
        path="/sites"
        element={
          <RequireAuth>
            <RequireAdmin>
              <SitesPage />
            </RequireAdmin>
          </RequireAuth>
        }
      />

      <Route
        path="/employees"
        element={
          <RequireAuth>
            <RequireAdmin>
              <EmployeesPage />
            </RequireAdmin>
          </RequireAuth>
        }
      />

      {/* Gemeinsame Routen (für alle angemeldeten Nutzer) */}
      <Route
        path="/timesheets"
        element={
          <RequireAuth>
            <TimesheetsPage />
          </RequireAuth>
        }
      />

      <Route
        path="/settings"
        element={
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
