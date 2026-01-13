import { useMemo } from 'react'
import { useControlStore, FlowParams, GlobalMode, LivingPaletteId } from '../stores/controlStore'
import { useOverrideStore, FixtureOverride, ChannelMask, hslToRgb } from '../stores/overrideStore'
import { useTruthStore } from '../stores/truthStore'
import { getLivingColor, mapZoneToSide, Side } from '../utils/frontendColorEngine'
import { calculateMovement } from '../utils/movementGenerator'

/**
 * 🎬 WAVE 339: Extended with optics and physics for simulator
 * 🔧 WAVE 342.5: pan/tilt and physicalPan/physicalTilt are NORMALIZED (0-1)
 */
interface FixtureRenderData {
  color: { r: number, g: number, b: number }
  intensity: number
  pan: number         // 0-1: 0=left, 0.5=center, 1=right (NORMALIZED from DMX 0-255)
  tilt: number        // 0-1: 0=down, 0.5=center, 1=up (NORMALIZED from DMX 0-255)
  // 🔍 WAVE 339: Optics
  zoom: number        // 0-255: 0=Beam, 255=Wash
  focus: number       // 0-255: 0=Sharp, 255=Soft
  // 🎛️ WAVE 339: Physics (interpolated positions) - NORMALIZED 0-1
  physicalPan: number   // Actual position after physics (0-1)
  physicalTilt: number  // Actual position after physics (0-1)
  panVelocity: number   // Current velocity (for debug)
  tiltVelocity: number  // Current velocity (for debug)
}

/**
 * Pure logic for calculating fixture render values
 * WAVE 34.2: Full Priority Hierarchy + WAVE 34.5: Smooth Transitions
 * 
 * 1. OVERRIDE (TOP) - Per-fixture manual values from Inspector
 * 2. FLOW/RADAR (MID) - Global Flow Engine and Kinetic Radar
 * 3. SELENE AI (BASE) - Backend AI decisions
 */
export function calculateFixtureRenderValues(
  truthData: any,
  globalMode: GlobalMode,
  flowParams: FlowParams,
  activePaletteId: LivingPaletteId,
  globalIntensity: number,
  globalSaturation: number = 1,
  fixtureIndex: number = 0,
  fixtureOverride?: FixtureOverride,
  overrideMask?: ChannelMask,
  targetPalette?: LivingPaletteId | null,
  transitionProgress: number = 1
): FixtureRenderData {
  // Default to Truth Data (BASE - Selene AI)
  // 🏛️ WAVE 78: SINGLE SOURCE OF TRUTH
  // All colors and movement come from backend (truthData).
  // Frontend no longer overrides with Flow/Fuego or Radar patterns.
  let color = truthData?.color || { r: 0, g: 0, b: 0 }
  let intensity = (truthData?.intensity ?? 0) * globalIntensity
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔧 WAVE 342.6: PAN/TILT YA VIENEN NORMALIZADOS DEL BACKEND
  // El HAL ya normaliza los valores antes de enviarlos.
  // NO dividir por 255 - eso fue el bug anterior que destruía los valores.
  // 
  // rawPan viene como 0-1, donde:
  //   0.0 = extremo izquierdo
  //   0.5 = centro
  //   1.0 = extremo derecho
  // ═══════════════════════════════════════════════════════════════════════
  let pan = truthData?.pan ?? 0.5  // Already normalized 0-1
  let tilt = truthData?.tilt ?? 0.5  // Already normalized 0-1
  
  // 🔍 DEBUG: Log values every ~1 second
  if (fixtureIndex === 0 && Math.random() < 0.016) {
    console.log(`[🔬 useFixtureRender] pan=${pan.toFixed(3)} | tilt=${tilt.toFixed(3)}`)
  }
  
  // 🔍 WAVE 339: Optics from backend (set by HAL based on vibe)
  const zoom = truthData?.zoom ?? 127        // Default to middle
  const focus = truthData?.focus ?? 127      // Default to middle
  
  // 🎛️ WAVE 339: Physics - interpolated positions from FixturePhysicsDriver
  // These show ACTUAL position after physics simulation (inertia, slew rate)
  // If not available, fall back to target pan/tilt
  // 🔧 WAVE 342.6: Physics values also come normalized (0-1)
  const physicalPan = truthData?.physicalPan ?? pan  // Already normalized
  const physicalTilt = truthData?.physicalTilt ?? tilt  // Already normalized
  const panVelocity = truthData?.panVelocity ?? 0
  const tiltVelocity = truthData?.tiltVelocity ?? 0
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔙 WAVE 80: RESTORED LOCAL LOGIC FOR FLOW MODE
  // 🔧 WAVE 350.8: ONLY apply Flow when globalMode === 'flow' (not when null)
  // PRIORITY 2: GLOBAL MODE 'FLOW' (Color & Movement Override)
  // Only apply if EXPLICITLY in Flow mode AND NOT overridden by fixture override
  // 
  // When globalMode is null or 'selene', respect backend (Selene AI) values.
  // This fixes Canvas 3D showing circles instead of linear sweep pattern.
  // ═══════════════════════════════════════════════════════════════════════
  
  if (globalMode === 'flow') {
    // 🎨 Color: Apply Living Palette unless fixture has color override
    const hasColorOverride = overrideMask?.color === true
    
    if (!hasColorOverride) {
      const fixtureZone = truthData?.zone || 'front'
      const side: Side = mapZoneToSide(fixtureZone)
      // 🎨 WAVE 34.5: Pass transition params for smooth palette blending
      color = getLivingColor(
        activePaletteId,
        intensity > 0 ? intensity : 0.7,
        side,
        globalSaturation,
        targetPalette,
        transitionProgress
      )
    }
    
    // 🌀 Movement: Apply Radar patterns unless fixture has position override
    const hasPositionOverride = overrideMask?.position === true
    
    if (!hasPositionOverride) {
      const movement = calculateMovement({
        pattern: flowParams.pattern,
        speed: flowParams.speed,
        size: flowParams.size,
        basePan: flowParams.basePan,
        baseTilt: flowParams.baseTilt,
        fixtureIndex: fixtureIndex,
      })
      pan = movement.pan
      tilt = movement.tilt
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PRIORITY 1: PER-FIXTURE OVERRIDE (TOP - Always wins)
  // This is preserved because it's direct hardware control from the Inspector
  // ═══════════════════════════════════════════════════════════════════════
  
  if (fixtureOverride && overrideMask) {
    // Color Override: Check HSL first (from Inspector), then RGB
    if (overrideMask?.color) {
      // 🎨 WAVE 34.3: HSL → RGB conversion (Inspector sends HSL)
      const hasHSL = fixtureOverride.h !== undefined || 
                     fixtureOverride.s !== undefined || 
                     fixtureOverride.l !== undefined
      
      if (hasHSL) {
        // Convert HSL to RGB (defaults: H=0, S=100, L=50)
        const h = fixtureOverride.h ?? 0
        const s = fixtureOverride.s ?? 100
        const l = fixtureOverride.l ?? 50
        const rgb = hslToRgb(h, s, l)
        color = { r: rgb.r, g: rgb.g, b: rgb.b }
      } else if (fixtureOverride.r !== undefined || 
                 fixtureOverride.g !== undefined || 
                 fixtureOverride.b !== undefined) {
        // Direct RGB override
        if (fixtureOverride.r !== undefined) color.r = fixtureOverride.r
        if (fixtureOverride.g !== undefined) color.g = fixtureOverride.g
        if (fixtureOverride.b !== undefined) color.b = fixtureOverride.b
      }
      // 🎚️ WAVE 34.4: Transparent Dimmer Merge
      // Color override does NOT affect intensity - Selene/Flow keeps controlling brightness
      // Only explicit dimmer override locks the intensity
    }
    
    // Dimmer Override (only if user explicitly set it)
    if (overrideMask?.dimmer && fixtureOverride.dimmer !== undefined) {
      intensity = fixtureOverride.dimmer / 255
    }
    
    // Position Override (convert degrees to 0-1 range)
    if (overrideMask?.position) {
      if (fixtureOverride.pan !== undefined) {
        pan = fixtureOverride.pan / 540 // 540° max → 0-1
      }
      if (fixtureOverride.tilt !== undefined) {
        tilt = fixtureOverride.tilt / 270 // 270° max → 0-1
      }
    }
  }
  
  // 🎬 WAVE 339: Return full render data including optics and physics
  return { 
    color, 
    intensity, 
    pan, 
    tilt,
    // Optics
    zoom,
    focus,
    // Physics (interpolated positions)
    physicalPan,
    physicalTilt,
    panVelocity,
    tiltVelocity,
  }
}

/**
 * 🔌 useFixtureRender - WAVE 34.2 + 34.5: FULL PRIORITY HIERARCHY + SMOOTH TRANSITIONS
 * 🩸 WAVE 380: Now fetches from truthStore when truthData is null
 * 
 * Checks:
 * 1. overrideStore for per-fixture manual values
 * 2. controlStore for Flow/Radar values
 * 3. Falls back to truthStore (Selene AI)
 */
export function useFixtureRender(
  truthData: any,
  fixtureId: string,
  fixtureIndex: number = 0
): FixtureRenderData {
  // 🩸 WAVE 380: If truthData not passed, fetch from truthStore by fixtureId
  // This enables Stage3DCanvas to get real-time data without cascade re-renders
  const hardwareFixtures = useTruthStore(state => state.truth?.hardware?.fixtures)
  const resolvedTruthData = useMemo(() => {
    if (truthData !== null) return truthData
    // Find fixture in truthStore by ID
    const fixtures = hardwareFixtures || []
    return fixtures.find((f: any) => f?.id === fixtureId) || null
  }, [truthData, hardwareFixtures, fixtureId])
  
  // 1. Read Control Store
  const globalMode = useControlStore(state => state.globalMode)
  const flowParams = useControlStore(state => state.flowParams)
  const activePaletteId = useControlStore(state => state.activePalette)
  const globalIntensity = useControlStore(state => state.globalIntensity)
  const globalSaturation = useControlStore(state => state.globalSaturation)
  
  // 🔄 WAVE 34.5: Read transition state for smooth palette blending
  const targetPalette = useControlStore(state => state.targetPalette)
  const transitionProgress = useControlStore(state => state.transitionProgress)
  
  // 2. Read Override Store (TOP PRIORITY)
  const fixtureOverride = useOverrideStore(state => state.overrides.get(fixtureId))
  
  // 3. Calculate with full hierarchy + transition support
  return calculateFixtureRenderValues(
    resolvedTruthData,
    globalMode,
    flowParams,
    activePaletteId,
    globalIntensity,
    globalSaturation,
    fixtureIndex,
    fixtureOverride?.values,
    fixtureOverride?.mask,
    targetPalette,
    transitionProgress
  )
}
