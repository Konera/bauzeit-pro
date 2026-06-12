// SiteSelector: Dropdown zur Baustellen-Auswahl
import React from 'react'
import { MapPin, ChevronDown } from 'lucide-react'
import type { ConstructionSite } from '../types/database'

interface SiteSelectorProps {
  sites: ConstructionSite[]
  selectedSiteId: string | null
  onSelect: (siteId: string) => void
  disabled?: boolean
  label?: string
}

export function SiteSelector({
  sites,
  selectedSiteId,
  onSelect,
  disabled = false,
  label = 'Baustelle auswählen',
}: SiteSelectorProps) {
  const selectedSite = sites.find(s => s.id === selectedSiteId)

  if (sites.length === 0) {
    return (
      <div className="card border-slate-600 bg-slate-800/50">
        <div className="flex items-center gap-3 text-slate-400">
          <MapPin size={20} />
          <div>
            <p className="text-sm font-medium">Keine Baustelle zugewiesen</p>
            <p className="text-xs text-slate-500">Bitte Admin kontaktieren</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* BUG-013 Fix: htmlFor/id Verknüpfung für Accessibility */}
      <label htmlFor="site-selector" className="label">
        <MapPin size={14} className="inline mr-1.5 text-construction-400" />
        {label}
      </label>
      <div className="relative">
        <select
          id="site-selector"
          value={selectedSiteId || ''}
          onChange={e => onSelect(e.target.value)}
          disabled={disabled}
          aria-label={label}
          className="input appearance-none pr-10 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="" disabled>— Bitte auswählen —</option>
          {sites.map(site => (
            <option key={site.id} value={site.id}>
              {site.name}{site.address ? ` · ${site.address}` : ''}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
      </div>
      {selectedSite && (
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
          <MapPin size={12} />
          <span>{selectedSite.address || 'Keine Adresse hinterlegt'}</span>
        </div>
      )}
    </div>
  )
}

export default SiteSelector
