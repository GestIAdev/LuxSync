/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 GenomeTabs.tsx — The 3 genome tabs
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Pestañas: ⚡ Photon Physics | 🎨 Chromatic Spectrum | 🛰 Kinetic Orbit
 *
 * @module components/vibeLab/GenomeTabs
 * @version FASE 3
 */

import React, { memo, useCallback } from 'react'
import { Zap, Palette, Orbit } from 'lucide-react'
import { useVibeLabStore, useActiveTab } from '../../stores/vibeLabStore'
import type { GenomeTab } from '../../stores/vibeLabStore'
import './genome-tabs.css'

interface TabConfig {
  id: GenomeTab
  label: string
  icon: React.ReactNode
  accent: string
}

const TABS: readonly TabConfig[] = [
  { id: 'physics', label: 'PHOTON PHYSICS', icon: <Zap size={14} />, accent: '#00e5ff' },
  { id: 'color', label: 'CHROMATIC SPECTRUM', icon: <Palette size={14} />, accent: '#ff2fd0' },
  { id: 'movement', label: 'KINETIC ORBIT', icon: <Orbit size={14} />, accent: '#ffb020' },
]

export const GenomeTabs: React.FC = memo(() => {
  const activeTab = useActiveTab()
  const setTab = useVibeLabStore((s) => s.setTab)

  const handleSelect = useCallback(
    (tab: GenomeTab) => {
      setTab(tab)
    },
    [setTab],
  )

  return (
    <div className="genome-tabs">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`genome-tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => handleSelect(tab.id)}
          style={{ '--tab-accent': tab.accent } as React.CSSProperties}
          type="button"
        >
          <span className="genome-tab-icon">{tab.icon}</span>
          <span className="genome-tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  )
})

GenomeTabs.displayName = 'GenomeTabs'
