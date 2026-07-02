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
import type {
  HephAutomationClipV3,
  HephCurve,
  HephParamId,
  BlendMode,
  HSL,
  PhaseConfig,
} from '../types'
import { type PhaseConfigPro, type FixturePhase } from '../phase/PhaseConfigPro'
import { resolveWithOverrides, type PhaseOverrideMap } from '../phase/PhaseOverride'
import type { EffectZone } from '../../effects/types'
import { getHephaestusClipIndex } from '../HephaestusClipIndex'
import { CurveEvaluator } from '../CurveEvaluator'
import { defaultBlendMode as _defaultBlendModeFor, blendNumeric, blendRgb } from '../HephSharedMath'
import { resolveZoneTags } from '../../zones/ZoneMapper'
import { getTitanOrchestrator } from '../../orchestrator/TitanOrchestrator'

// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 4856 — V3 SCHEMA HELPERS (module-private)
// ═══════════════════════════════════════════════════════════════════════════

// _defaultBlendModeFor is now imported from HephSharedMath (P2#7 consolidation)

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🧬 WAVE 4856 — V3 GENOME UPGRADE
 *
 * Una pista resuelta y lista para evaluar en el hot-path. Es la unidad
 * atómica de ejecución multicelular: cada track porta SU propia curva,
 * SU propio conjunto de fixtures (resuelto desde track.zones) y SU propia
 * distribución de fase opcional.
 *
 * Múltiples ResolvedTrack pueden compartir `paramId` — el bug de
 * "una curva por paramId" del esquema v2.1 queda eliminado por construcción.
 */
interface ResolvedTrack {
  /** ID estable del track (slug determinista en migración v2; UUID en v3 nativo). */
  id: string

  /** Parámetro semántico que esta pista controla. */
  paramId: HephParamId

  /**
   * Tipo de la curva subyacente. Cacheado aquí para evitar lookup en hot-path.
   * Determina el branching emit-color vs emit-numeric en `tickActive()`.
   */
  valueType: 'number' | 'color'

  /**
   * Evaluador con UN único entry: `Map([[paramId, curve]])`. Reusa la
   * implementación zero-alloc de `CurveEvaluator` (cursor cache, presets HSL).
   */
  evaluator: CurveEvaluator

  /**
   * Fixtures objetivo de ESTA pista — AND-intersección de `track.zones`
   * resueltas via `resolveZoneTags`. Si la intersección queda vacía, la
   * pista no emite (silencio espacial honesto, sin fallback global).
   */
  fixtureIds: string[]

  /**
   * Distribución de fase per-fixture. `null` cuando la pista no declara
   * `selector.phase` ni hereda config a nivel clip. Cuando presente, está
   * ordenada ASC por `phaseOffsetMs` para que el cursor cache de
   * `CurveEvaluator` se mantenga O(1) amortizado.
   */
  fixturePhases: FixturePhase[] | null

  /**
   * Estrategia de fusión declarada por el autor (HTP / replace / add / multiply).
   * Forward-compat: el Runtime emite por separado todos los tracks; la fusión
   * efectiva sucede aguas abajo en NodeArbiter (L3 dominance + LTP). Se
   * conserva aquí para que el adaptador / NodeArbiter puedan consultarla
   * cuando se introduzca blending real per-paramId.
   */
  blendMode: BlendMode
  /** Source track zone tags — passed to HephaestusAetherAdapter for compound fixture routing. */
  zones?: readonly string[]

  /**
   * 🧬 AUDIT P0-B: Override de color constante.
   * Si definido y paramId === 'color' → suplanta el output evaluado de la curva.
   * Ahora el runtime respeta colorOverride igual que el preview/kernel.
   */
  colorOverride?: HSL
}

/** Active clip being executed */
interface ActiveHephClip {
  /** Unique instance ID */
  instanceId: string

  /** Path to .lfx file */
  filePath: string

  /**
   * Clip original tras carga. Sólo se usa para logging y stats —
   * el hot-path consume exclusivamente `tracks[]`.
   */
  clip: HephAutomationClipV3

  /**
   * 🧬 WAVE 4856: Pistas resueltas — la unidad ejecutable real.
   * Reemplaza el antiguo `evaluator` + `fixturePhases` clip-globales.
   */
  tracks: ResolvedTrack[]

  /** Start time in ms (system time) */
  startTimeMs: number

  /** Duration in ms */
  durationMs: number

  /** Current intensity multiplier (0-1) */
  intensity: number

  /** Is the clip looping? */
  loop: boolean

  /**
   * Phase config a nivel CLIP (cuando aplica). Sólo informativo / debug —
   * la fase efectiva por pista vive ya en `tracks[i].fixturePhases`.
   */
  phaseConfig: PhaseConfigPro | null
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
  // WAVE 3521: Pre-DMX normalized value (0-1) for Aether adapter consumption
  normalizedValue: number
  // WAVE 3521: Normalized RGB (0-1 each) for Aether COLOR nodes (only for 'color' parameter)
  normalizedRgb?: { r: number; g: number; b: number }
  // WAVE 3521: true if the originating clip has effectType === 'heph_custom'
  isCustomClip: boolean
  // 🏛️ WAVE 2483: ID of the source clip (for spatialBehavior lookup in DynamicEffectRegistry).
  // Optional + lazy: legacy code paths that don't stamp it remain valid.
  clipId?: string
  // 🧩 COMPOUND ROUTING: source track zone tags for zone-aware node routing in HephaestusAetherAdapter.
  trackZones?: readonly string[]
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔥 WAVE 2495: Pure utilities re-exported from HephUtils.ts
// Extracted so renderer code can import them without dragging in the
// full Runtime (which depends on MasterArbiter → EventEmitter → Node.js).
// Backend code can still import from here — these are re-exports.
// ═══════════════════════════════════════════════════════════════════════════
import { hslToRgb, scaleToDMX, scaleToDMX16 } from './HephUtils'
export { hslToRgb, scaleToDMX, scaleToDMX16 }

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
  /**
   * Cache de clips cargados (filePath → clip parseado).
   * 🧬 WAVE 4856: Clip V3 canónico — la migración a tracks ejecutables
   * ocurre per-instancia en `play()`.
   */
  private clipCache: Map<string, HephAutomationClipV3> = new Map()
  
  /** Currently active clips being executed */
  private activeClips: Map<string, ActiveHephClip> = new Map()
  
  /** Instance counter for unique IDs */
  private instanceCounter = 0
  
  /** Statistics */
  private totalTriggered = 0
  private lastTickMs = 0
  
  /** Debug mode */
  private debug = true

  /**
   * 🧬 WAVE 7035: Blend map for intra-clip blendMode fusion.
   * Key: `${fixtureId}:${paramName}` → Value: index into outputBuffer.
   * Cleared per-clip in tickActive(). Enables max/replace/add/multiply
   * blending when multiple tracks of the same paramId target the same fixture.
   */
  private _blendMap: Map<string, number> = new Map()
  
  // ─────────────────────────────────────────────────────────────────────────
  // CLIP LOADING
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Load and cache a .lfx file (V3 schema).
   * Returns the parsed clip o null si falla.
   */
  loadClip(filePath: string): HephAutomationClipV3 | null {
    const index = getHephaestusClipIndex();
    const loaded = index.getByPath(filePath);
    if (!loaded) {
      console.error(`[HephRuntime] ❌ Clip not in index: ${filePath}`);
      return null;
    }
    if (!this.clipCache.has(filePath)) {
      this.clipCache.set(filePath, loaded.clip);
    }
    return this.clipCache.get(filePath)!;
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
   * ⚒️ WAVE 2400: Now applies phase config (PhaseConfigPro) if clip has one.
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
    const durationMs = options.durationOverrideMs ?? clip.durationMs

    // 🧬 WAVE 4856: Construir tracks resueltos.
    const { tracks, phaseConfig } = this._buildResolvedTracks(
      clip,
      durationMs,
      options.fixtureIds,
    )

    if (tracks.length === 0) {
      console.warn(`[HephRuntime] ⚠️ play(${path.basename(filePath)}): zero resolved tracks — clip will not emit`)
      return null
    }

    const activeClip: ActiveHephClip = {
      instanceId,
      filePath,
      clip,
      tracks,
      startTimeMs: now,
      durationMs,
      intensity: options.intensity ?? 1.0,
      loop: options.loop ?? false,
      phaseConfig,
    }

    this.activeClips.set(instanceId, activeClip)
    this.totalTriggered++

    // ⚒️ WAVE 2400: Ensure output buffer capacity
    this.ensureOutputCapacity(this.estimateTotalOutputs())

    if (this.debug) {
      const anyPhases = tracks.some(t => t.fixturePhases !== null)
      const phaseInfo = anyPhases ? ` [PHASE: ${phaseConfig?.symmetry}]` : ''
      console.log(`[HephRuntime] ▶️ PLAY: ${clip.name} (${activeClip.durationMs}ms, ${tracks.length} tracks)${phaseInfo} ID=${instanceId}`)
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
   * ⚒️ WAVE 2400: Now applies phase config (PhaseConfigPro) if clip has one.
   *
   * @param clip Pre-deserialized HephAutomationClipV3
   * @param options Playback options
   * @returns Instance ID for tracking
   */
  playFromClip(clip: HephAutomationClipV3, options: {
    intensity?: number
    durationOverrideMs?: number
    loop?: boolean
    /** ⚒️ WAVE 2400: External fixture IDs for phase distribution (pre-resolved) */
    fixtureIds?: string[]
  } = {}): string {
    const instanceId = `heph_diamond_${++this.instanceCounter}_${Date.now()}`
    const now = Date.now()
    const durationMs = options.durationOverrideMs ?? clip.durationMs

    // 🧬 WAVE 4856: Construir tracks resueltos.
    const { tracks, phaseConfig } = this._buildResolvedTracks(
      clip,
      durationMs,
      options.fixtureIds,
    )

    const activeClip: ActiveHephClip = {
      instanceId,
      filePath: '<diamond-inline>',  // No file — curves came inline
      clip,
      tracks,
      startTimeMs: now,
      durationMs,
      intensity: options.intensity ?? 1.0,
      loop: options.loop ?? false,
      phaseConfig,
    }

    this.activeClips.set(instanceId, activeClip)
    this.totalTriggered++

    // ⚒️ WAVE 2400: Ensure output buffer capacity
    this.ensureOutputCapacity(this.estimateTotalOutputs())

    if (this.debug) {
      const anyPhases = tracks.some(t => t.fixturePhases !== null)
      const phaseInfo = anyPhases ? ` [PHASE: ${phaseConfig?.symmetry}]` : ''
      const sourceCount = `${clip.tracks.length} tracks`
      console.log(`[HephRuntime] ▶️💎 DIAMOND PLAY: ${clip.name} (${activeClip.durationMs}ms, ${sourceCount} → ${tracks.length} resolved)${phaseInfo} ID=${instanceId}`)
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
   * 🧬 WAVE 4856 — UNIFIED TRACK-ITERATING TICK + ZERO-ALLOC.
   *
   * tick() ya no se ramifica en `tickWithPhase` / `tickLegacy`. La elección
   * phase-vs-flat se hace PER-TRACK dentro de `tickActive()` consultando
   * `track.fixturePhases`. Un mismo clip puede ahora mezclar pistas con y
   * sin distribución de fase; cada una se evalúa con el `CurveEvaluator`
   * de su propia curva (cursor cache aislado).
   *
   * ZERO-ALLOC: Uses pre-allocated outputBuffer with writeOutput().
   * Only 1 array allocation per frame (getOutputSlice) vs N objects before.
   *
   * SCALING PIPELINE (en `_emitTrackSample`):
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

      // 🧬 WAVE 4856: Unified track-iterating evaluation. Branching legacy/phase
      // ahora vive PER-TRACK dentro de tickActive — un mismo clip puede tener
      // unas pistas con phase y otras sin, evaluadas con tiempos independientes.
      this.tickActive(active, baseClipTimeMs)
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
   * 🧬 WAVE 4856 — UNIFIED TRACK-ITERATING TICK
   *
   * Reemplaza la pareja `tickWithPhase` + `tickLegacy` por un único pase que
   * itera `active.tracks[]`. Cada pista decide:
   *   - SI tiene `fixturePhases` → emite con tiempo `clipTime + phaseOffset`
   *     por cada FixturePhase (cursor-cache friendly: phases pre-ordenadas).
   *   - SI NO tiene phases → emite con `clipTime` global por cada fixtureId.
   *
   * El evaluador per-track contiene UNA sola curva: `evaluator.getValue/`
   * `getColorValue(track.paramId, t)`. Esto permite que múltiples pistas
   * compartan paramId sin colisión de cursor cache (cada una mantiene el
   * suyo). Garantiza routing espacial aislado: `track.fixtureIds` se resolvió
   * a partir de `track.zones` específico, NO del bloque global del clip.
   */
  private tickActive(active: ActiveHephClip, baseClipTimeMs: number): void {
    const isCustomThisClip = active.clip.effectType === 'heph_custom'
    const clipId = active.clip.id
    const intensity = active.intensity
    const durationMs = active.durationMs
    const isLoop = active.loop
    this._blendMap.clear()

    for (let ti = 0; ti < active.tracks.length; ti++) {
      const track = active.tracks[ti]
      const paramName = track.paramId
      const evaluator = track.evaluator

      // ── Path A: per-fixture phase distribution ────────────────────────
      if (track.fixturePhases !== null && track.fixturePhases.length > 0) {
        for (let pi = 0; pi < track.fixturePhases.length; pi++) {
          const fp = track.fixturePhases[pi]
          // ⚒️ WAVE 4859 + AUDIT P1-A — PHASE WRAP CONTINUO
          // Antes (bug): localElapsedMs = max(0, clipTime - offset)
          //   → fixtures con offset grande congelados en t=0 hasta que el
          //     playhead los alcanza. Salto discontinuo en la frontera del loop.
          // Ahora (MA3-style): (clipTime + offset) % duration → wrap continuo.
          //   → chase infinito sin costuras. Ningún fixture se congela.
          //   → en modo one-shot (no loop), clamp a durationMs como antes.
          let fixtureTimeMs: number
          if (isLoop) {
            fixtureTimeMs = ((baseClipTimeMs + fp.phaseOffsetMs) % durationMs + durationMs) % durationMs
          } else {
            fixtureTimeMs = Math.min(baseClipTimeMs + fp.phaseOffsetMs, durationMs)
          }
          this._emitTrackSample(
            track,
            fp.fixtureId,
            fixtureTimeMs,
            evaluator,
            paramName,
            intensity,
            isCustomThisClip,
            clipId,
            track.zones,
          )
        }
        continue
      }

      // ── Path B: zona resuelta sin phase distribution ──────────────────
      const fixtureIds = track.fixtureIds
      if (fixtureIds.length === 0) continue
      for (let fi = 0; fi < fixtureIds.length; fi++) {
        this._emitTrackSample(
          track,
          fixtureIds[fi],
          baseClipTimeMs,
          evaluator,
          paramName,
          intensity,
          isCustomThisClip,
          clipId,
          track.zones,
        )
      }
    }
  }

  /**
   * 🧬 WAVE 4856 — Emite UNA muestra de UNA pista para UN fixture en UN tiempo.
   *
   * Centraliza la lógica color-vs-numeric que antes se duplicaba en
   * `tickWithPhase` y `tickLegacy`. La pista ya trae cacheado `valueType`
   * para evitar el lookup `curve.valueType` en hot-path.
   */
  private _emitTrackSample(
    track: ResolvedTrack,
    fixtureId: string,
    timeMs: number,
    evaluator: CurveEvaluator,
    paramName: HephParamId,
    intensity: number,
    isCustomThisClip: boolean,
    clipId: string,
    trackZones: readonly string[] | undefined,
  ): void {
    const blendKey = fixtureId + ':' + paramName
    const existingIdx = this._blendMap.get(blendKey)

    if (track.valueType === 'color') {
      // 🧬 AUDIT P0-B: Respect colorOverride — same logic as HephEvaluationKernel
      let hsl: HSL
      if (track.colorOverride) {
        const co = track.colorOverride
        if (typeof co.h !== 'number' || !Number.isFinite(co.h) ||
            typeof co.s !== 'number' || !Number.isFinite(co.s) ||
            typeof co.l !== 'number' || !Number.isFinite(co.l)) {
          return
        }
        hsl = co
      } else {
        hsl = evaluator.getColorValue(paramName, timeMs)
        if (!hsl || typeof hsl.h !== 'number' || typeof hsl.s !== 'number' || typeof hsl.l !== 'number' ||
            !Number.isFinite(hsl.h) || !Number.isFinite(hsl.s) || !Number.isFinite(hsl.l)) {
          return
        }
      }
      const modulatedL = (hsl.l / 100) * intensity
      const rgb = hslToRgb(hsl.h, hsl.s / 100, modulatedL)
      if (!Number.isFinite(rgb.r)) rgb.r = 0
      if (!Number.isFinite(rgb.g)) rgb.g = 0
      if (!Number.isFinite(rgb.b)) rgb.b = 0
      this._normRgbBuf.r = rgb.r / 255
      this._normRgbBuf.g = rgb.g / 255
      this._normRgbBuf.b = rgb.b / 255

      if (existingIdx !== undefined) {
        this._blendOutput(this.outputBuffer[existingIdx], track.blendMode, 0, rgb, undefined, 0, this._normRgbBuf)
        return
      }
      this.writeOutput(fixtureId, 'all', paramName, 0, rgb, undefined, 0, this._normRgbBuf, isCustomThisClip, clipId, trackZones)
      this._blendMap.set(blendKey, this.outputCursor - 1)
    } else {
      const rawValue = evaluator.getValue(paramName, timeMs)
      const withIntensity = rawValue * intensity
      const scaledValue = scaleToDMX(paramName, withIntensity)
      const fine = (paramName === 'pan' || paramName === 'tilt')
        ? scaleToDMX16(withIntensity).fine
        : undefined

      if (existingIdx !== undefined) {
        this._blendOutput(this.outputBuffer[existingIdx], track.blendMode, scaledValue, undefined, fine, withIntensity, undefined)
        return
      }
      this.writeOutput(fixtureId, 'all', paramName, scaledValue, undefined, fine, withIntensity, undefined, isCustomThisClip, clipId, trackZones)
      this._blendMap.set(blendKey, this.outputCursor - 1)
    }
  }

  /**
   * 🧬 WAVE 7035 + AUDIT P0-B: Apply blendMode fusion in-place on an existing output entry.
   * Called when a second track targets the same (fixtureId, paramId) as a
   * previous track within the same clip.
   *
   * AUDIT FIX: Now delegates to HephSharedMath.blendNumeric/blendRgb — the
   * SAME functions used by the preview kernel. No more divergent blend logic.
   */
  private _blendOutput(
    existing: HephFixtureOutput,
    mode: BlendMode,
    newValue: number,
    newRgb?: { r: number; g: number; b: number },
    newFine?: number,
    newNormalized?: number,
    newNormalizedRgb?: { r: number; g: number; b: number },
  ): void {
    existing.value = blendNumeric(existing.value, newValue, mode)
    if (newNormalized !== undefined) {
      existing.normalizedValue = blendNumeric(existing.normalizedValue, newNormalized, mode)
    }
    if (newFine !== undefined && mode === 'replace') {
      existing.fine = newFine
    }
    if (existing.rgb && newRgb) {
      const [r, g, b] = blendRgb(existing.rgb.r, existing.rgb.g, existing.rgb.b, newRgb.r, newRgb.g, newRgb.b, mode)
      existing.rgb.r = r; existing.rgb.g = g; existing.rgb.b = b
    }
    if (existing.normalizedRgb && newNormalizedRgb) {
      const [r, g, b] = blendRgb(
        existing.normalizedRgb.r * 255, existing.normalizedRgb.g * 255, existing.normalizedRgb.b * 255,
        newNormalizedRgb.r * 255, newNormalizedRgb.g * 255, newNormalizedRgb.b * 255,
        mode,
      )
      existing.normalizedRgb.r = r / 255
      existing.normalizedRgb.g = g / 255
      existing.normalizedRgb.b = b / 255
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ⚒️ WAVE 2400: ZERO-ALLOCATION OUTPUT BUFFER
  // ─────────────────────────────────────────────────────────────────────────

  // WAVE 3521: Scratch buffer for normalized RGB (zero-alloc, mutated in-place)
  private readonly _normRgbBuf = { r: 0, g: 0, b: 0 }

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
        // 🩹 WAVE 4830: Pre-allocate per-slot rgb/normalizedRgb objects to
        // prevent color leak. writeOutput copies values INTO these objects
        // instead of assigning the shared _normRgbBuf reference.
        rgb: { r: 0, g: 0, b: 0 },
        fine: undefined,
        source: 'hephaestus-runtime',
        normalizedValue: 0,
        normalizedRgb: { r: 0, g: 0, b: 0 },
        isCustomClip: false,
        clipId: undefined,
        trackZones: undefined,
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
    fine?: number,
    normalizedValue?: number,
    normalizedRgb?: { r: number; g: number; b: number },
    isCustomClip?: boolean,
    clipId?: string,
    trackZones?: readonly string[]
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
    out.fine = fine
    out.normalizedValue = normalizedValue ?? 0
    out.isCustomClip = isCustomClip ?? false
    out.clipId = clipId
    out.trackZones = trackZones
    // 🩹 WAVE 4995: Protect Memory Reference
    // Only copy color values if the track actually provides them.
    // Do not destroy the pre-allocated references when processing non-color params.
    if (rgb) {
      if (!out.rgb) out.rgb = { r: 0, g: 0, b: 0 }
      out.rgb.r = rgb.r
      out.rgb.g = rgb.g
      out.rgb.b = rgb.b
    }
    
    if (normalizedRgb) {
      if (!out.normalizedRgb) out.normalizedRgb = { r: 0, g: 0, b: 0 }
      out.normalizedRgb.r = normalizedRgb.r
      out.normalizedRgb.g = normalizedRgb.g
      out.normalizedRgb.b = normalizedRgb.b
    }
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
   *
   * 🧬 WAVE 4856: Suma over tracks[] (cada track tiene su propio fixture set).
   */
  private estimateTotalOutputs(): number {
    let total = 0
    for (const [, active] of this.activeClips) {
      for (let i = 0; i < active.tracks.length; i++) {
        const t = active.tracks[i]
        // Phases (si existen) son por-fixture; si no hay phases, contamos fixtureIds.
        total += t.fixturePhases?.length ?? t.fixtureIds.length
      }
    }
    return total
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 🧬 WAVE 4856 — V3 RESOLUTION PIPELINE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 🧬 WAVE 4856 — Construye los `ResolvedTrack[]` ejecutables de un clip V3.
   *
   * Ruteo espacial AISLADO: cada track resuelve sus propios `zones` via
   * `resolveZoneTags` (AND-intersección). Si la intersección resulta vacía,
   * la pista queda silenciada (sin fallback global) — el autor puede
   * declarar zonas inexistentes y el sistema lo respeta sin máscaras.
   *
   * Distribución de fase per-track: cada `track.selector?.phase` se evalúa
   * independientemente.
   */
  private _buildResolvedTracks(
    clip: HephAutomationClipV3,
    durationMs: number,
    externalFixtureIds?: string[],
  ): { tracks: ResolvedTrack[]; phaseConfig: PhaseConfigPro | null } {
    const tracks: ResolvedTrack[] = []
    let topLevelPhaseConfig: PhaseConfigPro | null = null

    // ── Resolución del inventario de fixtures (compartido entre tracks) ──
    // Las zonas se resuelven contra el inventario actual del Orchestrator.
    // Caller puede pre-resolver `externalFixtureIds` para ahorrar lookups
    // en el path Diamond / IPC; en ese caso es la fuente de verdad.
    const orchFixtures = (externalFixtureIds == null || externalFixtureIds.length === 0)
      ? getTitanOrchestrator().getFixturesForZoneMapping()
      : null
    const allFixtureIds = (externalFixtureIds && externalFixtureIds.length > 0)
      ? externalFixtureIds
      : getTitanOrchestrator().getFixtureIds()

    /** Resuelve un `zones[]` a fixtureIds via AND-intersección. */
    const resolveZonesToFixtures = (zones: readonly string[]): string[] => {
      if (zones.length === 0) return [...allFixtureIds]
      if (zones.length === 1 && zones[0] === 'all') return [...allFixtureIds]
      if (orchFixtures != null) {
        const ids = resolveZoneTags(zones as string[], orchFixtures)
        return ids
      }
      // Pre-resolved IDs (externalFixtureIds) — ya filtrados por el caller.
      return [...allFixtureIds]
    }

    // ── V3 NATIVO ─────────────────────────────────────────────────────
    for (let i = 0; i < clip.tracks.length; i++) {
      const t = clip.tracks[i]
      const fixtureIds = resolveZonesToFixtures(t.zones as readonly string[])
      // ⚒️ WAVE 4859: `phaseConfig` es el shorthand canónico directo en el
      // track (formato nativo .lfx). `selector.phase` es la variante via
      // FixtureSelector (legado). Se da prioridad a `phaseConfig` y se usa
      // `selector.phase` / `selector.phaseSpread` como fallback.
      const trackPhase = this._extractPhaseConfig(
        t.phaseConfig ?? t.selector?.phase,
        t.selector?.phaseSpread,
      )
      if (trackPhase != null && topLevelPhaseConfig == null) {
        topLevelPhaseConfig = trackPhase
      }
      tracks.push(this._buildResolvedTrack(t.id, t.paramId, t.curve, t.blendMode, fixtureIds, trackPhase, durationMs, t.zones, t.phaseOverrides, t.colorOverride))
    }

    return { tracks, phaseConfig: topLevelPhaseConfig }
  }

  /**
   * 🧬 WAVE 4856 — Ensambla un único `ResolvedTrack` listo para `tickActive`.
   * Crea un `CurveEvaluator` con UNA sola curva (Map de tamaño 1) y, si hay
   * `phaseConfig + fixtureIds`, calcula la distribución de fase per-fixture.
   */
  private _buildResolvedTrack(
    id: string,
    paramId: HephParamId,
    curve: HephCurve,
    blendMode: BlendMode | undefined,
    fixtureIds: string[],
    phaseConfig: PhaseConfigPro | null,
    durationMs: number,
    zones?: readonly string[],
    phaseOverrides?: PhaseOverrideMap,
    colorOverride?: HSL,
  ): ResolvedTrack {
    const singleCurveMap = new Map<HephParamId, HephCurve>([[paramId, curve]])
    const evaluator = new CurveEvaluator(singleCurveMap, durationMs)

    let fixturePhases: FixturePhase[] | null = null
    const hasOverrides = phaseOverrides && Object.keys(phaseOverrides).length > 0
    if (phaseConfig && (phaseConfig.spreadDeg > 0 || hasOverrides) && fixtureIds.length > 0) {
      fixturePhases = resolveWithOverrides(fixtureIds, phaseConfig, phaseOverrides, durationMs)
    }

    return {
      id,
      paramId,
      valueType: curve.valueType,
      evaluator,
      fixtureIds,
      fixturePhases,
      blendMode: blendMode ?? _defaultBlendModeFor(paramId),
      zones,
      colorOverride,
    }
  }

  /**
   * 🧬 WAVE 7003 — Inverted: upgrades any phase config to PhaseConfigPro.
   * V2 `spread` (0-1) → `spreadDeg` (×1440). V3 `spreadDeg` passed through.
   * Returns null if no significant phase config.
   */
  private _extractPhaseConfig(
    phase: PhaseConfig | PhaseConfigPro | undefined,
    legacySpread: number | undefined,
  ): PhaseConfigPro | null {
    if (phase) {
      if ('spreadDeg' in phase) {
        const pro = phase as PhaseConfigPro
        if (pro.spreadDeg <= 0) return null
        return {
          spreadDeg: pro.spreadDeg,
          symmetry: pro.symmetry ?? 'linear',
          wings: pro.wings ?? 1,
          blocks: pro.blocks ?? 1,
          shuffle: pro.shuffle ?? 0,
          shuffleSeed: pro.shuffleSeed ?? 1,
          direction: pro.direction ?? 1,
        }
      }
      // V2 PhaseConfig → upgrade to PRO
      if ('spread' in phase) {
        const v2 = phase as PhaseConfig
        if (v2.spread <= 0) return null
        return {
          spreadDeg: v2.spread * 1440,
          symmetry: v2.symmetry ?? 'linear',
          wings: v2.wings ?? 1,
          blocks: 1,
          shuffle: 0,
          shuffleSeed: 1,
          direction: v2.direction ?? 1,
        }
      }
    }
    if (legacySpread != null && legacySpread > 0) {
      return {
        spreadDeg: legacySpread * 1440,
        symmetry: 'linear',
        wings: 1,
        blocks: 1,
        shuffle: 0,
        shuffleSeed: 1,
        direction: 1,
      }
    }
    return null
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
