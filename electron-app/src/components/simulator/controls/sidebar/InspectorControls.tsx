/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔍 INSPECTOR CONTROLS - WAVE 428: NEON POLISH
 * ⚠️ DEPRECATED IN WAVE 435 - USE TheProgrammer INSTEAD
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * @deprecated This component has been replaced by TheProgrammer (WAVE 425-432)
 * Use `TheProgrammerContent` for the same functionality with better architecture.
 * 
 * Reason for deprecation:
 * - Duplicate functionality with TheProgrammer
 * - TheProgrammer has Groups + Scenes integration
 * - Better state management with MasterArbiter
 * 
 * Migration path:
 * ```tsx
 * // OLD (deprecated):
 * import { InspectorControls } from './sidebar/InspectorControls'
 * 
 * // NEW (recommended):
 * import { TheProgrammerContent } from '../controls'
 * ```
 * 
 * This file will be removed in WAVE 436.
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * ORIGINAL DOCS (for reference):
 * 
 * Panel de control ACCORDION para fixtures seleccionados
 * 
 * Arquitectura:
 * - Accordion exclusivo (solo una sección abierta)
 * - Altura fija, sin scroll del panel completo
 * - Estética "Placa Militar" / Reactor Nuclear
 * 
 * Secciones:
 * - INTENSITY (Dimmer)
 * - COLOR (HSL Picker)
 * - POSITION (Pan/Tilt - solo Moving Heads)
 * - BEAM (Speed/Patterns)
 * 
 * @module components/simulator/controls/sidebar/InspectorControls
 * @version 428.0 (DEPRECATED)
 */

import React, { useCallback, useMemo, useState } from 'react'
import { useSelectionStore, selectSelectedIds } from '../../../../stores/selectionStore'
import { useOverrideStore, MovementPatternType } from '../../../../stores/overrideStore'
import { useTruthStore, selectHardware } from '../../../../stores/truthStore'

// DEPRECATION WARNING
console.warn(
  '⚠️ [WAVE 435 DEPRECATION] InspectorControls is deprecated. Use TheProgrammerContent instead.'
)
import { ColorPicker } from './ColorPicker'
import { DimmerSlider } from './DimmerSlider'
import { PanTiltControl } from './PanTiltControl'
import './InspectorControls.css'

// ═════════════════════════════════════════════════════════════════════════
// TYPES
// ═════════════════════════════════════════════════════════════════════════

type AccordionSection = 'intensity' | 'color' | 'position' | 'beam' | null

export interface InspectorControlsProps {
  className?: string
}

// ═════════════════════════════════════════════════════════════════════════
// ACCORDION SECTION COMPONENT
// ═════════════════════════════════════════════════════════════════════════

interface SectionProps {
  id: AccordionSection
  title: string
  icon: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
  disabled?: boolean
}

const AccordionSection: React.FC<SectionProps> = ({ 
  id, title, icon, isOpen, onToggle, children, disabled 
}) => (
  <div className={`accordion-section ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}>
    <button 
      className="section-header" 
      onClick={onToggle}
      disabled={disabled}
    >
      <span className="section-icon">{icon}</span>
      <span className="section-title">{title}</span>
      <span className="section-chevron">{isOpen ? '▼' : '▶'}</span>
    </button>
    {isOpen && (
      <div className="section-content">
        {children}
      </div>
    )}
  </div>
)

export const InspectorControls: React.FC<InspectorControlsProps> = ({
  className = '',
}) => {
  // Selection
  const selectedIds = useSelectionStore(selectSelectedIds)
  const deselectAll = useSelectionStore(state => state.deselectAll)
  const selectedArray = useMemo(() => [...selectedIds], [selectedIds])
  
  // Overrides
  const { setMultipleOverrides, clearAllOverrides } = useOverrideStore()
  
  // Truth (para obtener datos de fixtures)
  const hardware = useTruthStore(selectHardware)
  
  // WAVE 428: Accordion state - solo una sección abierta
  const [openSection, setOpenSection] = useState<AccordionSection>('intensity')
  
  // Toggle accordion section
  const toggleSection = useCallback((section: AccordionSection) => {
    setOpenSection(prev => prev === section ? null : section)
  }, [])
  
  // Estado local para valores del inspector
  const [inspectorH, setInspectorH] = useState(0)
  const [inspectorS, setInspectorS] = useState(100)
  const [inspectorL, setInspectorL] = useState(50)
  const [inspectorDimmer, setInspectorDimmer] = useState(255)
  const [inspectorPan, setInspectorPan] = useState(270)
  const [inspectorTilt, setInspectorTilt] = useState(135)
  const [inspectorSpeed, setInspectorSpeed] = useState(128) // 128 = velocidad media (0=MAX, 255=LENTO)
  
  // 🔄 WAVE 153.13: Estado para patrón de movimiento
  const [movementPattern, setMovementPattern] = useState<MovementPatternType>('static')
  const [patternAmplitude, setPatternAmplitude] = useState(50) // 0-100%
  const [patternSpeed, setPatternSpeed] = useState(50) // 0-100%
  
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
  
  // 🔄 WAVE 153.13: Pattern change
  const handlePatternChange = useCallback((pattern: MovementPatternType) => {
    setMovementPattern(pattern)
    const isEnabled = pattern !== 'static'
    // Enviar también el centro actual (pan/tilt) para que el patrón gire alrededor de ese punto
    setMultipleOverrides(selectedArray, { 
      movementPattern: pattern,
      patternEnabled: isEnabled,
      patternAmplitude,
      patternSpeed,
      // Usar inspectorPan/Tilt como centro del patrón
      pan: inspectorPan,
      tilt: inspectorTilt
    })
  }, [selectedArray, setMultipleOverrides, patternAmplitude, patternSpeed, inspectorPan, inspectorTilt])
  
  // 🔄 WAVE 153.13: Amplitude change
  const handleAmplitudeChange = useCallback((amplitude: number) => {
    setPatternAmplitude(amplitude)
    if (movementPattern !== 'static') {
      setMultipleOverrides(selectedArray, { patternAmplitude: amplitude })
    }
  }, [selectedArray, setMultipleOverrides, movementPattern])
  
  // 🔄 WAVE 153.13: Pattern speed change
  const handlePatternSpeedChange = useCallback((speed: number) => {
    setPatternSpeed(speed)
    if (movementPattern !== 'static') {
      setMultipleOverrides(selectedArray, { patternSpeed: speed })
    }
  }, [selectedArray, setMultipleOverrides, movementPattern])
  
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
  // RENDER - WAVE 428: ACCORDION LAYOUT
  // ═════════════════════════════════════════════════════════════════════════
  
  return (
    <div className={`inspector-controls ${className}`}>
      {/* ═══ HEADER ═══ */}
      <div className="inspector-header">
        <div className="header-badge">
          <span className="badge-count">{selectedArray.length}</span>
          <span className="badge-label">
            {selectedArray.length === 1 ? 'FIXTURE' : 'FIXTURES'}
          </span>
        </div>
        <button 
          className="close-btn"
          onClick={deselectAll}
          title="Deselect All (ESC)"
        >
          ✕
        </button>
      </div>
      
      {/* ═══ FIXTURE CHIPS ═══ */}
      <div className="fixture-chips">
        {selectedFixtures.slice(0, 3).map((fixture) => fixture && (
          <span key={fixture.id} className="chip">
            {fixture.name || fixture.id}
          </span>
        ))}
        {selectedFixtures.length > 3 && (
          <span className="chip overflow">+{selectedFixtures.length - 3}</span>
        )}
      </div>
      
      {/* ═══ ACCORDION SECTIONS ═══ */}
      <div className="accordion-container">
        
        {/* INTENSITY */}
        <AccordionSection
          id="intensity"
          title="INTENSITY"
          icon="◐"
          isOpen={openSection === 'intensity'}
          onToggle={() => toggleSection('intensity')}
        >
          <DimmerSlider
            value={inspectorDimmer}
            onChange={handleDimmerChange}
          />
        </AccordionSection>
        
        {/* COLOR */}
        <AccordionSection
          id="color"
          title="COLOR"
          icon="◉"
          isOpen={openSection === 'color'}
          onToggle={() => toggleSection('color')}
        >
          <ColorPicker
            h={inspectorH}
            s={inspectorS}
            l={inspectorL}
            onChange={handleColorChange}
          />
        </AccordionSection>
        
        {/* POSITION - Solo Moving Heads */}
        <AccordionSection
          id="position"
          title="POSITION"
          icon="◎"
          isOpen={openSection === 'position'}
          onToggle={() => toggleSection('position')}
          disabled={!hasMovingHeads}
        >
          <PanTiltControl
            pan={inspectorPan}
            tilt={inspectorTilt}
            onChange={handlePanTiltChange}
          />
          {/* Speed slider */}
          <div className="speed-control">
            <label className="control-label">MOTOR SPEED</label>
            <div className="energy-bar">
              <div 
                className="energy-fill speed" 
                style={{ width: `${(255 - inspectorSpeed) / 255 * 100}%` }}
              />
              <input
                type="range"
                min={0}
                max={255}
                value={inspectorSpeed}
                onChange={(e) => handleSpeedChange(parseInt(e.target.value))}
                className="energy-input"
              />
            </div>
            <div className="speed-labels">
              <span>FAST</span>
              <span className="speed-value">{inspectorSpeed}</span>
              <span>SLOW</span>
            </div>
          </div>
        </AccordionSection>
        
        {/* BEAM - Patterns (Solo Moving Heads) */}
        <AccordionSection
          id="beam"
          title="BEAM"
          icon="⌬"
          isOpen={openSection === 'beam'}
          onToggle={() => toggleSection('beam')}
          disabled={!hasMovingHeads}
        >
          {/* Pattern Selector */}
          <div className="pattern-grid">
            {(['static', 'circle', 'figure8', 'sweep'] as MovementPatternType[]).map(p => (
              <button
                key={p}
                className={`pattern-btn ${movementPattern === p ? 'active' : ''}`}
                onClick={() => handlePatternChange(p)}
              >
                <span className="pattern-icon">
                  {p === 'static' && '■'}
                  {p === 'circle' && '○'}
                  {p === 'figure8' && '∞'}
                  {p === 'sweep' && '↔'}
                </span>
                <span className="pattern-name">{p.toUpperCase()}</span>
              </button>
            ))}
          </div>
          
          {/* Amplitude & Speed (solo si patrón activo) */}
          {movementPattern !== 'static' && (
            <div className="pattern-params">
              <div className="param-row">
                <label>AMPLITUDE</label>
                <div className="energy-bar small">
                  <div 
                    className="energy-fill" 
                    style={{ width: `${patternAmplitude}%` }}
                  />
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={patternAmplitude}
                    onChange={(e) => handleAmplitudeChange(parseInt(e.target.value))}
                    className="energy-input"
                  />
                </div>
                <span className="param-value">{patternAmplitude}%</span>
              </div>
              <div className="param-row">
                <label>SPEED</label>
                <div className="energy-bar small">
                  <div 
                    className="energy-fill" 
                    style={{ width: `${patternSpeed}%` }}
                  />
                  <input
                    type="range"
                    min={1}
                    max={100}
                    value={patternSpeed}
                    onChange={(e) => handlePatternSpeedChange(parseInt(e.target.value))}
                    className="energy-input"
                  />
                </div>
                <span className="param-value">{patternSpeed}%</span>
              </div>
            </div>
          )}
        </AccordionSection>
        
      </div>
      
      {/* ═══ ACTIONS ═══ */}
      <div className="inspector-actions">
        <button className="action-btn release" onClick={handleRelease}>
          RELEASE SELECTED
        </button>
        <button className="action-btn release-all" onClick={handleReleaseAll}>
          RELEASE ALL
        </button>
      </div>
    </div>
  )
}

export default InspectorControls
