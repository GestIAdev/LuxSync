/**
 * 🕹️ POSITION SECTION - WAVE 375.4 + WAVE 377 (Calibration)
 * Movement control for selected fixtures (moving heads)
 * 
 * Architecture:
 * - XY Pad: Direct position control (the sniper)
 * - Patterns: Circle, Eight, Sweep (procedural movement)
 * - Group Radar: Center of gravity + fan (group formations)
 * - Precision: Numeric inputs for exact values
 * - Calibrate: Enter calibration mode for offset adjustment
 * 
 * Connected to MasterArbiter via window.lux.arbiter.setManual()
 */

import React, { useCallback, useState, useEffect, useMemo } from 'react'
import { useSelectionStore } from '../../stores/selectionStore'
import { useTruthStore, selectHardware } from '../../stores/truthStore'
import { XYPad } from './controls'
import { PatternSelector, type PatternType } from './controls'
import { PrecisionInputs } from './controls'

export interface PositionSectionProps {
  hasOverride: boolean
  onOverrideChange: (hasOverride: boolean) => void
}

export const PositionSection: React.FC<PositionSectionProps> = ({
  hasOverride,
  onOverrideChange,
}) => {
  // Selection
  const selectedIds = useSelectionStore(state => [...state.selectedIds])
  const hardware = useTruthStore(selectHardware)
  
  // Local state
  const [pan, setPan] = useState(270)    // 0-540 degrees
  const [tilt, setTilt] = useState(135)  // 0-270 degrees
  const [activePattern, setActivePattern] = useState<PatternType>('static')
  const [patternSpeed, setPatternSpeed] = useState(50)  // 0-100
  const [patternSize, setPatternSize] = useState(50)    // 0-100
  
  // WAVE 377: Calibration mode state
  const [isCalibrating, setIsCalibrating] = useState(false)
  
  // Check if selected fixtures are moving heads
  const hasMovingHeads = useMemo(() => {
    const fixtures = hardware?.fixtures || []
    return selectedIds.some(id => {
      const fixture = fixtures.find((f: { id: string }) => f.id === id)
      const type = fixture?.type?.toLowerCase() || ''
      return type.includes('moving') || type.includes('spot') || type.includes('beam') || type.includes('wash')
    })
  }, [selectedIds, hardware?.fixtures])
  
  // WAVE 428.5: Condición movida - NO hacer return temprano (rompe hooks)
  const shouldRender = hasMovingHeads && selectedIds.length > 0
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS - Connect to Arbiter
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * XY Pad change - Direct position control
   */
  const handlePositionChange = useCallback(async (newPan: number, newTilt: number) => {
    setPan(newPan)
    setTilt(newTilt)
    onOverrideChange(true)
    
    // Clear any active pattern when manually positioning
    if (activePattern !== 'static') {
      setActivePattern('static')
    }
    
    try {
      await window.lux?.arbiter?.setManual({
        fixtureIds: selectedIds,
        controls: {
          pan: Math.round((newPan / 540) * 65535),   // Convert to 16-bit
          tilt: Math.round((newTilt / 270) * 65535), // Convert to 16-bit
        },
        channels: ['pan', 'tilt'],
        source: 'ui_programmer',
      })
      console.log(`[Position] 🕹️ Pan: ${newPan}° Tilt: ${newTilt}°`)
    } catch (err) {
      console.error('[Position] Error:', err)
    }
  }, [selectedIds, activePattern, onOverrideChange])
  
  /**
   * Pattern change - Procedural movement
   * Note: Full pattern engine is in Arbiter (WAVE 376)
   * For now, we send the pattern type and let backend handle it
   */
  const handlePatternChange = useCallback(async (pattern: PatternType) => {
    setActivePattern(pattern)
    
    if (pattern === 'static') {
      // Just set current position
      await handlePositionChange(pan, tilt)
      return
    }
    
    onOverrideChange(true)
    
    try {
      // Send pattern config to Arbiter
      // The Arbiter will generate frames at 60fps
      await window.lux?.arbiter?.setManual({
        fixtureIds: selectedIds,
        controls: {
          pan: Math.round((pan / 540) * 65535),
          tilt: Math.round((tilt / 270) * 65535),
          // Pattern params encoded as special controls
          _patternType: pattern === 'circle' ? 1 : pattern === 'eight' ? 2 : 3,
          _patternSpeed: patternSpeed,
          _patternSize: patternSize,
        },
        channels: ['pan', 'tilt'],
        source: 'ui_programmer',
      })
      console.log(`[Position] 🔄 Pattern: ${pattern} Speed: ${patternSpeed}% Size: ${patternSize}%`)
    } catch (err) {
      console.error('[Position] Pattern error:', err)
    }
  }, [selectedIds, pan, tilt, patternSpeed, patternSize, onOverrideChange, handlePositionChange])
  
  /**
   * Pattern speed/size change
   */
  const handlePatternParamsChange = useCallback(async (speed: number, size: number) => {
    setPatternSpeed(speed)
    setPatternSize(size)
    
    if (activePattern !== 'static') {
      // Re-send pattern with new params
      await handlePatternChange(activePattern)
    }
  }, [activePattern, handlePatternChange])
  
  /**
   * Center position
   */
  const handleCenter = useCallback(() => {
    handlePositionChange(270, 135) // Center of range
  }, [handlePositionChange])
  
  /**
   * Release position back to AI
   */
  const handleRelease = useCallback(async () => {
    onOverrideChange(false)
    setActivePattern('static')
    setIsCalibrating(false)
    
    try {
      await window.lux?.arbiter?.clearManual({
        fixtureIds: selectedIds,
        channels: ['pan', 'tilt'],
      })
      console.log(`[Position] 🔓 Released for ${selectedIds.length} fixtures`)
    } catch (err) {
      console.error('[Position] Release error:', err)
    }
  }, [selectedIds, onOverrideChange])
  
  /**
   * WAVE 377: Toggle calibration mode
   * In calibration mode, the XY pad controls the fixture directly
   * for adjusting mounting offsets.
   */
  const handleCalibrationToggle = useCallback(async () => {
    const electron = (window as any).electron
    const firstFixtureId = selectedIds[0]
    
    if (!firstFixtureId) return
    
    try {
      if (isCalibrating) {
        // Exit calibration mode
        await electron?.ipcRenderer?.invoke?.('lux:arbiter:exitCalibrationMode', {
          fixtureId: firstFixtureId
        })
        setIsCalibrating(false)
        onOverrideChange(false)
        console.log(`[Position] 🎯 Exited calibration mode for ${firstFixtureId}`)
      } else {
        // Enter calibration mode
        await electron?.ipcRenderer?.invoke?.('lux:arbiter:enterCalibrationMode', {
          fixtureId: firstFixtureId
        })
        setIsCalibrating(true)
        onOverrideChange(true)
        // Center the position when entering calibration
        setPan(270)
        setTilt(135)
        console.log(`[Position] 🎯 Entered calibration mode for ${firstFixtureId}`)
      }
    } catch (err) {
      console.error('[Position] Calibration error:', err)
    }
  }, [selectedIds, isCalibrating, onOverrideChange])
  
  // WAVE 428.5: Condición de render al final (después de todos los hooks)
  if (!shouldRender) {
    return null
  }
  
  return (
    <div className={`programmer-section position-section ${hasOverride ? 'has-override' : ''} ${isCalibrating ? 'calibrating' : ''}`}>
      <div className="section-header">
        <h4 className="section-title">
          <span className="section-icon">🕹️</span>
          POSITION
          {isCalibrating && <span className="calibration-indicator"> 🎯 CALIBRATING</span>}
        </h4>
        <div className="section-actions">
          {/* WAVE 377: Calibration Button */}
          <button
            className={`calibrate-btn ${isCalibrating ? 'active' : ''}`}
            onClick={handleCalibrationToggle}
            title={isCalibrating ? 'Exit calibration mode' : 'Enter calibration mode'}
          >
            🎯
          </button>
          {hasOverride && (
            <button 
              className="release-btn"
              onClick={handleRelease}
              title="Release to AI control"
            >
              ↺
            </button>
          )}
        </div>
      </div>
      
      {/* XY PAD - The Sniper */}
      <XYPad
        pan={pan}
        tilt={tilt}
        onChange={handlePositionChange}
        onCenter={handleCenter}
      />
      
      {/* PATTERNS - Procedural Movement (disabled in calibration mode) */}
      {!isCalibrating && (
        <PatternSelector
          activePattern={activePattern}
          speed={patternSpeed}
          size={patternSize}
          onPatternChange={handlePatternChange}
          onParamsChange={handlePatternParamsChange}
        />
      )}
      
      {/* PRECISION INPUTS - The Surgeon */}
      <PrecisionInputs
        pan={pan}
        tilt={tilt}
        onChange={handlePositionChange}
      />
      
      {/* Override indicator */}
      {hasOverride && !isCalibrating && (
        <div className="override-badge">MANUAL</div>
      )}
      
      {/* Calibration badge */}
      {isCalibrating && (
        <div className="calibration-badge">🎯 CALIBRATION MODE</div>
      )}
    </div>
  )
}

export default PositionSection
