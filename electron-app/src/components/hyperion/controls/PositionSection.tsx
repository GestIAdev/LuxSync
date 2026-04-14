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

import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react'
import { useSelectedArray } from '../../../stores/selectionStore'
import { useHardware } from '../../../stores/truthStore'
import { useStageStore } from '../../../stores/stageStore'
import { XYPad, RadarXY, type GhostPoint, SpatialTargetPad, type SpatialFixtureGhost, VSlider } from './controls'
import { PatternSelector, type PatternType } from './controls'
import { PositionIcon } from '../../icons/LuxIcons'
import type { Target3D, IKResult } from '../../../engine/movement/InverseKinematicsEngine'

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
  const [activePattern, setActivePattern] = useState<PatternType>('none')
  const [patternSpeed, setPatternSpeed] = useState(50)  // 0-100
  const [patternSize, setPatternSize] = useState(50)    // 0-100
  
  // WAVE 377: Calibration mode state
  const [isCalibrating, setIsCalibrating] = useState(false)
  
  // WAVE 430.5: Fan control for group mode
  const [fanValue, setFanValue] = useState(0)  // -100 to 100

  // ═══════════════════════════════════════════════════════════════════════
  // 🎯 WAVE 2613: SPATIAL MODE — "Dile dónde mirar, no cuántos grados"
  // Toggle: GRADOS (classic RadarXY) ↔ SPATIAL (SpatialTargetPad + IK)
  // ═══════════════════════════════════════════════════════════════════════
  const [isSpatialMode, setIsSpatialMode] = useState(false)
  const [spatialTarget, setSpatialTarget] = useState<Target3D>({ x: 0, y: 2, z: 0 })
  const [spatialReachability, setSpatialReachability] = useState<Record<string, IKResult>>({})
  const spatialTargetRef = useRef<Target3D>({ x: 0, y: 2, z: 0 })

  // WAVE 2624: Spatial Fan state
  const [spatialFanMode, setSpatialFanMode] = useState<'converge' | 'line' | 'circle'>('converge')
  const [spatialFanAmplitude, setSpatialFanAmplitude] = useState(0)
  const [spatialSubTargets, setSpatialSubTargets] = useState<Record<string, Target3D>>({})
  const spatialFanModeRef = useRef<'converge' | 'line' | 'circle'>('converge')
  const spatialFanAmplitudeRef = useRef(0)

  // Stage dimensions from stageStore (for SpatialTargetPad)
  const stageFromStore = useStageStore((s) => s.stage)
  const stageFixtures = useStageStore((s) => s.fixtures)

  // 🔧 WAVE 2223: POLTERGEIST FIX — Reset local state when parent clears override
  // Without this, handleUnlockAll purges the backend but PositionSection's
  // activePattern stays stale → next XY touch re-injects a hold anchor.
  const prevHasOverrideRef = React.useRef(hasOverride)
  useEffect(() => {
    if (prevHasOverrideRef.current && !hasOverride) {
      // Parent cleared our override (UNLOCK ALL) → flush local state
      setActivePattern('none')
      setIsCalibrating(false)
      setPan(270)
      setTilt(135)
      setPatternSpeed(50)
      setPatternSize(50)
    }
    prevHasOverrideRef.current = hasOverride
  }, [hasOverride])
  
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
      // 🔄 WAVE 2042.22: HYDRATE-FIRST STRATEGY
      // OLD: Flush → Hydrate (pattern se perdía en el flush)
      // NEW: Hydrate → Apply defaults only to nulls
      // ═══════════════════════════════════════════════════════════════════
      
      // Si no hay selección, aplicar defaults y salir
      if (selectedIds.length === 0) {
        setPan(256)           // Centro seguro (513/2 ≈ 256°)
        setTilt(128)          // Centro seguro (256/2 = 128°)
        setActivePattern('static')
        setPatternSpeed(50)
        setPatternSize(50)
        console.log(`[Position] 🧼 FLUSH: No selection, defaults applied`)
        return
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // 🧠 PASO 1: HIDRATAR PRIMERO - Pedir estado real al Arbiter
      // ═══════════════════════════════════════════════════════════════════
      try {
        const result = await window.lux?.arbiter?.getFixturesState(selectedIds)
        
        if (!isMounted) return
        
        // Si el backend no responde, aplicar defaults
        if (!result?.success || !result?.state) {
          setPan(256)
          setTilt(128)
          setActivePattern('static')
          setPatternSpeed(50)
          setPatternSize(50)
          console.log(`[Position] 🧼 FLUSH: No backend state, applying defaults`)
          return
        }
        
        const { state } = result
        
        // ═══════════════════════════════════════════════════════════════════
        // 🎯 PASO 2: APLICAR valores con DEFAULTS CONDICIONALES
        // Si viene del backend (no null) = usar ese valor
        // Si es null (AI control) = aplicar default
        // ═══════════════════════════════════════════════════════════════════
        
        // --- POSITION ---
        setPan(state.pan !== null ? state.pan : 256)
        setTilt(state.tilt !== null ? state.tilt : 128)
        
        // --- PATTERN ---
        if (state.pattern !== null) {
          // 'hold' from engine = 'static' in UI (Hold button lit)
          // actual pattern names pass through
          const uiPattern = state.pattern === 'hold' ? 'static' : state.pattern
          setActivePattern(uiPattern as PatternType)
        } else {
          // No pattern active → 'none' (no button highlighted)
          setActivePattern('none')
        }
        
        // --- DYNAMICS ---
        setPatternSpeed(state.speed !== null ? state.speed : 50)
        setPatternSize(state.amplitude !== null ? state.amplitude : 50)
        
        console.log(`[Position] 🧠 Hydrated fixture ${selectedIds[0]} - Pattern: ${state.pattern ?? 'AI'}`)
      } catch (err) {
        console.error('[Position] Hydration error:', err)
        // En caso de error, aplicar defaults
        setPan(256)
        setTilt(128)
        setActivePattern('static')
        setPatternSpeed(50)
        setPatternSize(50)
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
    
    try {
      // ═══════════════════════════════════════════════════════════════════
      // 🔥 WAVE 2496: FORMATION MODE — Individual overrides per fixture
      // Before: ALL fixtures got the same center position → 2 froze, 1 responded
      // Now: Each fixture gets its individual ghost-point position (center + fan spread)
      // Mirrors handleFanChange pattern which already worked correctly.
      // ═══════════════════════════════════════════════════════════════════
      if (selectedIds.length > 1) {
        const basePanNorm = safePan / 540
        const baseTiltNorm = safeTilt / 270
        const spread = (fanValue / 100) * 0.3
        
        for (let i = 0; i < selectedIds.length; i++) {
          const fixtureId = selectedIds[i]
          const offsetIndex = i - (selectedIds.length - 1) / 2
          const offsetX = selectedIds.length > 1
            ? offsetIndex * spread / (selectedIds.length - 1)
            : 0
          
          const fixturePanNorm = Math.max(0, Math.min(1, basePanNorm + offsetX))
          const fixturePanDmx = Math.min(242, Math.round(fixturePanNorm * 255))
          const fixtureTiltDmx = Math.min(241, Math.round(baseTiltNorm * 255))
          
          await window.lux?.arbiter?.setManual({
            fixtureIds: [fixtureId],
            controls: {
              pan: fixturePanDmx,
              tilt: fixtureTiltDmx,
            },
            channels: ['pan', 'tilt'],
          })
        }
        
        console.log(`[Position] 🎯 FORMATION: ${selectedIds.length} fixtures, fan=${fanValue}%, center P${safePan}/T${safeTilt}`)
      } else {
        // Single fixture: direct position
        const panDmx = Math.min(242, Math.round((safePan / 540) * 255))
        const tiltDmx = Math.min(241, Math.round((safeTilt / 270) * 255))
        
        await window.lux?.arbiter?.setManual({
          fixtureIds: selectedIds,
          controls: {
            pan: panDmx,
            tilt: tiltDmx,
          },
          channels: ['pan', 'tilt'],
        })
        
        if (activePattern !== 'static') {
          console.log(`[Position] 🕹️ RE-ANCHOR: Pattern ${activePattern} now orbits P${panDmx}/T${tiltDmx}`)
        } else {
          console.log(`[Position] 🕹️ Pan: ${safePan}° (DMX ${panDmx}) Tilt: ${safeTilt}° (DMX ${tiltDmx})`)
        }
      }
    } catch (err) {
      console.error('[Position] Error:', err)
    }
  }, [selectedIds, activePattern, onOverrideChange, fanValue])
  
  /**
   * Pattern change - Procedural movement
   * 🛑 WAVE 999.5: HOLD = FRENO DE MANO ACTIVO
   * 
   * HOLD ('static' en UI) → setMovementPattern('hold') → INMOVILIDAD TOTAL
   * Circle/Eight/Sweep → setMovementPattern(pattern) → Override activo
   * UNLOCK ALL → setMovementPattern(null) → Release a AI
   * 
   * � WAVE 2070.3b: THE HIGHLANDER — Only one motor commands patterns.
   * Patterns live EXCLUSIVELY in MasterArbiter Layer 2 (activePatterns).
   * CHOREO (VibeMovementManager / Layer 0) is NOT touched from here.
   */
  const handlePatternChange = useCallback(async (pattern: PatternType) => {
    setActivePattern(pattern)
    
    onOverrideChange(true)
    
    // 🔧 WAVE 2071.2: UX POLISH — Map UI string to engine string.
    // 'none' = user deselected pattern → send 'hold' to kill active pattern but keep anchor
    // 'static' (Hold button) = freeze → send 'hold' to create anchor without pattern
    // circle/eight/sweep = real pattern → pass through
    const enginePattern = (pattern === 'none' || pattern === 'static') ? 'hold' : pattern
    
    try {
      await window.lux?.arbiter?.setManualFixturePattern({
        fixtureIds: selectedIds,
        pattern: enginePattern,
        speed: patternSpeed,
        amplitude: patternSize,
      })
      
      if (pattern === 'none') {
        console.log(`[Position] ⬜ Pattern DESELECTED — anchor maintained`)
      } else if (pattern === 'static') {
        console.log(`[Position] 🧊 HOLD: Fixture frozen at anchor`)
      } else {
        console.log(`[Position] 🎯 Pattern ${pattern} ARMED: Speed=${patternSpeed}% Amp=${patternSize}%`)
      }
    } catch (err) {
      console.error('[Position] Pattern error:', err)
    }
  }, [selectedIds, onOverrideChange, patternSpeed, patternSize])
  
  /**
   * Pattern speed/size change
   * 🔧 WAVE 2070.3b: THE HIGHLANDER — Only updates MasterArbiter Layer 2.
   * Does NOT touch CHOREO/VibeMovementManager (Layer 0).
   */
  const handlePatternParamsChange = useCallback(async (speed: number, size: number) => {
    setPatternSpeed(speed)
    setPatternSize(size)
    
    try {
      // Only send params if a real motion pattern is active (not 'none' or 'static')
      if (activePattern !== 'none' && activePattern !== 'static') {
        await window.lux?.arbiter?.setManualFixturePattern({
          fixtureIds: selectedIds,
          pattern: activePattern,
          speed: speed,
          amplitude: size,
        })
      }
      
      console.log(`[Position] 🎚️ Params updated (Layer 2 only): Speed=${speed}% Amp=${size}%`)
    } catch (err) {
      console.error('[Position] Movement params error:', err)
    }
  }, [activePattern, selectedIds])
  
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
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎯 WAVE 2613: SPATIAL TARGET HANDLER
  // Sends Target3D to MasterArbiter via IPC.
  // Returns per-fixture IKResult for reachability feedback (WAVE 2615).
  // ═══════════════════════════════════════════════════════════════════════

  const handleSpatialTargetChange = useCallback(async (newTarget: Target3D) => {
    setSpatialTarget(newTarget)
    spatialTargetRef.current = newTarget
    onOverrideChange(true)

    try {
      const result = await window.lux?.arbiter?.applySpatialTarget({
        target: newTarget,
        fixtureIds: selectedIds,
        fanMode: spatialFanModeRef.current,
        fanAmplitude: spatialFanAmplitudeRef.current,
      })
      if (result?.success && result.results) {
        setSpatialReachability(result.results)
        // WAVE 2624: Extract sub-targets for SVG beam rays
        const subs: Record<string, Target3D> = {}
        for (const [id, r] of Object.entries(result.results)) {
          const res = r as any
          if (res.subTarget) {
            subs[id] = res.subTarget
          }
        }
        setSpatialSubTargets(subs)
      }
    } catch (err) {
      console.error('[Position] 🎯 Spatial target error:', err)
    }
  }, [selectedIds, onOverrideChange])

  const handleSpatialCenter = useCallback(() => {
    handleSpatialTargetChange({ x: 0, y: 2, z: 0 })
  }, [handleSpatialTargetChange])

  // WAVE 2624: Fan mode/amplitude change handlers
  const handleFanModeChange = useCallback((mode: 'converge' | 'line' | 'circle') => {
    setSpatialFanMode(mode)
    spatialFanModeRef.current = mode
    // Re-solve with current target and new mode
    handleSpatialTargetChange(spatialTargetRef.current)
  }, [handleSpatialTargetChange])

  const handleFanAmplitudeChange = useCallback((amplitude: number) => {
    setSpatialFanAmplitude(amplitude)
    spatialFanAmplitudeRef.current = amplitude
    // Re-solve with current target and new amplitude
    handleSpatialTargetChange(spatialTargetRef.current)
  }, [handleSpatialTargetChange])

  // Build SpatialFixtureGhost[] from stageStore fixtures that match current selection
  const spatialFixtureGhosts = useMemo((): SpatialFixtureGhost[] => {
    if (!isSpatialMode || !stageFixtures) return []
    const ghosts: SpatialFixtureGhost[] = []
    for (const id of selectedIds) {
      const sf = stageFixtures.find((f) => f.id === id)
      if (sf) {
        ghosts.push({
          id: sf.id,
          name: sf.name,
          position: sf.position,
        })
      }
    }
    return ghosts
  }, [selectedIds, stageFixtures, isSpatialMode])

  // Stage dimensions with fallback
  const spatialStage = useMemo(() => stageFromStore ?? {
    width: 12,
    depth: 10,
    height: 6,
    gridSize: 1,
  }, [stageFromStore])
  
  /**
   * Release position back to AI
   * 
   * 👻 WAVE 2042.21: GHOST HANDOFF
   * Antes de soltar, le decimos a la IA: "Tu nuevo Home es aquí"
   * Así el fixture no salta a una posición random, sino que Selene
   * empieza a modificarlo sutilmente desde donde el operador lo dejó.
   */
  const handleRelease = useCallback(async () => {
    // 1. UI state reset — 'none' so no button is highlighted
    onOverrideChange(false)
    setActivePattern('none')
    setIsCalibrating(false)
    
    // 🔧 WAVE 2071.2: Reset radar to physical center so it has full range next time
    setPan(270)   // Center of 0-540° range
    setTilt(135)  // Center of 0-270° range
    
    // 🎯 WAVE 2613: Release spatial target if active
    if (isSpatialMode) {
      setSpatialReachability({})
      try {
        await window.lux?.arbiter?.releaseSpatialTarget({ fixtureIds: selectedIds })
      } catch (err) {
        console.error('[Position] 🎯 Spatial release error:', err)
      }
    }
    
    try {
      // Step 1: Destroy pattern in backend
      await window.lux?.arbiter?.setManualFixturePattern({
        fixtureIds: selectedIds,
        pattern: null,
        speed: 0,
        amplitude: 0,
      })
      
      // Step 2: Release ALL manual overrides - total amnesty
      // Backend also purges activePatterns + fixtureOrigins (WAVE 2070.3)
      await window.lux?.arbiter?.clearManual({
        fixtureIds: selectedIds,
      })
      console.log(`[Position] 🔓 RELEASE: Pattern destroyed + overrides cleared + radar reset for ${selectedIds.length} fixtures`)
    } catch (err) {
      console.error('[Position] Release error:', err)
    }
  }, [selectedIds, onOverrideChange, isSpatialMode])
  
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
              WAVE 2616: LAYOUT DESACOPLADO
              Los controles Speed/Amp rodean SIEMPRE al pad activo.
              PatternSelector + Fan viven DEBAJO, independientes del modo.
              
              Estructura:
              [MODE TOGGLE] (solo multi)
              [SPD] [──PAD ACTIVO──] [AMP]
              [FAN] (solo multi/grados)
              [PATTERNS]
              [PAN/TILT sliders] (solo single)
              ═══════════════════════════════════════════════════════════════════════ */}
          
          {/* WAVE 2613: MODE TOGGLE — GRADOS / SPATIAL (only shows in multi-selection) */}
          {isMultiSelection && (
            <div className="spatial-mode-toggle">
              <button
                className={`spatial-mode-btn${!isSpatialMode ? ' active-degrees' : ''}`}
                onClick={() => {
                  if (isSpatialMode) {
                    setIsSpatialMode(false)
                    setSpatialReachability({})
                    window.lux?.arbiter?.releaseSpatialTarget({ fixtureIds: selectedIds })
                      ?.catch(() => {})
                  }
                }}
              >
                GRADOS
              </button>
              <button
                className={`spatial-mode-btn${isSpatialMode ? ' active-spatial' : ''}`}
                onClick={() => {
                  if (!isSpatialMode) {
                    setIsSpatialMode(true)
                    handleSpatialTargetChange(spatialTargetRef.current)
                  }
                }}
              >
                ⊕ SPATIAL
              </button>
            </div>
          )}
          
          {/* ═══════════════════════════════════════════════════════════════════════
              WAVE 2616: TACTICAL LAYOUT UNIFICADO
              [SPD] [──PAD ACTIVO──] [AMP]
              Speed/Amp SIEMPRE visibles, pad cambia según modo.
              ═══════════════════════════════════════════════════════════════════════ */}
          <div className={`position-mode ${isMultiSelection ? 'formation-mode' : 'sniper-mode'}`}>
            <div className={`tactical-compact-layout${!isMultiSelection ? ' sniper-layout' : ''}${isSpatialMode && isMultiSelection ? ' spatial-active' : ''}`}>
              {/* 🚀 SPEED SLIDER — Siempre presente */}
              <VSlider
                track="speed"
                value={patternSpeed}
                onChange={(v) => handlePatternParamsChange(v, patternSize)}
                disabled={selectedIds.length === 0}
                variant={isMultiSelection ? 'formation' : 'sniper'}
              />
              
              {/* 🎯 PAD CENTRAL — Cambia según modo */}
              <div className={`radar-flex-container${!isMultiSelection ? ' sniper-pad' : ''}`}>
                {isMultiSelection ? (
                  isSpatialMode ? (
                    <SpatialTargetPad
                      target={spatialTarget}
                      onChange={handleSpatialTargetChange}
                      fixtures={spatialFixtureGhosts}
                      stage={spatialStage}
                      disabled={isCalibrating}
                      onCenter={handleSpatialCenter}
                      reachabilityMap={spatialReachability}
                      fanMode={spatialFanMode}
                      onFanModeChange={handleFanModeChange}
                      fanAmplitude={spatialFanAmplitude}
                      onFanAmplitudeChange={handleFanAmplitudeChange}
                      subTargets={spatialSubTargets}
                    />
                  ) : (
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
                  )
                ) : (
                  <XYPad
                    pan={pan}
                    tilt={tilt}
                    onChange={handlePositionChange}
                    onCenter={handleCenter}
                    disabled={isCalibrating}
                  />
                )}
              </div>
              
              {/* 📏 AMP SLIDER — Siempre presente */}
              <VSlider
                track="amp"
                value={patternSize}
                onChange={(v) => handlePatternParamsChange(patternSpeed, v)}
                disabled={selectedIds.length === 0}
                variant={isMultiSelection ? 'formation' : 'sniper'}
              />
            </div>
            
            {/* FAN CONTROL — Solo formation mode + grados */}
            {isMultiSelection && !isSpatialMode && !isCalibrating && (
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
          
          {/* PATTERNS — Siempre visible (disabled in calibration) */}
          {!isCalibrating && (
            <PatternSelector
              activePattern={activePattern}
              speed={patternSpeed}
              size={patternSize}
              onPatternChange={handlePatternChange}
              onParamsChange={handlePatternParamsChange}
            />
          )}
          
          {/* POSITION SLIDERS — Solo single mode */}
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
