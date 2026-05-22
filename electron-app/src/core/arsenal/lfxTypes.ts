// ════════════════════════════════════════════════════════════════════════════
// 🏛️ WAVE 2482 — INFINITE ARSENAL · LFX V2.1 TYPES
// ════════════════════════════════════════════════════════════════════════════
//  Tipado del Genoma para .lfx v2.1.0 (Aether-aware).
//
//  Referencias:
//   - docs/blueprints/WAVE-2480-INFINITE-ARSENAL-BLUEPRINT.md (esquema base)
//   - docs/blueprints/WAVE-2481-INFINITE-ARSENAL-V2-AUDIT.md  (correcciones V2)
//
//  Reglas:
//   - Estos tipos son ADITIVOS. No modifican `HephAutomationClip` existente.
//   - Todos los campos del bloque cognitivo son `readonly` — pensados para
//     Object.freeze() en el Registry (zero-alloc hot path).
//   - El campo `spatialBehavior` declara la relación con el motor IK
//     (WAVE 4912 / 4914 / 4916). Sin él no podemos enrutar pan/tilt
//     correctamente.
// ════════════════════════════════════════════════════════════════════════════

import type { HephCurve, HephParamId, PhaseConfig } from '../hephaestus/types'
import type { EnergyZone } from '../protocol/MusicalContext'

// ─── ENUMS / UNIONES ────────────────────────────────────────────────────────

/** Compatibilidad espectral del efecto (Texture Affinity — WAVE 1029). */
export type TextureAffinity = 'clean' | 'dirty' | 'universal'

/**
 * Relación del clip con la base IK del motor Aether.
 *
 *   - 'static':         No toca pan/tilt. Solo dimmer/color/optics.
 *   - 'relative_offset': Emite pan_offset/tilt_offset ∈ [-1,+1]. Se SUMA a la
 *                        base IK (fusión aditiva relativa, WAVE 4914).
 *   - 'absolute':       Secuestra pan/tilt absolutos. Si hay IK target activo
 *                        el SeleneHephBridge silencia pan/tilt del clip y
 *                        deja pasar solo dimmer/color.
 *   - 'spatial':        Reservado para futuro. Emite trayectoria 3D (x,y,z)
 *                        que el InverseKinematicsEngine resuelve por fixture.
 */
export type SpatialBehavior =
  | 'static'
  | 'relative_offset'
  | 'absolute'
  | 'spatial'

/** Modo de overlay del clip cuando es disparado vía Hephaestus runtime. */
export type OverlayMode = 'absolute' | 'relative' | 'additive'

/** Modo de escalado de intensidad del clip. */
export type IntensityScaling = 'proportional' | 'fixed' | 'energyDriven'

/** Targeting sugerido de fixtures (puede ser override por el ShowConfig). */
export type FixtureTargeting =
  | 'all'
  | 'movers'
  | 'pars'
  | 'strobes'
  | 'zone-front'
  | 'zone-back'
  | 'zone-left'
  | 'zone-right'

// ─── BLOQUES DEL .LFX V2.1 ──────────────────────────────────────────────────

/** Coordenadas inmutables del cubo unitario (A, C, O). */
export interface FrozenGenome {
  readonly aggression: number
  readonly chaos: number
  readonly organicity: number
}

/** Rango cerrado [min, max] reutilizable en varios sub-bloques. */
export interface Range {
  readonly min: number
  readonly max: number
}

/** Rango de zona energética en el termómetro Selene. */
export interface EnergyZoneRange {
  readonly min: EnergyZone
  readonly max: EnergyZone
}

/**
 * Compatibilidad con el motor IK (Aether spatial consciousness).
 * Solo relevante cuando `spatialBehavior === 'relative_offset' | 'absolute'`.
 */
export interface IKCompatibility {
  /** Si true, el clip respeta el target espacial; si false, lo ignora. */
  readonly respectsTarget: boolean
  /** Amplitud de la órbita relativa al target [0..1]. Solo relative_offset. */
  readonly orbitAmplitude: number
  /** Comportamiento de fallback cuando NO hay target IK activo. */
  readonly fallbackOnNoTarget: 'static' | 'absolute' | 'silence'
}

/**
 * Genoma cognitivo para el matching de Selene IA.
 * Fuente de verdad única — EFFECT_DNA_REGISTRY purgado (WAVE 4825).
 */
export interface CognitiveDNA {
  readonly genome: FrozenGenome
  readonly textureAffinity: TextureAffinity
  readonly compatibleVibes: readonly string[]
  readonly validSections: readonly string[]
  readonly energyZone: EnergyZoneRange
  readonly aggressionRange: Range

  // ── WAVE 2481 V2: directiva espacial obligatoria ──
  readonly spatialBehavior: SpatialBehavior
  readonly ikCompatibility?: IKCompatibility
}

/** Metadata para el EffectDreamSimulator (beauty, GPU cost, fatigue). */
export interface SimulationMeta {
  readonly beautyWeights: {
    readonly base: number
    readonly energyMultiplier: number
    readonly vibeBonus: number
  }
  readonly gpuCost: number
  readonly fatigueImpact: number
  readonly minDurationMs: number
  readonly cooldownMs: number
  readonly isStrobe: boolean
  readonly isDivineCandidate: boolean
  readonly isHeavyCandidate: boolean
  readonly zScoreGuards: {
    readonly requireRising: boolean
    readonly minimumZ: number | null
    readonly minimumEnergy: number | null
  }
}

/** Hints de ejecución para HephaestusRuntime / SeleneHephBridge. */
export interface ExecutionHints {
  readonly overlayMode: OverlayMode
  readonly phaseConfig: PhaseConfig
  readonly intensityScaling: IntensityScaling
  readonly fixtureTargeting: FixtureTargeting
}

/** Declaración auto-firmada de safety (cross-checked en ingesta — gate G6). */
export interface SafetyDeclaration {
  /** Frecuencia máxima declarada (Hz). 0 si no es estroboscópico. */
  readonly maxStrobeFreqHz: number
  /** True si el efecto contiene flash >3Hz en algún segmento. */
  readonly containsRapidFlash: boolean
  /** True solo para efectos firmados / builtin. Untrusted = community. */
  readonly communityTrusted: boolean
}

// ─── CLIP COMPLETO V2.1 (sobreviviente a IPC) ───────────────────────────────

/**
 * `.lfx v2.1.0` — formato serializable (Record en lugar de Map para JSON).
 *
 * Los campos legacy de `HephAutomationClipSerialized` se conservan para
 * mantener retrocompatibilidad. Los bloques nuevos (`cognitiveDNA`,
 * `simulationMeta`, `executionHints`, `safetyDeclaration`) son OPCIONALES:
 *   - Si están presentes → el clip es visible para Selene IA (Infinite Arsenal).
 *   - Si están ausentes  → el clip es "Hephaestus puro" (solo Chronos).
 */
export interface LfxClipV2 {
  readonly $schema: 'hephaestus/v2.1'
  readonly version: string

  readonly clip: {
    readonly id: string
    readonly name: string
    readonly author: string
    readonly category: string
    readonly tags: readonly string[]
    readonly vibeCompat: readonly string[]
    readonly zones: readonly string[]
    readonly mixBus: 'global' | 'htp' | 'ambient' | 'accent'
    readonly priority: number
    readonly durationMs: number
    /** `'heph_custom'` para clips que entran en pipeline L3+ del NodeArbiter. */
    readonly effectType: string

    /** Curvas Bézier reales (Record para sobrevivir IPC / JSON). */
    readonly curves: Readonly<Record<string, HephCurve>>

    readonly staticParams: Readonly<Record<string, number | string | boolean>>

    // ── Bloques cognitivos (opcionales — solo .lfx v2.1) ──
    readonly cognitiveDNA?: CognitiveDNA
    readonly simulationMeta?: SimulationMeta
    readonly executionHints?: ExecutionHints
    readonly safetyDeclaration?: SafetyDeclaration
  }

  readonly checksum: string
}

// ─── REGISTRY ENTRY (forma INTERNA del Registry, pre-indexada) ──────────────

/**
 * Snapshot inmutable de un `.lfx v2.1` listo para consumo zero-alloc.
 *
 * - NO contiene las curvas completas (solo el path al archivo / referencia).
 *   Las curvas se cargan lazy cuando HephaestusRuntime las necesita.
 * - Object.freeze() se aplica al insertar en el Registry.
 */
export interface RegistryEntry {
  readonly id: string
  readonly name: string
  readonly author: string
  readonly category: string
  readonly tags: readonly string[]
  readonly durationMs: number
  readonly effectType: string

  /** Ruta absoluta al `.lfx` en disco. `null` si fue inyectado in-memory. */
  readonly filePath: string | null

  /** Genoma cognitivo (alias plano para acceso O(1) en hot path). */
  readonly dna: FrozenGenome
  readonly textureAffinity: TextureAffinity
  readonly compatibleVibes: readonly string[]
  readonly validSections: readonly string[]
  readonly energyZone: EnergyZoneRange
  readonly aggressionRange: Range
  readonly spatialBehavior: SpatialBehavior
  readonly ikCompatibility: IKCompatibility | null

  /** Bloques anidados (read-only). */
  readonly simMeta: SimulationMeta
  readonly execHints: ExecutionHints
  readonly safetyDecl: SafetyDeclaration

  /** True para `.lfx` originados en `/builtin-effects/`. */
  readonly isBuiltin: boolean
  /** Timestamp de ingesta. */
  readonly loadedAt: number

  /**
   * Referencia al clip completo para carga lazy de curvas por el runtime.
   * Es OPCIONAL: si el Registry está corriendo en main process con FS access,
   * será `null` y el runtime cargará desde `filePath` cuando dispare.
   */
  readonly source: LfxClipV2 | null
}

// ─── DEFAULTS (para .lfx que omiten campos opcionales) ──────────────────────

export const DEFAULT_IK_COMPATIBILITY: Readonly<IKCompatibility> = Object.freeze({
  respectsTarget: true,
  orbitAmplitude: 1.0,
  fallbackOnNoTarget: 'static',
})

export const DEFAULT_SAFETY_DECLARATION: Readonly<SafetyDeclaration> = Object.freeze({
  maxStrobeFreqHz: 0,
  containsRapidFlash: false,
  communityTrusted: true, // builtin trust por defecto; ingesta override por path
})

export const DEFAULT_SIMULATION_META: Readonly<SimulationMeta> = Object.freeze({
  beautyWeights: Object.freeze({ base: 0.50, energyMultiplier: 1.00, vibeBonus: 0.00 }),
  gpuCost: 0.30,
  fatigueImpact: 0.06,
  minDurationMs: 1000,
  cooldownMs: 7000,
  isStrobe: false,
  isDivineCandidate: false,
  isHeavyCandidate: false,
  zScoreGuards: Object.freeze({
    requireRising: false,
    minimumZ: null,
    minimumEnergy: null,
  }),
}) as Readonly<SimulationMeta>

// ─── TYPE GUARDS ────────────────────────────────────────────────────────────

/** Type guard de runtime: ¿el clip tiene bloque cognitivo? */
export function hasCognitiveDNA(
  clip: LfxClipV2,
): clip is LfxClipV2 & { readonly clip: { readonly cognitiveDNA: CognitiveDNA } } {
  return clip.clip.cognitiveDNA != null
}

/** Type guard: ¿es un clip elegible para Selene IA? */
export function isSeleneEligible(clip: LfxClipV2): boolean {
  return clip.clip.effectType === 'heph_custom' && hasCognitiveDNA(clip)
}

// ─── RE-EXPORTS de tipos compatibles ────────────────────────────────────────

export type { HephCurve, HephParamId, PhaseConfig, EnergyZone }
