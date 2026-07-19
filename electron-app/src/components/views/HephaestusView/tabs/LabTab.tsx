/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ LAB TAB — WAVE 7011: DAW LAYOUT TIER 3B
 * Laboratory workspace: PhaseControls + QuantumSpectrometer + DnaRail
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

import React, { useMemo, useCallback, useState } from 'react'
import { PhaseControls } from '../PhaseControls'
import { QuantumSpectrometer } from '../QuantumSpectrometer'
import { DnaRail, DEFAULT_COGNITIVE_DNA, DEFAULT_SIMULATION_META } from '../dna/DnaRail'
import type { TemporalActions } from '../types/HephaestusShared'
import { useHephaestusEditorStore } from '../../../../core/hephaestus/store/useHephaestusEditorStore'
import { useStageStore, selectFixtures } from '../../../../stores/stageStore'
import { WaveformIcon } from '../../../icons/LuxIcons'
import type { HephPreviewReturn } from '../useHephPreview'
import type {
  HephAutomationClipV3,
} from '../../../../core/hephaestus/types'
import type {
  CognitiveDNA,
  SimulationMeta,
  SpatialBehavior,
} from '../../../../core/arsenal/lfxTypes'
import type { PhaseConfigPro } from '../../../../core/hephaestus/phase/PhaseConfigPro'
import type { PhaseOverride } from '../../../../core/hephaestus/phase/PhaseOverride'
import { resolveZoneTags } from '../../../../core/zones/ZoneMapper'
import { getZoneBadgeText, getZoneBadgeIcon } from '../SmartZoneSelector'
import type { EffectZone } from '../../../../core/effects/types'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface LabTabProps {
  temporalActions: TemporalActions
  isSaving?: boolean
  preview: HephPreviewReturn
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const LabTab: React.FC<LabTabProps> = ({ temporalActions, isSaving = false, preview }) => {
  // ── Store (canonical state) ──
  const clip = useHephaestusEditorStore(state => state.clip)
  const activeTrackId = useHephaestusEditorStore(state => state.selection.activeTrackId)
  const selectTrack = useHephaestusEditorStore(state => state.selectTrack)
  const updatePhaseInTrack = useHephaestusEditorStore(state => state.updatePhaseInTrack)
  const updatePhaseOverride = useHephaestusEditorStore(state => state.updatePhaseOverride)
  const clearPhaseOverrides = useHephaestusEditorStore(state => state.clearPhaseOverrides)
  const bakePhaseOverrides = useHephaestusEditorStore(state => state.bakePhaseOverrides)

  // ── Stage fixtures for radar preview ──
  const stageFixtures = useStageStore(selectFixtures)

  // ── Quantum Spectrometer selection state ──
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null)

  // ── setClip shim ──
  const setClip = useCallback((updater: (prev: HephAutomationClipV3) => HephAutomationClipV3) => {
    const { mutate, clip: currentClip } = useHephaestusEditorStore.getState()
    if (!currentClip) return
    mutate('Edit clip', (draft) => {
      return updater(draft as HephAutomationClipV3)
    })
  }, [])

  // ═══════════════════════════════════════════════════════════════════════
  // DERIVED
  // ═══════════════════════════════════════════════════════════════════════

  const activePhaseConfig = useMemo<PhaseConfigPro | null>(() => {
    if (!clip || !activeTrackId) return null
    const track = clip.tracks.find(t => t.id === activeTrackId)
    return track?.phaseConfig ?? null
  }, [clip, activeTrackId])

  const activeTrack = useMemo(() => {
    if (!clip || !activeTrackId) return null
    return clip.tracks.find(t => t.id === activeTrackId) ?? null
  }, [clip, activeTrackId])

  const activePhaseOverrides = activeTrack?.phaseOverrides

  // Resolve fixture IDs for the active track's zones
  const phaseFixtureIds = useMemo(() => {
    if (!clip || !activeTrack) return []
    const zones = activeTrack.zones.map(String)
    // Use stage fixtures to resolve zone tags
    const mappable = stageFixtures.map(f => ({
      id: f.id,
      zone: (f as any).zone ?? 'all',
      enabled: (f as any).enabled,
      position: (f as any).position ? { x: (f as any).position.x } : undefined,
    }))
    try {
      return resolveZoneTags(zones, mappable)
    } catch {
      return stageFixtures.map(f => f.id)
    }
  }, [clip, activeTrack, stageFixtures])

  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════

  const handlePhaseChange = useCallback((recipe: (draft: PhaseConfigPro) => void) => {
    if (!activeTrackId) return
    updatePhaseInTrack(activeTrackId, recipe)
  }, [updatePhaseInTrack, activeTrackId])

  const handleUpdatePhaseOverride = useCallback((fixtureId: string, override: PhaseOverride | null) => {
    if (!activeTrackId) return
    updatePhaseOverride(activeTrackId, fixtureId, override)
  }, [updatePhaseOverride, activeTrackId])

  const handleBakePhaseOverrides = useCallback(() => {
    if (!activeTrackId || !activePhaseConfig || !clip) return
    bakePhaseOverrides(activeTrackId, phaseFixtureIds, activePhaseConfig, clip.durationMs)
  }, [activeTrackId, activePhaseConfig, clip, phaseFixtureIds, bakePhaseOverrides])

  const handleClearPhaseOverrides = useCallback(() => {
    if (!activeTrackId) return
    clearPhaseOverrides(activeTrackId)
  }, [activeTrackId, clearPhaseOverrides])

  const handleSpatialBehaviorChange = useCallback((sb: SpatialBehavior) => {
    if (!clip?.cognitiveDNA) return
    setClip(prev => ({
      ...prev,
      cognitiveDNA: { ...prev.cognitiveDNA!, spatialBehavior: sb },
    }))
  }, [clip?.cognitiveDNA, setClip])

  const handleDnaChange = useCallback((dna: CognitiveDNA) => {
    setClip(prev => ({ ...prev, cognitiveDNA: dna }))
  }, [setClip])

  const handleSimMetaChange = useCallback((meta: SimulationMeta) => {
    setClip(prev => ({ ...prev, simulationMeta: meta }))
  }, [setClip])

  const handleEnableDna = useCallback(() => {
    setClip(prev => ({
      ...prev,
      cognitiveDNA: DEFAULT_COGNITIVE_DNA,
      simulationMeta: DEFAULT_SIMULATION_META,
    }))
  }, [setClip])

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER — Camisa de Fuerza Flexbox
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div
      className="heph-lab-workspace"
      style={{
        display: 'flex',
        flexDirection: 'row',
        flex: 1,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        gap: '4px',
        padding: '4px',
        background: 'transparent',
        boxSizing: 'border-box',
      }}
    >
      {/* ── Bastidor de Fase Izquierdo ── */}
      <div
        className="heph-lab-sidebar"
        style={{ width: '340px', flexShrink: 0, height: '100%', overflow: 'hidden', borderRight: '1px solid rgba(255, 107, 43, 0.1)', display: 'flex', flexDirection: 'column', padding: '4px', boxSizing: 'border-box' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '12px', fontWeight: 700, color: 'rgba(255, 107, 43, 0.6)', letterSpacing: '0.1em', flexShrink: 0 }}>
          <WaveformIcon size={16} color="rgba(255, 107, 43, 0.6)" />
          PHASE DISTRIBUTION ENGINE
        </div>

        {/* Track selector — lets user pick which track's phase config to edit */}
        <div style={{ marginBottom: '6px', flexShrink: 0, height: '38px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
          <label style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255, 107, 43, 0.4)', letterSpacing: '0.12em', display: 'block', marginBottom: '2px', fontFamily: '"Rajdhani", "Eurostile", sans-serif', lineHeight: '11px' }}>ACTIVE TRACK</label>
          <select
            value={activeTrackId ?? ''}
            onChange={(e) => selectTrack(e.target.value || null)}
            disabled={isSaving}
            style={{
              width: '100%',
              height: '24px',
              background: 'rgba(0,0,0,0.5)',
              color: '#FF6B2B',
              border: '1px solid rgba(255, 107, 43, 0.25)',
              borderRadius: '4px',
              padding: '0 24px 0 8px',
              fontSize: '11px',
              fontFamily: '"Rajdhani", "Eurostile", "Orbitron", sans-serif',
              fontWeight: 600,
              letterSpacing: '0.06em',
              cursor: 'pointer',
              boxSizing: 'border-box',
              lineHeight: '22px',
              outline: 'none',
              appearance: 'none',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\' viewBox=\'0 0 10 6\'><path d=\'M1 1l4 4 4-4\' stroke=\'%23FF6B2B\' stroke-width=\'1.5\' fill=\'none\' opacity=\'0.6\'/></svg>")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
            }}
          >
            {clip?.tracks.map(t => {
              const zoneText = getZoneBadgeText(t.zones as EffectZone[])
              return (
              <option key={t.id} value={t.id} style={{ background: '#0a0a0f', color: '#FF6B2B', fontSize: '11px', fontFamily: '"Rajdhani", sans-serif' }}>
                {t.paramId.toUpperCase()} — {zoneText}
              </option>
              )
            }) ?? <option value="">No tracks</option>}
          </select>
        </div>

        {/* WAVE 7161: Zone badge — shows which fixture group the phase distributor targets */}
        {activeTrack && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '6px',
            flexShrink: 0,
            padding: '4px 8px',
            background: 'rgba(255, 107, 43, 0.06)',
            border: '1px solid rgba(255, 107, 43, 0.15)',
            borderRadius: '4px',
            fontSize: '10px',
            fontFamily: '"Rajdhani", "Eurostile", sans-serif',
            fontWeight: 600,
            color: '#ff8c42',
            letterSpacing: '0.06em',
          }}>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              {getZoneBadgeIcon(activeTrack.zones as EffectZone[])}
            </span>
            <span>PHASE TARGET:</span>
            <span style={{ color: '#fff', fontWeight: 700 }}>
              {getZoneBadgeText(activeTrack.zones as EffectZone[])}
            </span>
            <span style={{ color: 'rgba(255,107,43,0.4)', fontSize: '9px' }}>
              ({activeTrack.paramId.toUpperCase()})
            </span>
          </div>
        )}

        <div className="heph-lab-phase-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <PhaseControls
            config={activePhaseConfig}
            onPhaseChange={handlePhaseChange}
            disabled={isSaving}
            spatialBehavior={clip?.cognitiveDNA?.spatialBehavior}
            onSpatialBehaviorChange={handleSpatialBehaviorChange}
            fixtureIds={phaseFixtureIds}
            durationMs={clip?.durationMs}
            phaseOverrides={activePhaseOverrides}
            selectedFixtureId={selectedFixtureId}
            onSelectFixture={setSelectedFixtureId}
            onUpdatePhaseOverride={handleUpdatePhaseOverride}
            onBakePhaseOverrides={handleBakePhaseOverrides}
            onClearPhaseOverrides={handleClearPhaseOverrides}
          />
        </div>
      </div>

      {/* ── Escenario Central Radar ── */}
      <div
        className="heph-lab-stage"
        style={{ display: 'flex', flex: 1, minWidth: 0, height: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
      >
        <div style={{ width: '100%', height: '100%', display: 'flex' }}>
          <QuantumSpectrometer
            preview={preview}
            previewDataRef={preview.previewDataRef}
            durationMs={clip?.durationMs ?? 1000}
            selectedFixtureId={selectedFixtureId}
            onSelectFixture={setSelectedFixtureId}
            onPlay={preview.play}
            onPause={preview.pause}
            onStop={preview.stop}
            onSeek={preview.seek}
            phaseConfig={activePhaseConfig}
            tracks={clip?.tracks}
            activeTrackId={activeTrackId}
            onSelectTrack={selectTrack}
          />
        </div>
      </div>

      {/* ── Bastidor ADN Derecho (Ensanchado a 310px) ── */}
      <div
        className="heph-lab-dna-rail"
        style={{ width: '310px', flexShrink: 0, height: '100%', overflowY: 'auto', borderLeft: '1px solid rgba(255, 107, 43, 0.1)' }}
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
