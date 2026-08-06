/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛰 MovementBench.tsx — TAB 3: Kinetic Orbit
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 8 paneles de §1.5 TAB 3. Renderiza dinámicamente desde GENE_REGISTRY.
 *
 * @module components/vibeLab/tabs/MovementBench
 * @version FASE 3
 */

import React, { memo, useMemo, useState, useCallback } from 'react'
import { Orbit, Grid, Calendar, Maximize, Users, Cog, Focus, Brain, Fan, Gauge } from 'lucide-react'
import { GenePanel } from '../kit'
import { GeneRenderer } from '../GeneRenderer'
import { OrbitVault } from '../panels/OrbitVault'
import { getGenesByPanel, getPanelsByTab, PANEL_META } from '../geneRegistry'
import { useVibeLabStore, useInterlock } from '../../../stores/vibeLabStore'
import type { InterlockMode } from '../../../stores/vibeLabStore'

interface BenchProps {
  interlock: InterlockMode
}

const PANEL_ICONS: Record<string, React.ReactNode> = {
  patterns: <Grid size={14} />,
  scheduler: <Calendar size={14} />,
  reach: <Maximize size={14} />,
  ensemble: <Users size={14} />,
  gearbox: <Cog size={14} />,
  lens: <Focus size={14} />,
  instinct: <Brain size={14} />,
  fan: <Fan size={14} />,
  grandmaster: <Gauge size={14} />,
}

export const MovementBench: React.FC<BenchProps> = memo(({ interlock }) => {
  const draft = useVibeLabStore((s) => s.draft)
  const expandedPanels = useVibeLabStore((s) => s.expandedPanels)
  const togglePanel = useVibeLabStore((s) => s.togglePanel)

  const baseDNA = draft?.baseDNA ?? 'techno-club'

  const panels = useMemo(() => getPanelsByTab('movement'), [])

  const [localExpanded, setLocalExpanded] = useState<Record<string, boolean>>({})

  const handleToggle = useCallback(
    (panelId: string) => {
      if (expandedPanels && togglePanel) {
        togglePanel('movement', panelId)
      } else {
        setLocalExpanded((prev) => ({ ...prev, [panelId]: !prev[panelId] }))
      }
    },
    [expandedPanels, togglePanel],
  )

  const isExpanded = useCallback(
    (panelId: string) => {
      if (expandedPanels?.movement) {
        return expandedPanels.movement.includes(panelId)
      }
      return localExpanded[panelId] ?? false
    },
    [expandedPanels, localExpanded],
  )

  return (
    <div className="movement-bench">
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
            icon={PANEL_ICONS[panelId] ?? <Orbit size={14} />}
            accent="#ffb020"
            tier={isRawOnly ? 'raw' : 'safe'}
            mutatedCount={0}
            isExpanded={expanded}
            onToggle={() => handleToggle(panelId)}
          >
            {panelId === 'patterns' ? (
              <OrbitVault />
            ) : panelId === 'scheduler' ? (
              <p className="bench-panel-empty">SchedulerDeck component (Fase 3.2+)</p>
            ) : genes.length === 0 ? (
              <p className="bench-panel-empty">No genes in this panel for current mode</p>
            ) : (
              genes.map((gene) => (
                <GeneRenderer
                  key={gene.path}
                  descriptor={gene}
                  baseDNA={baseDNA}
                />
              ))
            )}
          </GenePanel>
        )
      })}
    </div>
  )
})

MovementBench.displayName = 'MovementBench'
