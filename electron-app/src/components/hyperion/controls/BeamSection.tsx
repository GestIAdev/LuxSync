/**
 * 🔦 BEAM SECTION - WAVE 430
 * Optical control for moving heads: Gobos, Prism, Focus, Zoom
 * 
 * Features:
 * - COLLAPSIBLE section header
 * - Gobo: Pattern wheel (steps 0-7)
 * - Prism: Split the beam, spin it
 * - Focus: Near to far
 * - Zoom: Spot to flood
 * - Iris: Control beam diameter (optional)
 * 
 * Connected to Aether L2 via programmerStore + ProgrammerAetherBridge
 */

import React, { useCallback, useMemo } from 'react'
import { useSelectedArray } from '../../../stores/selectionStore'
import { useHardware } from '../../../stores/truthStore'
import { useProgrammerStore } from '../../../stores/programmerStore'
import { BeamIcon } from '../../icons/LuxIcons'

export interface BeamSectionProps {
  hasOverride: boolean
  isExpanded: boolean
  onToggle: () => void
  onOverrideChange: (hasOverride: boolean) => void
}

// Gobo steps (8 positions on typical wheel)
const GOBO_STEPS = [
  { value: 0, label: 'OPEN' },
  { value: 36, label: '1' },
  { value: 72, label: '2' },
  { value: 108, label: '3' },
  { value: 144, label: '4' },
  { value: 180, label: '5' },
  { value: 216, label: '6' },
  { value: 255, label: '7' },
]

export const BeamSection: React.FC<BeamSectionProps> = ({
  hasOverride,
  isExpanded,
  onToggle,
  onOverrideChange,
}) => {
  // 🛡️ WAVE 2042.13.13: Fixed - Use stable hook
  const selectedIds = useSelectedArray()
  const hardware = useHardware() // 🛡️ WAVE 2042.12: React 19 stable hook
  const fixtureOverrides = useProgrammerStore(s => s.fixtureOverrides)

  const clamp255 = useCallback((v: number) => Math.max(0, Math.min(255, Math.round(v))), [])
  const denorm255 = useCallback((v: number | null, fallback: number) => {
    if (v === null || v === undefined) return fallback
    return clamp255(v * 255)
  }, [clamp255])

  const firstSelectedId = selectedIds[0]
  const firstOverride = firstSelectedId ? fixtureOverrides.get(firstSelectedId) : null

  // Valores de UI derivados del estado real hidratado (L2 snapshot + cambios locales).
  const gobo = denorm255(firstOverride?.gobo ?? null, 0)
  const prismValue = denorm255(firstOverride?.prism ?? null, 0)
  const focus = denorm255(firstOverride?.focus ?? null, 128)
  const zoom = denorm255(firstOverride?.zoom ?? null, 128)
  const iris = denorm255(firstOverride?.iris ?? null, 255)
  
  // Check if selected fixtures have beam capabilities
  const hasBeamFixtures = useMemo(() => {
    const fixtures = hardware?.fixtures || []
    return selectedIds.some(id => {
      const fixture = fixtures.find((f: { id: string }) => f.id === id) as
        | { type?: string; channels?: Array<{ type?: string }> }
        | undefined

      const channelTypes = new Set(
        (fixture?.channels ?? [])
          .map(ch => (ch?.type ?? '').toLowerCase())
          .filter(Boolean),
      )

      const hasBeamChannels =
        channelTypes.has('gobo') ||
        channelTypes.has('gobo_rotation') ||
        channelTypes.has('prism') ||
        channelTypes.has('prism_rotation') ||
        channelTypes.has('focus') ||
        channelTypes.has('zoom') ||
        channelTypes.has('iris') ||
        channelTypes.has('frost')

      if (hasBeamChannels) return true

      const type = fixture?.type?.toLowerCase() || ''
      return type.includes('moving') || type.includes('spot') || 
             type.includes('beam') || type.includes('profile')
    })
  }, [selectedIds, hardware?.fixtures])
  
  // WAVE 428.5: Condición movida - NO hacer return temprano (rompe hooks)
  const shouldRender = hasBeamFixtures && selectedIds.length > 0
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS - Connect to Arbiter
  // ═══════════════════════════════════════════════════════════════════════
  
  // ─── WAVE 4529: Beam handlers → programmerStore ─────────────────────────

  /**
   * Gobo change (stepped wheel)
   */
  const handleGoboChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    onOverrideChange(true)
    useProgrammerStore.getState().setBeam('gobo', value)
  }, [onOverrideChange])
  
  /**
   * Gobo step click (direct selection)
   */
  const handleGoboStep = useCallback((stepValue: number) => {
    onOverrideChange(true)
    useProgrammerStore.getState().setBeam('gobo', stepValue)
  }, [onOverrideChange])
  
  /**
   * Prism direct control (0=off, 122-255=active+speed)
   */
  const handlePrismChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    onOverrideChange(true)
    useProgrammerStore.getState().setBeam('prism', value)
  }, [onOverrideChange])
  
  /**
   * Focus change
   */
  const handleFocusChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    onOverrideChange(true)
    useProgrammerStore.getState().setBeam('focus', value)
  }, [onOverrideChange])
  
  /**
   * Zoom change
   */
  const handleZoomChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    onOverrideChange(true)
    useProgrammerStore.getState().setBeam('zoom', value)
  }, [onOverrideChange])
  
  /**
   * Iris change
   */
  const handleIrisChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    onOverrideChange(true)
    useProgrammerStore.getState().setBeam('iris', value)
  }, [onOverrideChange])
  
  /**
   * Release all beam controls back to AI
   * WAVE 4529: Vía programmerStore.
   */
  const handleRelease = useCallback(() => {
    onOverrideChange(false)
    useProgrammerStore.getState().releaseBeam()
  }, [onOverrideChange])
  
  // Find closest gobo step for display
  const currentGoboStep = GOBO_STEPS.reduce((prev, curr) => 
    Math.abs(curr.value - gobo) < Math.abs(prev.value - gobo) ? curr : prev
  )
  
  // WAVE 428.5: Condición de render al final (después de todos los hooks)
  if (!shouldRender) {
    return null
  }
  
  return (
    <div className={`programmer-section beam-section ${hasOverride ? 'has-override' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="section-header clickable" onClick={onToggle}>
        <h4 className="section-title">
          <span className="section-icon">{isExpanded ? '▼' : '▶'}</span>
          <BeamIcon size={18} className="title-icon" />
          BEAM / OPTICS
        </h4>
        <div className="header-right">
          {hasOverride && (
            <button 
              className="release-btn"
              onClick={(e) => {
                e.stopPropagation()
                handleRelease()
              }}
              title="Release to AI control"
            >
              ↺
            </button>
          )}
        </div>
      </div>
      
      {isExpanded && (
        <>
          {/* ═══════════════════════════════════════════════════════════════════
              GOBO WHEEL
              ═══════════════════════════════════════════════════════════════════ */}
          <div className="beam-control gobo-control">
            <div className="control-header">
              <label className="control-label">GOBO</label>
              <span className="control-value">{currentGoboStep.label}</span>
            </div>
            
            {/* Gobo step buttons */}
            <div className="gobo-steps">
              {GOBO_STEPS.map(step => (
                <button
                  key={step.value}
                  className={`gobo-step ${gobo === step.value ? 'active' : ''}`}
                  onClick={() => handleGoboStep(step.value)}
                  title={`Gobo ${step.label}`}
                >
                  {step.label}
                </button>
              ))}
            </div>
            
            {/* Gobo slider for fine control */}
            <input
              type="range"
              className="beam-slider gobo-slider"
              min={0}
              max={255}
              value={gobo}
              onChange={handleGoboChange}
            />
          </div>
          
          {/* ═══════════════════════════════════════════════════════════════════
              PRISM CONTROL
              ═══════════════════════════════════════════════════════════════════ */}
          <div className="beam-control prism-control">
            <div className="control-header">
              <label className="control-label">PRISM</label>
              <span className="control-value">
                {prismValue === 0 ? 'OFF' : prismValue < 122 ? `${prismValue}` : `⟳ ${prismValue}`}
              </span>
            </div>
            
            {/* Single slider: 0=off, 1-121=pattern select, 122-255=active+speed */}
            <div className="prism-slider-wrap">
              <input
                type="range"
                className="beam-slider prism-slider"
                min={0}
                max={255}
                value={prismValue}
                onChange={handlePrismChange}
              />
              <div className="prism-markers">
                <span className="prism-marker" style={{ left: '0%' }}>OFF</span>
                <span className="prism-marker" style={{ left: '47.8%' }}>122</span>
                <span className="prism-marker" style={{ left: '100%' }}>255</span>
              </div>
            </div>
          </div>
          
          {/* ═══════════════════════════════════════════════════════════════════
              FOCUS & ZOOM
              ═══════════════════════════════════════════════════════════════════ */}
          <div className="beam-control optics-control">
            {/* Focus */}
            <div className="optic-row">
              <label className="optic-label">FOCUS</label>
              <span className="optic-range-label near">Near</span>
              <input
                type="range"
                className="beam-slider focus-slider"
                min={0}
                max={255}
                value={focus}
                onChange={handleFocusChange}
              />
              <span className="optic-range-label far">Far</span>
              <span className="optic-value">{Math.round((focus / 255) * 100)}%</span>
            </div>
            
            {/* Zoom */}
            <div className="optic-row">
              <label className="optic-label">ZOOM</label>
              <span className="optic-range-label spot">Spot</span>
              <input
                type="range"
                className="beam-slider zoom-slider"
                min={0}
                max={255}
                value={zoom}
                onChange={handleZoomChange}
              />
              <span className="optic-range-label flood">Flood</span>
              <span className="optic-value">{Math.round((zoom / 255) * 100)}%</span>
            </div>
            
            {/* Iris */}
            <div className="optic-row">
              <label className="optic-label">IRIS</label>
              <span className="optic-range-label closed">Closed</span>
              <input
                type="range"
                className="beam-slider iris-slider"
                min={0}
                max={255}
                value={iris}
                onChange={handleIrisChange}
              />
              <span className="optic-range-label open">Open</span>
              <span className="optic-value">{Math.round((iris / 255) * 100)}%</span>
            </div>
          </div>
          
          {/* Override indicator */}
          {hasOverride && (
            <div className="override-badge">MANUAL</div>
          )}
        </>
      )}
    </div>
  )
}

export default BeamSection
