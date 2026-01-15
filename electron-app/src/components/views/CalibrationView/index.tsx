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
  
  // Local state
  const [pan, setPan] = useState(270)    // 0-540 degrees (center)
  const [tilt, setTilt] = useState(135)  // 0-270 degrees (center)
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
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Handle position change from RadarXY
   */
  const handlePositionChange = useCallback(async (newPan: number, newTilt: number) => {
    setPan(newPan)
    setTilt(newTilt)
    
    if (!activeFixtureId) return
    
    try {
      await window.lux?.arbiter?.setManual({
        fixtureIds: [activeFixtureId],
        controls: {
          pan: Math.round((newPan / 540) * 255),
          tilt: Math.round((newTilt / 270) * 255),
        },
        channels: ['pan', 'tilt'],
      })
      console.log(`[Calibration] 🎯 Pan: ${newPan}° Tilt: ${newTilt}°`)
    } catch (err) {
      console.error('[Calibration] Position error:', err)
    }
  }, [activeFixtureId])
  
  /**
   * Center position
   */
  const handleCenter = useCallback(() => {
    handlePositionChange(270, 135)
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
