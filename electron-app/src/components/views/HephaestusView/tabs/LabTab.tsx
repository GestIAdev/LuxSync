/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ LAB TAB — WAVE 7011: DAW LAYOUT TIER 3B
 * Laboratory workspace: PhaseControls + HephRadar + DnaRail
 *
 * Architecture (Camisa de Fuerza Flexbox):
 * ┌──────────────────┬──────────────────────────────┬────────────────┐
 * │  PHASE RACK      │       RADAR (Canvas)         │   DNA RAIL     │
 * │  340px fixed     │       flex:1 minWidth:0      │   260px fixed  │
 * │  overflowY:auto  │       minHeight:0            │   overflowY:auto│
 * │                  │                              │                │
 * │  Spread/Wings/   │       2D spatial simulator   │   Genome/Cube  │
 * │  Blocks/Shuffle  │       Play/Pause/Seek        │   ACO/Thermo   │
 * └──────────────────┴──────────────────────────────┴────────────────┘
 *
 * State reads from useHephaestusEditorStore + useStageStore.
 * temporalActions passed from parent shell.
 *
 * @module views/HephaestusView/tabs/LabTab
 */

import React, { useMemo, useCallback } from 'react'
import { PhaseControls } from '../PhaseControls'
import { HephRadar } from '../HephRadar'
import { DnaRail, DEFAULT_COGNITIVE_DNA, DEFAULT_SIMULATION_META } from '../dna/DnaRail'
import type { TemporalActions } from '../types/HephaestusShared'
import { useHephaestusEditorStore } from '../../../../core/hephaestus/store/useHephaestusEditorStore'
import { useHephPreview } from '../useHephPreview'
import { useStageStore, selectFixtures } from '../../../../stores/stageStore'
import type {
  HephAutomationClipV3,
} from '../../../../core/hephaestus/types'
import type {
  CognitiveDNA,
  SimulationMeta,
  SpatialBehavior,
} from '../../../../core/arsenal/lfxTypes'
import type { PhaseConfigPro } from '../../../../core/hephaestus/phase/PhaseConfigPro'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface LabTabProps {
  temporalActions: TemporalActions
  isSaving?: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const LabTab: React.FC<LabTabProps> = ({ temporalActions, isSaving = false }) => {
  // ── Store (canonical state) ──
  const clip = useHephaestusEditorStore(state => state.clip)
  const activeTrackId = useHephaestusEditorStore(state => state.selection.activeTrackId)
  const updatePhaseInTrack = useHephaestusEditorStore(state => state.updatePhaseInTrack)

  // ── Stage fixtures for radar preview ──
  const stageFixtures = useStageStore(selectFixtures)

  // ── Preview hook ──
  const preview = useHephPreview(clip, stageFixtures)

  // ── setClip shim ──
  const setClip = useCallback((updater: (prev: HephAutomationClipV3) => HephAutomationClipV3) => {
    const currentClip = useHephaestusEditorStore.getState().clip
    if (!currentClip) return
    const nextClip = updater(currentClip)
    useHephaestusEditorStore.setState({ clip: nextClip, isDirty: true })
  }, [])

  // ═══════════════════════════════════════════════════════════════════════
  // DERIVED
  // ═══════════════════════════════════════════════════════════════════════

  const activePhaseConfig = useMemo<PhaseConfigPro | null>(() => {
    if (!clip || !activeTrackId) return null
    const track = clip.tracks.find(t => t.id === activeTrackId)
    return track?.phaseConfig ?? null
  }, [clip, activeTrackId])

  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════

  const handlePhaseChange = useCallback((recipe: (draft: PhaseConfigPro) => void) => {
    if (!activeTrackId) return
    updatePhaseInTrack(activeTrackId, recipe)
  }, [updatePhaseInTrack, activeTrackId])

  const handleSpatialBehaviorChange = useCallback((sb: SpatialBehavior) => {
    if (!clip?.cognitiveDNA) return
    temporalActions.snapshot()
    setClip(prev => ({
      ...prev,
      cognitiveDNA: { ...prev.cognitiveDNA!, spatialBehavior: sb },
    }))
  }, [clip?.cognitiveDNA, temporalActions, setClip])

  const handleDnaChange = useCallback((dna: CognitiveDNA) => {
    temporalActions.snapshot()
    setClip(prev => ({ ...prev, cognitiveDNA: dna }))
  }, [temporalActions, setClip])

  const handleSimMetaChange = useCallback((meta: SimulationMeta) => {
    temporalActions.snapshot()
    setClip(prev => ({ ...prev, simulationMeta: meta }))
  }, [temporalActions, setClip])

  const handleEnableDna = useCallback(() => {
    temporalActions.snapshot()
    setClip(prev => ({
      ...prev,
      cognitiveDNA: DEFAULT_COGNITIVE_DNA,
      simulationMeta: DEFAULT_SIMULATION_META,
    }))
  }, [temporalActions, setClip])

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER — Camisa de Fuerza Flexbox
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div
      className="heph-lab-workspace"
      style={{
        display: 'flex',
        flex: 1,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        gap: '16px',
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      {/* ── Bastidor de Fase Izquierdo (Ancho inmutable) ── */}
      <div
        className="heph-lab-sidebar"
        style={{ width: '340px', flexShrink: 0, height: '100%', overflowY: 'auto' }}
      >
        <div style={{ marginBottom: '12px', fontSize: '12px', fontWeight: 700, color: '#64c8ff', letterSpacing: '0.1em' }}>
          🌊 PHASE DISTRIBUTION ENGINE
        </div>
        <PhaseControls
          config={activePhaseConfig}
          onPhaseChange={handlePhaseChange}
          disabled={isSaving}
          spatialBehavior={clip?.cognitiveDNA?.spatialBehavior}
          onSpatialBehaviorChange={handleSpatialBehaviorChange}
        />
      </div>

      {/* ── Escenario Central (minWidth: 0 salva al Canvas) ── */}
      <div
        className="heph-lab-stage"
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minWidth: 0,
          height: '100%',
          gap: '12px',
          overflow: 'hidden',
        }}
      >
        <div
          className="heph-radar-cage"
          style={{
            flex: 1,
            minHeight: 0,
            width: '100%',
            position: 'relative',
            display: 'flex',
          }}
        >
          <HephRadar
            preview={preview}
            durationMs={clip?.durationMs ?? 1000}
            onPlay={preview.play}
            onPause={preview.pause}
            onStop={preview.stop}
            onSeek={preview.seek}
          />
        </div>
      </div>

      {/* ── DNA Rail Derecho (Ancho inmutable) ── */}
      <div
        className="heph-lab-dna-rail"
        style={{ width: '260px', flexShrink: 0, height: '100%', overflowY: 'auto' }}
      >
        <DnaRail
          dna={clip?.cognitiveDNA}
          simMeta={clip?.simulationMeta}
          onDnaChange={handleDnaChange}
          onSimMetaChange={handleSimMetaChange}
          onEnableDna={handleEnableDna}
        />
      </div>
    </div>
  )
}
