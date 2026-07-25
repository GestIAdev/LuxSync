// ════════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 4817 — LFX CLIP INSTANCE  (FASE 1: La Clase Átomo)
// ════════════════════════════════════════════════════════════════════════════
//  Traductor oficial entre los Arquetipos del usuario (lenguaje semántico)
//  y la matriz cognitiva fría que consume Selene IA (ACO + EnergyZones).
//
//  Doctrina:
//   - El usuario nunca toca ACO directo (salvo Expert Mode).
//   - Cada `userArchetype` aplica un bias matemático determinista sobre la
//     tríada ACO y restringe las EnergyZones legales.
//   - La instancia es mutable durante la edición y se congela
//     (`Object.freeze` recursivo) antes de entrar al hot path / serializar.
//   - Es retrocompatible con `.lfx` v1.x (legacy sin cognitiveDNA).
//
//  Referencias:
//   - docs/blueprints/WAVE-4816-UX-BLUEPRINT.md  (blueprint conceptual)
//   - docs/SELENE-REALITY-MAPPING.md             (realidad matemática)
//   - src/core/arsenal/lfxTypes.ts               (tipos `.lfx v2.1`)
// ════════════════════════════════════════════════════════════════════════════

import type {
  CognitiveDNA,
  FrozenGenome,
  EnergyZoneRange,
  TextureAffinity,
  SpatialBehavior as LfxSpatialBehavior,
  UserArchetype,
} from './lfxTypes'

// ─── TIPOS ESTRICTOS (FASE 1) ───────────────────────────────────────────────

// Re-export UserArchetype for backward compatibility (now defined in lfxTypes.ts)
export type { UserArchetype }

/** Comportamiento espacial frente al motor IK (subset declarado en directiva). */
export type SpatialBehavior = 'relative_offset' | 'absolute' | 'static'

/** Vibes compatibles — etiquetas de directiva (alias semánticos). */
export type CompatibleVibe =
  | 'techno-dark'
  | 'latino-organic'
  | 'pop-rock'
  | 'chill-lounge'

/** 7 zonas energéticas reales de Selene (ver SELENE-REALITY-MAPPING.md). */
export type EnergyZoneId =
  | 'silence'
  | 'valley'
  | 'ambient'
  | 'gentle'
  | 'active'
  | 'intense'
  | 'peak'

/** Tríada cognitiva ACO normalizada en [0..1]. */
export interface AcoTriad {
  aggression: number
  chaos: number
  organicity: number
}

// ─── CONSTANTES INMUTABLES ──────────────────────────────────────────────────

/** Lista canónica ordenada de zonas (silence → peak). Útil para clamps. */
export const ENERGY_ZONES: readonly EnergyZoneId[] = Object.freeze([
  'silence',
  'valley',
  'ambient',
  'gentle',
  'active',
  'intense',
  'peak',
] as const)

/** Lista canónica de vibes. */
export const COMPATIBLE_VIBES: readonly CompatibleVibe[] = Object.freeze([
  'techno-dark',
  'latino-organic',
  'pop-rock',
  'chill-lounge',
] as const)

/** Lista canónica de arquetipos. */
export const USER_ARCHETYPES: readonly UserArchetype[] = Object.freeze([
  'strobe',
  'ambient',
  'heavy',
  'divine',
  'utility',
] as const)

// ─── BIAS MAP — la "magia" del traductor ────────────────────────────────────

/**
 * Reglas de bias que cada arquetipo impone sobre el clip.
 *
 * Semántica:
 *   - `aggressionMin/Max`, `chaosMin/Max`, `organicityMin/Max`: clamp duro
 *     que se aplica DESPUÉS de los valores manuales del usuario.
 *   - `allowedZones`: si está presente, la lista de zonas válidas se
 *     intersecciona con esta whitelist. Si la intersección es vacía,
 *     se cae a `defaultZones`.
 *   - `defaultZones`: zonas que se inyectan si el usuario no eligió ninguna
 *     compatible (o si el clip es nuevo).
 *   - `centroid`: punto canónico ACO para inferencia inversa (FASE 3).
 */
export interface ArchetypeBias {
  readonly aggressionMin?: number
  readonly aggressionMax?: number
  readonly chaosMin?: number
  readonly chaosMax?: number
  readonly organicityMin?: number
  readonly organicityMax?: number
  readonly allowedZones?: readonly EnergyZoneId[]
  readonly defaultZones: readonly EnergyZoneId[]
  readonly centroid: Readonly<AcoTriad>
}

export const ARCHETYPE_BIAS_MAP: Readonly<Record<UserArchetype, ArchetypeBias>> =
  Object.freeze({
    // ── DIVINE: agresión magnetizada ≥0.90, solo PEAK/INTENSE ──
    divine: Object.freeze({
      aggressionMin: 0.9,
      chaosMin: 0.3,
      chaosMax: 0.7,
      allowedZones: Object.freeze(['intense', 'peak'] as const),
      defaultZones: Object.freeze(['peak'] as const),
      centroid: Object.freeze({ aggression: 0.95, chaos: 0.5, organicity: 0.5 }),
    }),

    // ── STROBE: agresión y caos altos, zonas activas/peak ──
    strobe: Object.freeze({
      aggressionMin: 0.75,
      chaosMin: 0.4,
      organicityMax: 0.35,
      allowedZones: Object.freeze(['active', 'intense', 'peak'] as const),
      defaultZones: Object.freeze(['intense', 'peak'] as const),
      centroid: Object.freeze({ aggression: 0.85, chaos: 0.65, organicity: 0.2 }),
    }),

    // ── HEAVY: peso bruto, baja organicidad, zonas duras ──
    heavy: Object.freeze({
      aggressionMin: 0.7,
      chaosMin: 0.3,
      organicityMax: 0.45,
      allowedZones: Object.freeze(['active', 'intense', 'peak'] as const),
      defaultZones: Object.freeze(['intense', 'peak'] as const),
      centroid: Object.freeze({ aggression: 0.8, chaos: 0.55, organicity: 0.25 }),
    }),

    // ── AMBIENT: tope de agresión, alta organicidad, zonas bajas ──
    ambient: Object.freeze({
      aggressionMax: 0.3,
      chaosMax: 0.3,
      organicityMin: 0.55,
      allowedZones: Object.freeze([
        'silence',
        'valley',
        'ambient',
        'gentle',
      ] as const),
      defaultZones: Object.freeze(['valley', 'ambient'] as const),
      centroid: Object.freeze({ aggression: 0.2, chaos: 0.2, organicity: 0.7 }),
    }),

    // ── UTILITY: passthrough; sin biases. Se usa para efectos de transición. ──
    utility: Object.freeze({
      defaultZones: Object.freeze(['ambient', 'gentle', 'active'] as const),
      centroid: Object.freeze({ aggression: 0.5, chaos: 0.5, organicity: 0.5 }),
    }),
  } as const)

// ─── DEFAULTS Y HELPERS ─────────────────────────────────────────────────────

const NEUTRAL_ACO: Readonly<AcoTriad> = Object.freeze({
  aggression: 0.5,
  chaos: 0.5,
  organicity: 0.5,
})

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0.5
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}

function clampRange(x: number, min: number | undefined, max: number | undefined): number {
  let v = clamp01(x)
  if (typeof min === 'number' && v < min) v = min
  if (typeof max === 'number' && v > max) v = max
  return v
}

function intersectZones(
  user: readonly EnergyZoneId[],
  allowed: readonly EnergyZoneId[] | undefined,
): EnergyZoneId[] {
  if (!allowed || allowed.length === 0) return [...user]
  const set = new Set(allowed)
  return user.filter(z => set.has(z))
}

function uniqueOrder<T>(arr: readonly T[]): T[] {
  const seen = new Set<T>()
  const out: T[] = []
  for (const item of arr) {
    if (!seen.has(item)) {
      seen.add(item)
      out.push(item)
    }
  }
  return out
}

function isUserArchetype(x: unknown): x is UserArchetype {
  return typeof x === 'string' && (USER_ARCHETYPES as readonly string[]).includes(x)
}

function isCompatibleVibe(x: unknown): x is CompatibleVibe {
  return typeof x === 'string' && (COMPATIBLE_VIBES as readonly string[]).includes(x)
}

/** Mapeo inverso público: `'techno-club' → 'techno-dark'`, etc. */
export function reverseVibeBridge(value: unknown): CompatibleVibe | null {
  if (typeof value !== 'string') return null
  if (isCompatibleVibe(value)) return value
  for (const [alias, real] of Object.entries(VIBE_BRIDGE)) {
    if (real === value) return alias as CompatibleVibe
  }
  return null
}

function isEnergyZone(x: unknown): x is EnergyZoneId {
  return typeof x === 'string' && (ENERGY_ZONES as readonly string[]).includes(x)
}

function isSpatialBehavior(x: unknown): x is SpatialBehavior {
  return x === 'relative_offset' || x === 'absolute' || x === 'static'
}

/** Mapea las vibes de directiva a las vibes reales de Selene (puente). */
const VIBE_BRIDGE: Readonly<Record<CompatibleVibe, string>> = Object.freeze({
  'techno-dark': 'techno-club',
  'latino-organic': 'fiesta-latina',
  'pop-rock': 'pop-rock',
  'chill-lounge': 'chill-lounge',
})

// ─── INPUT SHAPE ────────────────────────────────────────────────────────────

/** Forma de inicialización pública. Todos los campos no-id son opcionales. */
export interface LfxClipInstanceInit {
  id: string
  title?: string
  author?: string
  userArchetype?: UserArchetype
  spatialBehavior?: SpatialBehavior
  maxStrobeFreqHz?: number
  compatibleVibes?: readonly CompatibleVibe[]
  energyZones?: readonly EnergyZoneId[]
  acoTriad?: Partial<AcoTriad>
}

// ─── CLASE ÁTOMO ────────────────────────────────────────────────────────────

/**
 * Átomo unificador del Infinite Arsenal.
 *
 * Ciclo de vida típico:
 *  ```ts
 *  const clip = new LfxClipInstance({ id: 'abc', userArchetype: 'divine' })
 *  clip.setAcoTriad({ aggression: 0.5, chaos: 0.6, organicity: 0.4 })
 *  // → bake reescribe aggression a 0.9 (mínimo divine) y restringe zones a ['peak']
 *  clip.freeze() // listo para hot path / export
 *  ```
 */
export class LfxClipInstance {
  // ── Identidad ────────────────────────────────────────────────────────────
  public readonly id: string
  public title: string
  public author: string

  // ── Capa semántica (entrada principal del usuario) ───────────────────────
  private _userArchetype: UserArchetype

  // ── Capa técnica ─────────────────────────────────────────────────────────
  public spatialBehavior: SpatialBehavior
  public maxStrobeFreqHz: number

  // ── Capa cognitiva (consumida por Selene) ────────────────────────────────
  public compatibleVibes: CompatibleVibe[]
  public energyZones: EnergyZoneId[]
  public acoTriad: AcoTriad

  // ── Estado de freeze ─────────────────────────────────────────────────────
  private _frozen: boolean = false

  // ─────────────────────────────────────────────────────────────────────────

  constructor(init: LfxClipInstanceInit) {
    if (!init || typeof init.id !== 'string' || init.id.length === 0) {
      throw new Error('[LfxClipInstance] `id` is required and must be a non-empty string.')
    }

    this.id = init.id
    this.title = typeof init.title === 'string' ? init.title : 'Untitled Clip'
    this.author = typeof init.author === 'string' ? init.author : 'unknown'

    this._userArchetype = isUserArchetype(init.userArchetype)
      ? init.userArchetype
      : 'utility'

    this.spatialBehavior = isSpatialBehavior(init.spatialBehavior)
      ? init.spatialBehavior
      : 'static'

    this.maxStrobeFreqHz =
      typeof init.maxStrobeFreqHz === 'number' && Number.isFinite(init.maxStrobeFreqHz)
        ? Math.max(0, init.maxStrobeFreqHz)
        : 0

    this.compatibleVibes = Array.isArray(init.compatibleVibes)
      ? uniqueOrder(init.compatibleVibes.filter(isCompatibleVibe))
      : []

    this.energyZones = Array.isArray(init.energyZones)
      ? uniqueOrder(init.energyZones.filter(isEnergyZone))
      : []

    const a = init.acoTriad
    this.acoTriad = {
      aggression: clamp01(a?.aggression ?? NEUTRAL_ACO.aggression),
      chaos: clamp01(a?.chaos ?? NEUTRAL_ACO.chaos),
      organicity: clamp01(a?.organicity ?? NEUTRAL_ACO.organicity),
    }

    // Aplicar bias del arquetipo en construcción (idempotente).
    this.bakeCognitiveDNA()
  }

  // ─── GETTERS / SETTERS ────────────────────────────────────────────────────

  public get userArchetype(): UserArchetype {
    return this._userArchetype
  }

  public setUserArchetype(arch: UserArchetype): void {
    this._assertMutable()
    if (!isUserArchetype(arch)) {
      throw new Error(`[LfxClipInstance] Invalid userArchetype: ${String(arch)}`)
    }
    this._userArchetype = arch
    this.bakeCognitiveDNA()
  }

  public setAcoTriad(triad: Partial<AcoTriad>): void {
    this._assertMutable()
    if (typeof triad.aggression === 'number') this.acoTriad.aggression = clamp01(triad.aggression)
    if (typeof triad.chaos === 'number') this.acoTriad.chaos = clamp01(triad.chaos)
    if (typeof triad.organicity === 'number') this.acoTriad.organicity = clamp01(triad.organicity)
    this.bakeCognitiveDNA()
  }

  public setEnergyZones(zones: readonly EnergyZoneId[]): void {
    this._assertMutable()
    this.energyZones = uniqueOrder(zones.filter(isEnergyZone))
    this.bakeCognitiveDNA()
  }

  public setCompatibleVibes(vibes: readonly CompatibleVibe[]): void {
    this._assertMutable()
    this.compatibleVibes = uniqueOrder(vibes.filter(isCompatibleVibe))
  }

  public setSpatialBehavior(b: SpatialBehavior): void {
    this._assertMutable()
    if (!isSpatialBehavior(b)) {
      throw new Error(`[LfxClipInstance] Invalid spatialBehavior: ${String(b)}`)
    }
    this.spatialBehavior = b
  }

  public setMaxStrobeFreqHz(hz: number): void {
    this._assertMutable()
    if (!Number.isFinite(hz) || hz < 0) {
      throw new Error(`[LfxClipInstance] maxStrobeFreqHz must be a finite number ≥0.`)
    }
    this.maxStrobeFreqHz = hz
  }

  // ─── EL TRADUCTOR — bakeCognitiveDNA() ────────────────────────────────────

  /**
   * Aplica las reglas de bias del arquetipo activo sobre la realidad ACO y
   * sobre la lista de zonas. Determinista, idempotente y zero-alloc-friendly.
   *
   * Orden de operaciones:
   *  1. Clamp ACO contra `aggressionMin/Max`, `chaosMin/Max`, `organicityMin/Max`.
   *  2. Intersectar `energyZones` actuales con `allowedZones` (si existe).
   *  3. Si la intersección es vacía → caer en `defaultZones`.
   *  4. Si `energyZones` queda vacía aún → cae en `defaultZones`.
   */
  public bakeCognitiveDNA(): void {
    this._assertMutable()
    const bias = ARCHETYPE_BIAS_MAP[this._userArchetype]

    // 1. ACO clamps
    this.acoTriad.aggression = clampRange(
      this.acoTriad.aggression,
      bias.aggressionMin,
      bias.aggressionMax,
    )
    this.acoTriad.chaos = clampRange(
      this.acoTriad.chaos,
      bias.chaosMin,
      bias.chaosMax,
    )
    this.acoTriad.organicity = clampRange(
      this.acoTriad.organicity,
      bias.organicityMin,
      bias.organicityMax,
    )

    // 2-3. Zone intersection
    const filtered = intersectZones(this.energyZones, bias.allowedZones)
    if (filtered.length > 0) {
      this.energyZones = filtered
    } else if (this.energyZones.length === 0 || bias.allowedZones != null) {
      this.energyZones = [...bias.defaultZones]
    }

    // 4. Fallback general si quedó vacío
    if (this.energyZones.length === 0) {
      this.energyZones = [...bias.defaultZones]
    }
  }

  // ─── HOT-PATH SAFETY — freeze() ───────────────────────────────────────────

  /**
   * Congela recursivamente el átomo. Tras `freeze()`:
   *   - cualquier `set*` lanza Error.
   *   - los arrays `compatibleVibes`/`energyZones` y el objeto `acoTriad`
   *     son inmutables (`Object.freeze`).
   *   - la propia instancia es congelada.
   *
   * Garantiza zero-alloc safety al entrar al runtime y permite a Selene
   * cachear referencias confiando en que nada mutará.
   */
  public freeze(): Readonly<this> {
    if (this._frozen) return this as Readonly<this>
    Object.freeze(this.acoTriad)
    Object.freeze(this.compatibleVibes)
    Object.freeze(this.energyZones)
    this._frozen = true
    Object.freeze(this)
    return this as Readonly<this>
  }

  public get isFrozen(): boolean {
    return this._frozen
  }

  // ─── SERIALIZACIÓN / EXPORT ──────────────────────────────────────────────

  /**
   * Snapshot plano (PoD) listo para JSON / IPC. Independiente del freeze.
   */
  public toJSON(): {
    id: string
    title: string
    author: string
    userArchetype: UserArchetype
    spatialBehavior: SpatialBehavior
    maxStrobeFreqHz: number
    compatibleVibes: CompatibleVibe[]
    energyZones: EnergyZoneId[]
    acoTriad: AcoTriad
  } {
    return {
      id: this.id,
      title: this.title,
      author: this.author,
      userArchetype: this._userArchetype,
      spatialBehavior: this.spatialBehavior,
      maxStrobeFreqHz: this.maxStrobeFreqHz,
      compatibleVibes: [...this.compatibleVibes],
      energyZones: [...this.energyZones],
      acoTriad: { ...this.acoTriad },
    }
  }

  /**
   * Proyecta el átomo a un bloque `CognitiveDNA` (formato `.lfx v2.1`).
   *
   * WAVE 7176: Si se pasa `overrides`, los valores explícitos del usuario
   * (pressureRange, textureAffinity, spatialBehavior, etc.) tienen prioridad
   * absoluta sobre cualquier recálculo del archetype. Solo se recalculan
   * los campos que NO estén presentes en `overrides`.
   *
   * - `genome`: tríada ACO directa.
   * - `compatibleVibes`: vibes traducidas a las etiquetas reales de Selene
   *   (vía `VIBE_BRIDGE`).
   * - `energyZone`: rango [min..max] derivado del primer y último elemento
   *   de `energyZones` ordenados por la lista canónica `ENERGY_ZONES`.
   * - `aggressionRange`: rango [agg, agg] cerrado sobre el valor actual.
   * - `textureAffinity`: derivada del arquetipo (`strobe`/`heavy`→`dirty`,
   *   `ambient`/`divine`→`clean`, `utility`→`universal`).
   * - `spatialBehavior`: mapeado al subset de `lfxTypes` (`'static'`
   *   pasa tal cual; los otros también son válidos en lfx).
   */
  public toCognitiveDNA(overrides?: Partial<CognitiveDNA>): CognitiveDNA {
    const genome: FrozenGenome = Object.freeze({
      aggression: this.acoTriad.aggression,
      chaos: this.acoTriad.chaos,
      organicity: this.acoTriad.organicity,
    })

    // Calcular min/max de zone respetando orden canónico
    const order = ENERGY_ZONES
    let minIdx = order.length - 1
    let maxIdx = 0
    for (const z of this.energyZones) {
      const i = order.indexOf(z)
      if (i < 0) continue
      if (i < minIdx) minIdx = i
      if (i > maxIdx) maxIdx = i
    }
    if (this.energyZones.length === 0) {
      minIdx = 0
      maxIdx = order.length - 1
    }
    const energyZone: EnergyZoneRange = Object.freeze({
      min: order[minIdx],
      max: order[maxIdx],
    })

    const textureAffinity: TextureAffinity =
      this._userArchetype === 'strobe' || this._userArchetype === 'heavy'
        ? 'dirty'
        : this._userArchetype === 'ambient' || this._userArchetype === 'divine'
          ? 'clean'
          : 'universal'

    const compatibleVibes: readonly string[] = Object.freeze(
      this.compatibleVibes.map(v => VIBE_BRIDGE[v]),
    )

    const aggression = this.acoTriad.aggression
    const aggressionRange = Object.freeze({ min: aggression, max: aggression })

    // 🩸 WAVE 7159: Acoustic pressure gating — replace permissive {0,0} default
    // with classification-based ranges so the pressure veto actually fires.
    // Hard effects (strobe/heavy/divine archetype OR aggression > 0.7) require
    // high acoustic pressure (rawEnergy 0.5–1.0). Ambient effects are gated to
    // low pressure (0.0–0.5). Utility stays permissive (0.0–1.0).
    //
    // WAVE 7176: Si overrides.pressureRange está presente, tiene prioridad
    // absoluta — el usuario editó los sliders manualmente.
    const isHardArchetype =
      this._userArchetype === 'strobe' ||
      this._userArchetype === 'heavy' ||
      this._userArchetype === 'divine'
    const isAmbientArchetype = this._userArchetype === 'ambient'
    const computedPressureRange = Object.freeze(
      isHardArchetype || aggression > 0.7
        ? { min: 0.5, max: 1.0 }
        : isAmbientArchetype
          ? { min: 0.0, max: 0.5 }
          : { min: 0.0, max: 1.0 }
    )
    const pressureRange = Object.freeze(
      overrides?.pressureRange
        ? { min: overrides.pressureRange.min, max: overrides.pressureRange.max }
        : computedPressureRange
    )

    const spatialBehavior: LfxSpatialBehavior = this.spatialBehavior

    return Object.freeze({
      archetype: overrides?.archetype ?? this._userArchetype,
      genome: overrides?.genome ? { ...overrides.genome } : genome,
      textureAffinity: overrides?.textureAffinity ?? textureAffinity,
      compatibleVibes: overrides?.compatibleVibes
        ? [...overrides.compatibleVibes]
        : compatibleVibes,
      validSections: overrides?.validSections
        ? [...overrides.validSections]
        : Object.freeze([] as readonly string[]),
      energyZone: overrides?.energyZone
        ? { min: overrides.energyZone.min, max: overrides.energyZone.max }
        : energyZone,
      aggressionRange: overrides?.aggressionRange
        ? { min: overrides.aggressionRange.min, max: overrides.aggressionRange.max }
        : aggressionRange,
      pressureRange,
      spatialBehavior: overrides?.spatialBehavior ?? spatialBehavior,
      ikCompatibility: overrides?.ikCompatibility,
    })
  }

  // FASE 3: fromLegacyLfx (V2.1 compat bridge) demolished.
  // _reverseVibeBridge and _inferArchetypeFromLegacy also removed — no callers.

  // ─── INTERNALS ───────────────────────────────────────────────────────────

  private _assertMutable(): void {
    if (this._frozen) {
      throw new Error(
        '[LfxClipInstance] Instance is frozen. Clone via toJSON() and re-instantiate to mutate.',
      )
    }
  }
}
