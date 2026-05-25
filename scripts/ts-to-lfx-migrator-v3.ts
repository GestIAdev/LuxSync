#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
// ⚒️  WAVE 4848 — SPRINT 2: ts-to-lfx-migrator-v3.ts
//     EL ESCRIBA DEL FORJADOR — migrador canónico de efectos TypeScript
//     hacia archivos .lfx versión 3.0 (HephAutomationClipV3 / LFXFileV3).
// ════════════════════════════════════════════════════════════════════════════
//
//  FILOSOFÍA:
//    Sin mocks. Sin Math.random(). Sin heurísticas frágiles.
//    El migrador lee los DEFAULT_CONFIG de cada efecto legacy, y a partir
//    de sus constantes (duraciones, intensidades, colores, frecuencias de
//    strobe) construye curvas Bézier deterministas.
//
//    Para cada efecto legacy se genera un HephAutomationClipV3 con:
//      - tracks: HephTrack[]  (multicelular — uno por eje semántico)
//      - schemaVersion: '3.0'
//    Envuelto en LFXFileV3 con SHA-256 verificable.
//
//  ARQUITECTURA:
//    1. Registry de efectos legacy (manifest interno).
//    2. normalizeZone() — normalizador espacial blindado.
//    3. buildIntensityTrack()  — track de dimmer a partir de fases.
//    4. buildColorTrack()      — track de color a partir de colorCycle/config.
//    5. buildStrobeRateTrack() — track de strobeRate cuando el efecto es estroboscópico.
//    6. buildClipV3()          — ensamblador final con CognitiveDNA opcionalmente inferido.
//    7. emitLFXFile()          — serialización JSON + SHA-256.
//    8. main()                 — orchestra todo y escribe al disco.
//
//  USO:
//    npx tsx scripts/ts-to-lfx-migrator-v3.ts [--out ./builtin-effects]
//    npx tsx scripts/ts-to-lfx-migrator-v3.ts --dry-run
//
//  REQUISITOS PREVIOS:
//    npm i -D tsx  (o ts-node)   → ya presente en devDependencies
//    El script debe ejecutarse desde la raíz del workspace (LuxSync/).
//
// ════════════════════════════════════════════════════════════════════════════

import * as fs   from 'node:fs/promises'
import * as path from 'node:path'
import { createHash } from 'node:crypto'

// ─── TIPOS INLINADOS (sin depender de imports de src/ para que el script
//     sea ejecutable fuera del build de vite) ───────────────────────────────

type EffectCategory = 'physical' | 'color' | 'movement' | 'optics' | 'composite'

type CanonicalZone =
  | 'front' | 'back' | 'floor'
  | 'movers-left' | 'movers-right'
  | 'center' | 'air' | 'ambient' | 'unassigned'

type ZoneTarget = CanonicalZone | 'all' | 'all-pars' | 'all-movers'

type BlendMode = 'max' | 'replace' | 'add' | 'multiply'

type HephParamId =
  | 'intensity' | 'color' | 'white' | 'amber' | 'speed'
  | 'pan' | 'tilt' | 'zoom' | 'focus' | 'iris'
  | 'gobo1' | 'gobo2' | 'prism' | 'strobe' | 'strobeRate'
  | 'globalComp' | 'width' | 'direction'

type HephInterpolation = 'hold' | 'linear' | 'bezier'
type HephCurveMode     = 'absolute' | 'relative' | 'additive'

interface HSL { h: number; s: number; l: number }

interface HephKeyframe {
  timeMs:         number
  value:          number | HSL
  interpolation:  HephInterpolation
  bezierHandles?: [number, number, number, number]
}

interface HephCurve {
  paramId:      HephParamId
  valueType:    'number' | 'color'
  range:        [number, number]
  defaultValue: number | HSL
  keyframes:    HephKeyframe[]
  mode:         HephCurveMode
}

// ─── TIPOS DE SALIDA: LFX v2.1 (hephaestus/v2.1) ───────────────────────────
// Formato que espera LfxFileLoader + isSeleneEligible() + todos los gates.

interface LfxClipV21 {
  id:            string
  name:          string
  author:        string
  category:      EffectCategory
  tags:          string[]
  vibeCompat:    string[]
  zones:         string[]        // energy zones (EnergyZone[]) para Selene routing
  mixBus:        'global' | 'htp' | 'ambient' | 'accent'
  priority:      number
  durationMs:    number
  effectType:    'heph_custom'   // OBLIGATORIO para isSeleneEligible()
  curves:        Record<string, HephCurve>  // Record keyed by paramId
  staticParams:  Record<string, number | string | boolean>
  cognitiveDNA: {
    genome:          { aggression: number; chaos: number; organicity: number }
    textureAffinity: 'clean' | 'dirty' | 'universal'
    compatibleVibes: string[]
    validSections:   string[]
    energyZone:      { min: string; max: string }
    aggressionRange: { min: number; max: number }
    spatialBehavior: 'static' | 'relative_offset'
  }
  simulationMeta: {
    beautyWeights:     { base: number; energyMultiplier: number; vibeBonus: number }
    gpuCost:           number
    fatigueImpact:     number
    minDurationMs:     number
    cooldownMs:        number
    isStrobe:          boolean
    isDivineCandidate: boolean
    isHeavyCandidate:  boolean
    zScoreGuards: {
      requireRising:  boolean
      minimumZ:       number | null
      minimumEnergy:  number | null
    }
  }
  executionHints: {
    overlayMode:      'absolute' | 'relative' | 'additive'
    phaseConfig:      { spread: number; symmetry: string; wings: number; direction: number }
    intensityScaling: 'proportional' | 'fixed' | 'energyDriven'
    fixtureTargeting: string
  }
  safetyDeclaration: {
    maxStrobeFreqHz:    number
    containsRapidFlash: boolean
    communityTrusted:   boolean
  }
}

interface LfxClipV2File {
  readonly $schema:  'hephaestus/v2.1'
  readonly version:  string
  readonly clip:     LfxClipV21
  readonly checksum: string
}

// ════════════════════════════════════════════════════════════════════════════
// §1 — NORMALIZADOR ESPACIAL BLINDADO
// ════════════════════════════════════════════════════════════════════════════

/**
 * Conjunto canónico de ZoneTarget aceptados.
 * Cualquier string que no esté aquí es inválido.
 */
const VALID_ZONE_TARGETS: ReadonlySet<ZoneTarget> = new Set<ZoneTarget>([
  'front', 'back', 'floor',
  'movers-left', 'movers-right',
  'center', 'air', 'ambient', 'unassigned',
  'all', 'all-pars', 'all-movers',
])

/**
 * Mapa de alias a zona canónica.
 * Fuente de verdad: ShowFileV2.ts normalizeZone + análisis FXTParser.ts.
 */
const ZONE_ALIAS_MAP: Readonly<Record<string, ZoneTarget>> = Object.freeze({
  // Aliases de strobe / flash
  'flash':          'center',
  'strobes':        'center',
  'strobe':         'center',
  'blind':          'center',
  'blinder':        'center',
  'blinds':         'center',

  // Aliases de ambient / house
  'house':          'ambient',
  'audience':       'ambient',
  'wash':           'ambient',
  'ceiling':        'center',
  'ceiling-center': 'center',

  // Aliases de movers
  'movers':         'all-movers',
  'moving-heads':   'all-movers',
  'mover-left':     'movers-left',
  'mover-right':    'movers-right',

  // Aliases legacy de front/back
  'stage-front':    'front',
  'stage-back':     'back',
  'stage-center':   'center',
  'stage-floor':    'floor',
  'frontL':         'front',
  'frontR':         'front',
  'backL':          'back',
  'backR':          'back',
  'floorL':         'floor',
  'floorR':         'floor',
  'front-left':     'front',
  'front-right':    'front',
  'front-center':   'front',
  'back-left':      'back',
  'back-right':     'back',
  'all-left':       'all',
  'all-right':      'all',
})

/**
 * Normaliza cualquier string de zona al tipo estricto ZoneTarget.
 *
 * - Si ya es canónico → pasa directamente.
 * - Si tiene alias → se mapea.
 * - Si es irreconocible → 'unassigned' + warning en stderr.
 *
 * NUNCA escrupe un string que no sea ZoneTarget.
 */
function normalizeZone(rawZone: string): ZoneTarget {
  const lower = rawZone.toLowerCase().trim()

  // 1. ¿Ya es zona canónica?
  if (VALID_ZONE_TARGETS.has(lower as ZoneTarget)) {
    return lower as ZoneTarget
  }

  // 2. ¿Hay alias?
  const alias = ZONE_ALIAS_MAP[lower]
  if (alias !== undefined) return alias

  // 3. Fuzzy: ¿contiene alguna zona canónica como substring?
  for (const canonical of ['front', 'back', 'floor', 'center', 'air', 'ambient',
                            'movers-left', 'movers-right']) {
    if (lower.includes(canonical)) {
      process.stderr.write(
        `[migrator ⚠️] Zona desconocida "${rawZone}" → fuzzy-match a "${canonical}"\n`
      )
      return canonical as ZoneTarget
    }
  }

  // 4. Fallback + warning
  process.stderr.write(
    `[migrator ⚠️] Zona NO reconocida "${rawZone}" → fallback 'unassigned'\n`
  )
  return 'unassigned'
}

/**
 * Normaliza un array de zonas raw, deduplicando resultado.
 */
function normalizeZones(rawZones: readonly string[]): ZoneTarget[] {
  const seen = new Set<ZoneTarget>()
  for (const z of rawZones) {
    seen.add(normalizeZone(z))
  }
  return Array.from(seen)
}

// ════════════════════════════════════════════════════════════════════════════
// §2 — CONSTRUCTORES DE CURVAS
// ════════════════════════════════════════════════════════════════════════════

/** Genera un ID de track legible y estable (no UUID — el migrator es determinista). */
function trackId(effectId: string, paramId: string, suffix = ''): string {
  const base = `${effectId}-${paramId}${suffix ? `-${suffix}` : ''}`
  return base.replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
}

// ─── §2.1 Intensity Track ───────────────────────────────────────────────────

export interface IntensityModel {
  /** Duración total (ms) */
  durationMs: number
  /** Intensidad mínima inicial / final (0–1) */
  floorIntensity: number
  /** Intensidad en el pico (0–1) */
  peakIntensity: number
  /** Duración del fade-in (ms) */
  fadeInMs: number
  /** Duración del pitch/sustain en el pico (ms) */
  sustainMs: number
  /** Duración del fade-out (ms). Si 0 → el clip termina abruptamente. */
  fadeOutMs: number
  /** Pre-blackout antes del pico (ms). 0 = ninguno. */
  preBlackoutMs: number
  /** ¿Usar ease-in-out Bézier en lugar de linear? */
  useEase: boolean
}

/**
 * Construye un HephCurve de intensidad a partir de un modelo de fases.
 *
 * Curva resultante: floor → [blackout?] → peak → sostén → floor
 * Todo determinista: basado en los tiempos del DEFAULT_CONFIG del efecto.
 */
function buildIntensityCurve(model: IntensityModel): HephCurve {
  const {
    durationMs, floorIntensity, peakIntensity,
    fadeInMs, sustainMs, fadeOutMs, preBlackoutMs, useEase,
  } = model

  const ease: [number, number, number, number] = useEase
    ? [0.42, 0, 0.58, 1]
    : [0, 0, 1, 1]

  const interp: HephInterpolation = useEase ? 'bezier' : 'linear'

  const kf: HephKeyframe[] = []

  // t=0: floor
  kf.push({ timeMs: 0, value: floorIntensity, interpolation: 'linear' })

  let cursor = 0

  // Pre-blackout
  if (preBlackoutMs > 0) {
    cursor += Math.min(preBlackoutMs, durationMs * 0.05)
    kf.push({ timeMs: cursor, value: 0, interpolation: 'hold' })
  }

  // Fade-in → pico
  const riseEnd = Math.min(cursor + fadeInMs, durationMs)
  kf.push({ timeMs: riseEnd, value: peakIntensity, interpolation: interp, bezierHandles: ease })
  cursor = riseEnd

  // Sustain (sustain opcional — si hay margen)
  if (sustainMs > 0) {
    const sustainEnd = Math.min(cursor + sustainMs, durationMs - fadeOutMs)
    if (sustainEnd > cursor) {
      kf.push({ timeMs: sustainEnd, value: peakIntensity, interpolation: 'hold' })
      cursor = sustainEnd
    }
  }

  // Fade-out → floor
  if (fadeOutMs > 0 && cursor < durationMs) {
    kf.push({
      timeMs: durationMs,
      value: floorIntensity,
      interpolation: interp,
      bezierHandles: ease,
    })
  }

  return {
    paramId:      'intensity',
    valueType:    'number',
    range:        [0, 1],
    defaultValue: floorIntensity,
    keyframes:    kf,
    mode:         'absolute',
  }
}

// ─── §2.2 Color Track ────────────────────────────────────────────────────────

/**
 * Construye un HephCurve de color a partir de un colorCycle (array de HSL).
 *
 * Distribuye los keyframes uniformemente a lo largo de la duración.
 * Interpolación: 'linear' (shortest-path en hue — el runtime interpola en HSL).
 */
function buildColorCurve(
  colorCycle: ReadonlyArray<{ h: number; s: number; l: number }>,
  durationMs: number,
  staticOverride?: { h: number; s: number; l: number }
): HephCurve {
  // Si hay un color estático dominante, generamos curva de 1 keyframe constante
  if (staticOverride !== undefined || colorCycle.length === 1) {
    const color = staticOverride ?? colorCycle[0]
    return {
      paramId:      'color',
      valueType:    'color',
      range:        [0, 360],
      defaultValue: { ...color },
      keyframes: [
        { timeMs: 0, value: { ...color }, interpolation: 'hold' },
      ],
      mode: 'absolute',
    }
  }

  const step = durationMs / (colorCycle.length - 1)
  const keyframes: HephKeyframe[] = colorCycle.map((color, i) => ({
    timeMs:        Math.round(i * step),
    value:         { h: color.h, s: color.s, l: color.l },
    interpolation: (i < colorCycle.length - 1 ? 'linear' : 'hold') as HephInterpolation,
  }))

  return {
    paramId:      'color',
    valueType:    'color',
    range:        [0, 360],
    defaultValue: { ...colorCycle[0] },
    keyframes,
    mode: 'absolute',
  }
}

// ─── §2.3 StrobeRate Track ───────────────────────────────────────────────────

/**
 * Construye un HephCurve de strobeRate para efectos que usan dimmer-pulsing
 * o strobe hardware.
 *
 * Normalizado: 1.0 = frecuencia máxima permitida (por defecto 15Hz).
 * El adapter abre el shutter automáticamente.
 */
function buildStrobeRateCurve(model: {
  durationMs: number
  frequencyHz: number
  maxFrequencyHz: number
  /** Tiempo hasta que empieza el strobe (ms) — pre-blackout / fase Attack */
  delayMs: number
  /** Tiempo hasta que termina el strobe (ms). 0 = hasta el final. */
  endMs: number
}): HephCurve {
  const { durationMs, frequencyHz, maxFrequencyHz, delayMs, endMs } = model
  const normalizedLevel = Math.min(1, frequencyHz / maxFrequencyHz)
  const actualEnd = endMs > 0 ? Math.min(endMs, durationMs) : durationMs

  return {
    paramId:      'strobeRate',
    valueType:    'number',
    range:        [0, 1],
    defaultValue: 0,
    keyframes: [
      // Apagado antes del inicio
      { timeMs: 0,         value: 0,              interpolation: 'hold' },
      // Encendido al inicio del burst
      { timeMs: delayMs,   value: normalizedLevel, interpolation: 'hold' },
      // Apagado al final del burst
      { timeMs: actualEnd, value: 0,               interpolation: 'hold' },
    ],
    mode: 'absolute',
  }
}

// ════════════════════════════════════════════════════════════════════════════
// §3 — REGISTRY DE EFECTOS LEGACY
// ════════════════════════════════════════════════════════════════════════════

/**
 * Descriptor completo de un efecto legacy para el migrador.
 *
 * En lugar de parsear AST (frágil), codificamos directamente los valores
 * numéricos extraídos de cada DEFAULT_CONFIG. El migrador es la FUENTE DE
 * VERDAD escrita una vez; no ejecuta código del efecto en runtime.
 */
interface LegacyEffectDescriptor {
  /** ID canónico del efecto (effectType en la clase TS) */
  id: string
  /** Nombre legible */
  name: string
  /** Categoría */
  category: EffectCategory
  /** mixBus */
  mixBus: 'global' | 'htp' | 'ambient' | 'accent'
  /** priority 0–100 */
  priority: number
  /** Duración total en ms */
  durationMs: number
  /** Tags semánticos para Selene */
  tags: string[]
  /** Vibes compatibles */
  vibeCompat: string[]
  /** Zonas raw (se normalizan) */
  rawZones: string[]

  // ── Modelo de intensidad ──────────────────────────────────────────
  intensity: {
    floor: number
    peak: number
    fadeInMs: number
    sustainMs: number
    fadeOutMs: number
    preBlackoutMs: number
    useEase: boolean
  }

  // ── Modelo de color ───────────────────────────────────────────────
  color: {
    /** Ciclo de colores (de colorCycle o derivado del config) */
    cycle: Array<{ h: number; s: number; l: number }>
    /** Zonas que reciben color (si difiere de rawZones) */
    rawZones?: string[]
  } | null

  // ── Modelo de strobe ──────────────────────────────────────────────
  strobe: {
    frequencyHz: number
    maxFrequencyHz: number
    delayMs: number
    endMs: number
    /** Zonas que reciben el track de strobe */
    rawZones: string[]
  } | null

  // ── Parámetros estáticos ──────────────────────────────────────────
  staticParams?: Record<string, number | string | boolean>
}

// ─── CATÁLOGO: FIESTA LATINA ─────────────────────────────────────────────────

const FIESTA_LATINA_EFFECTS: LegacyEffectDescriptor[] = [
  // ─────────────────────────────────────────────────────────────────
  // GHOST BREATH — ZONA 1 SILENCE
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'ghost_breath', name: 'Ghost Breath',
    category: 'physical', mixBus: 'ambient',
    priority: 10, durationMs: 3000,
    tags: ['ambient', 'soft', 'silence', 'fiesta-latina'],
    vibeCompat: ['chill', 'latin', 'ambient'],
    rawZones: ['front'],
    intensity: { floor: 0, peak: 0.15, fadeInMs: 1200, sustainMs: 600, fadeOutMs: 1200, preBlackoutMs: 0, useEase: true },
    color: { cycle: [{ h: 200, s: 30, l: 40 }] },
    strobe: null,
  },

  // ─────────────────────────────────────────────────────────────────
  // AMAZON MIST — ZONA 1 SILENCE
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'amazon_mist', name: 'Amazon Mist',
    category: 'physical', mixBus: 'ambient',
    priority: 12, durationMs: 4000,
    tags: ['ambient', 'mist', 'silence', 'fiesta-latina'],
    vibeCompat: ['latin', 'ambient'],
    rawZones: ['floor', 'back'],
    intensity: { floor: 0.05, peak: 0.25, fadeInMs: 1500, sustainMs: 1000, fadeOutMs: 1500, preBlackoutMs: 0, useEase: true },
    color: { cycle: [{ h: 160, s: 60, l: 35 }, { h: 180, s: 50, l: 40 }] },
    strobe: null,
  },

  // ─────────────────────────────────────────────────────────────────
  // CUMBIA MOON — ZONA 2 VALLEY
  // Duración BPM-sync: cycleDurationMs=5000, beatsPerCycle=5
  // Color WAVE 785: plata lunar { h:210, s:10, l:60 } → 70 → 55
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'cumbia_moon', name: 'Cumbia Moon',
    category: 'physical', mixBus: 'global',
    priority: 65, durationMs: 5000,
    tags: ['ambient', 'soft', 'valley', 'fiesta-latina', 'bpm-sync'],
    vibeCompat: ['latin', 'ambient', 'chill'],
    rawZones: ['front', 'back', 'all-movers'],
    intensity: { floor: 0.15, peak: 0.30, fadeInMs: 2000, sustainMs: 400, fadeOutMs: 2600, preBlackoutMs: 0, useEase: true },
    color: {
      cycle: [
        { h: 210, s: 10, l: 60 },
        { h: 210, s: 10, l: 70 },
        { h: 210, s: 10, l: 55 },
      ],
      rawZones: ['front', 'back', 'all-movers'],
    },
    strobe: null,
    staticParams: { beatsPerCycle: 5 },
  },

  // ─────────────────────────────────────────────────────────────────
  // TIDAL WAVE — ZONA 2 VALLEY
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'tidal_wave', name: 'Tidal Wave',
    category: 'composite', mixBus: 'global',
    priority: 55, durationMs: 6000,
    tags: ['sweep', 'wave', 'valley', 'fiesta-latina'],
    vibeCompat: ['latin', 'ambient'],
    rawZones: ['front', 'back', 'floor', 'all-movers'],
    intensity: { floor: 0, peak: 0.50, fadeInMs: 2000, sustainMs: 800, fadeOutMs: 3200, preBlackoutMs: 0, useEase: true },
    color: { cycle: [{ h: 200, s: 80, l: 45 }, { h: 220, s: 90, l: 50 }, { h: 200, s: 75, l: 40 }] },
    strobe: null,
  },

  // ─────────────────────────────────────────────────────────────────
  // CORAZON LATINO — ZONA 3 AMBIENT
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'corazon_latino', name: 'Corazón Latino',
    category: 'physical', mixBus: 'htp',
    priority: 45, durationMs: 3500,
    tags: ['heart', 'ambient', 'fiesta-latina'],
    vibeCompat: ['latin', 'romantic'],
    rawZones: ['front', 'back', 'all-movers'],
    intensity: { floor: 0.20, peak: 0.65, fadeInMs: 500, sustainMs: 1200, fadeOutMs: 1800, preBlackoutMs: 0, useEase: true },
    color: { cycle: [{ h: 355, s: 90, l: 50 }, { h: 10, s: 85, l: 55 }] },
    strobe: null,
  },

  // ─────────────────────────────────────────────────────────────────
  // STROBE BURST — ZONA 3 AMBIENT
  // WAVE 3471: 6 flashes × 33ms ON / 33ms OFF → software strobe 15Hz
  // Total burst: 6 × 66ms = 396ms
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'strobe_burst', name: 'Strobe Burst',
    category: 'physical', mixBus: 'global',
    priority: 85, durationMs: 396,
    tags: ['strobe', 'flash', 'ambient', 'fiesta-latina'],
    vibeCompat: ['latin', 'techno', 'electronic'],
    rawZones: ['front', 'back', 'center'],
    intensity: { floor: 0, peak: 1.0, fadeInMs: 1, sustainMs: 33, fadeOutMs: 1, preBlackoutMs: 0, useEase: false },
    color: null,   // pass-through por defecto (vibe decide el color)
    strobe: {
      frequencyHz:    15,
      maxFrequencyHz: 15,
      delayMs:        0,
      endMs:          396,
      rawZones:       ['front', 'back', 'center'],
    },
    staticParams: { flashCount: 6, flashDurationMs: 33, gapDurationMs: 33 },
  },

  // ─────────────────────────────────────────────────────────────────
  // CLAVE RHYTHM — ZONA 4 GENTLE
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'clave_rhythm', name: 'Clave Rhythm',
    category: 'physical', mixBus: 'htp',
    priority: 50, durationMs: 2000,
    tags: ['rhythm', 'clave', 'gentle', 'fiesta-latina', 'bpm-sync'],
    vibeCompat: ['latin', 'salsa', 'cumbia'],
    rawZones: ['front', 'back'],
    intensity: { floor: 0, peak: 0.70, fadeInMs: 80, sustainMs: 280, fadeOutMs: 600, preBlackoutMs: 0, useEase: false },
    color: { cycle: [{ h: 45, s: 95, l: 55 }] },
    strobe: null,
  },

  // ─────────────────────────────────────────────────────────────────
  // TROPICAL PULSE — ZONA 4 GENTLE
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'tropical_pulse', name: 'Tropical Pulse',
    category: 'color', mixBus: 'htp',
    priority: 48, durationMs: 3000,
    tags: ['pulse', 'tropical', 'gentle', 'fiesta-latina'],
    vibeCompat: ['latin', 'tropical'],
    rawZones: ['front', 'back', 'all-movers'],
    intensity: { floor: 0.30, peak: 0.80, fadeInMs: 400, sustainMs: 600, fadeOutMs: 2000, preBlackoutMs: 0, useEase: true },
    color: {
      cycle: [
        { h: 30, s: 100, l: 50 },
        { h: 55, s: 100, l: 55 },
        { h: 120, s: 90, l: 45 },
      ],
    },
    strobe: null,
  },

  // ─────────────────────────────────────────────────────────────────
  // GLITCH GUAGUANCÓ — ZONA 5 ACTIVE
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'glitch_guaguanco', name: 'Glitch Guaguancó',
    category: 'composite', mixBus: 'global',
    priority: 72, durationMs: 1500,
    tags: ['glitch', 'guaguanco', 'active', 'fiesta-latina'],
    vibeCompat: ['latin', 'electronic', 'techno'],
    rawZones: ['front', 'back', 'center', 'all-movers'],
    intensity: { floor: 0, peak: 0.90, fadeInMs: 50, sustainMs: 200, fadeOutMs: 1250, preBlackoutMs: 30, useEase: false },
    color: { cycle: [{ h: 270, s: 100, l: 50 }, { h: 60, s: 100, l: 50 }] },
    strobe: null,
  },

  // ─────────────────────────────────────────────────────────────────
  // MACHETE SPARK — ZONA 5 ACTIVE
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'machete_spark', name: 'Machete Spark',
    category: 'physical', mixBus: 'global',
    priority: 68, durationMs: 1200,
    tags: ['spark', 'machete', 'active', 'fiesta-latina'],
    vibeCompat: ['latin', 'salsa'],
    rawZones: ['front', 'center'],
    intensity: { floor: 0, peak: 1.0, fadeInMs: 30, sustainMs: 100, fadeOutMs: 1070, preBlackoutMs: 0, useEase: false },
    color: { cycle: [{ h: 50, s: 100, l: 80 }, { h: 40, s: 100, l: 65 }] },
    strobe: null,
  },

  // ─────────────────────────────────────────────────────────────────
  // SALSA FIRE — ZONA 6 INTENSE
  // flickerFrequency: 15Hz → strobe implícito por dimmer
  // Intensidad: minIntensity=0.35, base=0.55 aprox, variation=0.45
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'salsa_fire', name: 'Salsa Fire',
    category: 'physical', mixBus: 'global',
    priority: 80, durationMs: 2000,
    tags: ['fire', 'salsa', 'intense', 'fiesta-latina'],
    vibeCompat: ['latin', 'salsa'],
    rawZones: ['front', 'back'],
    intensity: { floor: 0.35, peak: 0.80, fadeInMs: 150, sustainMs: 1500, fadeOutMs: 350, preBlackoutMs: 50, useEase: false },
    color: {
      cycle: [
        { h: 5,  s: 100, l: 50 },   // rojo profundo (baseColor)
        { h: 20, s: 100, l: 55 },   // naranja
        { h: 55, s: 100, l: 75 },   // amarillo (hotColor)
        { h: 10, s: 100, l: 50 },   // rojo: vuelta
      ],
    },
    strobe: {
      frequencyHz:    15,
      maxFrequencyHz: 15,
      delayMs:        150,
      endMs:          1650,
      rawZones:       ['front', 'back'],
    },
    staticParams: { flickerFrequency: 15, preBlackoutMs: 50 },
  },

  // ─────────────────────────────────────────────────────────────────
  // SOLAR FLARE — ZONA 6 INTENSE
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'solar_flare', name: 'Solar Flare',
    category: 'physical', mixBus: 'global',
    priority: 90, durationMs: 1500,
    tags: ['flare', 'solar', 'intense', 'fiesta-latina'],
    vibeCompat: ['latin', 'electronic'],
    rawZones: ['front', 'back', 'center', 'all-movers'],
    intensity: { floor: 0, peak: 1.0, fadeInMs: 80, sustainMs: 300, fadeOutMs: 1120, preBlackoutMs: 0, useEase: false },
    color: { cycle: [{ h: 45, s: 100, l: 75 }, { h: 30, s: 100, l: 60 }] },
    strobe: null,
  },

  // ─────────────────────────────────────────────────────────────────
  // LATINA MELTDOWN — ZONA 7 PEAK
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'latina_meltdown', name: 'Latina Meltdown',
    category: 'physical', mixBus: 'global',
    priority: 95, durationMs: 3000,
    tags: ['meltdown', 'peak', 'fiesta-latina'],
    vibeCompat: ['latin'],
    rawZones: ['all'],
    intensity: { floor: 0, peak: 1.0, fadeInMs: 60, sustainMs: 800, fadeOutMs: 2140, preBlackoutMs: 60, useEase: false },
    color: {
      cycle: [
        { h: 0, s: 100, l: 60 },
        { h: 60, s: 100, l: 60 },
        { h: 0, s: 100, l: 55 },
      ],
    },
    strobe: null,
  },

  // ─────────────────────────────────────────────────────────────────
  // STROBE STORM — ZONA 7 PEAK
  // WAVE 3300: 7 volleys, preBlackoutMs=60, burstMs=800, decayMs=150.
  // Software strobe a 15Hz puro por dimmer.
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'strobe_storm', name: 'Strobe Storm',
    category: 'physical', mixBus: 'global',
    priority: 90, durationMs: 1010,  // 60 + 800 + 150
    tags: ['strobe', 'storm', 'peak', 'fiesta-latina'],
    vibeCompat: ['latin', 'techno', 'electronic'],
    rawZones: ['front', 'back', 'all-movers'],
    intensity: { floor: 0, peak: 1.0, fadeInMs: 1, sustainMs: 800, fadeOutMs: 150, preBlackoutMs: 60, useEase: false },
    color: null,  // movers: pass-through color
    strobe: {
      frequencyHz:    15,
      maxFrequencyHz: 15,
      delayMs:        60,   // preBlackoutMs
      endMs:          860,  // 60 + 800
      rawZones:       ['front', 'back'],
    },
    staticParams: { preBlackoutMs: 60, burstMs: 800, decayMs: 150 },
  },

  // ─────────────────────────────────────────────────────────────────
  // ORO SÓLIDO — EL TROMPETAZO (WAVE 2189)
  // latchMs=600, decayMs=1400, totalMs=2000
  // Color: Oro Puro → Ámbar (convertidos de RGB a HSL)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'oro_solido', name: 'Oro Sólido',
    category: 'physical', mixBus: 'global',
    priority: 98, durationMs: 2000,
    tags: ['oro', 'trompetazo', 'peak', 'fiesta-latina'],
    vibeCompat: ['latin'],
    rawZones: ['front', 'back', 'all-movers'],
    intensity: { floor: 0, peak: 1.0, fadeInMs: 1, sustainMs: 600, fadeOutMs: 1400, preBlackoutMs: 0, useEase: false },
    color: {
      cycle: [
        // colorPeak HSL approx: r=255 g=200 b=40 → H≈46 S=100 L=58
        { h: 46, s: 100, l: 58 },
        // colorDecay HSL approx: r=255 g=120 b=0 → H≈28 S=100 L=50
        { h: 28, s: 100, l: 50 },
      ],
    },
    strobe: null,
    staticParams: { latchMs: 600, decayMs: 1400 },
  },
]

// ─── CATÁLOGO: POP-ROCK ────────────────────────────────────────────────────

const POPROCK_EFFECTS: LegacyEffectDescriptor[] = [
  // THUNDER STRUCK — flashDurationMs=800×2, warmWhite+amber
  {
    id: 'thunder_struck', name: 'Thunder Struck',
    category: 'physical', mixBus: 'global',
    priority: 95, durationMs: 2000,
    tags: ['flash', 'blinder', 'rock', 'poprock'],
    vibeCompat: ['rock', 'pop-rock', 'metal'],
    rawZones: ['front', 'back', 'all-movers'],
    intensity: { floor: 0, peak: 1.0, fadeInMs: 20, sustainMs: 800, fadeOutMs: 1180, preBlackoutMs: 0, useEase: false },
    color: {
      cycle: [
        { h: 40, s: 15, l: 95 },  // warmWhiteColor
        { h: 35, s: 85, l: 55 },  // amberColor
      ],
    },
    strobe: null,
    staticParams: { flashCount: 2, beatsPerFlash: 1 },
  },

  // LIQUID SOLO — sweep horizontal, spotlight elegante
  {
    id: 'liquid_solo', name: 'Liquid Solo',
    category: 'movement', mixBus: 'htp',
    priority: 60, durationMs: 3500,
    tags: ['sweep', 'spotlight', 'solo', 'poprock'],
    vibeCompat: ['rock', 'pop-rock'],
    rawZones: ['all-movers', 'front'],
    intensity: { floor: 0.10, peak: 0.75, fadeInMs: 400, sustainMs: 2200, fadeOutMs: 900, preBlackoutMs: 0, useEase: true },
    color: { cycle: [{ h: 40, s: 20, l: 90 }] },  // cool white
    strobe: null,
  },

  // AMP HEAT — atmósfera íntima, drift lento
  {
    id: 'amp_heat', name: 'Amp Heat',
    category: 'color', mixBus: 'ambient',
    priority: 30, durationMs: 8000,
    tags: ['heat', 'warm', 'ambient', 'poprock'],
    vibeCompat: ['rock', 'pop-rock', 'blues'],
    rawZones: ['front', 'back', 'floor'],
    intensity: { floor: 0.25, peak: 0.55, fadeInMs: 2000, sustainMs: 4000, fadeOutMs: 2000, preBlackoutMs: 0, useEase: true },
    color: { cycle: [{ h: 25, s: 80, l: 50 }, { h: 35, s: 70, l: 55 }] },
    strobe: null,
  },

  // ARENA SWEEP — Queen en Wembley, vShape
  {
    id: 'arena_sweep', name: 'Arena Sweep',
    category: 'composite', mixBus: 'global',
    priority: 75, durationMs: 4000,
    tags: ['sweep', 'arena', 'rock', 'poprock'],
    vibeCompat: ['rock', 'rock-anthem'],
    rawZones: ['all-movers', 'front', 'back'],
    intensity: { floor: 0, peak: 0.90, fadeInMs: 600, sustainMs: 2600, fadeOutMs: 800, preBlackoutMs: 0, useEase: true },
    color: { cycle: [{ h: 0, s: 100, l: 50 }, { h: 240, s: 100, l: 60 }] },
    strobe: null,
  },

  // FEEDBACK STORM — strobe caótico escalado por Harshness
  {
    id: 'feedback_storm', name: 'Feedback Storm',
    category: 'physical', mixBus: 'global',
    priority: 88, durationMs: 2200,
    tags: ['strobe', 'chaos', 'feedback', 'poprock'],
    vibeCompat: ['rock', 'metal', 'industrial'],
    rawZones: ['front', 'back', 'center'],
    intensity: { floor: 0, peak: 1.0, fadeInMs: 100, sustainMs: 1800, fadeOutMs: 300, preBlackoutMs: 0, useEase: false },
    color: { cycle: [{ h: 0, s: 0, l: 100 }] },  // white burst
    strobe: {
      frequencyHz:    12,
      maxFrequencyHz: 15,
      delayMs:        100,
      endMs:          1900,
      rawZones:       ['front', 'back', 'center'],
    },
  },

  // POWER CHORD — flash potente + strobe rítmico
  {
    id: 'power_chord', name: 'Power Chord',
    category: 'physical', mixBus: 'global',
    priority: 92, durationMs: 2000,
    tags: ['flash', 'chord', 'rock', 'poprock'],
    vibeCompat: ['rock', 'pop-rock'],
    rawZones: ['front', 'back', 'center'],
    intensity: { floor: 0, peak: 1.0, fadeInMs: 10, sustainMs: 400, fadeOutMs: 1590, preBlackoutMs: 0, useEase: false },
    color: { cycle: [{ h: 40, s: 80, l: 85 }] },
    strobe: {
      frequencyHz:    8,
      maxFrequencyHz: 15,
      delayMs:        410,
      endMs:          1000,
      rawZones:       ['front', 'back', 'center'],
    },
  },

  // STAGE WASH — lavado amber/warm, todo iluminado
  {
    id: 'stage_wash', name: 'Stage Wash',
    category: 'color', mixBus: 'ambient',
    priority: 25, durationMs: 3500,
    tags: ['wash', 'warm', 'ambient', 'poprock'],
    vibeCompat: ['rock', 'pop-rock', 'blues'],
    rawZones: ['front', 'back', 'floor', 'all-movers'],
    intensity: { floor: 0.40, peak: 0.80, fadeInMs: 800, sustainMs: 1900, fadeOutMs: 800, preBlackoutMs: 0, useEase: true },
    color: { cycle: [{ h: 35, s: 60, l: 60 }] },  // amber/warm
    strobe: null,
  },

  // SPOTLIGHT PULSE — movers respiran en intensidad
  {
    id: 'spotlight_pulse', name: 'Spotlight Pulse',
    category: 'physical', mixBus: 'htp',
    priority: 55, durationMs: 3000,
    tags: ['pulse', 'spotlight', 'poprock'],
    vibeCompat: ['rock', 'pop-rock'],
    rawZones: ['all-movers'],
    intensity: { floor: 0.15, peak: 0.85, fadeInMs: 800, sustainMs: 800, fadeOutMs: 1400, preBlackoutMs: 0, useEase: true },
    color: { cycle: [{ h: 0, s: 0, l: 95 }] },  // blanco
    strobe: null,
  },
]

// ─── CATÁLOGO: TECHNO ────────────────────────────────────────────────────────

const TECHNO_EFFECTS: LegacyEffectDescriptor[] = [
  // ─────────────────────────────────────────────────────────────────
  // INDUSTRIAL STROBE — El Martillo (WAVE 2202)
  // 4 flashes × 40ms, gaps 55/45/55ms, preDuck 80ms
  // Total burst: 80 + 60 + 55 + 40 + 45 + 40 + 55 + 40 = ~415ms
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'industrial_strobe', name: 'Industrial Strobe',
    category: 'physical', mixBus: 'global',
    priority: 95, durationMs: 415,
    tags: ['strobe', 'hammer', 'peak', 'techno'],
    vibeCompat: ['techno', 'industrial', 'metal'],
    rawZones: ['front', 'back', 'center', 'all-movers'],
    intensity: { floor: 0, peak: 1.0, fadeInMs: 1, sustainMs: 60, fadeOutMs: 1, preBlackoutMs: 80, useEase: false },
    color: { cycle: [{ h: 0, s: 0, l: 100 }] },  // blanco puro por defecto
    strobe: {
      frequencyHz:    10,
      maxFrequencyHz: 10,
      delayMs:        80,
      endMs:          415,
      rawZones:       ['front', 'back', 'center'],
    },
    staticParams: { flashCount: 4, preDuckMs: 80, firstFlashDurationMs: 60, flashDurationMs: 40 },
  },

  // ─────────────────────────────────────────────────────────────────
  // ACID SWEEP — La Cuchilla (WAVE 770)
  // 3 sweeps × 2000ms = 6000ms total
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'acid_sweep', name: 'Acid Sweep',
    category: 'color', mixBus: 'htp',
    priority: 75, durationMs: 6000,
    tags: ['sweep', 'acid', 'techno'],
    vibeCompat: ['techno', 'acid'],
    rawZones: ['front', 'all-pars', 'back', 'all-movers'],
    intensity: { floor: 0, peak: 0.85, fadeInMs: 200, sustainMs: 5400, fadeOutMs: 400, preBlackoutMs: 0, useEase: false },
    color: {
      cycle: [
        { h: 180, s: 100, l: 60 },  // cyan brillante
        { h: 120, s: 100, l: 55 },  // verde tóxico (high harshness)
        { h: 0, s: 0, l: 100 },     // blanco (pico sweep)
      ],
    },
    strobe: null,
    staticParams: { sweepCount: 3, beatsPerSweep: 3, bladeWidth: 0.45 },
  },

  // ─────────────────────────────────────────────────────────────────
  // CYBER DUALISM — Los Gemelos (WAVE 810)
  // 6 alternaciones L/R × 120ms = 720ms activos
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'cyber_dualism', name: 'Cyber Dualism',
    category: 'physical', mixBus: 'global',
    priority: 78, durationMs: 3000,
    tags: ['pingpong', 'strobe', 'dualism', 'techno'],
    vibeCompat: ['techno', 'minimal'],
    rawZones: ['movers-left', 'movers-right'],
    intensity: { floor: 0, peak: 1.0, fadeInMs: 1, sustainMs: 2998, fadeOutMs: 1, preBlackoutMs: 0, useEase: false },
    color: {
      cycle: [
        { h: 180, s: 100, l: 70 },  // cian (izquierda)
        { h: 300, s: 100, l: 70 },  // magenta (derecha)
      ],
    },
    strobe: {
      frequencyHz:    8,  // ~6 ciclos / 3s
      maxFrequencyHz: 10,
      delayMs:        0,
      endMs:          3000,
      rawZones:       ['movers-left', 'movers-right'],
    },
    staticParams: { cycles: 6, flashDurationMs: 120 },
  },

  // ─────────────────────────────────────────────────────────────────
  // GATLING RAID — La Ametralladora (WAVE 930)
  // 8 balas × (30ms + 35ms) = 520ms × 3 barridos = ~1560ms + fadeOut
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'gatling_raid', name: 'Gatling Raid',
    category: 'physical', mixBus: 'global',
    priority: 88, durationMs: 1760,
    tags: ['gatling', 'machine-gun', 'peak', 'techno'],
    vibeCompat: ['techno', 'industrial', 'metal'],
    rawZones: ['front', 'back'],
    intensity: { floor: 0, peak: 1.0, fadeInMs: 1, sustainMs: 1560, fadeOutMs: 200, preBlackoutMs: 0, useEase: false },
    color: { cycle: [{ h: 0, s: 0, l: 100 }] },  // blanco
    strobe: {
      frequencyHz:    15,
      maxFrequencyHz: 15,
      delayMs:        0,
      endMs:          1560,
      rawZones:       ['front', 'back'],
    },
    staticParams: { bulletCount: 8, bulletDurationMs: 30, bulletGapMs: 35, sweepCount: 3 },
  },

  // ─────────────────────────────────────────────────────────────────
  // SKY SAW — La Sierra del Techo (WAVE 930)
  // 2 cortes × (250ms ceiling + 150ms floor) = 800ms activos en 2000ms
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'sky_saw', name: 'Sky Saw',
    category: 'movement', mixBus: 'htp',
    priority: 70, durationMs: 2000,
    tags: ['skysaw', 'movers', 'cut', 'techno'],
    vibeCompat: ['techno', 'dubstep', 'neurofunk'],
    rawZones: ['all-movers'],
    intensity: { floor: 0.20, peak: 0.90, fadeInMs: 50, sustainMs: 1750, fadeOutMs: 200, preBlackoutMs: 0, useEase: false },
    color: {
      cycle: [
        { h: 180, s: 100, l: 70 },  // cyan
        { h: 120, s: 100, l: 50 },  // verde ácido
      ],
    },
    strobe: null,
    staticParams: { cutCount: 2, ceilingHoldMs: 250, floorHoldMs: 150 },
  },

  // ─────────────────────────────────────────────────────────────────
  // ABYSSAL RISE (AbyssalPressure) — La Presión (WAVE 997)
  // Fases: PRESSURE 80% (3040ms) → CRUSH 15% (570ms, 3 strobes) → VOID 5% (190ms)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'abyssal_rise', name: 'Abyssal Rise',
    category: 'composite', mixBus: 'global',
    priority: 85, durationMs: 3800,
    tags: ['pressure', 'buildup', 'peak', 'techno'],
    vibeCompat: ['techno', 'dubstep', 'dark'],
    rawZones: ['front', 'back', 'all-movers'],
    intensity: { floor: 0, peak: 1.0, fadeInMs: 3040, sustainMs: 1, fadeOutMs: 190, preBlackoutMs: 0, useEase: true },
    color: {
      cycle: [
        { h: 240, s: 100, l: 30 },  // azul profundo (PRESSURE)
        { h: 190, s: 100, l: 50 },  // cyan eléctrico (CRUSH)
      ],
    },
    strobe: {
      frequencyHz:    8,  // 3 flashes en 570ms ≈ max 5Hz pero 3 golpes quirúrgicos
      maxFrequencyHz: 10,
      delayMs:        3040,  // inicio fase CRUSH
      endMs:          3610,  // 3040 + 570
      rawZones:       ['front', 'back'],
    },
    staticParams: { pressurePhaseRatio: 0.80, crushPhaseRatio: 0.15, voidPhaseRatio: 0.05, maxStrobeCount: 3 },
  },

  // ─────────────────────────────────────────────────────────────────
  // VOID MIST — Neblina del Vacío (WAVE 2182)
  // Respiración sine 0.25Hz PARs + movers dimmer 0.3Hz
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'void_mist', name: 'Void Mist',
    category: 'physical', mixBus: 'global',
    priority: 60, durationMs: 3000,
    tags: ['ambient', 'void', 'deep', 'techno'],
    vibeCompat: ['techno', 'minimal', 'dark'],
    rawZones: ['all-pars', 'all-movers'],
    intensity: { floor: 0.10, peak: 0.45, fadeInMs: 800, sustainMs: 1400, fadeOutMs: 800, preBlackoutMs: 0, useEase: true },
    color: {
      cycle: [
        { h: 270, s: 100, l: 12 },  // deep purple UV
        { h: 250, s: 90, l: 18 },
      ],
      rawZones: ['all-pars', 'all-movers'],
    },
    strobe: null,
    staticParams: { parBreathHz: 0.25, moverBreathHz: 0.3, moverMinDimmer: 0.03 },
  },

  // ─────────────────────────────────────────────────────────────────
  // STATIC PULSE / LASER CANDY — UV Stabs (WAVE 976.9)
  // Stabs 50ms @ 0.75 intensidad, bpmSync, distribución asíncrona
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'static_pulse', name: 'Static Pulse',
    category: 'physical', mixBus: 'global',
    priority: 70, durationMs: 5000,
    tags: ['stab', 'uv', 'laser', 'techno'],
    vibeCompat: ['techno', 'minimal', 'acid'],
    rawZones: ['front', 'all-pars', 'back'],
    intensity: { floor: 0, peak: 0.75, fadeInMs: 100, sustainMs: 4700, fadeOutMs: 200, preBlackoutMs: 0, useEase: false },
    color: {
      cycle: [
        { h: 270, s: 100, l: 35 },  // UV violeta
        { h: 120, s: 100, l: 50 },  // verde láser
        { h: 210, s: 100, l: 55 },  // azul eléctrico
      ],
    },
    strobe: {
      frequencyHz:    2,  // ~2 stabs por segundo (bpmSync 2-4 beats)
      maxFrequencyHz: 3,
      delayMs:        0,
      endMs:          5000,
      rawZones:       ['front', 'all-pars', 'back'],
    },
    staticParams: { flashDurationMs: 50, minBeatsInterval: 2, maxBeatsInterval: 4 },
  },

  // ─────────────────────────────────────────────────────────────────
  // DIGITAL RAIN — Matrix Vibes (WAVE 938)
  // Flicker 3% por fixture × 4000ms → verde/cian atmosférico
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'digital_rain', name: 'Digital Rain',
    category: 'physical', mixBus: 'global',
    priority: 55, durationMs: 4000,
    tags: ['matrix', 'atmospheric', 'techno'],
    vibeCompat: ['techno', 'cyberpunk', 'dark'],
    rawZones: ['all-pars', 'all-movers'],
    intensity: { floor: 0.35, peak: 0.70, fadeInMs: 300, sustainMs: 3400, fadeOutMs: 300, preBlackoutMs: 0, useEase: false },
    color: {
      cycle: [
        { h: 180, s: 100, l: 50 },  // cyan terminal
        { h: 120, s: 100, l: 50 },  // lime matrix
      ],
    },
    strobe: null,
    staticParams: { flickerProbability: 0.03, minIntensity: 0.35, maxIntensity: 0.70 },
  },

  // ─────────────────────────────────────────────────────────────────
  // DEEP BREATH — Respiración Profunda (WAVE 938)
  // 2 ciclos × 2500ms = 5000ms, peak 60%
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'deep_breath', name: 'Deep Breath',
    category: 'physical', mixBus: 'global',
    priority: 40, durationMs: 5000,
    tags: ['breath', 'ambient', 'valley', 'techno'],
    vibeCompat: ['techno', 'minimal'],
    rawZones: ['front', 'back', 'all-movers'],
    intensity: { floor: 0, peak: 0.60, fadeInMs: 1250, sustainMs: 500, fadeOutMs: 1250, preBlackoutMs: 0, useEase: true },
    color: {
      cycle: [
        { h: 240, s: 100, l: 30 },  // deep blue
        { h: 270, s: 100, l: 35 },  // UV purple
      ],
    },
    strobe: null,
    staticParams: { breathCycleMs: 2500, breathCount: 2, beatsPerCycle: 16 },
  },

  // ─────────────────────────────────────────────────────────────────
  // AMBIENT STROBE — Stadium Flashbulbs (WAVE 977)
  // Flashes dispersos 33ms @100%, dispersión asíncrona 8% por fixture
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'ambient_strobe', name: 'Ambient Strobe',
    category: 'physical', mixBus: 'htp',
    priority: 65, durationMs: 4000,
    tags: ['strobe', 'ambient', 'stadium', 'techno'],
    vibeCompat: ['techno', 'minimal'],
    rawZones: ['front', 'all-pars', 'back'],
    intensity: { floor: 0, peak: 1.0, fadeInMs: 1, sustainMs: 3998, fadeOutMs: 1, preBlackoutMs: 0, useEase: false },
    color: { cycle: [{ h: 0, s: 0, l: 90 }] },  // blanco suave
    strobe: {
      frequencyHz:    3,  // ~2-4Hz disperso → tomamos 3Hz promedio
      maxFrequencyHz: 4,
      delayMs:        0,
      endMs:          4000,
      rawZones:       ['front', 'all-pars', 'back'],
    },
    staticParams: { flashDurationMs: 33, flashProbability: 0.08, tickIntervalMs: 100 },
  },

  // ─────────────────────────────────────────────────────────────────
  // SONAR PING — Tensión Submarina (WAVE 977)
  // Ping cian 180ms × 3 zonas + 100ms gap × 2 = ~740ms total
  // back → all-pars → front (viaje del sonar)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'sonar_ping', name: 'Sonar Ping',
    category: 'physical', mixBus: 'global',
    priority: 35, durationMs: 740,
    tags: ['sonar', 'ping', 'silence', 'techno'],
    vibeCompat: ['techno', 'minimal', 'dark'],
    rawZones: ['back', 'all-pars', 'front'],
    intensity: { floor: 0, peak: 0.40, fadeInMs: 30, sustainMs: 180, fadeOutMs: 530, preBlackoutMs: 0, useEase: false },
    color: {
      cycle: [
        { h: 190, s: 100, l: 45 },  // cian profundo
        { h: 210, s: 80, l: 40 },   // azul frío
      ],
    },
    strobe: null,
    staticParams: { pingDurationMs: 180, zoneGapMs: 100, pingIntensity: 0.40 },
  },

  // ─────────────────────────────────────────────────────────────────
  // BINARY GLITCH — Código Morse Corrupto (WAVE 1003.14)
  // Patrones micros: 3-5 flashes de 12-35ms → 2000ms total
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'binary_glitch', name: 'Binary Glitch',
    category: 'physical', mixBus: 'global',
    priority: 72, durationMs: 2000,
    tags: ['glitch', 'digital', 'active', 'techno'],
    vibeCompat: ['techno', 'industrial'],
    rawZones: ['front', 'back', 'all-movers'],
    intensity: { floor: 0, peak: 1.0, fadeInMs: 1, sustainMs: 1600, fadeOutMs: 400, preBlackoutMs: 50, useEase: false },
    color: {
      cycle: [
        { h: 215, s: 100, l: 50 },  // azul eléctrico
        { h: 185, s: 85, l: 55 },   // hot cyan
      ],
    },
    strobe: {
      frequencyHz:    8,  // flashes micros ~8Hz en burst
      maxFrequencyHz: 15,
      delayMs:        50,  // pre-blackout
      endMs:          1600,
      rawZones:       ['front', 'back'],
    },
    staticParams: { durationMs: 2000, fadeOutMs: 400 },
  },

  // ─────────────────────────────────────────────────────────────────
  // CORE MELTDOWN — La Bestia Nuclear (WAVE 988)
  // Strobe 15Hz por 4200ms total, magenta nuclear + blanco cegador
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'core_meltdown', name: 'Core Meltdown',
    category: 'physical', mixBus: 'global',
    priority: 100, durationMs: 4200,
    tags: ['strobe', 'nuclear', 'peak', 'techno'],
    vibeCompat: ['techno', 'industrial', 'metal'],
    rawZones: ['all'],
    intensity: { floor: 0, peak: 1.0, fadeInMs: 1, sustainMs: 4199, fadeOutMs: 0, preBlackoutMs: 0, useEase: false },
    color: {
      cycle: [
        { h: 300, s: 100, l: 50 },  // magenta nuclear
        { h: 0, s: 0, l: 100 },     // blanco cegador
      ],
    },
    strobe: {
      frequencyHz:    15,
      maxFrequencyHz: 15,
      delayMs:        0,
      endMs:          4200,
      rawZones:       ['all'],
    },
    staticParams: { strobeRateHz: 15 },
  },

  // ─────────────────────────────────────────────────────────────────
  // SEISMIC SNAP — Terremoto Visual (WAVE 997.6)
  // BLACKOUT(150) → SNAP(400) → SHAKE(600) → FADE(1350) = 2500ms
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'seismic_snap', name: 'Seismic Snap',
    category: 'physical', mixBus: 'global',
    priority: 82, durationMs: 2500,
    tags: ['seismic', 'impact', 'intense', 'techno'],
    vibeCompat: ['techno', 'industrial'],
    rawZones: ['front', 'all-pars', 'back', 'all-movers'],
    intensity: { floor: 0, peak: 1.0, fadeInMs: 1, sustainMs: 400, fadeOutMs: 1350, preBlackoutMs: 150, useEase: false },
    color: {
      cycle: [
        { h: 0, s: 90, l: 55 },    // rojo impacto
        { h: 0, s: 0, l: 100 },    // blanco puro
      ],
    },
    strobe: {
      frequencyHz:    10,  // shake 10Hz en fase SHAKE
      maxFrequencyHz: 12,
      delayMs:        550, // post-SNAP: 150+400
      endMs:          1150, // hasta fin de SHAKE: 150+400+600
      rawZones:       ['front', 'all-pars', 'back'],
    },
    staticParams: { blackoutDurationMs: 150, snapDurationMs: 400, shakeDurationMs: 600, fadeDurationMs: 1350, shakeFrequencyHz: 10 },
  },

  // ─────────────────────────────────────────────────────────────────
  // FIBER OPTICS — Traveling Colors (WAVE 997.5)
  // Onda de color cian→magenta→azul viajando back→front @ 1Hz, 6000ms
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'fiber_optics', name: 'Fiber Optics',
    category: 'color', mixBus: 'global',
    priority: 45, durationMs: 6000,
    tags: ['ambient', 'color', 'flow', 'techno'],
    vibeCompat: ['techno', 'minimal', 'cyberpunk'],
    rawZones: ['all-pars', 'all-movers'],
    intensity: { floor: 0.20, peak: 0.85, fadeInMs: 600, sustainMs: 4800, fadeOutMs: 600, preBlackoutMs: 0, useEase: true },
    color: {
      cycle: [
        { h: 190, s: 100, l: 50 },  // cian brillante
        { h: 280, s: 80, l: 55 },   // magenta tech
        { h: 230, s: 90, l: 50 },   // azul eléctrico
      ],
    },
    strobe: null,
    staticParams: { waveSpeedHz: 1.0, parIntensity: 0.85, moverIntensity: 0.50 },
  },

  // ─────────────────────────────────────────────────────────────────
  // NEON BLINDER — The Flash Wall (WAVE 2183)
  // attack 50ms → strobe 266ms @15Hz → melt 684ms → total 1000ms
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'neon_blinder', name: 'Neon Blinder',
    category: 'physical', mixBus: 'global',
    priority: 93, durationMs: 1000,
    tags: ['blinder', 'flash-wall', 'peak', 'techno'],
    vibeCompat: ['techno', 'industrial'],
    rawZones: ['front', 'all-pars', 'back', 'all-movers'],
    intensity: { floor: 0, peak: 1.0, fadeInMs: 1, sustainMs: 316, fadeOutMs: 684, preBlackoutMs: 50, useEase: false },
    color: {
      cycle: [
        { h: 185, s: 100, l: 55 },  // cian eléctrico (default)
        { h: 300, s: 100, l: 55 },  // magenta eléctrico
        { h: 0, s: 100, l: 50 },    // rojo sangre
      ],
    },
    strobe: {
      frequencyHz:    15,
      maxFrequencyHz: 15,
      delayMs:        50,   // post-attack
      endMs:          316,  // 50 + 266
      rawZones:       ['front', 'all-pars', 'back'],
    },
    staticParams: { attackMs: 50, strobePhaseMs: 266, strobeHz: 15 },
  },

  // ─────────────────────────────────────────────────────────────────
  // SURGICAL STRIKE — El Bisturí (WAVE 2214)
  // Solo dimmer toggle 14Hz, 600ms, movers en blackout PARs
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'surgical_strike', name: 'Surgical Strike',
    category: 'physical', mixBus: 'global',
    priority: 90, durationMs: 600,
    tags: ['surgical', 'strobe', 'intense', 'techno'],
    vibeCompat: ['techno', 'minimal'],
    rawZones: ['all-movers'],
    intensity: { floor: 0, peak: 1.0, fadeInMs: 1, sustainMs: 600, fadeOutMs: 0, preBlackoutMs: 0, useEase: false },
    color: { cycle: [{ h: 0, s: 0, l: 100 }] },  // blanco puro via dimmer
    strobe: {
      frequencyHz:    14,
      maxFrequencyHz: 15,
      delayMs:        0,
      endMs:          600,
      rawZones:       ['all-movers'],
    },
    staticParams: { strobeHz: 14 },
  },

  // ─────────────────────────────────────────────────────────────────
  // GHOST CHASE — Almas en la Niebla (WAVE 2182)
  // PARs: respiración sine 0.3Hz, movers fantasma 0.2Hz desfasados
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'ghost_chase', name: 'Ghost Chase',
    category: 'physical', mixBus: 'global',
    priority: 50, durationMs: 4000,
    tags: ['ghost', 'ambient', 'valley', 'techno'],
    vibeCompat: ['techno', 'minimal', 'dark'],
    rawZones: ['all-pars', 'movers-left', 'movers-right'],
    intensity: { floor: 0.08, peak: 0.35, fadeInMs: 600, sustainMs: 2800, fadeOutMs: 600, preBlackoutMs: 0, useEase: true },
    color: {
      cycle: [{ h: 250, s: 80, l: 20 }],  // deep indigo espectral
      rawZones: ['movers-left', 'movers-right'],
    },
    strobe: null,
    staticParams: { parBreathHz: 0.3, moverGhostHz: 0.2, moverMaxDimmer: 0.30 },
  },
]

// ─── CATÁLOGO UNIFICADO ────────────────────────────────────────────────────

const ALL_LEGACY_EFFECTS: LegacyEffectDescriptor[] = [
  ...FIESTA_LATINA_EFFECTS,
  ...POPROCK_EFFECTS,
  ...TECHNO_EFFECTS,
]

// ════════════════════════════════════════════════════════════════════════════
// §4 — ENSAMBLADOR DE CLIPS V3
// ════════════════════════════════════════════════════════════════════════════

/**
 * Construye un HephAutomationClipV3 completo a partir de un descriptor legacy.
 *
 * Genera tracks[] separados por eje semántico, respetando zonas distintas.
 * El clip resultante es determinista y checksum-estable.
 */
// ════════════════════════════════════════════════════════════════════════════
// §4 — HELPERS DE INFERENCIA COGNITIVA
// ════════════════════════════════════════════════════════════════════════════

function inferEnergyZones(priority: number, tags: readonly string[]): string[] {
  if (tags.includes('silence')) return ['silence', 'valley']
  if (tags.includes('valley') && priority < 30) return ['valley', 'ambient']
  if (priority >= 90 || tags.includes('peak')) return ['intense', 'peak']
  if (priority >= 70 || tags.includes('intense')) return ['active', 'intense']
  if (priority >= 50 || tags.includes('active')) return ['gentle', 'active']
  if (priority >= 30 || tags.includes('ambient')) return ['ambient', 'gentle']
  return ['valley', 'ambient']
}

function inferValidSections(priority: number, tags: readonly string[]): string[] {
  if (tags.includes('silence')) return ['intro', 'outro', 'silence']
  if (tags.includes('valley')) return ['intro', 'breakdown', 'valley', 'outro']
  if (tags.includes('ambient') && priority < 40) return ['intro', 'breakdown', 'valley', 'outro']
  if (priority >= 88 || tags.includes('peak')) return ['drop', 'peak']
  if (priority >= 70) return ['build', 'drop', 'breakdown']
  if (priority >= 50) return ['build', 'active', 'breakdown']
  return ['build', 'active', 'breakdown', 'valley']
}

// ════════════════════════════════════════════════════════════════════════════
// §4b — ENSAMBLADOR PRINCIPAL (formato hephaestus/v2.1)
// ════════════════════════════════════════════════════════════════════════════

function buildClipV21(desc: LegacyEffectDescriptor): LfxClipV21 {
  const isStrobe   = desc.strobe !== null
  const firstColor = desc.color?.cycle?.[0] ?? { h: 0, s: 0, l: 50 }

  // ── Curves (Record, NO tracks[]) ─────────────────────────────────
  const curves: Record<string, HephCurve> = {}

  curves['intensity'] = buildIntensityCurve({
    durationMs:     desc.durationMs,
    floorIntensity: desc.intensity.floor,
    peakIntensity:  desc.intensity.peak,
    fadeInMs:       desc.intensity.fadeInMs,
    sustainMs:      desc.intensity.sustainMs,
    fadeOutMs:      desc.intensity.fadeOutMs,
    preBlackoutMs:  desc.intensity.preBlackoutMs,
    useEase:        desc.intensity.useEase,
  })

  if (desc.color !== null) {
    curves['color'] = buildColorCurve(desc.color.cycle, desc.durationMs)
  }

  if (isStrobe) {
    // Clave 'strobe' — gate G6 del LfxFileLoader busca curves['strobe']
    curves['strobe'] = buildStrobeRateCurve({
      durationMs:     desc.durationMs,
      frequencyHz:    desc.strobe!.frequencyHz,
      maxFrequencyHz: desc.strobe!.maxFrequencyHz,
      delayMs:        desc.strobe!.delayMs,
      endMs:          desc.strobe!.endMs,
    })
  }

  // ── CognitiveDNA ─────────────────────────────────────────────────
  const aggression   = Math.min(1, desc.priority / 100 + (isStrobe ? 0.05 : 0))
  const energyZones  = inferEnergyZones(desc.priority, desc.tags)
  const spatialBehavior: 'static' | 'relative_offset' =
    desc.category === 'movement' ? 'relative_offset' : 'static'

  const cognitiveDNA: LfxClipV21['cognitiveDNA'] = {
    genome: {
      aggression,
      chaos:      isStrobe ? 0.75 :
                  desc.category === 'composite' ? 0.50 :
                  desc.category === 'movement'  ? 0.35 : 0.30,
      organicity: desc.category === 'movement'  ? 0.45 :
                  desc.category === 'composite' ? 0.25 : 0.10,
    },
    textureAffinity: isStrobe ? 'dirty' : (desc.priority < 40 ? 'clean' : 'universal'),
    compatibleVibes: desc.vibeCompat,
    validSections:   inferValidSections(desc.priority, desc.tags),
    energyZone: { min: energyZones[0], max: energyZones[energyZones.length - 1] },
    aggressionRange: { min: 0, max: Math.min(1, aggression + 0.15) },
    spatialBehavior,
  }

  // ── SimulationMeta ────────────────────────────────────────────────
  const simulationMeta: LfxClipV21['simulationMeta'] = {
    beautyWeights: {
      base:             0.40 + desc.priority / 200,
      energyMultiplier: 1.05,
      vibeBonus:        0.05,
    },
    gpuCost:           desc.category === 'composite' ? 0.45 : 0.30,
    fatigueImpact:     isStrobe ? 0.18 : 0.06,
    minDurationMs:     Math.min(1000, desc.durationMs),
    cooldownMs:        Math.max(3000, Math.round(desc.durationMs * 1.5)),
    isStrobe,
    isDivineCandidate: isStrobe && desc.priority >= 90,
    isHeavyCandidate:  desc.priority >= 80,
    zScoreGuards: {
      requireRising: isStrobe && desc.priority >= 85,
      minimumZ:      isStrobe ? 2.0 : null,
      minimumEnergy: desc.priority >= 85 ? 0.70 : null,
    },
  }

  // ── ExecutionHints ────────────────────────────────────────────────
  const hasMovers = desc.rawZones.some(z => z.includes('mover') || z === 'all')
  const hasPars   = desc.rawZones.some(z =>
    ['front', 'back', 'all-pars', 'center', 'floor', 'all', 'ambient'].includes(z)
  )
  const fixtureTargeting = (hasMovers && hasPars) ? 'all' :
                            hasMovers ? 'movers' : 'pars'

  const executionHints: LfxClipV21['executionHints'] = {
    overlayMode:      desc.mixBus === 'global' ? 'absolute' : 'relative',
    phaseConfig:      { spread: 0, symmetry: 'linear', wings: 1, direction: 1 },
    intensityScaling: 'energyDriven',
    fixtureTargeting,
  }

  // ── SafetyDeclaration ─────────────────────────────────────────────
  const safetyDeclaration: LfxClipV21['safetyDeclaration'] = {
    maxStrobeFreqHz:    isStrobe ? desc.strobe!.frequencyHz : 0,
    containsRapidFlash: isStrobe && desc.strobe!.frequencyHz > 3,
    communityTrusted:   true,
  }

  // ── StaticParams (v2.1 conventions + params del descriptor) ───────
  const staticParams: Record<string, number | string | boolean> = {
    dominantColorH: firstColor.h,
    dominantColorS: firstColor.s,
    dominantColorL: firstColor.l,
    isOneShot:      false,
    legacyMixBus:   desc.mixBus,
    bpmRef:         128,
    ...(desc.staticParams ?? {}),
  }

  return {
    id:                desc.id,
    name:              desc.name,
    author:            'LuxSync-Migrator-v3 / WAVE 4848',
    category:          desc.category,
    tags:              desc.tags,
    vibeCompat:        desc.vibeCompat,
    zones:             energyZones, // energy zones para Selene routing
    mixBus:            desc.mixBus,
    priority:          desc.priority,
    durationMs:        desc.durationMs,
    effectType:        'heph_custom', // OBLIGATORIO: isSeleneEligible() requiere este valor
    curves,
    staticParams,
    cognitiveDNA,
    simulationMeta,
    executionHints,
    safetyDeclaration,
  }
}

// ════════════════════════════════════════════════════════════════════════════
// §5 — SERIALIZACIÓN Y CHECKSUM (hephaestus/v2.1)
// ════════════════════════════════════════════════════════════════════════════

/**
 * SHA-256 sobre JSON.stringify(innerClip) — igual que LfxFileLoader._validateChecksum.
 * El hash se calcula sobre el inner clip object (sin el wrapper $schema/version/checksum).
 */
function sha256Clip(innerClip: LfxClipV21): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(innerClip)).digest('hex')}`
}

/**
 * Ensambla el LfxClipV2File final con checksum incluido.
 */
function emitLFXFile(innerClip: LfxClipV21): LfxClipV2File {
  return {
    $schema:  'hephaestus/v2.1',
    version:  '2.1.0',
    clip:     innerClip,
    checksum: sha256Clip(innerClip),
  }
}

// ════════════════════════════════════════════════════════════════════════════
// §6 — VALIDACIÓN ESTRUCTURAL (sans zod — comprobaciones en runtime)
// ════════════════════════════════════════════════════════════════════════════

interface ValidationResult {
  ok:     boolean
  errors: string[]
}

function validateLFXFileV21(file: LfxClipV2File): ValidationResult {
  const errors: string[] = []
  const c = file.clip

  if (file.$schema !== 'hephaestus/v2.1') {
    errors.push(`$schema inválido: "${file.$schema}" (esperado 'hephaestus/v2.1')`)
  }
  if (file.version !== '2.1.0') {
    errors.push(`version inválida: "${file.version}" (esperado '2.1.0')`)
  }
  if (!c.id || typeof c.id !== 'string') {
    errors.push('clip.id es requerido')
  }
  if (c.effectType !== 'heph_custom') {
    errors.push(`clip.effectType debe ser 'heph_custom' (es '${c.effectType}')`)
  }
  if (!c.curves || typeof c.curves !== 'object' || Object.keys(c.curves).length === 0) {
    errors.push('clip.curves está vacío o ausente')
  } else {
    for (const [key, curve] of Object.entries(c.curves)) {
      if (!Array.isArray(curve.keyframes) || curve.keyframes.length === 0) {
        errors.push(`curves['${key}'] sin keyframes en clip ${c.id}`)
      }
      if (!Array.isArray(curve.range) || curve.range.length !== 2) {
        errors.push(`curves['${key}'] range inválido en clip ${c.id}`)
      }
    }
  }
  if (!c.cognitiveDNA) {
    errors.push('clip.cognitiveDNA requerido para Selene eligibility')
  }
  if (!c.staticParams || typeof c.staticParams !== 'object') {
    errors.push('clip.staticParams requerido')
  }
  if (!Array.isArray(c.zones) || c.zones.length === 0) {
    errors.push('clip.zones requerido')
  }

  // Verificar checksum
  const expected = sha256Clip(c)
  if (file.checksum !== expected) {
    errors.push(
      `Checksum inválido en clip "${c.id}": ` +
      `esperado=${expected} recibido=${file.checksum}`
    )
  }

  return { ok: errors.length === 0, errors }
}

// ════════════════════════════════════════════════════════════════════════════
// §7 — MAIN ORCHESTRATOR
// ════════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  const args    = process.argv.slice(2)
  const dryRun  = args.includes('--dry-run')
  const outFlag = args.indexOf('--out')
  const outDir  = outFlag >= 0
    ? path.resolve(args[outFlag + 1])
    : path.resolve(process.cwd(), 'electron-app/src/core/arsenal/builtins')

  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║  ⚒️  ts-to-lfx-migrator-v3 — WAVE 4848 Sprint 2          ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log(`Efectos en catálogo : ${ALL_LEGACY_EFFECTS.length}`)
  console.log(`Directorio de salida: ${outDir}`)
  if (dryRun) console.log('⚠️  DRY-RUN: no se escribirá nada al disco\n')
  else console.log()

  if (!dryRun) {
    await fs.mkdir(outDir, { recursive: true })
  }

  let passed  = 0
  let failed  = 0
  const report: string[] = []

  for (const desc of ALL_LEGACY_EFFECTS) {
    process.stdout.write(`  → [${desc.id.padEnd(22)}] `)

    try {
      const innerClip = buildClipV21(desc)
      const lfxFile   = emitLFXFile(innerClip)
      const valid     = validateLFXFileV21(lfxFile)

      if (!valid.ok) {
        process.stdout.write(`❌ VALIDATION FAIL\n`)
        for (const err of valid.errors) {
          process.stderr.write(`     • ${err}\n`)
        }
        failed++
        report.push(`FAIL ${desc.id}: ${valid.errors.join(' | ')}`)
        continue
      }

      const json     = JSON.stringify(lfxFile, null, 2)
      const fileName = `${desc.id}.lfx`
      const filePath = path.join(outDir, fileName)

      if (!dryRun) {
        await fs.writeFile(filePath, json, 'utf-8')
      }

      const curveNames = Object.keys(innerClip.curves).join('+')
      const sizeKb     = (Buffer.byteLength(json, 'utf-8') / 1024).toFixed(1)

      process.stdout.write(`✅  curves=[${curveNames}]  ${sizeKb}KB\n`)
      passed++
      report.push(`OK  ${desc.id} → ${fileName} (${sizeKb}KB)`)

    } catch (err) {
      process.stdout.write(`💥 ERROR\n`)
      process.stderr.write(`     ${String(err)}\n`)
      failed++
      report.push(`ERR ${desc.id}: ${String(err)}`)
    }
  }

  console.log()
  console.log('────────────────────────────────────────────────────────────')
  console.log(`  RESULTADO: ${passed} OK  |  ${failed} FAIL  |  total ${ALL_LEGACY_EFFECTS.length}`)
  if (!dryRun && passed > 0) {
    console.log(`  Archivos .lfx escritos en: ${outDir}`)
  }
  console.log('────────────────────────────────────────────────────────────')

  if (failed > 0) process.exit(1)
}

main().catch(err => {
  process.stderr.write(`[migrator 💀] Error fatal: ${String(err)}\n`)
  process.exit(2)
})
