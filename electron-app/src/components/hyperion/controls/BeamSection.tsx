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
 * Connected to MasterArbiter via window.lux.arbiter.setManual()
 */

import React, { useCallback, useState, useMemo } from 'react'
import { useSelectedArray } from '../../../stores/selectionStore'
import { useHardware } from '../../../stores/truthStore'
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
  
  // Local state
  const [gobo, setGobo] = useState(0)           // 0-255
  const [prismActive, setPrismActive] = useState(false)
  const [prismRotation, setPrismRotation] = useState(128)  // 0-255
  const [focus, setFocus] = useState(128)       // 0-255
  const [zoom, setZoom] = useState(128)         // 0-255
  const [iris, setIris] = useState(255)         // 0-255 (255 = open)
  
  // Check if selected fixtures have beam capabilities
  const hasBeamFixtures = useMemo(() => {
    const fixtures = hardware?.fixtures || []
    return selectedIds.some(id => {
      const fixture = fixtures.find((f: { id: string }) => f.id === id)
      const type = fixture?.type?.toLowerCase() || ''
      // Moving heads, spots, and beams typically have these features
      return type.includes('moving') || type.includes('spot') || 
             type.includes('beam') || type.includes('profile')
    })
  }, [selectedIds, hardware?.fixtures])
  
  // WAVE 428.5: Condición movida - NO hacer return temprano (rompe hooks)
  const shouldRender = hasBeamFixtures && selectedIds.length > 0
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS - Connect to Arbiter
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Send beam values to Arbiter
   */
  const sendBeamValues = useCallback(async (values: Record<string, number>, channels: string[]) => {
    onOverrideChange(true)
    
    try {
      await window.lux?.arbiter?.setManual({
        fixtureIds: selectedIds,
        controls: values,
        channels,
      })
    } catch (err) {
      console.error('[Beam] Error:', err)
    }
  }, [selectedIds, onOverrideChange])
  
  /**
   * Gobo change (stepped wheel)
   */
  const handleGoboChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    setGobo(value)
    await sendBeamValues({ gobo: value }, ['gobo'])
    console.log(`[Beam] 🎭 Gobo → ${value}`)
  }, [sendBeamValues])
  
  /**
   * Gobo step click (direct selection)
   */
  const handleGoboStep = useCallback(async (stepValue: number) => {
    setGobo(stepValue)
    await sendBeamValues({ gobo: stepValue }, ['gobo'])
    console.log(`[Beam] 🎭 Gobo step → ${stepValue}`)
  }, [sendBeamValues])
  
  /**
   * Prism toggle
   */
  const handlePrismToggle = useCallback(async () => {
    const newActive = !prismActive
    setPrismActive(newActive)
    await sendBeamValues({ prism: newActive ? 255 : 0 }, ['prism'])
    console.log(`[Beam] 💎 Prism → ${newActive ? 'ON' : 'OFF'}`)
  }, [prismActive, sendBeamValues])
  
  /**
   * Prism rotation change
   */
  const handlePrismRotationChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    setPrismRotation(value)
    await sendBeamValues({ prismRotation: value }, ['prismRotation'])
  }, [sendBeamValues])
  
  /**
   * Focus change
   */
  const handleFocusChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    setFocus(value)
    await sendBeamValues({ focus: value }, ['focus'])
  }, [sendBeamValues])
  
  /**
   * Zoom change
   */
  const handleZoomChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    setZoom(value)
    await sendBeamValues({ zoom: value }, ['zoom'])
  }, [sendBeamValues])
  
  /**
   * Iris change
   */
  const handleIrisChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    setIris(value)
    await sendBeamValues({ iris: value }, ['iris'])
  }, [sendBeamValues])
  
  /**
   * Release all beam controls back to AI
   */
  const handleRelease = useCallback(async () => {
    onOverrideChange(false)
    
    try {
      await window.lux?.arbiter?.clearManual({
        fixtureIds: selectedIds,
        channels: ['gobo', 'prism', 'prismRotation', 'focus', 'zoom', 'iris'],
      })
      console.log(`[Beam] 🔓 Released for ${selectedIds.length} fixtures`)
    } catch (err) {
      console.error('[Beam] Release error:', err)
    }
  }, [selectedIds, onOverrideChange])
  
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
              <button
                className={`prism-toggle ${prismActive ? 'active' : ''}`}
                onClick={handlePrismToggle}
              >
                {prismActive ? 'ON' : 'OFF'}
              </button>
            </div>
            
            {/* Rotation slider - only active when prism is on */}
            <div className={`prism-rotation ${!prismActive ? 'disabled' : ''}`}>
              <span className="rotation-label">ROTATION</span>
              <input
                type="range"
                className="beam-slider rotation-slider"
                min={0}
                max={255}
                value={prismRotation}
                onChange={handlePrismRotationChange}
                disabled={!prismActive}
              />
              <span className="rotation-value">{Math.round((prismRotation / 255) * 100)}%</span>
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
