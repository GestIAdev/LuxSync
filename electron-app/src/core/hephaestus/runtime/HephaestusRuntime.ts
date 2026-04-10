/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPHAESTUS RUNTIME - WAVE 2030.18: THE RUNTIME
 * 
 * El Ejecutor Universal de efectos .lfx de Hephaestus.
 * En lugar de buscar efectos por nombre en un registro estático,
 * este runtime carga archivos dinámicamente y evalúa curvas en tiempo real.
 * 
 * ARQUITECTURA:
 * ┌─────────────────────────┐
 * │  chronos:triggerHeph    │
 * │  (filePath, duration)   │
 * └───────────┬─────────────┘
 *             │ play(path)
 *             ▼
 * ┌─────────────────────────┐
 * │   HEPHAESTUS RUNTIME    │
 * │  - Load .lfx file       │
 * │  - Cache parsed clips   │
 * │  - Evaluate curves      │
 * │  - Inject to fixtures   │
 * └───────────┬─────────────┘
 *             │ tick(currentTimeMs)
 *             ▼
 * ┌─────────────────────────┐
 * │   FixtureBuffer (DMX)   │
 * └─────────────────────────┘
 * 
 * AXIOMA ANTI-SIMULACIÓN:
 * Real files, real math, real DMX values.
 * 
 * @module core/hephaestus/runtime/HephaestusRuntime
 * @version WAVE 2030.18
 */

import * as fs from 'fs'
import * as path from 'path'
import type { HephAutomationClip, HephCurve, HSL, FixturePhase, PhaseConfig } from '../types'
import { DEFAULT_PHASE_CONFIG } from '../types'
import type { EffectZone } from '../../effects/types'
import { deserializeHephClip, type HephAutomationClipSerialized } from '../types'
import { CurveEvaluator } from '../CurveEvaluator'
import { PhaseDistributor } from './PhaseDistributor'
import { resolveFixtureSelector } from '../../stage/ShowFileV2'
import { resolveZoneTags } from '../../zones/ZoneMapper'
import { masterArbiter } from '../../arbiter'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Active clip being executed */
interface ActiveHephClip {
  /** Unique instance ID */
  instanceId: string
  
  /** Path to .lfx file */
  filePath: string
  
  /** Parsed clip data */
  clip: HephAutomationClip
  
  /** CurveEvaluator instance for this clip */
  evaluator: CurveEvaluator
  
  /** Start time in ms (system time) */
  startTimeMs: number
  
  /** Duration in ms */
  durationMs: number
  
  /** Current intensity multiplier (0-1) */
  intensity: number
  
  /** Is the clip looping? */
  loop: boolean

  // ── WAVE 2400: Phase Distribution ──────────────────────────────────

  /**
   * Pre-calculated fixture phases. Resolved ONCE at play() time.
   * Sorted by phaseOffsetMs ASC for cursor cache optimization.
   * null = legacy mode (zones without phase, backward compat)
   */
  fixturePhases: FixturePhase[] | null

  /**
   * Phase config used to generate fixturePhases.
   * Stored for runtime introspection/debug UI.
   */
  phaseConfig: PhaseConfig | null
}

/** 
 * ⚒️ WAVE 2030.21: DMX-READY output from HephaestusRuntime
 * Values are PRE-SCALED to DMX format. TitanOrchestrator only merges, never scales.
 * 
 * SCALING RULES:
 *   - intensity/strobe/white/amber → int 0-255
 *   - pan/tilt → 16-bit: coarse 0-255 + fine 0-255 (val16 = val * 65535)
 *   - zoom/focus/iris/gobo1/gobo2/prism → int 0-255 (extended DMX params)
 *   - color → { r, g, b } each 0-255
 *   - speed/width/direction/globalComp → float 0-1 (engine-internal)
 */
export interface HephFixtureOutput {
  fixtureId: string
  zone: EffectZone | 'all'
  parameter: string
  /** DMX-scaled value: 0-255 for DMX params, 0-1 for engine-internal params */
  value: number
  /** RGB color pre-converted from HSL (only for 'color' parameter) */
  rgb?: { r: number; g: number; b: number }
  /**
   * ⚒️ WAVE 2030.24: 16-bit fine channel for pan/tilt.
   * When parameter is 'pan' or 'tilt', this carries the fine byte (LSB).
   * `value` carries the coarse byte (MSB).
   * Together: val16 = (coarse << 8) | fine = original float * 65535
   */
  fine?: number
  source: 'hephaestus-runtime'
}

// ═══════════════════════════════════════════════════════════════════════════
// HSL → RGB CONVERSION (Pure math, no dependencies)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚒️ WAVE 2030.21: Convert HSL to RGB
 * Self-contained helper - no external dependency needed.
 * 
 * @param h Hue 0-360
 * @param s Saturation 0-1
 * @param l Lightness 0-1
 * @returns { r, g, b } each 0-255
 */
export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  // Normalize hue to 0-360
  const hue = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1))
  const m = l - c / 2

  let r1: number, g1: number, b1: number

  if (hue < 60) { r1 = c; g1 = x; b1 = 0 }
  else if (hue < 120) { r1 = x; g1 = c; b1 = 0 }
  else if (hue < 180) { r1 = 0; g1 = c; b1 = x }
  else if (hue < 240) { r1 = 0; g1 = x; b1 = c }
  else if (hue < 300) { r1 = x; g1 = 0; b1 = c }
  else { r1 = c; g1 = 0; b1 = x }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DMX SCALING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/** Parameters that scale 0-1 → 0-255 (DMX channels, 8-bit standard) */
const DMX_SCALED_PARAMS = new Set([
  'intensity', 'strobe', 'white', 'amber',
  'zoom', 'focus', 'iris', 'gobo1', 'gobo2', 'prism',
])

/**
 * ⚒️ WAVE 2030.24: 16-bit movement params.
 * These scale 0-1 → 0-65535 and emit BOTH coarse (MSB) and fine (LSB).
 */
const DMX_16BIT_PARAMS = new Set(['pan', 'tilt'])

/** Parameters that pass through as 0-1 floats (engine-internal) */
const FLOAT_PASSTHROUGH_PARAMS = new Set([
  'speed', 'width', 'direction', 'globalComp',
])

/**
 * ⚒️ WAVE 2030.24: Scale a raw 0-1 curve value to DMX format
 * 
 * 16-bit params (pan/tilt): returns coarse byte (0-255).
 * Use scaleToDMX16 for the full { coarse, fine } pair.
 * 
 * 8-bit DMX params: 0-1 → 0-255 (clamped).
 * Engine params: 0-1 passthrough (clamped).
 */
export function scaleToDMX(paramId: string, rawValue: number): number {
  const clamped = Math.max(0, Math.min(1, rawValue))

  if (DMX_16BIT_PARAMS.has(paramId)) {
    // 16-bit: return coarse byte (MSB) for backward compatibility
    const val16 = Math.round(clamped * 65535)
    return (val16 >> 8) & 0xFF
  }

  if (DMX_SCALED_PARAMS.has(paramId)) {
    return Math.round(clamped * 255)
  }

  // Engine-internal params: clamp 0-1, no scaling
  return clamped
}

/**
 * ⚒️ WAVE 2030.24: 16-bit scaling — returns { coarse, fine } pair.
 * 
 * coarse = MSB = (val16 >> 8) & 0xFF
 * fine   = LSB = val16 & 0xFF
 * 
 * Example:
 *   0.5000 → val16=32768 → coarse=128, fine=0
 *   0.5019 → val16=32893 → coarse=128, fine=125
 */
export function scaleToDMX16(rawValue: number): { coarse: number; fine: number } {
  const clamped = Math.max(0, Math.min(1, rawValue))
  const val16 = Math.round(clamped * 65535)
  return {
    coarse: (val16 >> 8) & 0xFF,
    fine: val16 & 0xFF,
  }
}

/** Runtime statistics */
export interface HephRuntimeStats {
  activeClips: number
  totalTriggered: number
  cacheSize: number
  lastTickMs: number
}

// ═══════════════════════════════════════════════════════════════════════════
// HEPHAESTUS RUNTIME
// ═══════════════════════════════════════════════════════════════════════════

export class HephaestusRuntime {
  /** Cache of loaded clips (path → parsed clip) */
  private clipCache: Map<string, HephAutomationClip> = new Map()
  
  /** Currently active clips being executed */
  private activeClips: Map<string, ActiveHephClip> = new Map()
  
  /** Instance counter for unique IDs */
  private instanceCounter = 0
  
  /** Statistics */
  private totalTriggered = 0
  private lastTickMs = 0
  
  /** Debug mode */
  private debug = true
  
  // ─────────────────────────────────────────────────────────────────────────
  // CLIP LOADING
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Load and cache a .lfx file
   * Returns the parsed clip or null if failed
   */
  loadClip(filePath: string): HephAutomationClip | null {
    // Check cache first
    if (this.clipCache.has(filePath)) {
      return this.clipCache.get(filePath)!
    }
    
    try {
      // Read file
      if (!fs.existsSync(filePath)) {
        console.error(`[HephRuntime] ❌ File not found: ${filePath}`)
        return null
      }
      
      const content = fs.readFileSync(filePath, 'utf-8')
      
      // Validate content is not empty
      if (!content || content.trim().length === 0) {
        console.error(`[HephRuntime] ❌ Empty file: ${filePath}`)
        return null
      }
      
      // Parse JSON
      let parsed: any
      try {
        parsed = JSON.parse(content)
      } catch (parseErr) {
        console.error(`[HephRuntime] ❌ Invalid JSON in ${filePath}:`, parseErr)
        return null
      }
      
      // ⚒️ WAVE 2030.20: UNWRAP FILE FORMAT
      // .lfx files have wrapper structure: { $schema, version, clip: {...} }
      // We need the inner 'clip' object for deserialization
      let serialized: HephAutomationClipSerialized
      
      if (parsed.clip && typeof parsed.clip === 'object') {
        // File format v1.0.0: { clip: {...} }
        serialized = parsed.clip
      } else if (parsed.curves && typeof parsed.curves === 'object') {
        // Legacy format: direct clip object
        serialized = parsed
      } else {
        console.error(`[HephRuntime] ❌ Invalid clip structure in ${filePath}: no 'clip' or 'curves' field`)
        return null
      }
      
      // Validate structure
      if (!serialized || typeof serialized !== 'object') {
        console.error(`[HephRuntime] ❌ Invalid clip structure in ${filePath}: not an object`)
        return null
      }
      
      if (!serialized.curves || typeof serialized.curves !== 'object') {
        console.error(`[HephRuntime] ❌ Invalid clip structure in ${filePath}: missing or invalid curves`)
        return null
      }
      
      // ⚒️ WAVE 2030.20: VALIDATE CURVES STRUCTURE
      // Each curve must have a keyframes array
      for (const [paramId, curve] of Object.entries(serialized.curves)) {
        if (!curve || typeof curve !== 'object') {
          console.error(`[HephRuntime] ❌ Invalid curve '${paramId}' in ${filePath}: not an object`)
          return null
        }
        
        const hephCurve = curve as any
        if (!Array.isArray(hephCurve.keyframes)) {
          console.error(`[HephRuntime] ❌ Invalid curve '${paramId}' in ${filePath}: keyframes is not an array`)
          return null
        }
        
        if (hephCurve.keyframes.length === 0) {
          console.warn(`[HephRuntime] ⚠️ Curve '${paramId}' in ${filePath} has no keyframes (will be ignored)`)
        }
      }
      
      // Deserialize (converts curves Record to Map)
      const clip = deserializeHephClip(serialized)
      
      // Final validation
      if (!clip || !clip.curves || clip.curves.size === 0) {
        console.error(`[HephRuntime] ❌ Deserialization failed or empty curves in ${filePath}`)
        return null
      }
      
      // Cache it
      this.clipCache.set(filePath, clip)
      
      if (this.debug) {
        console.log(`[HephRuntime] 📁 Loaded: ${path.basename(filePath)} (${clip.curves.size} curves, ${clip.durationMs}ms)`)
      }
      
      return clip
    } catch (err) {
      console.error(`[HephRuntime] ❌ Failed to load ${filePath}:`, err)
      return null
    }
  }
  
  /**
   * Invalidate cache for a specific file (on external save)
   */
  invalidateCache(filePath: string): void {
    this.clipCache.delete(filePath)
    if (this.debug) {
      console.log(`[HephRuntime] 🗑️ Cache invalidated: ${path.basename(filePath)}`)
    }
  }
  
  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.clipCache.clear()
    if (this.debug) {
      console.log('[HephRuntime] 🗑️ Cache cleared')
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PLAYBACK CONTROL
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * ▶️ Trigger a .lfx clip
   * Loads the file (cached), starts execution
   * 
   * ⚒️ WAVE 2400: Now resolves PhaseDistributor if clip has phase config.
   * 
   * @param filePath Path to .lfx file
   * @param options Playback options
   * @returns Instance ID for tracking, or null if failed
   */
  play(filePath: string, options: {
    intensity?: number
    durationOverrideMs?: number
    loop?: boolean
    /** ⚒️ WAVE 2400: External fixture IDs for phase distribution (pre-resolved) */
    fixtureIds?: string[]
  } = {}): string | null {
    const clip = this.loadClip(filePath)
    if (!clip) {
      return null
    }
    
    const instanceId = `heph_${++this.instanceCounter}_${Date.now()}`
    const now = Date.now()
    
    // Create the curve evaluator instance for this clip
    const evaluator = new CurveEvaluator(clip.curves, clip.durationMs)

    // ── WAVE 2400: Resolve phase distribution ─────────────────────────
    const { fixturePhases, phaseConfig } = this.resolvePhaseForClip(
      clip,
      options.durationOverrideMs ?? clip.durationMs,
      options.fixtureIds
    )
    
    const activeClip: ActiveHephClip = {
      instanceId,
      filePath,
      clip,
      evaluator,
      startTimeMs: now,
      durationMs: options.durationOverrideMs ?? clip.durationMs,
      intensity: options.intensity ?? 1.0,
      loop: options.loop ?? false,
      fixturePhases,
      phaseConfig,
    }
    
    this.activeClips.set(instanceId, activeClip)
    this.totalTriggered++

    // ⚒️ WAVE 2400: Ensure output buffer capacity
    this.ensureOutputCapacity(this.estimateTotalOutputs())
    
    if (this.debug) {
      const phaseInfo = fixturePhases
        ? ` [PHASE: ${fixturePhases.length} fixtures, ${phaseConfig?.symmetry}]`
        : ''
      console.log(`[HephRuntime] ▶️ PLAY: ${clip.name} (${activeClip.durationMs}ms)${phaseInfo} ID=${instanceId}`)
    }
    
    return instanceId
  }
  
  /**
   * ▶️ WAVE 2040.22: Play from an in-memory HephAutomationClip (Diamond Data)
   * 
   * Unlike play(), this doesn't need a file on disk — the curves arrive
   * inline via the Chronos timeline (serialized in the FXClip, deserialized 
   * by IPCHandlers). This is the DIAMOND PATH for Hephaestus clips.
   * 
   * ⚒️ WAVE 2400: Now resolves PhaseDistributor if clip has phase config.
   * 
   * @param clip Pre-deserialized HephAutomationClip with Map<> curves
   * @param options Playback options
   * @returns Instance ID for tracking
   */
  playFromClip(clip: HephAutomationClip, options: {
    intensity?: number
    durationOverrideMs?: number
    loop?: boolean
    /** ⚒️ WAVE 2400: External fixture IDs for phase distribution (pre-resolved) */
    fixtureIds?: string[]
  } = {}): string {
    const instanceId = `heph_diamond_${++this.instanceCounter}_${Date.now()}`
    const now = Date.now()
    
    const evaluator = new CurveEvaluator(clip.curves, clip.durationMs)

    // ── WAVE 2400: Resolve phase distribution ─────────────────────────
    const { fixturePhases, phaseConfig } = this.resolvePhaseForClip(
      clip,
      options.durationOverrideMs ?? clip.durationMs,
      options.fixtureIds
    )
    
    const activeClip: ActiveHephClip = {
      instanceId,
      filePath: '<diamond-inline>',  // No file — curves came inline
      clip,
      evaluator,
      startTimeMs: now,
      durationMs: options.durationOverrideMs ?? clip.durationMs,
      intensity: options.intensity ?? 1.0,
      loop: options.loop ?? false,
      fixturePhases,
      phaseConfig,
    }
    
    this.activeClips.set(instanceId, activeClip)
    this.totalTriggered++

    // ⚒️ WAVE 2400: Ensure output buffer capacity
    this.ensureOutputCapacity(this.estimateTotalOutputs())
    
    if (this.debug) {
      const phaseInfo = fixturePhases
        ? ` [PHASE: ${fixturePhases.length} fixtures, ${phaseConfig?.symmetry}]`
        : ''
      console.log(`[HephRuntime] ▶️💎 DIAMOND PLAY: ${clip.name} (${activeClip.durationMs}ms) ${clip.curves.size} curves${phaseInfo} ID=${instanceId}`)
    }
    
    return instanceId
  }
  
  /**
   * ⏹️ Stop a specific clip instance
   */
  stop(instanceId: string): boolean {
    const removed = this.activeClips.delete(instanceId)
    if (removed && this.debug) {
      console.log(`[HephRuntime] ⏹️ STOP: ${instanceId}`)
    }
    return removed
  }
  
  /**
   * ⏹️ Stop all active clips
   */
  stopAll(): void {
    const count = this.activeClips.size
    this.activeClips.clear()
    if (this.debug) {
      console.log(`[HephRuntime] ⏹️ STOP ALL: ${count} clips stopped`)
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // FRAME TICK - MAIN RENDER LOOP INTEGRATION
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 🔄 Called every frame from TitanEngine
   * Evaluates all active curves and returns fixture outputs
   * 
   * @param currentTimeMs Current system time in ms
   * @returns Array of fixture outputs to apply
   */
  /**
   * ⚒️ WAVE 2400: THE PHASER REVOLUTION + ZERO-ALLOC
   * 
   * tick() now branches between:
   * - tickWithPhase(): Per-fixture phase evaluation (WAVE 2400 path)
   * - tickLegacy(): Zone-based, same time for all (backward compat)
   * 
   * ZERO-ALLOC: Uses pre-allocated outputBuffer with writeOutput().
   * Only 1 array allocation per frame (getOutputSlice) vs N objects before.
   * 
   * SCALING PIPELINE:
   *   1. CurveEvaluator → raw 0-1 (number) or HSL (color)
   *   2. Apply intensity multiplier
   *   3. SCALE to target format:
   *      - DMX params (intensity/strobe/white/amber/pan/tilt) → 0-255
   *      - Color params → HSL→RGB { r, g, b } each 0-255
   *      - Engine params (speed/zoom/width/direction/globalComp) → 0-1 float
   */
  tick(currentTimeMs: number): HephFixtureOutput[] {
    this.lastTickMs = currentTimeMs
    this.outputCursor = 0  // ⚒️ WAVE 2400: Reset cursor — reuse buffer
    const expiredClips: string[] = []
    
    for (const [instanceId, active] of this.activeClips) {
      // Calculate clip progress
      const elapsedMs = currentTimeMs - active.startTimeMs
      let baseClipTimeMs = elapsedMs
      
      // Handle looping
      if (active.loop && elapsedMs >= active.durationMs) {
        baseClipTimeMs = elapsedMs % active.durationMs
      }
      
      // Check expiration (non-looping)
      if (!active.loop && elapsedMs >= active.durationMs) {
        expiredClips.push(instanceId)
        continue
      }

      // ── WAVE 2400: Branch between phase-aware and legacy paths ────
      if (active.fixturePhases && active.fixturePhases.length > 0) {
        // 🔥 PER-FIXTURE PHASE EVALUATION
        this.tickWithPhase(active, baseClipTimeMs)
      } else {
        // Legacy: zone-based, same time for all
        this.tickLegacy(active, baseClipTimeMs)
      }
    }
    
    // Clean up expired clips
    for (const instanceId of expiredClips) {
      this.activeClips.delete(instanceId)
      if (this.debug) {
        console.log(`[HephRuntime] ✅ Completed: ${instanceId}`)
      }
    }
    
    // ⚒️ WAVE 2400: Return slice of pre-allocated buffer
    return this.getOutputSlice()
  }

  /**
   * ⚒️ WAVE 2400: Phase-aware evaluation path.
   *
   * fixturePhases is SORTED by phaseOffsetMs ASC.
   * This means CurveEvaluator queries go in monotonically
   * increasing time order → cursor cache stays O(1) amortized.
   *
   * For each fixture, we calculate a fixture-specific time
   * (baseClipTimeMs + phaseOffsetMs) and evaluate all curves at that time.
   */
  private tickWithPhase(active: ActiveHephClip, baseClipTimeMs: number): void {
    for (const fp of active.fixturePhases!) {
      // ── Calculate fixture-specific time ──────────────────────────
      let fixtureTimeMs = baseClipTimeMs + fp.phaseOffsetMs

      // Wrap if looping (phase offset can push beyond duration)
      if (active.loop) {
        fixtureTimeMs = ((fixtureTimeMs % active.durationMs) + active.durationMs) % active.durationMs
      } else {
        fixtureTimeMs = Math.min(fixtureTimeMs, active.durationMs)
      }

      // ── Evaluate each curve at fixture-specific time ────────────
      for (const [paramName, curve] of active.clip.curves) {
        if (curve.valueType === 'color') {
          const hsl = active.evaluator.getColorValue(paramName, fixtureTimeMs)
          // Intensity modulates lightness (dim the color, don't destroy hue/sat)
          const modulatedL = (hsl.l / 100) * active.intensity
          const rgb = hslToRgb(hsl.h, hsl.s / 100, modulatedL)

          this.writeOutput(fp.fixtureId, 'all', paramName, 0, rgb)
        } else {
          const rawValue = active.evaluator.getValue(paramName, fixtureTimeMs)
          const withIntensity = rawValue * active.intensity
          const scaledValue = scaleToDMX(paramName, withIntensity)
          const fine = (paramName === 'pan' || paramName === 'tilt')
            ? scaleToDMX16(withIntensity).fine
            : undefined

          this.writeOutput(fp.fixtureId, 'all', paramName, scaledValue, undefined, fine)
        }
      }
    }
  }

  /**
   * Legacy path: sin phase distribution.
   * Mantiene backward compatibility 1:1 con el tick() pre-WAVE 2400.
   * Used when clip has no PhaseConfig / no FixtureSelector.
   *
   * 🎯 WAVE 2544.3: AND-GATE FIX
   * Previously emitted one output per zone tag (OR semantics in TitanOrchestrator).
   * Now resolves the AND-intersection of all zone tags to concrete fixture IDs
   * using resolveZoneTags, then emits per-fixture outputs (same as tickWithPhase).
   * This ensures ['back', 'all-right'] → only back-right fixtures, not all-right ∪ back.
   */
  private tickLegacy(active: ActiveHephClip, clipTimeMs: number): void {
    const clipZones = active.clip.zones

    // ── Resolve target fixture IDs (AND-intersection via ZoneMapper) ──────
    // Single 'all' or empty → all fixtures. Multiple tags → AND-intersection.
    let targetFixtureIds: string[]
    if (clipZones.length === 0 || (clipZones.length === 1 && clipZones[0] === 'all')) {
      targetFixtureIds = masterArbiter.getFixtureIds()
    } else {
      const fixtures = masterArbiter.getFixturesForZoneMapping()
      targetFixtureIds = resolveZoneTags(clipZones as string[], fixtures)
      // Fallback: if zone combo resolves to nothing, treat as global
      if (targetFixtureIds.length === 0) {
        targetFixtureIds = masterArbiter.getFixtureIds()
      }
    }

    if (targetFixtureIds.length === 0) return

    // ── Evaluate each curve → scale → emit per-fixture ────────────────────
    for (const [paramName, curve] of active.clip.curves) {

      // ─── COLOR CURVE PATH ───────────────────────────────────
      if (curve.valueType === 'color') {
        const hsl = active.evaluator.getColorValue(paramName, clipTimeMs)
        // ⚒️ WAVE 2040.22c: HSL values are 0-100 (Heph standard), hslToRgb expects 0-1
        const modulatedL = (hsl.l / 100) * active.intensity
        const rgb = hslToRgb(hsl.h, hsl.s / 100, modulatedL)

        for (const fixtureId of targetFixtureIds) {
          this.writeOutput(fixtureId, 'all', paramName, 0, rgb)
        }
        continue
      }

      // ─── NUMERIC CURVE PATH ─────────────────────────────────
      const rawValue = active.evaluator.getValue(paramName, clipTimeMs)
      const withIntensity = rawValue * active.intensity
      const scaledValue = scaleToDMX(paramName, withIntensity)
      const fine = (paramName === 'pan' || paramName === 'tilt')
        ? scaleToDMX16(withIntensity).fine
        : undefined

      for (const fixtureId of targetFixtureIds) {
        this.writeOutput(fixtureId, 'all', paramName, scaledValue, undefined, fine)
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ⚒️ WAVE 2400: ZERO-ALLOCATION OUTPUT BUFFER
  // ─────────────────────────────────────────────────────────────────────────

  /** Pre-allocated output buffer */
  private outputBuffer: HephFixtureOutput[] = []

  /** Current write position in outputBuffer */
  private outputCursor: number = 0

  /** Maximum capacity of the output buffer */
  private outputCapacity: number = 0

  /**
   * Ensure output buffer has enough capacity.
   * Called when clips are added/removed (NOT in tick — outside hot path).
   * Grows amortized by 2x to avoid frequent resizes.
   */
  private ensureOutputCapacity(needed: number): void {
    if (needed <= this.outputCapacity) return

    // Grow by 2x or to needed, whichever is larger (min 256)
    const newCapacity = Math.max(needed, this.outputCapacity * 2, 256)

    // Extend buffer with pre-allocated empty output objects
    for (let i = this.outputCapacity; i < newCapacity; i++) {
      this.outputBuffer[i] = {
        fixtureId: '',
        zone: 'all',
        parameter: '',
        value: 0,
        rgb: undefined,
        fine: undefined,
        source: 'hephaestus-runtime',
      }
    }
    this.outputCapacity = newCapacity
  }

  /**
   * Write one output to the pre-allocated buffer.
   * Mutates in-place — zero allocation in the hot path.
   * Auto-grows if capacity estimate was wrong (rare).
   */
  private writeOutput(
    fixtureId: string,
    zone: EffectZone | 'all',
    parameter: string,
    value: number,
    rgb?: { r: number; g: number; b: number },
    fine?: number
  ): void {
    // Auto-grow if needed (rare — only if capacity estimate was wrong)
    if (this.outputCursor >= this.outputCapacity) {
      this.ensureOutputCapacity(this.outputCursor + 64)
    }

    const out = this.outputBuffer[this.outputCursor++]
    out.fixtureId = fixtureId
    out.zone = zone
    out.parameter = parameter
    out.value = value
    out.rgb = rgb
    out.fine = fine
    // out.source is always 'hephaestus-runtime' — set once at buffer creation
  }

  /**
   * Return a slice of the output buffer (0..outputCursor).
   * 
   * ⚠️ CONTRATO: The consumer MUST NOT retain references to the output
   * objects beyond the current frame. They will be mutated in the next tick.
   * 
   * Uses Array.slice() which creates ONE new array per frame (array of
   * references, not copies). This is an accepted trade-off:
   * 1 array header/frame vs hundreds of object allocations/frame.
   */
  private getOutputSlice(): HephFixtureOutput[] {
    return this.outputBuffer.slice(0, this.outputCursor)
  }

  /**
   * Estimate total output count across all active clips.
   * Used to pre-size the output buffer at play() time.
   */
  private estimateTotalOutputs(): number {
    let total = 0
    const allFixtureCount = masterArbiter.getFixtureIds().length || 32
    for (const [, active] of this.activeClips) {
      // Legacy clips now emit per-fixture (not per-zone), use full fixture count as upper bound
      const fixtureCount = active.fixturePhases?.length ?? allFixtureCount
      total += fixtureCount * active.clip.curves.size
    }
    return total
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ⚒️ WAVE 2400: PHASE RESOLUTION HELPER
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Resolves phase distribution for a clip at play() time.
   * 
   * Resolution priority:
   * 1. clip.selector.phase (full PhaseConfig) — highest priority
   * 2. clip.selector.phaseSpread (legacy shorthand → converted to linear PhaseConfig)
   * 3. null (no phase distribution — legacy zone mode)
   * 
   * @param clip — The clip to resolve phase for
   * @param durationMs — Effective duration (may be overridden)
   * @param externalFixtureIds — Pre-resolved fixture IDs (optional, bypasses selector resolution)
   * @returns { fixturePhases, phaseConfig } or both null if no phase config
   */
  private resolvePhaseForClip(
    clip: HephAutomationClip,
    durationMs: number,
    externalFixtureIds?: string[]
  ): { fixturePhases: FixturePhase[] | null; phaseConfig: PhaseConfig | null } {
    const selector = clip.selector
    if (!selector) {
      return { fixturePhases: null, phaseConfig: null }
    }

    // Determine PhaseConfig (full config takes precedence over legacy phaseSpread)
    let config: PhaseConfig | null = null

    if (selector.phase) {
      config = selector.phase
    } else if (selector.phaseSpread && selector.phaseSpread > 0) {
      // Legacy shorthand → convert to linear PhaseConfig
      config = {
        spread: selector.phaseSpread,
        symmetry: 'linear',
        wings: 1,
        direction: 1,
      }
    }

    if (!config || config.spread === 0) {
      return { fixturePhases: null, phaseConfig: null }
    }

    // Resolve fixture IDs
    const fixtureIds = externalFixtureIds && externalFixtureIds.length > 0
      ? externalFixtureIds
      : [] // Caller should provide pre-resolved IDs; empty = no phase

    if (fixtureIds.length === 0) {
      // No fixture IDs available — can't distribute phase
      // This happens when resolveFixtureSelector() hasn't been called externally.
      // The runtime doesn't have access to the fixture store directly.
      // Phase will be resolved when TitanOrchestrator provides fixture IDs.
      if (this.debug) {
        console.warn(`[HephRuntime] ⚠️ Phase config present but no fixture IDs provided. Falling back to legacy mode.`)
      }
      return { fixturePhases: null, phaseConfig: config }
    }

    // Resolve phase distribution
    const fixturePhases = PhaseDistributor.resolve(fixtureIds, config, durationMs)

    return { fixturePhases, phaseConfig: config }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // STATUS & STATS
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Get runtime statistics
   */
  getStats(): HephRuntimeStats {
    return {
      activeClips: this.activeClips.size,
      totalTriggered: this.totalTriggered,
      cacheSize: this.clipCache.size,
      lastTickMs: this.lastTickMs,
    }
  }
  
  /**
   * Check if any clips are currently playing
   */
  isPlaying(): boolean {
    return this.activeClips.size > 0
  }
  
  /**
   * Get list of active clip instance IDs
   */
  getActiveInstances(): string[] {
    return Array.from(this.activeClips.keys())
  }
  
  /**
   * Get info about a specific active clip
   */
  getActiveClipInfo(instanceId: string): {
    name: string
    progress: number
    intensity: number
  } | null {
    const active = this.activeClips.get(instanceId)
    if (!active) return null
    
    const elapsed = Date.now() - active.startTimeMs
    const progress = Math.min(1, elapsed / active.durationMs)
    
    return {
      name: active.clip.name,
      progress,
      intensity: active.intensity,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

let runtimeInstance: HephaestusRuntime | null = null

/**
 * Get the singleton HephaestusRuntime instance
 */
export function getHephaestusRuntime(): HephaestusRuntime {
  if (!runtimeInstance) {
    runtimeInstance = new HephaestusRuntime()
    console.log('[HephRuntime] ⚒️ WAVE 2030.18: Hephaestus Runtime initialized')
  }
  return runtimeInstance
}

/**
 * Reset the runtime (for testing)
 */
export function resetHephaestusRuntime(): void {
  if (runtimeInstance) {
    runtimeInstance.stopAll()
    runtimeInstance.clearCache()
  }
  runtimeInstance = null
}
