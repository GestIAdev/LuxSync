/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 CustomVibe.ts — THE GENOME TYPINGS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Contrato de datos del formato `.luxvibe`: una **capa de mutación sparse**
 * sobre uno de los 4 ADN canónicos (techno-club, fiesta-latina, pop-rock,
 * chill-lounge).
 *
 * ── FILOSOFÍA ──────────────────────────────────────────────────────────────
 * Un vibe custom NO es una entidad nueva en el sistema. Es una clave más en
 * Records que los motores ya sabían leer. Este archivo describe únicamente
 * las DIFERENCIAS respecto al ADN base; el `VibeFusionResolver` reconstruye
 * las 7 configs de motor haciendo deep-merge de base + esta capa.
 *
 * ── INVARIANTES DEL TIPADO ─────────────────────────────────────────────────
 * 1. TODO override es opcional. Ausente = heredado del baseDNA.
 * 2. Los parámetros SELLADOS (seguridad de hardware / anti-epilepsia) NO
 *    existen en estos tipos. Es imposible escribirlos por accidente.
 *    Ver `engine/vibe/custom/SEALED_PARAMS.ts`.
 * 3. Cero `any`. Cero índices laxos. Todo primitivo es estricto.
 * 4. Los rangos físicos viven en `engine/vibe/custom/GENE_RANGES.ts` (SSOT
 *    compartida por el resolver y la UI). Aquí sólo se documentan en JSDoc.
 * 5. `readonly` en identidad y esquema; mutable en lo que la UI edita.
 *
 * ── ADVERTENCIA DE ACOPLAMIENTO ────────────────────────────────────────────
 * Los nombres de campo de las capas `physics` / `color` / `movement` son
 * espejo EXACTO de los contratos de motor:
 *   - physics  → `hal/physics/profiles/ILiquidProfile.ts` + `LiquidEnvelope.ts`
 *   - color    → `engine/color/SeleneColorEngine.ts` (GenerationOptions)
 *   - movement → `engine/movement/VibeMovementManager.ts` + `VibeMovementPresets.ts`
 * Si un contrato de motor cambia, este archivo debe seguirlo. Los tests de
 * `VibeFusionResolver` fallarán si divergen.
 *
 * @module types/CustomVibe
 * @version FASE 1A — The Genome Typings
 */

import type { VibeId, VibeProfile } from './VibeProfile'
import type { GenerationOptions } from '../engine/color/SeleneColorEngine'
import type { ILiquidProfile } from '../hal/physics/profiles/ILiquidProfile'
import type { MovementPreset } from '../engine/movement/VibeMovementPresets'

// ═══════════════════════════════════════════════════════════════════════════
// IDENTIDAD Y ESQUEMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Versión del esquema `.luxvibe`.
 * Incrementar SÓLO ante cambios incompatibles. Al ser un formato sparse, la
 * mayoría de adiciones de genes son retrocompatibles sin migración: un gen
 * nuevo ausente simplemente se hereda del ADN base.
 */
export const LUXVIBE_SCHEMA_VERSION = 1 as const

/** Tipo de la versión de esquema (evita `number` genérico). */
export type LuxVibeSchemaVersion = typeof LUXVIBE_SCHEMA_VERSION

/**
 * Clave sintética de un vibe custom.
 *
 * Formato: `custom:<slug>-<hash6>` — p.ej. `custom:dubstep-cathedral-a1b2c3`.
 *
 * El prefijo `custom:` es el discriminante que permite injertar la clave en
 * los registries de motor sin colisionar nunca con un `VibeId` canónico.
 */
export type CustomVibeKey = `custom:${string}`

/**
 * Los 4 donantes de ADN válidos.
 *
 * `idle` queda excluido deliberadamente: no es un género musical, es el estado
 * neutro de espera (panScale 0.15, 1 solo patrón `breath`, sin constitución
 * cromática real). Heredar de `idle` produciría vibes inertes.
 */
export type BaseDNA = Extract<
  VibeId,
  'techno-club' | 'fiesta-latina' | 'pop-rock' | 'chill-lounge'
>

/** Lista runtime de los ADN válidos (para validación y UI). */
export const BASE_DNA_IDS: readonly BaseDNA[] = [
  'techno-club',
  'fiesta-latina',
  'pop-rock',
  'chill-lounge',
] as const

/** Type guard de `BaseDNA`. */
export function isBaseDNA(value: string): value is BaseDNA {
  return (BASE_DNA_IDS as readonly string[]).includes(value)
}

/** Type guard de `CustomVibeKey`. */
export function isCustomVibeKey(value: string): value is CustomVibeKey {
  return value.startsWith('custom:') && value.length > 'custom:'.length
}

/** Metadatos de biblioteca de un vibe custom. */
export interface CustomVibeMeta {
  /** Clave sintética estable, generada al crear. NUNCA cambia. */
  readonly key: CustomVibeKey
  /** Nombre visible. Editable. */
  name: string
  /** Descripción libre. */
  description: string
  /** Emoji o nombre de icono `lucide-react`. */
  icon: string
  /** Autor declarado por el usuario. */
  author: string
  /** Epoch ms de creación. Inmutable. */
  readonly createdAt: number
  /** Epoch ms de última modificación. */
  updatedAt: number
  /** Etiquetas libres para el GenomeVault: `['dubstep', 'heavy', 'club']`. */
  tags: string[]
  /** Color de acento de la tarjeta en la biblioteca. Hex `#rrggbb`. */
  accentHex: string
}

/** Identificadores de los Macro Genes del modo SHIELDED. */
export type MacroGeneId =
  | 'aggression'
  | 'viscosity'
  | 'thermalBias'
  | 'spatialReach'
  | 'nervousness'

// ═══════════════════════════════════════════════════════════════════════════
// PRIMITIVAS COMPARTIDAS
// ═══════════════════════════════════════════════════════════════════════════

/** Rango angular en el círculo cromático. Grados `[0, 360]`. */
export type HueRange = readonly [start: number, end: number]

/** Rango genérico `[min, max]`. El resolver garantiza `min <= max`. */
export type MinMax = readonly [min: number, max: number]

/** Color HSL. `h` 0-360, `s` 0-100, `l` 0-100. */
export interface HslTriplet {
  h: number
  s: number
  l: number
}

/** Color RGB de 8 bits por canal. */
export interface RgbTriplet {
  r: number
  g: number
  b: number
}

// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENTO RAÍZ — `.luxvibe`
// ═══════════════════════════════════════════════════════════════════════════

/**
 * EL DOCUMENTO `.luxvibe`
 *
 * Mutación sparse sobre un ADN canónico. Sólo contiene lo que difiere del base.
 *
 * @example
 * ```json
 * {
 *   "schemaVersion": 1,
 *   "kind": "luxvibe",
 *   "baseDNA": "techno-club",
 *   "meta": { "key": "custom:dubstep-cathedral-a1b2c3", "name": "Dubstep Cathedral", ... },
 *   "physics":  { "transient": { "percBoost": 6.5 } },
 *   "movement": { "kinematics": { "panScale": 0.55 } }
 * }
 * ```
 */
export interface CustomVibeOverride {
  readonly schemaVersion: LuxVibeSchemaVersion
  /** Discriminante de formato. Permite validar un JSON antes de parsearlo. */
  readonly kind: 'luxvibe'
  meta: CustomVibeMeta

  /** El genoma del que hereda. Cambiarlo re-basa todas las mutaciones. */
  baseDNA: BaseDNA

  /** Capa de mutación del motor OmniLiquid (física de fotones). */
  physics?: PhysicsOverride
  /** Capa de mutación del motor Selene Color. */
  color?: ColorOverride
  /** Capa de mutación del VMM + presets de movimiento/óptica. */
  movement?: MovementOverride

  /**
   * Valores crudos de los Macro Genes (modo SHIELDED), `[0, 1]`.
   *
   * SÓLO INFORMATIVO: su efecto ya está materializado en las capas de arriba.
   * Se persiste para que al reabrir el documento los diales aparezcan en su
   * posición. El resolver los IGNORA.
   */
  macros?: Partial<Record<MacroGeneId, number>>
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPA 1 — PHYSICS (OmniLiquid) — ~180 parámetros
// Espejo de: hal/physics/profiles/ILiquidProfile.ts + hal/physics/LiquidEnvelope.ts
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Los 17 parámetros mutables de un `LiquidEnvelope`.
 *
 * Espejo de `LiquidEnvelopeConfig` EXCEPTO `name`, que es identidad (una
 * etiqueta de telemetría), no física, y por tanto no se muta.
 */
export interface EnvelopeOverride {
  /** Umbral de activación del gate. La señal debe superarlo para disparar. `0.0–1.0` */
  gateOn?: number
  /** Multiplicador de ganancia post-gate. `0.0–20.0` */
  boost?: number
  /** Compresión base. `>1` = selectivo (sólo picos), `<1` = expansivo. `0.1–5.0` */
  crushExponent?: number
  /** Factor de decay por frame en morph=0. Más alto = decay más lento. `0.0–1.0` */
  decayBase?: number
  /** Rango de modulación del decay por morphFactor. `0.0–1.0` */
  decayRange?: number
  /** Cap de intensidad máxima de salida. `0.0–1.0` */
  maxIntensity?: number
  /** Umbral de ignition squelch en morph=0 (anti-pad-ghost). `0.0–1.0` */
  squelchBase?: number
  /** Pendiente de squelch: cuánto baja con morphFactor. `0.0–1.0` */
  squelchSlope?: number
  /** Cap de ghostPower en morph=1 (soft knee subliminal glow). `0.0–1.0` */
  ghostCap?: number
  /** Margen fijo añadido sobre el gate adaptativo. `0.0–0.5` */
  gateMargin?: number
  /** Pendiente mínima de ataque para permitir disparo. `0` = sin filtro. `-0.1–0.5` */
  attackSlopeMin?: number
  /** Velocidad máxima de subida del output por frame. `1.0` = instantáneo. `0.0–1.0` */
  riseRate?: number
  /** Frames de señal plana antes de endurecer squelch (anti-autotune). `0–9999` */
  sustainedSquelchStartFrames?: number
  /** Incremento de squelch por frame tras superar `startFrames`. `0.0–0.1` */
  sustainedSquelchRisePerFrame?: number
  /** Techo del endurecimiento acumulado de squelch. `0.0–1.0` */
  sustainedSquelchMaxBoost?: number
  /** Umbral de velocidad considerada "plana" (nota sostenida). `0.0–1.0` */
  sustainedFlatVelocityMax?: number
  /** Alpha extra para que `avgSignal` persiga señal sostenida más rápido. `0.0–1.0` */
  adaptiveNoiseAlpha?: number
}

/**
 * Las 6 cámaras (envelopes) del motor.
 *
 * El nombre de la clave es el del contrato de motor; el rol físico es el de
 * la zona que alimenta:
 *   - `envelopeSubBass`  → Front L  (El Océano / Pulso del Abismo)
 *   - `envelopeKick`     → Front R  (El Francotirador / Bombo)
 *   - `envelopeVocal`    → Mover R  (El Coro / Galán / Voz del Mar)
 *   - `envelopeSnare`    → Back R   (El Látigo / Schwarzenegger)
 *   - `envelopeHighMid`  → Back L   (Teclados / Mid Synths)
 *   - `envelopeTreble`   → Mover L  (Melodías tonales)
 */
export type EnvelopeSlot =
  | 'envelopeSubBass'
  | 'envelopeKick'
  | 'envelopeVocal'
  | 'envelopeSnare'
  | 'envelopeHighMid'
  | 'envelopeTreble'

/** Lista runtime de las 6 cámaras (orden de UI). */
export const ENVELOPE_SLOTS: readonly EnvelopeSlot[] = [
  'envelopeSubBass',
  'envelopeKick',
  'envelopeVocal',
  'envelopeSnare',
  'envelopeHighMid',
  'envelopeTreble',
] as const

/** Estrategia de enrutamiento del layout 4.1. */
export type Layout41Strategy = 'default' | 'strict-split'

/** THE SCHWARZENEGGER — transient shaper de Back R. */
export interface TransientOverride {
  /** Penalización de mid al aislar treble. `rawR = max(0, treble - mid × k)`. `0.0–5.0` */
  percMidSubtract?: number
  /** Gate duro: umbral que `rawRight` debe superar. `0.0–0.5` */
  percGate?: number
  /** Multiplicador post-gate+exponent. `0.0–10.0` */
  percBoost?: number
  /** Exponente de la curva post-gate. `1.0`=lineal, `>1`=convexa. `0.1–3.0` */
  percExponent?: number
}

/** THE SEPARATION MATRIX — cross-filters de las 3 zonas melódicas. */
export interface SeparationOverride {
  // ── Mover R (voces) — bass subtractor adaptativo ──
  /** Factor base de resta de bass en morph=0. `0.0–1.0` */
  bassSubtractBase?: number
  /** Rango de modulación por morph. `factor = base - morph × range`. `0.0–1.0` */
  bassSubtractRange?: number
  /** Resta de treble en Mover R. Negativo INYECTA treble. `-1.0–1.0` */
  moverRTrebleSub?: number

  // ── Back L (mid synths) — cross-filter ──
  /** Peso de lowMid en la mezcla de Back L. `0.0–2.0` */
  backLLowMidWeight?: number
  /** Peso de mid en la mezcla de Back L. `0.0–2.0` */
  backLMidWeight?: number
  /** Resta de treble en Back L. Negativo INYECTA. `-1.0–1.0` */
  backLTrebleSub?: number
  /** Resta de bass en Back L. `0.0–1.0` */
  backLBassSub?: number

  // ── Mover L (melodías) — cross-filter + tonal gate ──
  /** Peso de highMid en la mezcla de Mover L. `0.0–3.0` */
  moverLHighMidWeight?: number
  /** Peso de treble en la mezcla de Mover L. `0.0–2.0` */
  moverLTrebleWeight?: number
  /** Peso de mid en la mezcla de Mover L. `0.0–2.0` */
  moverLMidWeight?: number
  /** Umbral de flatness del gate tonal. `< threshold` = tonal = pasa. `0.0–1.0` */
  moverLTonalThreshold?: number
}

/** THE GUILLOTINE — sidechain y caps morfológicos. */
export interface SidechainOverride {
  /** Umbral de `frontMax` para activar ducking. `999` = imposible. `0.0–999.0` */
  sidechainThreshold?: number
  /** Profundidad del ducking. `0` = nada, `1` = kill total. `0.0–1.0` */
  sidechainDepth?: number
  /** Profundidad del sidechain del snare sobre Mover R. `0.0–1.0` */
  snareSidechainDepth?: number
  /** Guillotina 4.1: umbral de kick para guillotinar subBass. `0` = off. `0.0–1.0` */
  frontKickSidechainThreshold?: number
  /** Cap morfológico del subBass. `0` = off. `0.0–1.0` */
  auraCapBase?: number
  /** Exponente del auraCap. `cap = base × pow(morph, exp)`. `0.0–5.0` */
  auraCapExponent?: number
}

/**
 * THE FLASH GATE — strobe.
 *
 * ⚠️ El resolver impone un guardarraíl anti-epilepsia: la combinación
 * `strobeThreshold` / `strobeDuration` nunca puede producir > 12 Hz efectivos.
 */
export interface StrobeOverride {
  /** Umbral base de treble para trigger. `999` = imposible. `0.0–999.0` */
  strobeThreshold?: number
  /** Duración del strobe en ms. `1–1000` */
  strobeDuration?: number
  /** Descuento de threshold en noiseMode. `0.80` = 20% menos. `0.0–1.0` */
  strobeNoiseDiscount?: number
}

/** ACID / NOISE / APOCALYPSE — umbrales de los modos espectrales. */
export interface ModesOverride {
  /** Harshness para activar Acid Mode. `0.0–1.0` */
  harshnessAcidThreshold?: number
  /** Flatness para activar Noise Mode. `0.0–1.0` */
  flatnessNoiseThreshold?: number
  /** Harshness mínimo para Apocalypse Mode. `0.0–1.0` */
  apocalypseHarshness?: number
  /** Flatness mínimo para Apocalypse Mode. `0.0–1.0` */
  apocalypseFlatness?: number
}

/**
 * MORPHOLOGY — normalización del morphFactor.
 *
 * `morphFactor = clamp((avgMid - floor) / (ceiling - floor), 0, 1)`
 *
 * ⚠️ Invariante: `morphFloor < morphCeiling`. El resolver auto-corrige.
 */
export interface MorphOverride {
  /** Umbral inferior de avgMid para morphFactor=0 (percusión pura). `0.0–1.0` */
  morphFloor?: number
  /** Umbral superior de avgMid para morphFactor=1 (melodía pura). `0.0–1.0` */
  morphCeiling?: number
}

/** THE METRONOME — detección de kick. */
export interface KickOverride {
  /** Intervalo mínimo (ms) entre kicks para considerar edge. `1–999999` */
  kickEdgeMinInterval?: number
  /** Frames de veto post-kick (input kill en Mover R). `0–20` */
  kickVetoFrames?: number
}

/** VISCOSITY — constantes de tiempo del EMA ambiental. */
export interface AmbientOverride {
  /** Attack del EMA ambiental (ms). Menor = subida más rápida. `1–10000` */
  ambientAttackMs?: number
  /** Release del EMA ambiental (ms). Mayor = caída más lenta. `1–60000` */
  ambientReleaseMs?: number
  /** Peso de la banda mid en la mezcla ambiental. `0` = sólo subBass. `0.0–2.0` */
  ambientMidWeight?: number
  /** Ganancia global post-crush del ambient. Default motor `1.35`. `0.0–5.0` */
  ambientGain?: number
}

/** THE ROUTING BAY — enrutamiento y modos especiales. */
export interface RoutingOverride {
  /** Estrategia de compactación del layout 4.1. */
  layout41Strategy?: Layout41Strategy
  /**
   * Modo Ambient Puro: ignora TODO el audio y genera con osciladores temporales.
   * ⚠️ Desactiva por completo la reactividad musical. Sólo modo RAW.
   */
  isPureAmbient?: boolean
}

/**
 * THE COMPACT MIRROR — overrides exclusivos del layout 4.1.
 *
 * ⚠️ SUPERFICIE DELIBERADAMENTE ESTRECHA. Espejo EXACTO de
 * `ILiquidProfile.overrides41`, que el motor fusiona en `fuseProfileFor41()`.
 *
 * El motor NO soporta overrides 4.1 de strobe, modes, morph, kick, ambient ni
 * `isPureAmbient`. Exponerlos aquí crearía genes fantasma: la UI los mostraría,
 * el usuario los movería y el motor los ignoraría en silencio. Por eso este
 * tipo NO es un `Omit<PhysicsOverride, 'overrides41'>`.
 */
export interface Physics41Override {
  /** Overrides parciales de las 6 cámaras para layout 4.1. */
  envelopes?: Partial<Record<EnvelopeSlot, EnvelopeOverride>>
  transient?: TransientOverride
  separation?: SeparationOverride
  sidechain?: SidechainOverride
  routing?: Pick<RoutingOverride, 'layout41Strategy'>
}

/** Capa de mutación completa del motor OmniLiquid. */
export interface PhysicsOverride {
  /** THE SIX CHAMBERS — 17 genes × 6 envelopes = 102 parámetros. */
  envelopes?: Partial<Record<EnvelopeSlot, EnvelopeOverride>>
  /** THE SCHWARZENEGGER — 4 parámetros. */
  transient?: TransientOverride
  /** THE SEPARATION MATRIX — 11 parámetros. */
  separation?: SeparationOverride
  /** THE GUILLOTINE — 6 parámetros. */
  sidechain?: SidechainOverride
  /** THE FLASH GATE — 3 parámetros. */
  strobe?: StrobeOverride
  /** ACID / NOISE / APOCALYPSE — 4 parámetros. */
  modes?: ModesOverride
  /** MORPHOLOGY — 2 parámetros. */
  morph?: MorphOverride
  /** THE METRONOME — 2 parámetros. */
  kick?: KickOverride
  /** VISCOSITY — 4 parámetros. */
  ambient?: AmbientOverride
  /** THE ROUTING BAY — 2 parámetros. */
  routing?: RoutingOverride
  /** THE COMPACT MIRROR — overrides de layout 4.1. */
  overrides41?: Physics41Override
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPA 2 — COLOR (Selene Color Engine) — 46 parámetros
// Espejo de: engine/color/SeleneColorEngine.ts (GenerationOptions)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estrategias de armonía que el motor soporta como `forceStrategy`.
 *
 * ⚠️ Es un SUBCONJUNTO de `ColorStrategy` de `VibeProfile.ts`. El motor
 * `SeleneColorEngine` no implementa `monochromatic` ni `split-complementary`
 * (este último se mapea a `complementary` en TitanEngine). Exponer los 6
 * crearía dos genes muertos.
 */
export type ColorStrategyOverride =
  | 'analogous'
  | 'triadic'
  | 'complementary'
  | 'prism'

/** Comportamientos del color de acento. */
export type AccentBehavior =
  | 'strobe'
  | 'drum-reactive'
  | 'solar-flare'
  | 'breathing'
  | 'quaternary'

/** Curvas de easing de las transiciones cromáticas. */
export type ColorEasing = 'linear' | 'ease-in' | 'ease-out' | 'sine-inout'

/** Regla de transmutación forzada de una zona cromática. */
export interface HueRemapRule {
  /** Inicio del rango origen, en grados. `0–360` */
  from: number
  /** Fin del rango origen, en grados. `0–360` */
  to: number
  /** Hue destino, en grados. `0–360` */
  target: number
}

/** Slot temporal del carrusel sidéreo. */
export interface SiderealSlot {
  /** Etiqueta para debug y UI: `'BUNKER'`, `'APEX'`, `'ABISAL'`... */
  label: string
  /** Rangos de hue permitidos durante este slot. */
  allowedHueRanges: HueRange[]
  /** Rango de luminosidad opcional para este slot. `0–100` */
  lightnessRange?: MinMax
}

/** THE FORBIDDEN WHEEL — restricciones angulares del círculo cromático. */
export interface HueOverride {
  /** Rangos prohibidos. La Elastic Rotation escapa de ellos. */
  forbiddenHueRanges?: HueRange[]
  /** Rangos permitidos. Si un hue cae fuera, hace snap al más cercano. */
  allowedHueRanges?: HueRange[]
  /** Grados de rotación por iteración al escapar de una zona prohibida. `1–90` */
  elasticRotation?: number
  /** Mapeos forzados de zonas cromáticas completas. */
  hueRemapping?: HueRemapRule[]
}

/**
 * THERMAL GRAVITY — la física cromática.
 *
 * Zona neutral `5800–6200K` (sin gravedad). Por encima arrastra hacia 240°
 * (Azul Rey); por debajo hacia 40° (Oro).
 */
export interface ThermalOverride {
  /** Temperatura atmosférica del vibe, en Kelvin. `2000–10000` */
  atmosphericTemp?: number
  /** Fuerza máxima del arrastre térmico. Default motor `0.35`. `0.0–1.0` */
  thermalGravityStrength?: number
}

/** THE LUMINANCE GATE — rangos de saturación y luminosidad. */
export interface LuminanceOverride {
  /** Rango de saturación permitido. `0–100` */
  saturationRange?: MinMax
  /** Rango de luminosidad permitido. `0–100` */
  lightnessRange?: MinMax
}

/** MUD GUARD — anti-barro para vibes tropicales. */
export interface MudGuardOverride {
  enabled?: boolean
  /** Zona de hue peligrosa (marrón). Grados. */
  swampZone?: HueRange
  /** Luminosidad mínima dentro de la swamp zone. `0–100` */
  minLightness?: number
  /** Saturación mínima dentro de la swamp zone. `0–100` */
  minSaturation?: number
}

/** NEON PROTOCOL — "Neon or Nothing": sanitiza la danger zone. */
export interface NeonProtocolOverride {
  enabled?: boolean
  /** Rango de hue peligroso. Grados. */
  dangerZone?: HueRange
  /** Saturación mínima para calificar como neón. `0–100` */
  minSaturation?: number
  /** Luminosidad mínima para evitar el barro. `0–100` */
  minLightness?: number
  /** Si no puede ser neón, colapsar a blanco hielo. */
  fallbackToWhite?: boolean
}

/** THE HARMONY ENGINE — estrategia y geometría de la paleta. */
export interface HarmonyOverride {
  /**
   * Si se define, BLINDA la estrategia frente al `StrategyArbiter`.
   * Dejarlo ausente delega la decisión al Arbiter (rolling avg de syncopation).
   */
  forceStrategy?: ColorStrategyOverride
  /** Ambient = Secondary + 180° (máximo contraste caribeño). */
  tropicalMirror?: boolean
  /** Empuja el ambient a zona fría cuando el primary es cálido. */
  tropicalAmbientBias?: boolean
  /** Suprime el Tropical Bias automático del motor. */
  suppressTropicalBias?: boolean
  /** Bloquea el Ambient en un color fijo. ⚠️ Puede producir paletas estáticas. */
  ambientLock?: HslTriplet
  /** Rotación del secundario, en grados. Default motor ≈ `222.5` (PHI). `0–360` */
  fibonacciRotationDeg?: number
  /**
   * Salt cromático por tónica: `root (0–11)` → delta en grados.
   * `0`=C, `1`=C#, ... `11`=B.
   */
  saltChromaticKeys?: Record<number, number>
  /** Signature de hue por tónica: `root (0–11)` → `{ h, maxS? }`. */
  luxurySignatures?: Record<number, { h: number; maxS?: number }>
}

/** THE ACCENT REACTOR — comportamiento y color del acento. */
export interface AccentOverride {
  accentBehavior?: AccentBehavior
  /** Prohíbe strobes por constitución (p.ej. Chill). */
  strobeProhibited?: boolean
  /** Color del strobe (usado por `accentBehavior: 'strobe'`). */
  strobeColor?: RgbTriplet
  /** Config del Solar Flare (usado por `accentBehavior: 'solar-flare'`). */
  solarFlareAccent?: HslTriplet
  /** Config del Snare Flash (usado por `accentBehavior: 'drum-reactive'`). */
  snareFlash?: HslTriplet
  /** Config del Kick Punch (usado por `accentBehavior: 'drum-reactive'`). */
  kickPunch?: {
    usesPrimary?: boolean
    /** Luminosidad del punch. `0–100` */
    l?: number
  }
  /** Config del pulso (usado por `accentBehavior: 'breathing'`). */
  pulseConfig?: {
    /** Duración del ciclo en ms. `1–60000` */
    duration?: number
    /** Amplitud del pulso. `0.0–1.0` */
    amplitude?: number
  }
}

/**
 * THE GLACIER — transiciones cromáticas.
 *
 * ⚠️ Invariante: `minDuration <= maxDuration`. El resolver auto-corrige.
 */
export interface ColorTransitionsOverride {
  /** Duración mínima de transición, en ms. `1–60000` */
  minDuration?: number
  /** Duración máxima de transición, en ms. `1–60000` */
  maxDuration?: number
  easing?: ColorEasing
}

/**
 * Dimming general del vibe.
 *
 * ⚠️ Invariante: `floor <= ceiling`. El resolver auto-corrige.
 */
export interface DimmingOverride {
  /** Suelo del dimmer. `0.0–1.0` */
  floor?: number
  /** Techo del dimmer. `0.0–1.0` */
  ceiling?: number
}

/** THE SIDEREAL CAROUSEL — carrusel temporal de zonas cromáticas. */
export interface SiderealClockOverride {
  enabled?: boolean
  /** Duración de cada slot, en ms. `1000–3600000` (1s–1h) */
  slotDurationMs?: number
  /** Los actos del carrusel, en orden. */
  slots?: SiderealSlot[]
}

/**
 * THE ABYSS — modulación oceánica.
 *
 * ⚠️ En el pipeline canónico, `TitanEngine` INYECTA este bloque dinámicamente
 * para vibes chill a partir de `ChillAmbientEngine.morphFactor`, sobrescribiendo
 * lo que haya aquí. Definirlo sólo tiene efecto real en vibes NO basados en
 * chill-lounge. Modo RAW únicamente.
 */
export interface OceanicModulationOverride {
  enabled?: boolean
  /** Hue sugerido por la profundidad. `0–360` */
  hueInfluence?: number
  /** Fuerza de la sugestión de hue. `0.0–1.0` */
  hueInfluenceStrength?: number
  /** Modificador de saturación. `-30–+30` */
  saturationMod?: number
  /** Modificador de luminosidad. `-20–+20` */
  lightnessMod?: number
  /** Modulación respiratoria por audio. `0.85–1.15` */
  breathingFactor?: number
}

/** Capa de mutación completa del motor Selene Color. */
export interface ColorOverride {
  /** THE FORBIDDEN WHEEL — 4 parámetros. */
  hue?: HueOverride
  /** THERMAL GRAVITY — 2 parámetros. */
  thermal?: ThermalOverride
  /** THE LUMINANCE GATE — 2 parámetros. */
  luminance?: LuminanceOverride
  /** MUD GUARD — 4 parámetros. */
  mudGuard?: MudGuardOverride
  /** NEON PROTOCOL — 5 parámetros. */
  neonProtocol?: NeonProtocolOverride
  /** THE HARMONY ENGINE — 8 parámetros. */
  harmony?: HarmonyOverride
  /** THE ACCENT REACTOR — 7 parámetros. */
  accent?: AccentOverride
  /** THE GLACIER — 3 parámetros. */
  transitions?: ColorTransitionsOverride
  /** Dimming — 2 parámetros. */
  dimming?: DimmingOverride
  /** THE SIDEREAL CAROUSEL — 3 parámetros. */
  siderealClock?: SiderealClockOverride
  /** THE ABYSS — 6 parámetros (RAW). */
  oceanicModulation?: OceanicModulationOverride
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPA 3 — MOVEMENT (VMM + IK) — 28 escalares + 6 genes × 22 patrones
// Espejo de: engine/movement/VibeMovementManager.ts + VibeMovementPresets.ts
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Los 22 patrones del vocabulario cinemático completo.
 *
 * NOTA DE CORRECCIÓN: el blueprint y los comentarios del motor hablan de "La
 * Docena Dorada + The Four Nobles" y en algún encabezado citan 16 patrones. El
 * recuento real de `PATTERNS` en `VibeMovementManager.ts` es **22**:
 * 7 techno + 5 latino + 3 pop-rock + 3 chill + 4 nobles. La cifra correcta es 22.
 */
export type GoldenPatternId =
  // ── TECHNO (7) — industrial / geometría dura ──
  | 'scan_x'
  | 'square'
  | 'diamond'
  | 'botstep'
  | 'darkspin'
  | 'laser_grid'
  | 'industrial_pendulum'
  // ── LATINO (5) — fluido / caderas / alma ──
  | 'figure8'
  | 'wave_y'
  | 'ballyhoo'
  | 'cadera_libre'
  | 'espiral_conga'
  // ── POP-ROCK (3) — estadio / simetría ──
  | 'circle_big'
  | 'cancan'
  | 'dual_sweep'
  // ── CHILL (3) — orgánico / ambiental ──
  | 'drift'
  | 'sway'
  | 'breath'
  // ── THE FOUR NOBLES (4) — universales ──
  | 'slow_pan'
  | 'tilt_nod'
  | 'figure_of_4'
  | 'chase_position'

/** Lista runtime de los 22 patrones, agrupada por familia (orden de UI). */
export const GOLDEN_PATTERN_IDS: readonly GoldenPatternId[] = [
  'scan_x', 'square', 'diamond', 'botstep', 'darkspin', 'laser_grid', 'industrial_pendulum',
  'figure8', 'wave_y', 'ballyhoo', 'cadera_libre', 'espiral_conga',
  'circle_big', 'cancan', 'dual_sweep',
  'drift', 'sway', 'breath',
  'slow_pan', 'tilt_nod', 'figure_of_4', 'chase_position',
] as const

/** Familia estética de un patrón (para agrupar en THE ORBIT VAULT). */
export type PatternFamily = 'techno' | 'latino' | 'poprock' | 'chill' | 'noble'

/** Mapa patrón → familia. */
export const PATTERN_FAMILY: Readonly<Record<GoldenPatternId, PatternFamily>> = {
  scan_x: 'techno', square: 'techno', diamond: 'techno', botstep: 'techno',
  darkspin: 'techno', laser_grid: 'techno', industrial_pendulum: 'techno',
  figure8: 'latino', wave_y: 'latino', ballyhoo: 'latino',
  cadera_libre: 'latino', espiral_conga: 'latino',
  circle_big: 'poprock', cancan: 'poprock', dual_sweep: 'poprock',
  drift: 'chill', sway: 'chill', breath: 'chill',
  slow_pan: 'noble', tilt_nod: 'noble', figure_of_4: 'noble', chase_position: 'noble',
} as const

/** Tipo de desfase estéreo entre fixtures. */
export type StereoType = 'sync' | 'snake' | 'mirror'

/** Modo de física del driver de movimiento. */
export type PhysicsMode = 'snap' | 'classic'

/** Modo de dispersión espacial del fan IK. */
export type SpatialFanMode = 'converge' | 'line' | 'circle'

/**
 * THE SCHEDULER DECK — override del scheduler para UN patrón.
 *
 * ⚠️ Invariante musical: `phraseDuration = N × cycleBeats` (múltiplo entero).
 * El resolver hace snap al múltiplo más cercano y emite un diagnostic `warn`.
 */
export interface PatternSchedulerOverride {
  /** Beats por ciclo completo. Controla la VELOCIDAD del foco. `8–512` */
  cycleBeats?: number
  /** Beats en escena antes de rotar. Controla la DURACIÓN. `16–1024` */
  phraseDuration?: number
  /** Duración del crossfade cinético, en beats. `1–8` */
  transitionBeats?: number
  /** Fase (rad) de posición segura para transicionar. `0–2π` (RAW) */
  safeHarborPhase?: number
  /** Tolerancia angular del harbor (rad). Default motor `π/4`. `0–π` (RAW) */
  safeHarborWindow?: number
  /** Beats extra de gracia anti-bloqueo. `8–128` (RAW) */
  hardDeadlineExtra?: number
}

/** THE ORBIT VAULT + THE REACH — espejo de `VibeConfig` del VMM. */
export interface KinematicsOverride {
  /**
   * Lista ordenada de patrones. El orden define la rotación del scheduler.
   * ⚠️ Si se provee vacía, el resolver hereda la del ADN base (un vibe sin
   * patrones dejaría los movers congelados).
   */
  patterns?: GoldenPatternId[]
  /** Escala de amplitud Pan. `1.0` = rango completo (~540°). `0.0–1.0` */
  panScale?: number
  /** Escala de amplitud Tilt. `1.0` = rango completo (~270°). `0.0–1.0` */
  tiltScale?: number
  /** Frecuencia base en Hz. LEGACY: el scheduler usa `cycleBeats`. `0.0–1.0` (RAW) */
  baseFrequency?: number
  /** Volver a home en silencio. `false` = Ghost Protocol (congela posición). */
  homeOnSilence?: boolean
}

/** THE ENSEMBLE — espejo de `StereoConfig` del VMM. */
export interface StereoOverride {
  /** `mirror` invierte X en impares; `snake` desfasa la fase; `sync` no desfasa. */
  type?: StereoType
  /** Offset de fase entre fixtures consecutivos, en radianes. `0–π` */
  offset?: number
}

/**
 * THE GEARBOX — espejo de `MovementPhysics` del preset.
 *
 * ⚠️ `maxAcceleration` y `maxVelocity` son capados en runtime por el
 * `SAFETY_CAP` del `FixturePhysicsDriver` (900 DMX/s² y 400 DMX/s). Pedir más
 * es legal en el documento pero no tendrá efecto: el resolver emite `warn`.
 */
export interface MovementPhysicsOverride {
  /** `snap` = persecución directa; `classic` = inercia con accel/frenado. */
  physicsMode?: PhysicsMode
  /** Aceleración máxima en DMX/s². `6–900` */
  maxAcceleration?: number
  /** Velocidad máxima en DMX/s. `12–400` */
  maxVelocity?: number
  /** Slew rate limit / inercia. `0.0–1.0` */
  friction?: number
  /** Umbral de llegada en DMX (overshoot elegante). `0.5–8.0` (RAW) */
  arrivalThreshold?: number
  /** Factor de snap. `1.0` = instantáneo. Sólo aplica en `physicsMode: 'snap'`. `0.0–1.0` */
  snapFactor?: number
  /** Límite de velocidad pan en DMX/s (protección de correas). `15–300` */
  revLimitPanPerSec?: number
  /** Límite de velocidad tilt en DMX/s (protección de correas). `10–240` */
  revLimitTiltPerSec?: number
}

/**
 * THE LENS — espejo de `OpticsConfig` del preset.
 *
 * ⚠️ Invariantes: `zoomRange[0] <= zoomRange[1]`, íd. focus. El resolver corrige.
 */
export interface OpticsOverride {
  /** Zoom por defecto. `0`=Beam, `255`=Wash. `0–255` */
  zoomDefault?: number
  /** Rango de zoom permitido. `0–255` */
  zoomRange?: MinMax
  /** Foco por defecto. `0`=Sharp, `255`=Soft. `0–255` */
  focusDefault?: number
  /** Rango de foco permitido. `0–255` */
  focusRange?: MinMax
  /** Iris por defecto, si el fixture lo tiene. `0–255` (RAW) */
  irisDefault?: number
}

/** THE INSTINCT — espejo de `MovementBehavior` del preset. */
export interface BehaviorOverride {
  /** Volver a home en silencio (capa del preset de física). */
  homeOnSilence?: boolean
  /** Sincronizar con beat en lugar de reaccionar a energía. */
  syncToBeat?: boolean
  /** Permitir posiciones aleatorias / deriva orgánica. */
  allowRandomPos?: boolean
  /** Suavizado extra. `0`=seco, `1`=ultra suave. `0.0–1.0` */
  smoothFactor?: number
}

/** THE FAN ARRAY — targeting espacial del motor IK. */
export interface SpatialOverride {
  /** Modo de dispersión geométrica del grupo. */
  fanMode?: SpatialFanMode
  /** Amplitud total del spread, en metros (punta a punta). `0–10` */
  fanAmplitude?: number
}

/** Defaults globales de la IA para este vibe. */
export interface GrandMasterOverride {
  /** Multiplicador global de velocidad del motor generativo. `0.1–2.0` */
  globalSpeedMultiplier?: number
  /** Amplitud del caos global por nodo. `0.0–1.0` */
  globalChaosAmount?: number
}

/** Capa de mutación completa del VMM + presets de movimiento. */
export interface MovementOverride {
  /** THE ORBIT VAULT + THE REACH — 5 parámetros. */
  kinematics?: KinematicsOverride
  /** THE SCHEDULER DECK — 6 genes por patrón, hasta 22 patrones. */
  scheduler?: Partial<Record<GoldenPatternId, PatternSchedulerOverride>>
  /** THE ENSEMBLE — 2 parámetros. */
  stereo?: StereoOverride
  /**
   * Audience bias del tilt.
   *
   * ⚠️ Sólo tiene efecto en montaje `floor`. Para `ceiling`/`truss-*` el VMM
   * usa la constante SELLADA `TILT_OFFSET_CEILING` (-0.325) y para `totem` un
   * literal sellado (-0.45). `-0.50–0.0`
   */
  tiltOffset?: number
  /** THE GEARBOX — 8 parámetros. */
  physics?: MovementPhysicsOverride
  /** THE LENS — 5 parámetros. */
  optics?: OpticsOverride
  /** THE INSTINCT — 4 parámetros. */
  behavior?: BehaviorOverride
  /** THE FAN ARRAY — 2 parámetros. */
  spatial?: SpatialOverride
  /** GrandMaster — 2 parámetros. */
  grandMaster?: GrandMasterOverride
}

// ═══════════════════════════════════════════════════════════════════════════
// SALIDA DEL RESOLVER — FUSED BUNDLE Y DIAGNÓSTICOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Config del VMM injertable en `VIBE_CONFIG`.
 *
 * El VMM declara su `VibeConfig` como `interface` NO exportada
 * (`VibeMovementManager.ts:84`), por lo que este tipo es su espejo estructural.
 * Debe permanecer sincronizado.
 */
export interface GraftableVibeConfig {
  panScale: number
  tiltScale: number
  baseFrequency: number
  patterns: GoldenPatternId[]
  homeOnSilence: boolean
}

/**
 * Config estéreo injertable en `STEREO_CONFIG`.
 * Espejo de la `interface StereoConfig` no exportada (`VibeMovementManager.ts:361`).
 */
export interface GraftableStereoConfig {
  offset: number
  type: StereoType
}

/**
 * Config de scheduler injertable en `PATTERN_CONFIG`.
 * Espejo de la `interface PatternConfig` no exportada (`VibeMovementManager.ts:145`).
 */
export interface GraftablePatternConfig {
  cycleBeats: number
  phraseDuration: number
  safeHarborPhase: number
  safeHarborWindow: number
  hardDeadlineExtra: number
  transitionBeats: number
}

/**
 * Resultado del resolver: las configs canónicas ya fusionadas, listas para ser
 * injertadas en los registries de motor por `VibeGraftRegistry.graft()`.
 *
 * Destino de cada campo:
 * | Campo               | Registry destino      |
 * |---------------------|-----------------------|
 * | `vibeProfile`       | `VIBE_REGISTRY`       |
 * | `liquidProfile`     | `PROFILE_REGISTRY`    |
 * | `colorConstitution` | `COLOR_CONSTITUTIONS` |
 * | `vibeConfig`        | `VIBE_CONFIG`         |
 * | `stereoConfig`      | `STEREO_CONFIG`       |
 * | `movementPreset`    | `MOVEMENT_PRESETS`    |
 * | `tiltOffset`        | `TILT_OFFSET_BY_VIBE` |
 */
export interface FusedVibeBundle {
  readonly key: CustomVibeKey
  readonly baseDNA: BaseDNA
  vibeProfile: VibeProfile
  liquidProfile: ILiquidProfile
  colorConstitution: GenerationOptions
  vibeConfig: GraftableVibeConfig
  stereoConfig: GraftableStereoConfig
  movementPreset: MovementPreset
  tiltOffset: number
  /**
   * Overrides de scheduler por patrón, si el documento los definió.
   * `PATTERN_CONFIG` del VMM es global (no por vibe), así que el injerto de
   * estos valores es destructivo y requiere backup/restore. Vacío = no tocar.
   */
  patternConfigs?: Partial<Record<GoldenPatternId, GraftablePatternConfig>>
  /**
   * Override espacial del fan array IK. No tiene registry canónico propio:
   * el graft registry lo aplica al `InverseKinematicsEngine` en Fase 4.
   * Ausente = heredado del ADN base (sin override).
   */
  spatial?: SpatialOverride
  /**
   * Override del GrandMaster (velocidad/caos global). No tiene registry
   * canónico propio: el graft registry lo aplica al `AetherKineticEngine`
   * en Fase 4. Ausente = heredado del ADN base.
   */
  grandMaster?: GrandMasterOverride
}

/** Severidad de un diagnóstico del resolver. */
export type DiagnosticSeverity = 'info' | 'warn' | 'error'

/** Un hallazgo del resolver sobre un gen concreto. */
export interface ResolveDiagnostic {
  severity: DiagnosticSeverity
  /** Ruta dot-notation del gen: `'physics.envelopes.envelopeKick.boost'`. */
  path: string
  /** Mensaje legible para el DiagnosticsRail. */
  message: string
  /** Valor solicitado por el documento. */
  requested?: number | string | boolean
  /** Valor finalmente aplicado tras clamp / snap / corrección de invariante. */
  applied?: number | string | boolean
}

/** Resultado completo de una resolución. */
export interface ResolveResult {
  /** `null` si hubo un error irrecuperable (p.ej. `baseDNA` inválido). */
  bundle: FusedVibeBundle | null
  diagnostics: ResolveDiagnostic[]
  /** `false` si hay al menos un diagnostic de severidad `'error'`. */
  ok: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS DE VALIDACIÓN DE DOCUMENTO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Type guard estructural de un `.luxvibe` recién parseado de disco.
 * Valida forma y esquema; NO valida rangos (eso es del resolver).
 */
export function isCustomVibeOverride(value: unknown): value is CustomVibeOverride {
  if (typeof value !== 'object' || value === null) return false
  const doc = value as Partial<CustomVibeOverride>
  if (doc.kind !== 'luxvibe') return false
  if (doc.schemaVersion !== LUXVIBE_SCHEMA_VERSION) return false
  if (typeof doc.baseDNA !== 'string' || !isBaseDNA(doc.baseDNA)) return false
  if (typeof doc.meta !== 'object' || doc.meta === null) return false
  const meta = doc.meta as Partial<CustomVibeMeta>
  if (typeof meta.key !== 'string' || !isCustomVibeKey(meta.key)) return false
  if (typeof meta.name !== 'string') return false
  return true
}

/** Crea un documento vacío (sin mutaciones) para un ADN dado. */
export function createEmptyCustomVibe(
  key: CustomVibeKey,
  baseDNA: BaseDNA,
  name: string,
  author = '',
): CustomVibeOverride {
  const now = Date.now()
  return {
    schemaVersion: LUXVIBE_SCHEMA_VERSION,
    kind: 'luxvibe',
    baseDNA,
    meta: {
      key,
      name,
      description: '',
      icon: 'Dna',
      author,
      createdAt: now,
      updatedAt: now,
      tags: [],
      accentHex: '#00e5ff',
    },
  }
}
