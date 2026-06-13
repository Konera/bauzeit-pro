// React Router v6 Konfiguration mit geschützten Routen
// Code-Splitting: Seiten werden per React.lazy() dynamisch geladen
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// Lazy-Imports für Code-Splitting (reduziert initiale Bundle-Größe)
const LoginPage = React.lazy(() => import('../pages/LoginPage').then(m => ({ default: m.LoginPage })))
const EmployeeDashboard = React.lazy(() => import('../pages/EmployeeDashboard').then(m => ({ default: m.EmployeeDashboard })))
const AdminDashboard = React.lazy(() => import('../pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })))
const SitesPage = React.lazy(() => import('../pages/SitesPage').then(m => ({ default: m.SitesPage })))
const EmployeesPage = React.lazy(() => import('../pages/EmployeesPage').then(m => ({ default: m.EmployeesPage })))
const TimesheetsPage = React.lazy(() => import('../pages/TimesheetsPage').then(m => ({ default: m.TimesheetsPage })))
const SettingsPage = React.lazy(() => import('../pages/SettingsPage').then(m => ({ default: m.SettingsPage })))

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
    <React.Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner w-10 h-10 mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Lade...</p>
        </div>
      </div>
    }>
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
    </React.Suspense>
  )
}
