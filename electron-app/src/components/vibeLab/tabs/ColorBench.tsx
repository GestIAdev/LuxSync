/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 ColorBench.tsx — TAB 2: Chromatic Spectrum
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 10 paneles de §1.5 TAB 2. Renderiza dinámicamente desde GENE_REGISTRY.
 *
 * @module components/vibeLab/tabs/ColorBench
 * @version FASE 3
 */

import React, { memo, useMemo, useState, useCallback } from 'react'
import { Palette, Circle, Thermometer, Repeat, Sliders, Shield, Sparkles, Zap, Clock, Waves } from 'lucide-react'
import { GenePanel } from '../kit'
import { PanelGeneList } from '../PanelGeneList'
import { ChromaticWheel } from '../panels/ChromaticWheel'
import { ThermalVector } from '../panels/ThermalVector'
import { getGenesByPanel, getPanelsByTab, PANEL_META } from '../geneRegistry'
import { useVibeLabStore, useInterlock } from '../../../stores/vibeLabStore'
import type { InterlockMode } from '../../../stores/vibeLabStore'

interface BenchProps {
  interlock: InterlockMode
}

const PANEL_ICONS: Record<string, React.ReactNode> = {
  wheel: <Circle size={14} />,
  thermal: <Thermometer size={14} />,
  remapping: <Repeat size={14} />,
  luminance: <Sliders size={14} />,
  sanitized: <Shield size={14} />,
  harmony: <Sparkles size={14} />,
  accent: <Zap size={14} />,
  transitions: <Clock size={14} />,
  sidereal: <Clock size={14} />,
  oceanic: <Waves size={14} />,
}

export const ColorBench: React.FC<BenchProps> = memo(({ interlock }) => {
  const draft = useVibeLabStore((s) => s.draft)
  const expandedPanels = useVibeLabStore((s) => s.expandedPanels)
  const togglePanel = useVibeLabStore((s) => s.togglePanel)

  const baseDNA = draft?.baseDNA ?? 'techno-club'

  const panels = useMemo(() => getPanelsByTab('color'), [])

  const [localExpanded, setLocalExpanded] = useState<Record<string, boolean>>({})

  const handleToggle = useCallback(
    (panelId: string) => {
      if (expandedPanels && togglePanel) {
        togglePanel('color', panelId)
      } else {
        setLocalExpanded((prev) => ({ ...prev, [panelId]: !prev[panelId] }))
      }
    },
    [expandedPanels, togglePanel],
  )

  const isExpanded = useCallback(
    (panelId: string) => {
      if (expandedPanels?.color) {
        return expandedPanels.color.includes(panelId)
      }
      return localExpanded[panelId] ?? false
    },
    [expandedPanels, localExpanded],
  )

  return (
    <div className="color-bench">
      {panels.map((panelId) => {
        const genes = getGenesByPanel(panelId, interlock)
        const meta = PANEL_META[panelId]
        const isRawOnly = genes.length > 0 && genes.every((g) => g.tier === 'raw')
        const expanded = isExpanded(panelId)

        return (
          <GenePanel
            key={panelId}
            id={panelId}
            title={meta?.title ?? panelId}
            icon={PANEL_ICONS[panelId] ?? <Palette size={14} />}
            accent="#ff2fd0"
            tier={isRawOnly ? 'raw' : 'safe'}
            mutatedCount={0}
            isExpanded={expanded}
            onToggle={() => handleToggle(panelId)}
          >
            {panelId === 'wheel' ? (
              <ChromaticWheel size={220} accent="#ff2fd0" />
            ) : panelId === 'thermal' ? (
              <div className="bench-thermal-row">
                <ThermalVector size={120} />
                <PanelGeneList genes={genes} baseDNA={baseDNA} />
              </div>
            ) : panelId === 'remapping' ? (
              <p className="bench-panel-empty">TransmutationTable component (Fase 3.2+)</p>
            ) : genes.length === 0 ? (
              <p className="bench-panel-empty">No genes in this panel for current mode</p>
            ) : (
              <PanelGeneList genes={genes} baseDNA={baseDNA} />
            )}
          </GenePanel>
        )
      })}
    </div>
  )
})

ColorBench.displayName = 'ColorBench'
