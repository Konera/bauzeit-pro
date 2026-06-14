// Mitarbeiterverwaltung: Erstellen, Bearbeiten, Rollen vergeben
import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus, Users, Edit2, Power, PowerOff, ArrowLeft,
  Save, X, Loader2, User, Shield, HardHat
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTranslation } from '../i18n/LanguageContext'
import type { Profile, UserRole } from '../types/database'

interface EmployeeFormData {
  full_name: string
  role: UserRole
  phone: string
  active: boolean
  email?: string
  password?: string
}

const defaultForm: EmployeeFormData = {
  full_name: '',
  role: 'employee',
  phone: '',
  active: true,
  email: '',
  password: '',
}

const roleConfig = {
  admin: { label: 'Administrator', icon: Shield, color: 'text-stopped', bg: 'bg-stopped/20' },
  manager: { label: 'Bauleiter', icon: HardHat, color: 'text-admin', bg: 'bg-admin/20' },
  employee: { label: 'Mitarbeiter', icon: User, color: 'text-slate-300', bg: 'bg-slate-700' },
}

export function EmployeesPage() {
  const { t } = useTranslation()
  const [employees, setEmployees] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Profile | null>(null)
  const [form, setForm] = useState<EmployeeFormData>(defaultForm)
  const [filter, setFilter] = useState<'all' | UserRole>('all')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name')
      if (err) throw err
      setEmployees(data || [])
    } catch (err) {
      setError(t('error_load_data'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const openCreateForm = () => {
    setEditingEmployee(null)
    setForm(defaultForm)
    setShowForm(true)
    setError(null)
  }

  const openEditForm = (emp: Profile) => {
    setEditingEmployee(emp)
    setForm({
      full_name: emp.full_name,
      role: emp.role,
      phone: emp.phone || '',
      active: emp.active,
    })
    setShowForm(true)
    setError(null)
  }

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      setError('Name ist Pflichtfeld')
      return
    }
    setSaving(true)
    setError(null)

    try {
      if (editingEmployee) {
        // Profil aktualisieren
        const { error: err } = await supabase
          .from('profiles')
          .update({
            full_name: form.full_name.trim(),
            role: form.role,
            phone: form.phone || null,
            active: form.active,
            updated_at: new Date().toISOString(),
          } as Record<string, unknown>)
          .eq('id', editingEmployee.id)
        if (err) throw err
      } else {
        // Neuen Benutzer über Supabase Admin-API anlegen
        // In Produktion sollte das über Edge Functions gemacht werden!
        if (!form.email || !form.password) {
          setError('E-Mail und Passwort sind für neue Mitarbeiter Pflichtfelder')
          setSaving(false)
          return
        }

        // Hinweis: In Produktion via Supabase Admin Edge Function
        setError('Neue Mitarbeiter müssen über das Supabase-Dashboard oder Edge Functions angelegt werden. Bitte nutze die Supabase-UI für die Erstanlage.')
        setSaving(false)
        return
      }

      setShowForm(false)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (emp: Profile) => {
    await supabase
      .from('profiles')
      .update({ active: !emp.active, updated_at: new Date().toISOString() } as Record<string, unknown>)
      .eq('id', emp.id)
    await loadData()
  }

  const filtered = employees.filter(e => filter === 'all' ? true : e.role === filter)

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-4 safe-top">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <Link to="/admin" className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">{t('employees_title')}</h1>
            <p className="text-xs text-slate-500">{employees.length} Benutzer</p>
          </div>
          <button
            onClick={openCreateForm}
            className="flex items-center gap-2 bg-construction-500 hover:bg-construction-600 text-white py-2.5 px-4 rounded-xl font-medium text-sm transition-all active:scale-95"
          >
            <Plus size={16} />
            {t('employees_add')}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Filter-Tabs */}
        <div className="flex gap-2 bg-slate-900 p-1 rounded-2xl">
          {(['all', 'admin', 'manager', 'employee'] as const).map(role => (
            <button
              key={role}
              onClick={() => setFilter(role)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                filter === role
                  ? 'bg-construction-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {role === 'all' ? t('admin_all') : roleConfig[role].label}
            </button>
          ))}
        </div>

        {/* Mitarbeiter-Liste */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-800 rounded-2xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-12">
            <Users size={48} className="mx-auto text-slate-700 mb-3" />
            <p className="text-slate-400 font-medium">{t('admin_no_active')}</p>
          </div>
        ) : (
          filtered.map(emp => {
            const RoleIcon = roleConfig[emp.role].icon
            return (
              <div key={emp.id} className="card flex items-center gap-4">
                {/* Avatar */}
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0 ${roleConfig[emp.role].bg}`}>
                  <span className={roleConfig[emp.role].color}>
                    {emp.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-semibold truncate ${emp.active ? 'text-white' : 'text-slate-500'}`}>
                      {emp.full_name}
                    </h3>
                    {!emp.active && (
                      <span className="text-xs bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full flex-shrink-0">
                        Inaktiv
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs flex items-center gap-1 ${roleConfig[emp.role].color}`}>
                      <RoleIcon size={10} />
                      {roleConfig[emp.role].label}
                    </span>
                    {emp.phone && (
                      <span className="text-xs text-slate-500">· {emp.phone}</span>
                    )}
                  </div>
                </div>

                {/* Aktionen */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => openEditForm(emp)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-colors"
                    title={t('common_edit')}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => toggleActive(emp)}
                    className={`p-2 rounded-xl transition-colors ${
                      emp.active
                        ? 'text-working hover:bg-working/10'
                        : 'text-slate-500 hover:bg-slate-700'
                    }`}
                    title={emp.active ? 'Deaktivieren' : 'Aktivieren'}
                  >
                    {emp.active ? <Power size={16} /> : <PowerOff size={16} />}
                  </button>
                </div>
              </div>
            )
          })
        )}

        {/* Hinweis für neue Mitarbeiter */}
        <div className="card border-admin/30 bg-admin/5">
          <p className="text-sm text-slate-400">
            <span className="text-admin font-medium">💡 Hinweis:</span> Neue Mitarbeiter werden über das Supabase-Dashboard angelegt.
            Gehe zu Authentication → Users → New User. Das Profil wird automatisch erstellt.
          </p>
        </div>
      </main>

      {/* Formular-Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-xl font-bold text-white">
                {editingEmployee ? 'Mitarbeiter bearbeiten' : t('employees_add')}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="label">Name *</label>
                <input
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Max Mustermann"
                  className="input"
                />
              </div>

              <div>
                <label className="label">Rolle</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['employee', 'manager', 'admin'] as UserRole[]).map(role => {
                    const RoleIcon = roleConfig[role].icon
                    return (
                      <button
                        key={role}
                        onClick={() => setForm(f => ({ ...f, role }))}
                        className={`p-3 rounded-xl border transition-all text-sm flex flex-col items-center gap-1.5 ${
                          form.role === role
                            ? 'border-construction-500 bg-construction-500/20 text-white'
                            : 'border-slate-600 text-slate-400 hover:border-slate-500'
                        }`}
                      >
                        <RoleIcon size={18} />
                        <span className="text-xs">{roleConfig[role].label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="label">Telefon</label>
                <input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+49 123 456789"
                  type="tel"
                  className="input"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  id="emp-active"
                  type="checkbox"
                  checked={form.active}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  className="w-5 h-5 rounded accent-construction-500"
                />
                <label htmlFor="emp-active" className="text-slate-300 font-medium">
                  Mitarbeiter ist aktiv
                </label>
              </div>

              {error && (
                <div className="p-3 bg-stopped/10 border border-stopped/30 rounded-xl text-stopped text-sm">
                  {error}
                </div>
              )}
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">
                {t('common_cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.full_name.trim()}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Speichere...' : t('settings_save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EmployeesPage
