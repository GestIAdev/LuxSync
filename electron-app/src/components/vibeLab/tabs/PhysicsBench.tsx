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
import { GenePanel, GeneSegmented, GeneToggle } from '../kit'
import { GeneRenderer } from '../GeneRenderer'
import { PanelGeneList } from '../PanelGeneList'
import { EnvelopeBay } from '../panels/EnvelopeBay'
import { getGenesByPanel, getPanelsByTab, PANEL_META } from '../geneRegistry'
import { ENVELOPE_SLOTS } from '../../../types/CustomVibe'
import { useVibeLabStore, useInterlock, useGene } from '../../../stores/vibeLabStore'
import { PROFILE_REGISTRY } from '../../../hal/physics/profiles/index'
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

// ── ROUTING BAY: layout41Strategy (GeneSegmented) + isPureAmbient (GeneToggle) ─
const LAYOUT41_OPTIONS = [
  { label: 'Default', value: 'default' as const },
  { label: 'Strict Split', value: 'strict-split' as const },
]

const RoutingBayPanel: React.FC<{ baseDNA: string }> = memo(({ baseDNA }) => {
  const setGene = useVibeLabStore((s) => s.setGene)
  const revertGene = useVibeLabStore((s) => s.revertGene)

  // Resolve base values from the active profile
  const profile = PROFILE_REGISTRY[baseDNA as keyof typeof PROFILE_REGISTRY]
  const baseLayout = (profile?.layout41Strategy ?? 'default') as 'default' | 'strict-split'
  const basePureAmbient = Boolean(profile?.isPureAmbient ?? false)

  // layout41Strategy is routed via VibeFusionResolver to overrides41.layout41Strategy
  // but the UI gene path is physics.routing.layout41Strategy
  const { value: layoutVal, isMutated: layoutMut } = useGene<'default' | 'strict-split'>(
    'physics.routing.layout41Strategy',
    baseLayout,
  )
  const { value: pureAmbientVal, isMutated: pureAmbientMut } = useGene<boolean>(
    'physics.routing.isPureAmbient',
    basePureAmbient,
  )

  return (
    <>
      <GeneSegmented
        path="physics.routing.layout41Strategy"
        label="Layout 4.1 Strategy"
        baseValue={baseLayout}
        value={layoutVal}
        options={LAYOUT41_OPTIONS}
        isMutated={layoutMut}
        tier="safe"
        onChange={(v) => setGene('physics.routing.layout41Strategy', v)}
        onRevert={() => revertGene('physics.routing.layout41Strategy')}
      />
      <GeneToggle
        path="physics.routing.isPureAmbient"
        label="Pure Ambient (RAW)"
        baseValue={basePureAmbient}
        value={pureAmbientVal}
        isMutated={pureAmbientMut}
        tier="raw"
        onChange={(v) => setGene('physics.routing.isPureAmbient', v)}
        onRevert={() => revertGene('physics.routing.isPureAmbient')}
      />
    </>
  )
})
RoutingBayPanel.displayName = 'RoutingBayPanel'

export const PhysicsBench: React.FC<BenchProps> = memo(({ interlock }) => {
  const draft = useVibeLabStore((s) => s.draft)
  const expandedPanels = useVibeLabStore((s) => s.expandedPanels)
  const togglePanel = useVibeLabStore((s) => s.togglePanel)

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
            {panelId === 'envelopes' ? (
              <div className="bench-envelope-bays">
                {ENVELOPE_SLOTS.map((slot) => (
                  <EnvelopeBay
                    key={slot}
                    slot={slot}
                    slotLabel={slot.toUpperCase()}
                    accent="#00e5ff"
                    isExpanded={isExpanded(`env-${slot}`)}
                    onToggle={() => handleToggle(`env-${slot}`)}
                  />
                ))}
              </div>
            ) : panelId === 'routing' ? (
              <RoutingBayPanel baseDNA={baseDNA} />
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

PhysicsBench.displayName = 'PhysicsBench'
