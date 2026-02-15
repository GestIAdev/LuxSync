/**
 * 🕹️ POSITION SECTION - WAVE 430.5 + WAVE 999 TACTICAL RADAR
 * Movement control for selected fixtures (moving heads)
 * 
 * Architecture:
 * - COLLAPSIBLE section header (WAVE 999: Ahora es el primero)
 * - SWITCH INTELIGENTE:
 *   - 1 fixture → XYPad (Sniper Mode)
 *   - 2+ fixtures → RadarXY (Formation Mode) + Fan Control
 * - WAVE 999: TACTICAL RADAR LAYOUT
 *   - Left: 🚀 SPEED vertical slider
 *   - Center: 🎯 RADAR / PAD
 *   - Right: 📏 SIZE/AMP vertical slider
 * - Patterns: Circle, Eight, Sweep (procedural movement)
 * - Precision: Numeric inputs for exact values
 * 
 * 👻 WAVE 2042.21: GHOST HANDOFF
 * - Pattern change now resyncs speed/amplitude immediately
 * - Release injects current position as AI origin (no jump on unlock)
 * 
 * Connected to MasterArbiter via window.lux.arbiter.setManual()
 */

import React, { useCallback, useState, useEffect, useMemo } from 'react'
import { useSelectedArray } from '../../../stores/selectionStore'
import { useHardware } from '../../../stores/truthStore'
import { XYPad, RadarXY, type GhostPoint } from './controls'
import { PatternSelector, type PatternType } from './controls'
import { PositionIcon } from '../../icons/LuxIcons'

export interface PositionSectionProps {
  hasOverride: boolean
  isExpanded: boolean
  onToggle: () => void
  onOverrideChange: (hasOverride: boolean) => void
}

export const PositionSection: React.FC<PositionSectionProps> = ({
  hasOverride,
  isExpanded,
  onToggle,
  onOverrideChange,
}) => {
  // 🛡️ WAVE 2042.13.13: Fixed - Use stable hook
  const selectedIds = useSelectedArray()
  const hardware = useHardware() // 🛡️ WAVE 2042.12: React 19 stable hook
  
  // Local state
  const [pan, setPan] = useState(270)    // 0-540 degrees
  const [tilt, setTilt] = useState(135)  // 0-270 degrees
  const [activePattern, setActivePattern] = useState<PatternType>('static')
  const [patternSpeed, setPatternSpeed] = useState(50)  // 0-100
  const [patternSize, setPatternSize] = useState(50)    // 0-100
  
  // WAVE 377: Calibration mode state
  const [isCalibrating, setIsCalibrating] = useState(false)
  
  // WAVE 430.5: Fan control for group mode
  const [fanValue, setFanValue] = useState(0)  // -100 to 100
  
  // WAVE 430.5: Detect multi-selection mode
  const isMultiSelection = selectedIds.length > 1
  
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
  // WAVE 430.5: GHOST POINTS CALCULATION (Formation Mode)
  // Distributes fixtures in a "fan" pattern around the center of gravity
  // ═══════════════════════════════════════════════════════════════════════
  
  const ghostPoints = useMemo((): GhostPoint[] => {
    if (!isMultiSelection) return []
    
    // Base position (center of gravity)
    const basePanNorm = pan / 540
    const baseTiltNorm = tilt / 270
    
    // Fan spread: -100 to 100 → -0.3 to 0.3 (normalized spread)
    const spread = (fanValue / 100) * 0.3
    
    return selectedIds.map((id, index) => {
      // Position offset based on index (centered distribution)
      const fixtureCount = selectedIds.length
      const offsetIndex = index - (fixtureCount - 1) / 2
      
      // Apply fan spread to pan (horizontal fan)
      const offsetX = offsetIndex * spread / Math.max(1, fixtureCount - 1)
      
      // Clamp to valid range
      const x = Math.max(0, Math.min(1, basePanNorm + offsetX))
      const y = baseTiltNorm
      
      return {
        id,
        x,
        y,
        label: `Fixture ${index + 1}`,
      }
    })
  }, [selectedIds, pan, tilt, fanValue, isMultiSelection])
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🧠 WAVE 999.7: THE HYBRID FLUSH - Clean state on selection change
  // Problema: Al cambiar de fixture A → B, la UI mostraba estado de A
  // Solución: FLUSH inmediato + luego hidratar desde backend
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    let isMounted = true
    
    const hydrateState = async () => {
      // ═══════════════════════════════════════════════════════════════════
      // 🧼 PASO 1: FLUSH INMEDIATO - Limpiar estado local ANTES de fetch
      // ═══════════════════════════════════════════════════════════════════
      // 🛡️ WAVE 1008.3: Use safe center (95% of physical max)
      setPan(256)           // Centro seguro (513/2 ≈ 256°)
      setTilt(128)          // Centro seguro (256/2 = 128°)
      setActivePattern('static')  // Ningún patrón activo
      setPatternSpeed(50)   // Default
      setPatternSize(50)    // Default
      
      // Si no hay selección, ya terminamos con el flush
      if (selectedIds.length === 0) {
        console.log(`[Position] 🧼 FLUSH: No selection, defaults applied`)
        return
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // 🧠 PASO 2: HIDRATAR - Pedir estado real al Arbiter
      // ═══════════════════════════════════════════════════════════════════
      try {
        const result = await window.lux?.arbiter?.getFixturesState(selectedIds)
        
        if (!isMounted) return
        
        // Si el backend no responde, mantener defaults del flush
        if (!result?.success || !result?.state) {
          console.log(`[Position] 🧼 FLUSH: No backend state, keeping defaults`)
          return
        }
        
        const { state } = result
        
        // ═══════════════════════════════════════════════════════════════════
        // 🎯 PASO 3: APLICAR solo los valores que tienen OVERRIDE MANUAL
        // Si es null = AI control = mantener el default del flush
        // ═══════════════════════════════════════════════════════════════════
        
        // --- POSITION (Individual Logic) ---
        if (state.pan !== null) {
          setPan(state.pan)
        }
        // else: mantiene 270 del flush (AI control)
        
        if (state.tilt !== null) {
          setTilt(state.tilt)
        }
        // else: mantiene 135 del flush (AI control)
        
        // --- PATTERN (Hybrid Logic) ---
        if (state.pattern !== null) {
          // map 'hold' back to 'static' for UI button
          const uiPattern = state.pattern === 'hold' ? 'static' : state.pattern
          setActivePattern(uiPattern as PatternType)
        }
        // else: mantiene 'static' del flush (AI control = HOLD visual)
        
        // --- DYNAMICS ---
        if (state.speed !== null) {
          setPatternSpeed(state.speed)
        }
        // else: mantiene 50 del flush
        
        if (state.amplitude !== null) {
          setPatternSize(state.amplitude)
        }
        // else: mantiene 50 del flush
        
        console.log(`[Position] 🧠 Hydrated fixture ${selectedIds[0]} - Pattern: ${state.pattern ?? 'AI'}`)
      } catch (err) {
        console.error('[Position] Hydration error:', err)
        // En caso de error, los defaults del flush ya están aplicados
      }
    }
    
    hydrateState()
    
    return () => { isMounted = false }
  }, [JSON.stringify(selectedIds)]) // 🔑 Stringify para detectar cambios de contenido, no solo length
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS - Connect to Arbiter
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * XY Pad change - Direct position control
   */
  const handlePositionChange = useCallback(async (newPan: number, newTilt: number) => {
    // 🛡️ WAVE 1008.3: Safety clamps (95% of physical max)
    const SAFE_PAN_MAX = 513   // 95% of 540°
    const SAFE_TILT_MAX = 256  // 95% of 270°
    
    const safePan = Math.max(0, Math.min(SAFE_PAN_MAX, newPan))
    const safeTilt = Math.max(0, Math.min(SAFE_TILT_MAX, newTilt))
    
    setPan(safePan)
    setTilt(safeTilt)
    onOverrideChange(true)
    
    // Clear any active pattern when manually positioning
    if (activePattern !== 'static') {
      setActivePattern('static')
    }
    
    try {
      // Convert to DMX with safety cap
      const panDmx = Math.min(242, Math.round((safePan / 540) * 255))
      const tiltDmx = Math.min(241, Math.round((safeTilt / 270) * 255))
      
      await window.lux?.arbiter?.setManual({
        fixtureIds: selectedIds,
        controls: {
          pan: panDmx,
          tilt: tiltDmx,
          speed: 0,  // 🚀 WAVE 1008.2: Fast movement for moving heads
        },
        channels: ['pan', 'tilt', 'speed'],
      })
      console.log(`[Position] 🕹️ Pan: ${safePan}° (DMX ${panDmx}) Tilt: ${safeTilt}° (DMX ${tiltDmx})`)
    } catch (err) {
      console.error('[Position] Error:', err)
    }
  }, [selectedIds, activePattern, onOverrideChange])
  
  /**
   * Pattern change - Procedural movement
   * 🛑 WAVE 999.5: HOLD = FRENO DE MANO ACTIVO
   * 
   * HOLD ('static' en UI) → setMovementPattern('hold') → INMOVILIDAD TOTAL
   * Circle/Eight/Sweep → setMovementPattern(pattern) → Override activo
   * UNLOCK ALL → setMovementPattern(null) → Release a AI
   * 
   * 🔥 WAVE 2042.21: GHOST HANDOFF - Resync movement parameters after pattern change
   */
  const handlePatternChange = useCallback(async (pattern: PatternType) => {
    setActivePattern(pattern)
    
    // 🛑 WAVE 999.5: HOLD es un OVERRIDE ACTIVO, no un release
    // El botón "HOLD" en UI tiene id 'static', pero enviamos 'hold' al engine
    const enginePattern = pattern === 'static' ? 'hold' : pattern
    
    onOverrideChange(true)
    
    try {
      await window.lux?.arbiter?.setMovementPattern(enginePattern)
      
      // 2️⃣ 🔄 WAVE 2042.22: INJECT pattern into MasterArbiter activePatterns
      //    This makes the pattern actually execute on the fixtures
      const electron = (window as any).electron
      if (electron?.ipcRenderer?.invoke) {
        await electron.ipcRenderer.invoke('lux:arbiter:setManualFixturePattern', {
          fixtureIds: selectedIds,
          pattern: pattern,  // Use UI pattern name ('circle', 'eight', 'sweep')
          speed: patternSpeed,
          amplitude: patternSize,
        })
      }
      
      // 🔥 WAVE 2042.21: RESYNC MOVEMENT DYNAMICS
      // Si venimos de mover el pad manualmente, la velocidad interna estará en 0 (instant).
      // Hay que empujar los valores de los sliders al motor de patrones inmediatamente.
      if (pattern !== 'static') {
        await window.lux?.arbiter?.setMovementParameter('speed', patternSpeed)
        await window.lux?.arbiter?.setMovementParameter('amplitude', patternSize)
        console.log(`[Position] � Pattern ${pattern} ARMED: Speed=${patternSpeed}% Amp=${patternSize}%`)
      } else {
        console.log(`[Position] 🛑 HOLD: Freno de mano activado (offset 0,0)`)
      }
    } catch (err) {
      console.error('[Position] Pattern error:', err)
    }
  }, [selectedIds, onOverrideChange, patternSpeed, patternSize])
  
  /**
   * Pattern speed/size change
   * 🎚️ WAVE 999: Now calls setMovementParameter to affect VibeMovementManager directly
   * 🔄 WAVE 2042.22: Also update MasterArbiter activePatterns
   */
  const handlePatternParamsChange = useCallback(async (speed: number, size: number) => {
    setPatternSpeed(speed)
    setPatternSize(size)
    
    // 🎚️ WAVE 999: Send to VibeMovementManager via IPC
    try {
      await window.lux?.arbiter?.setMovementParameter('speed', speed)
      await window.lux?.arbiter?.setMovementParameter('amplitude', size)
      
      // 🔄 WAVE 2042.22: Update MasterArbiter pattern config
      if (activePattern !== 'static') {
        const electron = (window as any).electron
        if (electron?.ipcRenderer?.invoke) {
          await electron.ipcRenderer.invoke('lux:arbiter:setManualFixturePattern', {
            fixtureIds: selectedIds,
            pattern: activePattern,
            speed: speed,
            amplitude: size,
          })
        }
      }
      
      console.log(`[Position] 🎚️ Movement params: Speed=${speed}% Amplitude=${size}%`)
    } catch (err) {
      console.error('[Position] Movement params error:', err)
    }
    
    if (activePattern !== 'static') {
      // Re-send pattern with new params (legacy)
      await handlePatternChange(activePattern)
    }
  }, [activePattern, handlePatternChange])
  
  /**
   * Center position
   */
  const handleCenter = useCallback(() => {
    // 🛡️ WAVE 1008.3: Use safe center (50% of safe range)
    const SAFE_PAN_MAX = 513
    const SAFE_TILT_MAX = 256
    handlePositionChange(Math.round(SAFE_PAN_MAX / 2), Math.round(SAFE_TILT_MAX / 2)) // ~256°, ~128°
  }, [handlePositionChange])
  
  /**
   * WAVE 430.5: Fan control change
   * Spreads fixtures in a fan pattern around the center of gravity
   */
  const handleFanChange = useCallback(async (newFanValue: number) => {
    setFanValue(newFanValue)
    onOverrideChange(true)
    
    // Calculate individual positions with fan spread
    const basePanNorm = pan / 540
    const baseTiltNorm = tilt / 270
    const spread = (newFanValue / 100) * 0.3
    
    // Send individual positions to each fixture
    for (let i = 0; i < selectedIds.length; i++) {
      const fixtureId = selectedIds[i]
      const offsetIndex = i - (selectedIds.length - 1) / 2
      const offsetX = selectedIds.length > 1 
        ? offsetIndex * spread / (selectedIds.length - 1)
        : 0
      
      const fixturePanNorm = Math.max(0, Math.min(1, basePanNorm + offsetX))
      const fixturePan = Math.round(fixturePanNorm * 540)
      const fixtureTilt = Math.round(baseTiltNorm * 270)
      
      try {
        await window.lux?.arbiter?.setManual({
          fixtureIds: [fixtureId],
          controls: {
            pan: Math.round((fixturePan / 540) * 255),
            tilt: Math.round((fixtureTilt / 270) * 255),
          },
          channels: ['pan', 'tilt'],
        })
      } catch (err) {
        console.error(`[Position] Fan error for ${fixtureId}:`, err)
      }
    }
    
    console.log(`[Position] 🌀 Fan spread: ${newFanValue}% for ${selectedIds.length} fixtures`)
  }, [pan, tilt, selectedIds, onOverrideChange])
  
  /**
   * Release position back to AI
   * 
   * 👻 WAVE 2042.21: GHOST HANDOFF
   * Antes de soltar, le decimos a la IA: "Tu nuevo Home es aquí"
   * Así el fixture no salta a una posición random, sino que Selene
   * empieza a modificarlo sutilmente desde donde el operador lo dejó.
   */
  const handleRelease = useCallback(async () => {
    // 1. Actualizar estado UI inmediatamente
    onOverrideChange(false)
    // 🔄 WAVE 2042.22: NO CLEAR pattern - let it continue running
    // setActivePattern('static')  // ❌ OLD: This killed the pattern
    setIsCalibrating(false)
    
    try {
      // 👻 WAVE 2042.21: GHOST HANDOFF - Inject current position as AI origin
      // Antes de liberar, comunicamos la posición actual al backend
      // para que Selene adopte este punto como nuevo "home"
      if (selectedIds.length > 0) {
        // Convertir grados a DMX (0-255)
        // pan: 0-540° → 0-255 DMX
        // tilt: 0-270° → 0-255 DMX
        const panDmx = Math.round((pan / 540) * 255)
        const tiltDmx = Math.round((tilt / 270) * 255)
        
        // Notificar al Arbiter la nueva posición de origen
        // Usamos setManual con un flag especial de "soft release"
        // que indica: "usa estos valores como punto de partida, no como override"
        const electron = (window as any).electron
        if (electron?.ipcRenderer?.invoke) {
          await electron.ipcRenderer.invoke('lux:arbiter:setContextOrigin', {
            fixtureIds: selectedIds,
            origin: { pan: panDmx, tilt: tiltDmx }
          })
          console.log(`[Position] 👻 GHOST HANDOFF: AI adopts P${panDmx}/T${tiltDmx} as new origin`)
        }
      }
      
      // 2. Ahora sí, liberamos el override manual de PAN/TILT
      // 🔄 WAVE 2042.22: PATTERN PERSISTE - Solo liberamos pan/tilt, el pattern sigue
      await window.lux?.arbiter?.clearManual({
        fixtureIds: selectedIds,
        channels: ['pan', 'tilt'],
      })
      console.log(`[Position] 🔓 Released pan/tilt for ${selectedIds.length} fixtures (pattern continues)`)
    } catch (err) {
      console.error('[Position] Release error:', err)
    }
  }, [selectedIds, onOverrideChange, pan, tilt])  // ⚠️ NO incluir activePattern en deps
  
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
    <div className={`programmer-section position-section ${hasOverride ? 'has-override' : ''} ${isCalibrating ? 'calibrating' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="section-header clickable" onClick={onToggle}>
        <h4 className="section-title">
          <span className="section-icon">{isExpanded ? '▼' : '▶'}</span>
          <PositionIcon size={18} className="title-icon" />
          POSITION
          {isCalibrating && <span className="calibration-indicator"> 🎯 CALIBRATING</span>}
        </h4>
        <div className="section-actions">
          {/* Calibration Button */}
          {isExpanded && (
            <button
              className={`calibrate-btn ${isCalibrating ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                handleCalibrationToggle()
              }}
              title={isCalibrating ? 'Exit calibration mode' : 'Enter calibration mode'}
            >
              🎯
            </button>
          )}
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
          {/* ═══════════════════════════════════════════════════════════════════════
              SWITCH INTELIGENTE: Radar (Multi) vs XYPad (Single)
              ═══════════════════════════════════════════════════════════════════════ */}
          
          {isMultiSelection ? (
            /* 📡 FORMATION MODE - Multiple fixtures selected */
            <div className="position-mode formation-mode">
              {/* ═══════════════════════════════════════════════════════════════════════
                  WAVE 999.3: COMPACT TACTICAL LAYOUT - No overflow
                  [SPD] [────RADAR────] [AMP]
                  ═══════════════════════════════════════════════════════════════════════ */}
              <div className="tactical-compact-layout">
                {/* 🚀 SPEED SLIDER - TRUE VERTICAL */}
                <div className="v-slider-track speed-track">
                  <svg className="v-slider-icon" viewBox="0 0 24 24" width="16" height="16">
                    <path fill="currentColor" d="M13 2v8h4l-5 6-5-6h4V2h2zm-2 16v4h2v-4h-2zm-6-4l1.41-1.41L12 18.17l5.59-5.58L19 14l-7 7-7-7z"/>
                  </svg>
                  <div className="v-slider-wrapper">
                    <input
                      type="range"
                      className="v-slider-input"
                      min="0"
                      max="100"
                      step="1"
                      value={patternSpeed}
                      onChange={(e) => handlePatternParamsChange(Number(e.target.value), patternSize)}
                      disabled={selectedIds.length === 0}
                    />
                  </div>
                  <span className="v-slider-value">{patternSpeed}</span>
                </div>
                
                {/* 🎯 RADAR CENTER - Flexible width */}
                <div className="radar-flex-container">
                  <RadarXY
                    pan={pan}
                    tilt={tilt}
                    onChange={handlePositionChange}
                    onCenter={handleCenter}
                    isCalibrating={isCalibrating}
                    isGroupMode={true}
                    ghostPoints={ghostPoints}
                    fixtureCount={selectedIds.length}
                  />
                </div>
                
                {/* 📏 SIZE/AMP SLIDER - TRUE VERTICAL */}
                <div className="v-slider-track amp-track">
                  <svg className="v-slider-icon" viewBox="0 0 24 24" width="16" height="16">
                    <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                  </svg>
                  <div className="v-slider-wrapper">
                    <input
                      type="range"
                      className="v-slider-input"
                      min="0"
                      max="100"
                      step="1"
                      value={patternSize}
                      onChange={(e) => handlePatternParamsChange(patternSpeed, Number(e.target.value))}
                      disabled={selectedIds.length === 0}
                    />
                  </div>
                  <span className="v-slider-value">{patternSize}</span>
                </div>
              </div>
              
              {/* FAN CONTROL - Inline compact */}
              {!isCalibrating && (
                <div className="fan-control-compact">
                  <span className="fan-label-mini">FAN</span>
                  <input
                    type="range"
                    className="fan-slider-mini"
                    min="-100"
                    max="100"
                    step="1"
                    value={fanValue}
                    onChange={(e) => handleFanChange(Number(e.target.value))}
                  />
                  <span className="fan-value-mini">{fanValue}%</span>
                </div>
              )}
            </div>
          ) : (
            /* 🎯 SNIPER MODE - Single fixture selected */
            <div className="position-mode sniper-mode">
              {/* ═══════════════════════════════════════════════════════════════════════
                  WAVE 999.6: SNIPER TACTICAL LAYOUT (Single) - More pad, less sliders
                  [SPD] [────────PAD────────] [AMP]
                  ═══════════════════════════════════════════════════════════════════════ */}
              <div className="tactical-compact-layout sniper-layout">
                {/* 🚀 SPEED SLIDER - Compact vertical */}
                <div className="v-slider-track speed-track">
                  <svg className="v-slider-icon" viewBox="0 0 24 24" width="14" height="14">
                    <path fill="currentColor" d="M13 2v8h4l-5 6-5-6h4V2h2zm-2 16v4h2v-4h-2zm-6-4l1.41-1.41L12 18.17l5.59-5.58L19 14l-7 7-7-7z"/>
                  </svg>
                  <div className="v-slider-wrapper">
                    <input
                      type="range"
                      className="v-slider-input"
                      min="0"
                      max="100"
                      step="1"
                      value={patternSpeed}
                      onChange={(e) => handlePatternParamsChange(Number(e.target.value), patternSize)}
                      disabled={selectedIds.length === 0}
                    />
                  </div>
                  <span className="v-slider-value">{patternSpeed}</span>
                </div>
                
                {/* 🎯 XY PAD CENTER - EXPANDED for single target */}
                <div className="radar-flex-container sniper-pad">
                  <XYPad
                    pan={pan}
                    tilt={tilt}
                    onChange={handlePositionChange}
                    onCenter={handleCenter}
                    disabled={isCalibrating}
                  />
                </div>
                
                {/* 📏 SIZE/AMP SLIDER - Compact vertical */}
                <div className="v-slider-track amp-track">
                  <svg className="v-slider-icon" viewBox="0 0 24 24" width="14" height="14">
                    <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                  </svg>
                  <div className="v-slider-wrapper">
                    <input
                      type="range"
                      className="v-slider-input"
                      min="0"
                      max="100"
                      step="1"
                      value={patternSize}
                      onChange={(e) => handlePatternParamsChange(patternSpeed, Number(e.target.value))}
                      disabled={selectedIds.length === 0}
                    />
                  </div>
                  <span className="v-slider-value">{patternSize}</span>
                </div>
              </div>
            </div>
          )}
          
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
          
          {/* POSITION SLIDERS - Solo para modo single - COMPACT */}
          {!isMultiSelection && (
            <div className="position-sliders-compact">
              <div className="pos-slider-row">
                <span className="pos-label">PAN</span>
                <input
                  type="range"
                  className="pos-slider"
                  min="0"
                  max="540"
                  step="1"
                  value={pan}
                  onChange={(e) => handlePositionChange(Number(e.target.value), tilt)}
                  disabled={isCalibrating}
                />
                <span className="pos-value">{pan}°</span>
              </div>
              
              <div className="pos-slider-row">
                <span className="pos-label">TILT</span>
                <input
                  type="range"
                  className="pos-slider"
                  min="0"
                  max="270"
                  step="1"
                  value={tilt}
                  onChange={(e) => handlePositionChange(pan, Number(e.target.value))}
                  disabled={isCalibrating}
                />
                <span className="pos-value">{tilt}°</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default PositionSection
