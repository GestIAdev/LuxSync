import { useMemo } from 'react'
import { useControlStore, FlowParams, GlobalMode, LivingPaletteId } from '../stores/controlStore'
import { useOverrideStore, FixtureOverride, ChannelMask, hslToRgb } from '../stores/overrideStore'
import { getLivingColor, mapZoneToSide, Side } from '../utils/frontendColorEngine'
import { calculateMovement } from '../utils/movementGenerator'

interface FixtureRenderData {
  color: { r: number, g: number, b: number }
  intensity: number
  pan: number
  tilt: number
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
  let color = truthData?.color || { r: 0, g: 0, b: 0 }
  let intensity = (truthData?.intensity ?? 0) * globalIntensity
  let pan = truthData?.pan ?? 0.5
  let tilt = truthData?.tilt ?? 0.5
  
  // ═══════════════════════════════════════════════════════════════════════
  // PRIORITY 2: GLOBAL MODE 'MANUAL' or 'FLOW' (Color Override)
  // Only apply if NOT overridden by individual fixture override
  // ═══════════════════════════════════════════════════════════════════════
  
  if (globalMode !== 'selene') {
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
  
  return { color, intensity, pan, tilt }
}

/**
 * 🔌 useFixtureRender - WAVE 34.2 + 34.5: FULL PRIORITY HIERARCHY + SMOOTH TRANSITIONS
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
    truthData,
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
