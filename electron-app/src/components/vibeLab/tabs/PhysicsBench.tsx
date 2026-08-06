/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ PhysicsBench.tsx — TAB 1: Photon Physics
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 11 paneles de §1.5 TAB 1. Renderiza dinámicamente desde GENE_REGISTRY.
 *
 * @module components/vibeLab/tabs/PhysicsBench
 * @version FASE 3
 */

import React, { memo, useMemo, useState, useCallback } from 'react'
import { Zap, Activity, Waves, Scissors, Gauge, Bolt, Flame, Timer, Droplets, Route, Copy } from 'lucide-react'
import { GenePanel } from '../kit'
import { GeneRenderer } from '../GeneRenderer'
import { getGenesByPanel, getPanelsByTab, PANEL_META } from '../geneRegistry'
import { useVibeLabStore, useInterlock } from '../../../stores/vibeLabStore'
import type { InterlockMode } from '../../../stores/vibeLabStore'

interface BenchProps {
  interlock: InterlockMode
}

// Panel icons (lucide-react)
const PANEL_ICONS: Record<string, React.ReactNode> = {
  envelopes: <Activity size={14} />,
  morph: <Waves size={14} />,
  transient: <Zap size={14} />,
  separation: <Scissors size={14} />,
  sidechain: <Gauge size={14} />,
  strobe: <Bolt size={14} />,
  modes: <Flame size={14} />,
  kick: <Timer size={14} />,
  ambient: <Droplets size={14} />,
  routing: <Route size={14} />,
  overrides41: <Copy size={14} />,
}

export const PhysicsBench: React.FC<BenchProps> = memo(({ interlock }) => {
  const draft = useVibeLabStore((s) => s.draft)
  const expandedPanels = useVibeLabStore((s) => s.expandedPanels)
  const togglePanel = useVibeLabStore((s) => s.togglePanel)
  const revertPanel = useVibeLabStore((s) => s.revertPanel)

  const baseDNA = draft?.baseDNA ?? 'techno-club'

  const panels = useMemo(() => getPanelsByTab('physics'), [])

  const [localExpanded, setLocalExpanded] = useState<Record<string, boolean>>({})

  const handleToggle = useCallback(
    (panelId: string) => {
      // Use store if available, otherwise local state
      if (expandedPanels && togglePanel) {
        togglePanel('physics', panelId)
      } else {
        setLocalExpanded((prev) => ({ ...prev, [panelId]: !prev[panelId] }))
      }
    },
    [expandedPanels, togglePanel],
  )

  const isExpanded = useCallback(
    (panelId: string) => {
      if (expandedPanels?.physics) {
        return expandedPanels.physics.includes(panelId)
      }
      return localExpanded[panelId] ?? false
    },
    [expandedPanels, localExpanded],
  )

  return (
    <div className="physics-bench">
      {panels.map((panelId) => {
        const genes = getGenesByPanel(panelId, interlock)
        const meta = PANEL_META[panelId]
        const isRawOnly = genes.length > 0 && genes.every((g) => g.tier === 'raw')
        const expanded = isExpanded(panelId)

        // Count mutations in this panel (simplified — counts genes that are in draft)
        const mutatedCount = genes.filter((g) => {
          if (!draft) return false
          // Check if path exists in draft override
          return draft && Object.keys(draft).length > 0
        }).length

        return (
          <GenePanel
            key={panelId}
            id={panelId}
            title={meta?.title ?? panelId}
            icon={PANEL_ICONS[panelId] ?? <Zap size={14} />}
            accent="#00e5ff"
            tier={isRawOnly ? 'raw' : 'safe'}
            mutatedCount={0}
            isExpanded={expanded}
            onToggle={() => handleToggle(panelId)}
          >
            {genes.map((gene) => (
              <GeneRenderer
                key={gene.path}
                descriptor={gene}
                baseDNA={baseDNA}
              />
            ))}
            {genes.length === 0 && (
              <p className="bench-panel-empty">
                {panelId === 'envelopes'
                  ? '6 envelope chambers — EnvelopeBay component (Fase 3.2)'
                  : panelId === 'routing'
                    ? 'Routing toggles — custom component'
                    : 'No genes in this panel for current mode'}
              </p>
            )}
          </GenePanel>
        )
      })}
    </div>
  )
})

PhysicsBench.displayName = 'PhysicsBench'
