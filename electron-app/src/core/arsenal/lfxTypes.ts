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

import type { HephCurve, HephParamId, PhaseConfig, HephTrack } from '../hephaestus/types'
import type { EnergyZone } from '../protocol/MusicalContext'

// ─── WAVE 4856 — V3 GENOME UPGRADE ──────────────────────────────────────────
// El esquema canónico para clips ejecutables a partir de WAVE 4856 es V3:
// `tracks: HephTrackV3[]` reemplaza al `curves: Record<paramId, curve>` plano,
// permitiendo MÚLTIPLES pistas con el mismo `paramId` enrutadas a zonas
// distintas (multicelularidad espacial). El alias `HephTrackV3` apunta al
// tipo `HephTrack` definido en `core/hephaestus/types.ts` y existe únicamente
// como contrato de naming hacia el cargador / Runtime / adapters.
export type HephTrackV3 = HephTrack

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
 * 🎨 WAVE 4812: Dominio de ejecución del clip.
 *
 * - `'vector'` (default si omitido) → curvas Bézier evaluadas por
 *   `HephaestusRuntime`. Flujo legacy intacto.
 * - `'pixel'`  → render bitmap a un `Uint8ClampedArray` muestreado por
 *   `PixelMapAetherAdapter`. Selene/Bridge encolan a `RenderHook`.
 * - `'hybrid'` → emite ambos: curvas Hephaestus para canales declarados
 *   en `pixelHints.hybridChannels` + canvas para el resto.
 */
export type ExecutionDomain = 'vector' | 'pixel' | 'hybrid'

/**
 * 🎨 WAVE 4812: Hints específicos del dominio pixel.
 * Solo relevante si `executionDomain ∈ {pixel, hybrid}`.
 */
export interface PixelExecutionHints {
  /** 'world' = textura proyectada al stage (UV from x,z). 'local' = grid intra-fixture (UV from cellIndex). */
  readonly mappingSpace: 'world' | 'local'
  /** Resolución preferida del Virtual Frame Buffer (W×H interleaved RGBA8). */
  readonly preferredResolution: { readonly w: number; readonly h: number }
  /** Modo de blend del sample sobre el target node. */
  readonly blend: 'replace' | 'multiply' | 'add' | 'screen'
  /** Si true, el alpha del pixel modula `dimmer`/`brightness` del target. */
  readonly alphaToDimmer: boolean
  /** Solo `'hybrid'`: lista de canales Bézier (no-pixel) que también se ejecutan. */
  readonly hybridChannels?: readonly string[]
  /** Override opcional al targetFps del productor (15-60). Default = arbiter rate (44 Hz). */
  readonly targetFps?: number
  /**
   * Política para fixtures sin posición 3D (`isPlaced=false`) cuando
   * `mappingSpace='world'`:
   *   - 'omit'           (default) → el fixture no recibe sample.
   *   - 'fallback-zone'  → muestrea el centro de la zona del fixture.
   */
  readonly guerrillaPolicy?: 'omit' | 'fallback-zone'
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

  // ── WAVE 4812: dominio de ejecución (vector vs pixel-map) ──
  /** Discriminador vector/pixel. Default `'vector'` si omitido. */
  readonly executionDomain?: ExecutionDomain
  /** Solo si `executionDomain ∈ {pixel, hybrid}`. */
  readonly pixelHints?: PixelExecutionHints
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

    /**
     * @deprecated WAVE 4856 — Esquema plano legacy (v2.1).
     *
     * Limita a UNA curva por `paramId`, lo que impide ruteo espacial
     * independiente (ej. dos colores distintos para dos zonas distintas).
     *
     * Sustituido por {@link tracks} (`HephTrackV3[]`). El `HephaestusRuntime`
     * sigue aceptando este campo en clips v2.1: realiza una migración
     * in-memory a `tracks[]` usando la zona global del clip como destino
     * común. Para nuevas autorías → emitir `tracks[]` directamente.
     */
    readonly curves: Readonly<Record<string, HephCurve>>

    /**
     * 🧬 WAVE 4856 — V3 multicelular (opcional en el wrapper v2.1).
     *
     * Cuando está presente, SUSTITUYE a `curves` para todos los efectos de
     * runtime. Cada track porta su propio conjunto de zonas, permitiendo N
     * pistas distintas con el mismo `paramId`. El Loader v2.1 ignora este
     * campo (usa `curves`); el Runtime lo prioriza si existe.
     */
    readonly tracks?: readonly HephTrackV3[]

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

  /**
   * 🎨 WAVE 4812: Alias plano del dominio de ejecución del clip.
   * Default `'vector'` cuando el `.lfx` no lo declara — flujo legacy.
   */
  readonly executionDomain: ExecutionDomain
  /** 🎨 WAVE 4812: Hints de pixel; null cuando `executionDomain === 'vector'`. */
  readonly pixelHints: PixelExecutionHints | null

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

// ─── LFX FILE V3.0 ──────────────────────────────────────────────────────────

/**
 * Wrapper de archivo `.lfx v3.0`.
 *
 * $schema:  discriminador en carga. Literal exacto 'luxsync.lfx/3.0'.
 * checksum: SHA-256 sobre JSON.stringify(clip) sin pretty-print.
 *           Calculado por el migrator v3; validado (opcional en dev) por LfxFileLoader.
 */
export interface LFXFileV3 {
  readonly $schema: 'luxsync.lfx/3.0'
  readonly clip: import('../hephaestus/types').HephAutomationClipV3
  readonly checksum: string
}

// ─── RE-EXPORTS de tipos compatibles ────────────────────────────────────────

export type { HephCurve, HephParamId, PhaseConfig, EnergyZone }
export type { ZoneTarget, BlendMode, HephTrack, HephAutomationClipV3 } from '../hephaestus/types'
// `HephTrackV3` se declara arriba como alias de `HephTrack` (WAVE 4856).
