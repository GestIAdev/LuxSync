/**
 * 🎨 WAVE 3504-EXT.1 — COLOR PROCESSORS
 *
 * Funciones puras de transformación cromática extraídas de TitanEngine.
 * Cero estado. Cero singletons. Cero side-effects.
 *
 * Contiene:
 *  - Conversión SelenePalette → ColorPalette (normalización HSL)
 *  - Aplicación de decisiones de consciencia sobre paleta y efectos
 *  - Cálculo de intensidad global con noise gate
 *  - Cálculo de intensidades de zona por banda espectral
 *  - Normalización de tipo de sección musical
 *
 * @layer ENGINE/GENERATORS (Pure Math)
 */

import type { ColorPalette, ZoneIntentMap, EffectIntent } from '../../core/protocol/LightingIntent'
import { withHex } from '../../core/protocol/LightingIntent'
import type { SelenePalette } from '../color/SeleneColorEngine'
import type {
  ConsciousnessColorDecision,
  ConsciousnessPhysicsModifier,
} from '../../core/protocol/ConsciousnessOutput'

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS DE ENTRADA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Subconjunto mínimo de EngineAudioMetrics para cálculo de intensidades.
 * Structural typing para evitar importar el tipo monolítico.
 */
export interface IntensityAudioInput {
  bass: number
  mid: number
  high: number
  energy: number
}

/**
 * Parámetros del dimmer del vibe (floor/ceiling from VibeProfile).
 */
export interface DimmerConfig {
  floor: number
  ceiling: number
}

/**
 * Tipos válidos de sección musical (contrato interno del Engine).
 */
export type NormalizedSectionType =
  | 'intro'
  | 'verse'
  | 'chorus'
  | 'drop'
  | 'bridge'
  | 'outro'
  | 'build'
  | 'breakdown'
  | 'unknown'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * WAVE 2990: NOISE GATE — energía por debajo de este umbral se trata como silencio.
 * El ruido de fondo, hum de sala y artefactos de codec dan ~2-4% de energía.
 * Silencio duro a cero previene luz residual cuando la sala está realmente en silencio.
 */
export const NOISE_GATE = 0.05

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSIÓN DE PALETA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte SelenePalette (HSL en rango 0-360 / 0-100 / 0-100)
 * a ColorPalette del protocolo (HSL en rango 0-1).
 *
 * WAVE 269: SeleneColorEngine usa escalas absolutas, el protocolo usa
 * escalas normalizadas. Esta función es el único punto de traducción.
 *
 * @pure
 */
export function selenePaletteToColorPalette(selene: SelenePalette): ColorPalette {
  const normalizeHSL = (color: { h: number; s: number; l: number }) =>
    withHex({
      h: color.h / 360,
      s: color.s / 100,
      l: color.l / 100,
    })

  return {
    primary:   normalizeHSL(selene.primary),
    secondary: normalizeHSL(selene.secondary),
    accent:    normalizeHSL(selene.accent),
    ambient:   normalizeHSL(selene.ambient),
    strategy:  selene.meta.strategy,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DECISIONES DE CONSCIENCIA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aplica las modificaciones de color de la consciencia a una paleta.
 *
 * La consciencia puede ajustar saturación y brillo (factor ±20%) pero
 * RESPETA la paleta base generada por SeleneColorEngine. No cambia hue.
 *
 * Modificadores clampeados a ±20% para evitar distorsiones extremas.
 *
 * @pure
 */
export function applyConsciousnessColorDecision(
  palette: ColorPalette,
  decision: ConsciousnessColorDecision,
): ColorPalette {
  const satMod    = Math.max(0.8, Math.min(1.2, decision.saturationMod  ?? 1))
  const brightMod = Math.max(0.8, Math.min(1.2, decision.brightnessMod ?? 1))

  const modifyChannel = (color: ColorPalette['primary']): ColorPalette['primary'] => ({
    ...color,
    s: Math.max(0, Math.min(1, color.s * satMod)),
    l: Math.max(0, Math.min(1, color.l * brightMod)),
  })

  return {
    primary:   modifyChannel({ ...palette.primary }),
    secondary: modifyChannel({ ...palette.secondary }),
    accent:    modifyChannel({ ...palette.accent }),
    ambient:   modifyChannel({ ...palette.ambient }),
    strategy:  palette.strategy,
  }
}

/**
 * Aplica modificadores de física de la consciencia a la lista de efectos.
 *
 * Sólo modifica intensidades de strobe/flash — no añade ni elimina efectos.
 * ⚠️ Solo debe llamarse cuando energy < 0.85. En drops, la física tiene VETO TOTAL.
 *
 * @pure
 */
export function applyConsciousnessPhysicsModifier(
  effects: EffectIntent[],
  modifier: ConsciousnessPhysicsModifier,
): EffectIntent[] {
  return effects.map(effect => {
    const next = { ...effect }

    if (effect.type === 'strobe' && modifier.strobeIntensity !== undefined) {
      next.intensity = Math.max(0, Math.min(1, effect.intensity * modifier.strobeIntensity))
    }
    if (effect.type === 'flash' && modifier.flashIntensity !== undefined) {
      next.intensity = Math.max(0, Math.min(1, effect.intensity * modifier.flashIntensity))
    }

    return next
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// INTENSIDAD GLOBAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula la intensidad maestra normalizada (0..1) para el frame actual.
 *
 * Aplica el noise gate para evitar luz residual en silencio, luego mapea
 * la energía al rango floor/ceiling del vibe actual.
 *
 * WAVE 2990: Sub-threshold energy → absolute silence.
 *
 * @pure
 */
export function calculateMasterIntensity(
  energy: number,
  dimmer: DimmerConfig,
): number {
  const gated = energy < NOISE_GATE ? 0 : energy
  return Math.max(0, Math.min(1, dimmer.floor + gated * (dimmer.ceiling - dimmer.floor)))
}

// ─────────────────────────────────────────────────────────────────────────────
// ZONAS DE INTENSIDAD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula el mapa de intenciones de zona base a partir de las bandas espectrales.
 *
 * Aplica el noise gate por banda antes de los cálculos de zona para que
 * el ruido de fondo no genere intensidad residual en ninguna zona.
 *
 * Esta función devuelve el mapa BASE (mono / 5 zonas).
 * Los overrides estéreo del NervousSystem se aplican en el Engine dispatcher.
 *
 * WAVE 2990: Noise gate por banda.
 *
 * @pure
 */
export function calculateZoneIntents(audio: IntensityAudioInput): ZoneIntentMap {
  const NG = NOISE_GATE
  const bass   = audio.bass   < NG ? 0 : audio.bass
  const mid    = audio.mid    < NG ? 0 : audio.mid
  const high   = audio.high   < NG ? 0 : audio.high
  const energy = audio.energy < NG ? 0 : audio.energy

  return {
    front:  { intensity: mid * 0.8 + bass * 0.2,       paletteRole: 'primary'   },
    back:   { intensity: bass * 0.6 + energy * 0.4,    paletteRole: 'accent'    },
    left:   { intensity: high * 0.5 + energy * 0.5,    paletteRole: 'secondary' },
    right:  { intensity: high * 0.5 + energy * 0.5,    paletteRole: 'ambient'   },
    ambient:{ intensity: energy * 0.3,                 paletteRole: 'ambient'   },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZACIÓN DE SECCIÓN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tabla de mapeo de nombres de sección cruda → tipo normalizado.
 * Los alias más comunes están aquí; los no recognocidos caen a 'unknown'.
 */
const SECTION_MAP: Record<string, NormalizedSectionType> = {
  intro:      'intro',
  verse:      'verse',
  chorus:     'chorus',
  drop:       'drop',
  bridge:     'bridge',
  outro:      'outro',
  build:      'build',
  buildup:    'build',
  breakdown:  'breakdown',
  hook:       'chorus',
  prechorus:  'build',
  postchorus: 'verse',
}

/**
 * Normaliza el tipo de sección musical a un enum tipado.
 *
 * Los strings de sección vienen del análisis Wave8 y pueden tener
 * mayúsculas o variaciones de alias. Esta función los canonicaliza.
 *
 * @pure
 */
export function normalizeSectionType(sectionType: string): NormalizedSectionType {
  return SECTION_MAP[sectionType?.toLowerCase() ?? ''] ?? 'unknown'
}
