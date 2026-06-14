// Baustellenverwaltung: Erstellen, Bearbeiten, Mitarbeiter zuweisen
import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus, Building2, MapPin, Users, Edit2, Power, PowerOff,
  ArrowLeft, Save, X, Loader2
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../i18n/LanguageContext'
import type { ConstructionSite, Profile } from '../types/database'

interface SiteFormData {
  name: string
  address: string
  manager_id: string
  gps_lat: string
  gps_lng: string
  gps_radius_m: number
  active: boolean
}

const defaultForm: SiteFormData = {
  name: '',
  address: '',
  manager_id: '',
  gps_lat: '',
  gps_lng: '',
  gps_radius_m: 200,
  active: true,
}

export function SitesPage() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [sites, setSites] = useState<(ConstructionSite & { manager?: Profile; assignedCount?: number })[]>([])
  const [managers, setManagers] = useState<Profile[]>([])
  const [employees, setEmployees] = useState<Profile[]>([])
  const [siteAssignments, setSiteAssignments] = useState<Record<string, string[]>>({})

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingSite, setEditingSite] = useState<ConstructionSite | null>(null)
  const [form, setForm] = useState<SiteFormData>(defaultForm)

  const [selectedSiteForAssign, setSelectedSiteForAssign] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: sitesData } = await supabase
        .from('construction_sites')
        .select(`*, manager:profiles(id, full_name, role)`)
        .order('name')

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .eq('active', true)
        .order('full_name')

      const { data: assignData } = await supabase
        .from('site_assignments')
        .select('site_id, employee_id')

      const profiles = (profilesData || []) as Profile[]
      setManagers(profiles.filter(p => p.role === 'manager' || p.role === 'admin'))
      setEmployees(profiles.filter(p => p.role === 'employee'))

      // Zuweisungen gruppieren
      const assignments: Record<string, string[]> = {}
      const assigns = (assignData || []) as Array<{site_id: string; employee_id: string}>
      assigns.forEach(a => {
        if (!assignments[a.site_id]) assignments[a.site_id] = []
        assignments[a.site_id].push(a.employee_id)
      })
      setSiteAssignments(assignments)
      setSites((sitesData || []) as (ConstructionSite & { manager?: Profile })[])
    } catch (err) {
      setError(t('error_load_data'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const openCreateForm = () => {
    setEditingSite(null)
    setForm(defaultForm)
    setShowForm(true)
  }

  const openEditForm = (site: ConstructionSite) => {
    setEditingSite(site)
    setForm({
      name: site.name,
      address: site.address || '',
      manager_id: site.manager_id || '',
      gps_lat: site.gps_lat?.toString() || '',
      gps_lng: site.gps_lng?.toString() || '',
      gps_radius_m: site.gps_radius_m || 200,
      active: site.active,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Name ist Pflichtfeld')
      return
    }
    setSaving(true)
    setError(null)

    const data = {
      name: form.name.trim(),
      address: form.address.trim() || null,
      manager_id: form.manager_id || null,
      gps_lat: form.gps_lat ? parseFloat(form.gps_lat) : null,
      gps_lng: form.gps_lng ? parseFloat(form.gps_lng) : null,
      gps_radius_m: form.gps_radius_m,
      active: form.active,
    }

    try {
      if (editingSite) {
        const { error: err } = await supabase
          .from('construction_sites')
          .update(data as Record<string, unknown>)
          .eq('id', editingSite.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase
          .from('construction_sites')
          .insert(data as Record<string, unknown>)
        if (err) throw err
      }
      setShowForm(false)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (site: ConstructionSite) => {
    await supabase
      .from('construction_sites')
      .update({ active: !site.active } as Record<string, unknown>)
      .eq('id', site.id)
    await loadData()
  }

  const toggleAssignment = async (siteId: string, employeeId: string) => {
    const assigned = siteAssignments[siteId]?.includes(employeeId)
    if (assigned) {
      await supabase
        .from('site_assignments')
        .delete()
        .eq('site_id', siteId)
        .eq('employee_id', employeeId)
    } else {
      await supabase
        .from('site_assignments')
        .insert({ site_id: siteId, employee_id: employeeId } as Record<string, unknown>)
    }
    await loadData()
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-4 safe-top">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <Link to="/admin" className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">{t('sites_title')}</h1>
            <p className="text-xs text-slate-500">{sites.length} {t('sites_title')}</p>
          </div>
          <button
            onClick={openCreateForm}
            className="flex items-center gap-2 bg-construction-500 hover:bg-construction-600 text-white py-2.5 px-4 rounded-xl font-medium text-sm transition-all active:scale-95"
          >
            <Plus size={16} />
            {t('sites_add')}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Fehler */}
        {error && (
          <div className="p-3 bg-stopped/10 border border-stopped/30 rounded-xl text-stopped text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        {/* Baustellen-Liste */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-800 rounded-2xl animate-pulse" />)}
          </div>
        ) : sites.length === 0 ? (
          <div className="card text-center py-12">
            <Building2 size={48} className="mx-auto text-slate-700 mb-3" />
            <p className="text-slate-400 font-medium">Keine Baustellen angelegt</p>
            <button onClick={openCreateForm} className="btn-primary mt-4 px-6">
              Erste Baustelle erstellen
            </button>
          </div>
        ) : (
          sites.map(site => (
            <div key={site.id} className="card space-y-3">
              {/* Site Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl ${site.active ? 'bg-working/20' : 'bg-slate-700'}`}>
                    <Building2 size={20} className={site.active ? 'text-working' : 'text-slate-500'} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{site.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        site.active ? 'bg-working/20 text-working' : 'bg-slate-700 text-slate-400'
                      }`}>
                        {site.active ? t('admin_active') : 'Inaktiv'}
                      </span>
                    </div>
                    {site.address && (
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin size={11} />
                        {site.address}
                      </p>
                    )}
                    {site.manager_id && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        👷 {(site as ConstructionSite & { manager?: Profile }).manager?.full_name || 'Bauleiter'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setSelectedSiteForAssign(
                      selectedSiteForAssign === site.id ? null : site.id
                    )}
                    className="p-2 text-slate-400 hover:text-admin hover:bg-admin/10 rounded-xl transition-colors"
                    title={t('employees_title')}
                  >
                    <Users size={16} />
                  </button>
                  <button
                    onClick={() => openEditForm(site)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-colors"
                    title={t('common_edit')}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => toggleActive(site)}
                    className={`p-2 rounded-xl transition-colors ${
                      site.active
                        ? 'text-working hover:bg-working/10'
                        : 'text-slate-500 hover:bg-slate-700'
                    }`}
                    title={site.active ? 'Deaktivieren' : 'Aktivieren'}
                  >
                    {site.active ? <Power size={16} /> : <PowerOff size={16} />}
                  </button>
                </div>
              </div>

              {/* Mitarbeiter-Zuweisung */}
              {selectedSiteForAssign === site.id && (
                <div className="pt-3 border-t border-slate-700">
                  <p className="text-xs text-slate-400 mb-2 font-medium">Mitarbeiter zuweisen:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {employees.map(emp => {
                      const isAssigned = siteAssignments[site.id]?.includes(emp.id)
                      return (
                        <button
                          key={emp.id}
                          onClick={() => toggleAssignment(site.id, emp.id)}
                          className={`flex items-center gap-2 p-2 rounded-xl text-sm text-left transition-all ${
                            isAssigned
                              ? 'bg-working/20 border border-working/40 text-working'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            isAssigned ? 'bg-working/30' : 'bg-slate-600'
                          }`}>
                            {emp.full_name.charAt(0)}
                          </div>
                          <span className="truncate">{emp.full_name}</span>
                          {isAssigned && <span className="ml-auto text-xs">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                  {employees.length === 0 && (
                    <p className="text-slate-500 text-sm">Keine Mitarbeiter vorhanden</p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </main>

      {/* Formular-Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-xl font-bold text-white">
                {editingSite ? 'Baustelle bearbeiten' : t('sites_add')}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
              <div>
                <label className="label">Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="z.B. Baustelle Hauptstraße"
                  className="input"
                />
              </div>
              <div>
                <label className="label">Adresse</label>
                <input
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Straße, PLZ Ort"
                  className="input"
                />
              </div>
              <div>
                <label className="label">Bauleiter</label>
                <select
                  value={form.manager_id}
                  onChange={e => setForm(f => ({ ...f, manager_id: e.target.value }))}
                  className="input"
                >
                  <option value="">— Kein Bauleiter —</option>
                  {managers.map(m => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">GPS Breitengrad</label>
                  <input
                    value={form.gps_lat}
                    onChange={e => setForm(f => ({ ...f, gps_lat: e.target.value }))}
                    placeholder="z.B. 48.1372"
                    type="number"
                    step="0.0001"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">GPS Längengrad</label>
                  <input
                    value={form.gps_lng}
                    onChange={e => setForm(f => ({ ...f, gps_lng: e.target.value }))}
                    placeholder="z.B. 11.5755"
                    type="number"
                    step="0.0001"
                    className="input"
                  />
                </div>
              </div>
              <div>
                <label className="label">GPS-Radius (Meter)</label>
                <input
                  value={form.gps_radius_m}
                  onChange={e => setForm(f => ({ ...f, gps_radius_m: parseInt(e.target.value) || 200 }))}
                  type="number"
                  min="50"
                  max="5000"
                  className="input"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="site-active"
                  type="checkbox"
                  checked={form.active}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  className="w-5 h-5 rounded accent-construction-500"
                />
                <label htmlFor="site-active" className="text-slate-300 font-medium">
                  Baustelle ist aktiv
                </label>
              </div>

              {error && (
                <p className="text-stopped text-sm">{error}</p>
              )}
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">
                {t('common_cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
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

export default SitesPage
