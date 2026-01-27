/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 CALIBRATION VIEW - WAVE 425
 * "El Taller del Francotirador"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Vista dedicada para calibración de hardware:
 * - RadarXY: Control Pan/Tilt expandido con visual targeting
 * - FixtureList: Lista de fixtures con selección
 * - TestPanel: Botones de prueba (color, strobe, gobo)
 * - OffsetPanel: Ajustes de offset de instalación
 * 
 * Diseño: 2 columnas
 * - Izquierda (320px): Fixture List + Offset Panel
 * - Centro: RadarXY (grande, protagonista)
 * - Derecha (280px): Test Panel + Quick Actions
 * 
 * @module components/views/CalibrationView
 * @version 425.0.0
 */

import React, { useState, useCallback, useMemo } from 'react'
import { useTruthStore, selectHardware } from '../../../stores/truthStore'
import { useSelectionStore } from '../../../stores/selectionStore'
import { useStageStore } from '../../../stores/stageStore'
import { RadarXY, FixtureList, TestPanel, OffsetPanel } from './components'
import './CalibrationView.css'

// ═══════════════════════════════════════════════════════════════════════════
// MAIN VIEW COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const CalibrationView: React.FC = () => {
  // Store connections
  const hardware = useTruthStore(selectHardware)
  const selectedIds = useSelectionStore(state => state.selectedIds)
  const selectFixture = useSelectionStore(state => state.select)
  // 🛡️ WAVE 1008.3: SAFETY CONSTANTS (95% of EL-1140 physical max)
  const SAFE_PAN_MAX = 513   // 95% of 540° - protects motor from strain
  const SAFE_TILT_MAX = 256  // 95% of 270° - protects motor from strain
  
  // Local state (center position = 50% of safe range)
  const [pan, setPan] = useState(Math.round(SAFE_PAN_MAX / 2))     // ~256° center
  const [tilt, setTilt] = useState(Math.round(SAFE_TILT_MAX / 2))  // ~128° center
  const [isCalibrating, setIsCalibrating] = useState(false)
  
  // Get fixtures from hardware
  const fixtures = useMemo(() => {
    return hardware?.fixtures || []
  }, [hardware?.fixtures])
  
  // Filter to moving heads (calibratable fixtures)
  const calibratableFixtures = useMemo(() => {
    return fixtures.filter((f: { type?: string }) => {
      const type = (f.type || '').toLowerCase()
      return type.includes('moving') || type.includes('spot') || type.includes('beam') || type.includes('wash')
    })
  }, [fixtures])
  
  // Get first selected fixture for calibration
  const activeFixtureId = selectedIds.size > 0 ? [...selectedIds][0] : null
  const activeFixture = useMemo(() => {
    if (!activeFixtureId) return null
    return fixtures.find((f: { id: string }) => f.id === activeFixtureId) || null
  }, [activeFixtureId, fixtures])
  
  // 🔥 WAVE 1008: Get full fixture data from stageStore for DMX info
  const stageFixture = useStageStore(state => {
    const fixtures = state.fixtures || []
    return fixtures.find(f => f.id === activeFixtureId) || null
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔥 WAVE 1008.1: POSITION CHANGE VIA ARBITER (like Commander)
  // The Arbiter route WORKS, direct DMX doesn't in some contexts
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Handle position change from RadarXY
   * Uses Arbiter.setManual like the Commander XYPad (which works!)
   * 
   * 🛡️ WAVE 1008.3: SAFETY LIMITS
   * EL-1140 specs: Pan 540° max, Tilt 270° max
   * Safety margin: 95% = Pan 513° max, Tilt 256° max
   * DMX clamps: Pan 242 max, Tilt 241 max (to protect motor belts!)
   */
  const handlePositionChange = useCallback(async (newPan: number, newTilt: number) => {
    // 🛡️ Safety clamps: 95% of max physical range
    const SAFE_PAN_MAX = 513   // 95% of 540°
    const SAFE_TILT_MAX = 256  // 95% of 270°
    
    const safePan = Math.max(0, Math.min(SAFE_PAN_MAX, newPan))
    const safeTilt = Math.max(0, Math.min(SAFE_TILT_MAX, newTilt))
    
    setPan(safePan)
    setTilt(safeTilt)
    
    if (!activeFixtureId) return
    
    // Convert degrees to DMX (0-255) with safety cap
    const panDmx = Math.min(242, Math.round((safePan / 540) * 255))   // Max 242 DMX
    const tiltDmx = Math.min(241, Math.round((safeTilt / 270) * 255)) // Max 241 DMX
    
    console.log(`[Calibration] 🎯 Pan: ${safePan}° (DMX ${panDmx}) Tilt: ${safeTilt}° (DMX ${tiltDmx})`)
    
    try {
      // 🔥 WAVE 1008.2: Include SPEED=0 for fast movement response!
      // EL-1140 manual: CH5 = Pan Tilt Speed (0=fast, 255=slow)
      const command = {
        fixtureIds: [activeFixtureId],
        controls: {
          pan: panDmx,
          tilt: tiltDmx,
          speed: 0,  // 🚀 MAX SPEED for instant response during calibration
        },
        channels: ['pan', 'tilt', 'speed'],
      }
      console.log(`[Calibration] 📤 Sending to Arbiter:`, command)
      await window.lux?.arbiter?.setManual(command)
      console.log(`[Calibration] ✅ Arbiter command sent`)
    } catch (err) {
      console.error('[Calibration] ❌ Position error:', err)
    }
  }, [activeFixtureId])
  
  /**
   * Center position (50% of safe range)
   * 🛡️ WAVE 1008.3: Uses safe range, not physical max
   */
  const handleCenter = useCallback(() => {
    const centerPan = Math.round(SAFE_PAN_MAX / 2)   // ~256°
    const centerTilt = Math.round(SAFE_TILT_MAX / 2) // ~128°
    handlePositionChange(centerPan, centerTilt)
  }, [handlePositionChange])
  
  /**
   * Toggle calibration mode
   */
  const handleCalibrationToggle = useCallback(async () => {
    if (!activeFixtureId) return
    
    const electron = (window as any).electron
    
    try {
      if (isCalibrating) {
        await electron?.ipcRenderer?.invoke?.('lux:arbiter:exitCalibrationMode', {
          fixtureId: activeFixtureId
        })
        setIsCalibrating(false)
        console.log(`[Calibration] 🎯 Exited calibration mode`)
      } else {
        await electron?.ipcRenderer?.invoke?.('lux:arbiter:enterCalibrationMode', {
          fixtureId: activeFixtureId
        })
        setIsCalibrating(true)
        handleCenter()
        console.log(`[Calibration] 🎯 Entered calibration mode`)
      }
    } catch (err) {
      console.error('[Calibration] Mode toggle error:', err)
    }
  }, [activeFixtureId, isCalibrating, handleCenter])
  
  /**
   * Handle fixture selection
   */
  const handleFixtureSelect = useCallback((fixtureId: string) => {
    selectFixture(fixtureId, 'replace')
    // Reset calibration mode when switching fixtures
    if (isCalibrating) {
      setIsCalibrating(false)
    }
  }, [selectFixture, isCalibrating])
  
  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  
  return (
    <div className={`calibration-view ${isCalibrating ? 'calibrating' : ''}`}>
      {/* HEADER */}
      <header className="calibration-header">
        <div className="header-title">
          <span className="title-icon">🎯</span>
          <h1>CALIBRATION</h1>
          <span className="title-badge">HARDWARE SETUP</span>
        </div>
        <div className="header-status">
          {activeFixture ? (
            <span className="active-fixture">
              <span className="fixture-icon">💡</span>
              {(activeFixture as { name?: string }).name || activeFixtureId}
            </span>
          ) : (
            <span className="no-fixture">Select a fixture to calibrate</span>
          )}
        </div>
      </header>
      
      {/* MAIN CONTENT - 3 Columns */}
      <div className="calibration-content">
        {/* LEFT COLUMN - Fixture List */}
        <aside className="calibration-sidebar left">
          <FixtureList
            fixtures={calibratableFixtures}
            selectedId={activeFixtureId}
            onSelect={handleFixtureSelect}
          />
          <OffsetPanel
            fixtureId={activeFixtureId}
            disabled={!activeFixtureId}
          />
        </aside>
        
        {/* CENTER - Radar XY (The Star) */}
        <main className="calibration-center">
          <RadarXY
            pan={pan}
            tilt={tilt}
            onChange={handlePositionChange}
            onCenter={handleCenter}
            isCalibrating={isCalibrating}
            disabled={!activeFixtureId}
          />
          
          {/* Calibration Toggle */}
          <div className="calibration-toggle-bar">
            <button
              className={`calibration-toggle-btn ${isCalibrating ? 'active' : ''}`}
              onClick={handleCalibrationToggle}
              disabled={!activeFixtureId}
            >
              {isCalibrating ? '⏹ EXIT CALIBRATION' : '🎯 ENTER CALIBRATION MODE'}
            </button>
          </div>
        </main>
        
        {/* RIGHT COLUMN - Test Panel */}
        <aside className="calibration-sidebar right">
          <TestPanel
            fixtureId={activeFixtureId}
            disabled={!activeFixtureId}
          />
        </aside>
      </div>
    </div>
  )
}

export default CalibrationView
