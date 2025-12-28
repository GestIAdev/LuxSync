/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔍 INSPECTOR CONTROLS - WAVE 30.1: Stage Command & Dashboard
 * Panel de control para fixtures seleccionados
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Muestra cuando hay selección activa:
 * - Información de fixtures seleccionados
 * - Color Picker (HSL)
 * - Dimmer Slider
 * - Pan/Tilt Control (si hay moving heads)
 * - Botón Release (limpiar overrides)
 * 
 * @module components/views/StageViewDual/sidebar/InspectorControls
 * @version 30.1.0
 */

import React, { useCallback, useMemo, useState } from 'react'
import { useSelectionStore, selectSelectedIds } from '../../../../stores/selectionStore'
import { useOverrideStore, hslToRgb, rgbToHsl } from '../../../../stores/overrideStore'
import { useTruthStore, selectHardware } from '../../../../stores/truthStore'
import { ColorPicker } from './ColorPicker'
import { DimmerSlider } from './DimmerSlider'
import { PanTiltControl } from './PanTiltControl'
import './InspectorControls.css'

export interface InspectorControlsProps {
  className?: string
}

export const InspectorControls: React.FC<InspectorControlsProps> = ({
  className = '',
}) => {
  // Selection
  const selectedIds = useSelectionStore(selectSelectedIds)
  const deselectAll = useSelectionStore(state => state.deselectAll)
  const selectedArray = useMemo(() => [...selectedIds], [selectedIds])
  
  // Overrides
  const { setMultipleOverrides, clearAllOverrides, getOverride } = useOverrideStore()
  
  // Truth (para obtener datos de fixtures)
  const hardware = useTruthStore(selectHardware)
  
  // Estado local para valores del inspector
  const [inspectorH, setInspectorH] = useState(0)
  const [inspectorS, setInspectorS] = useState(100)
  const [inspectorL, setInspectorL] = useState(50)
  const [inspectorDimmer, setInspectorDimmer] = useState(255)
  const [inspectorPan, setInspectorPan] = useState(270)
  const [inspectorTilt, setInspectorTilt] = useState(135)
  const [inspectorSpeed, setInspectorSpeed] = useState(128) // 128 = velocidad media (0=MAX, 255=LENTO)
  
  // Determinar si hay moving heads en la selección
  const hasMovingHeads = useMemo(() => {
    const fixtures = hardware?.fixtures || []
    return selectedArray.some(id => {
      const fixture = fixtures.find((f: { id: string }) => f.id === id)
      const type = fixture?.type?.toLowerCase() || ''
      return type.includes('moving') || type.includes('spot') || type.includes('beam')
    })
  }, [selectedArray, hardware?.fixtures])
  
  // Obtener información de fixtures seleccionados
  const selectedFixtures = useMemo(() => {
    const fixtures = hardware?.fixtures || []
    return selectedArray.map(id => {
      return fixtures.find((f: { id: string }) => f.id === id)
    }).filter(Boolean)
  }, [selectedArray, hardware?.fixtures])
  
  // ═════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═════════════════════════════════════════════════════════════════════════
  
  // Color change
  const handleColorChange = useCallback((h: number, s: number, l: number) => {
    setInspectorH(h)
    setInspectorS(s)
    setInspectorL(l)
    
    // Aplicar a todos los fixtures seleccionados
    setMultipleOverrides(selectedArray, { h, s, l })
  }, [selectedArray, setMultipleOverrides])
  
  // Dimmer change
  const handleDimmerChange = useCallback((dimmer: number) => {
    setInspectorDimmer(dimmer)
    setMultipleOverrides(selectedArray, { dimmer })
  }, [selectedArray, setMultipleOverrides])
  
  // Pan/Tilt change
  const handlePanTiltChange = useCallback((pan: number, tilt: number) => {
    setInspectorPan(pan)
    setInspectorTilt(tilt)
    setMultipleOverrides(selectedArray, { pan, tilt })
  }, [selectedArray, setMultipleOverrides])
  
  // Speed change (velocidad motores: 0=MAX, 255=LENTO)
  const handleSpeedChange = useCallback((speed: number) => {
    setInspectorSpeed(speed)
    setMultipleOverrides(selectedArray, { speed })
  }, [selectedArray, setMultipleOverrides])
  
  // Release (limpiar overrides de selección)
  const handleRelease = useCallback(() => {
    selectedArray.forEach(id => {
      useOverrideStore.getState().clearOverride(id)
    })
  }, [selectedArray])
  
  // Release All
  const handleReleaseAll = useCallback(() => {
    clearAllOverrides()
  }, [clearAllOverrides])
  
  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════
  
  return (
    <div className={`inspector-controls ${className}`}>
      {/* HEADER */}
      <div className="inspector-header">
        <div className="selection-info">
          <span className="selection-count">{selectedArray.length}</span>
          <span className="selection-label">
            {selectedArray.length === 1 ? 'Fixture' : 'Fixtures'}
          </span>
        </div>
        <button 
          className="close-btn"
          onClick={deselectAll}
          title="Deselect All"
        >
          ✕
        </button>
      </div>
      
      {/* FIXTURE LIST (collapsed) */}
      <div className="fixture-list">
        {selectedFixtures.slice(0, 4).map((fixture) => fixture && (
          <div key={fixture.id} className="fixture-chip">
            {fixture.name || fixture.id}
          </div>
        ))}
        {selectedFixtures.length > 4 && (
          <div className="fixture-chip more">
            +{selectedFixtures.length - 4} más
          </div>
        )}
      </div>
      
      {/* DIVIDER */}
      <div className="divider" />
      
      {/* COLOR */}
      <div className="control-section">
        <h4 className="section-title">🎨 Color</h4>
        <ColorPicker
          h={inspectorH}
          s={inspectorS}
          l={inspectorL}
          onChange={handleColorChange}
        />
      </div>
      
      {/* DIMMER */}
      <div className="control-section">
        <h4 className="section-title">💡 Intensidad</h4>
        <DimmerSlider
          value={inspectorDimmer}
          onChange={handleDimmerChange}
        />
      </div>
      
      {/* PAN/TILT (solo si hay moving heads) */}
      {hasMovingHeads && (
        <div className="control-section">
          <h4 className="section-title">🕹️ Movimiento</h4>
          <PanTiltControl
            pan={inspectorPan}
            tilt={inspectorTilt}
            onChange={handlePanTiltChange}
          />
        </div>
      )}
      
      {/* SPEED (solo si hay moving heads - ¡para que no exploten los motores!) */}
      {hasMovingHeads && (
        <div className="control-section">
          <h4 className="section-title">⏱️ Velocidad Motores</h4>
          <div className="speed-control">
            <input
              type="range"
              min={0}
              max={255}
              value={inspectorSpeed}
              onChange={(e) => handleSpeedChange(parseInt(e.target.value))}
              className="speed-slider"
            />
            <div className="speed-labels">
              <span className="speed-label fast">🚀 Rápido</span>
              <span className="speed-value">{inspectorSpeed}</span>
              <span className="speed-label slow">🐢 Lento</span>
            </div>
          </div>
        </div>
      )}
      
      {/* DIVIDER */}
      <div className="divider" />
      
      {/* ACTIONS */}
      <div className="inspector-actions">
        <button 
          className="action-btn release"
          onClick={handleRelease}
        >
          🔓 Release Selected
        </button>
        <button 
          className="action-btn release-all"
          onClick={handleReleaseAll}
        >
          🔓 Release All
        </button>
      </div>
    </div>
  )
}

export default InspectorControls
