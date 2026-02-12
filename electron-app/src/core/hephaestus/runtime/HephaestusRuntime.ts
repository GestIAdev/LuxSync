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
import type { HephAutomationClip, HephCurve, HSL } from '../types'
import type { EffectZone } from '../../effects/types'
import { deserializeHephClip, type HephAutomationClipSerialized } from '../types'
import { CurveEvaluator } from '../CurveEvaluator'

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
}

/** 
 * ⚒️ WAVE 2030.21: DMX-READY output from HephaestusRuntime
 * Values are PRE-SCALED to DMX format. TitanOrchestrator only merges, never scales.
 * 
 * SCALING RULES:
 *   - intensity/strobe/white/amber → int 0-255
 *   - pan/tilt → int 0-255
 *   - color → { r, g, b } each 0-255
 *   - speed/zoom/width/direction/globalComp → float 0-1 (engine-internal)
 */
export interface HephFixtureOutput {
  fixtureId: string
  zone: EffectZone | 'all'
  parameter: string
  /** DMX-scaled value: 0-255 for DMX params, 0-1 for engine-internal params */
  value: number
  /** RGB color pre-converted from HSL (only for 'color' parameter) */
  rgb?: { r: number; g: number; b: number }
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

/** Parameters that scale 0-1 → 0-255 (DMX channels) */
const DMX_SCALED_PARAMS = new Set([
  'intensity', 'strobe', 'white', 'amber', 'pan', 'tilt',
])

/** Parameters that pass through as 0-1 floats (engine-internal) */
const FLOAT_PASSTHROUGH_PARAMS = new Set([
  'speed', 'zoom', 'width', 'direction', 'globalComp',
])

/**
 * ⚒️ WAVE 2030.21: Scale a raw 0-1 curve value to DMX format
 */
export function scaleToDMX(paramId: string, rawValue: number): number {
  if (DMX_SCALED_PARAMS.has(paramId)) {
    return Math.round(Math.max(0, Math.min(1, rawValue)) * 255)
  }
  // Engine-internal params: clamp 0-1, no scaling
  return Math.max(0, Math.min(1, rawValue))
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
   * @param filePath Path to .lfx file
   * @param options Playback options
   * @returns Instance ID for tracking, or null if failed
   */
  play(filePath: string, options: {
    intensity?: number
    durationOverrideMs?: number
    loop?: boolean
  } = {}): string | null {
    const clip = this.loadClip(filePath)
    if (!clip) {
      return null
    }
    
    const instanceId = `heph_${++this.instanceCounter}_${Date.now()}`
    const now = Date.now()
    
    // Create the curve evaluator instance for this clip
    const evaluator = new CurveEvaluator(clip.curves, clip.durationMs)
    
    const activeClip: ActiveHephClip = {
      instanceId,
      filePath,
      clip,
      evaluator,
      startTimeMs: now,
      durationMs: options.durationOverrideMs ?? clip.durationMs,
      intensity: options.intensity ?? 1.0,
      loop: options.loop ?? false,
    }
    
    this.activeClips.set(instanceId, activeClip)
    this.totalTriggered++
    
    if (this.debug) {
      console.log(`[HephRuntime] ▶️ PLAY: ${clip.name} (${activeClip.durationMs}ms) ID=${instanceId}`)
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
   * ⚒️ WAVE 2030.21: THE TRANSLATOR
   * 
   * tick() now outputs DMX-READY values. TitanOrchestrator only merges.
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
    const outputs: HephFixtureOutput[] = []
    const expiredClips: string[] = []
    
    for (const [instanceId, active] of this.activeClips) {
      // Calculate clip progress
      const elapsedMs = currentTimeMs - active.startTimeMs
      let clipTimeMs = elapsedMs
      
      // Handle looping
      if (active.loop && elapsedMs >= active.durationMs) {
        clipTimeMs = elapsedMs % active.durationMs
      }
      
      // Check expiration (non-looping)
      if (!active.loop && elapsedMs >= active.durationMs) {
        expiredClips.push(instanceId)
        continue
      }

      // Resolve output zones once per clip
      const zones: Array<EffectZone | 'all'> = active.clip.zones.length > 0 
        ? active.clip.zones 
        : ['all']
      
      // Evaluate each curve → scale → output
      for (const [paramName, curve] of active.clip.curves) {

        // ─── COLOR CURVE PATH ───────────────────────────────────
        if (curve.valueType === 'color') {
          const hsl = active.evaluator.getColorValue(paramName, clipTimeMs)
          // Intensity modulates lightness (dim the color, don't destroy hue/sat)
          const modulatedL = hsl.l * active.intensity
          const rgb = hslToRgb(hsl.h, hsl.s, modulatedL)

          for (const zone of zones) {
            outputs.push({
              fixtureId: `zone:${zone}`,
              zone,
              parameter: paramName,
              value: 0,  // Not used for color - rgb field carries the data
              rgb,
              source: 'hephaestus-runtime',
            })
          }
          continue
        }

        // ─── NUMERIC CURVE PATH ─────────────────────────────────
        const rawValue = active.evaluator.getValue(paramName, clipTimeMs)
        const withIntensity = rawValue * active.intensity
        const scaledValue = scaleToDMX(paramName, withIntensity)

        for (const zone of zones) {
          outputs.push({
            fixtureId: `zone:${zone}`,
            zone,
            parameter: paramName,
            value: scaledValue,
            source: 'hephaestus-runtime',
          })
        }
      }
    }
    
    // Clean up expired clips
    for (const instanceId of expiredClips) {
      this.activeClips.delete(instanceId)
      if (this.debug) {
        console.log(`[HephRuntime] ✅ Completed: ${instanceId}`)
      }
    }
    
    return outputs
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
