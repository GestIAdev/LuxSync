/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛡️ CELL TYPE ADMITTANCE — WAVE 4732-A
 *
 * Aduana de tipos: mapeo canónico `ChannelType → NodeFamily[]`.
 * Única fuente de verdad para validar qué tipos de canal pueden pertenecer
 * a cada familia Aether. Basado en la Sección §6 del blueprint WAVE 4732.
 *
 * Regla maestra:
 * - IMPACT/COLOR/KINETIC: estrictos (subset cerrado).
 * - BEAM:      canales ópticos puros + color_wheel (rueda mecánica).
 * - ATMOSPHERE: control genérico, macro, phantoms.
 * - custom:    comodín explícito — el operador elige con warning visible.
 * - unknown:   bloqueado en cualquier célula.
 *
 * @module core/forge/cellTypeAdmittance
 * @version WAVE 4732-A
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { ChannelType } from '../../types/FixtureDefinition'
import { NodeFamily } from '../aether/types'

// ═══════════════════════════════════════════════════════════════════════════
// TABLA CANÓNICA (inmutable)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mapa declarativo e inmutable.
 * Cubre los 30 ChannelType reales definidos en FixtureDefinition.ts.
 */
export const CELL_TYPE_ADMITTANCE: Readonly<Record<ChannelType, readonly NodeFamily[]>> =
  Object.freeze({
    // ── INTENSITY ─────────────────────────────────────────────────────────
    // WAVE 4732.4 HOTFIX: canales universales de intensidad.
    // Deben poder vivir en COLOR para nodos wash autónomos (dimmer+strobe integrados),
    // además de IMPACT/BEAM/ATMOSPHERE.
    dimmer:         [NodeFamily.IMPACT, NodeFamily.COLOR, NodeFamily.BEAM, NodeFamily.ATMOSPHERE],
    strobe:         [NodeFamily.IMPACT, NodeFamily.COLOR, NodeFamily.BEAM, NodeFamily.ATMOSPHERE],
    shutter:        [NodeFamily.IMPACT, NodeFamily.COLOR, NodeFamily.BEAM, NodeFamily.ATMOSPHERE],

    // ── COLOR ─────────────────────────────────────────────────────────────
    red:            [NodeFamily.COLOR],
    green:          [NodeFamily.COLOR],
    blue:           [NodeFamily.COLOR],
    // WAVE 4732.4 HOTFIX: white/amber también se tratan como universales.
    white:          [NodeFamily.COLOR, NodeFamily.IMPACT, NodeFamily.BEAM, NodeFamily.ATMOSPHERE],
    amber:          [NodeFamily.COLOR, NodeFamily.IMPACT, NodeFamily.BEAM, NodeFamily.ATMOSPHERE],
    uv:             [NodeFamily.COLOR],
    cyan:           [NodeFamily.COLOR],
    magenta:        [NodeFamily.COLOR],
    yellow:         [NodeFamily.COLOR],
    color_wheel:    [NodeFamily.COLOR, NodeFamily.BEAM],  // rueda mecánica óptica

    // ── POSITION ──────────────────────────────────────────────────────────
    pan:            [NodeFamily.KINETIC],
    pan_fine:       [NodeFamily.KINETIC],
    tilt:           [NodeFamily.KINETIC],
    tilt_fine:      [NodeFamily.KINETIC],
    rotation:       [NodeFamily.KINETIC],
    speed:          [NodeFamily.KINETIC],

    // ── BEAM ──────────────────────────────────────────────────────────────
    gobo:           [NodeFamily.BEAM],
    gobo_rotation:  [NodeFamily.BEAM],
    prism:          [NodeFamily.BEAM],
    prism_rotation: [NodeFamily.BEAM],
    focus:          [NodeFamily.BEAM],
    zoom:           [NodeFamily.BEAM],
    frost:          [NodeFamily.BEAM],

    // ── CONTROL / ATMOSPHERE ──────────────────────────────────────────────
    macro:          [NodeFamily.ATMOSPHERE, NodeFamily.IMPACT],
    control:        [NodeFamily.ATMOSPHERE],

    // ── COMODÍN — warning visible en UI ───────────────────────────────────
    custom:         [
      NodeFamily.ATMOSPHERE,
      NodeFamily.IMPACT,
      NodeFamily.BEAM,
      NodeFamily.COLOR,
      NodeFamily.KINETIC,
    ],

    // ── BLOQUEADO ─────────────────────────────────────────────────────────
    unknown:        [],
  })

// ═══════════════════════════════════════════════════════════════════════════
// RESULTADO DE ADMISIÓN
// ═══════════════════════════════════════════════════════════════════════════

export type AdmittanceResult =
  | { ok: true }
  | { ok: false; reason: string }

// ═══════════════════════════════════════════════════════════════════════════
// API PÚBLICA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Valida si un canal de tipo `channelType` puede pertenecer a la familia `family`.
 *
 * Función pura, determinista, sin side-effects. Triple-validada en:
 *   1. onDragOver (cursor rápido)
 *   2. onDrop (defensiva)
 *   3. reducer CELL_ATTACH_CHANNEL (autoridad final)
 *
 * @returns `{ ok: true }` si se admite, `{ ok: false, reason }` si se rechaza.
 */
export function canAdmit(channelType: ChannelType, family: NodeFamily): AdmittanceResult {
  const allowed = CELL_TYPE_ADMITTANCE[channelType]

  if (!allowed || allowed.length === 0) {
    return {
      ok: false,
      reason: `Canal '${channelType}' no puede asociarse a ninguna familia`,
    }
  }

  if (!allowed.includes(family)) {
    return {
      ok: false,
      reason: `Canal '${channelType}' incompatible con familia ${family}. Permitidas: ${allowed.join(', ')}`,
    }
  }

  return { ok: true }
}

/**
 * Devuelve la primera familia aceptada para un tipo de canal (la "familia natural").
 * Útil para el Auto-detect del descompilador (§8) y la heurística de cells.
 *
 * @returns `undefined` si el tipo es `unknown` (ninguna familia lo acepta).
 */
export function primaryFamilyOf(channelType: ChannelType): NodeFamily | undefined {
  return CELL_TYPE_ADMITTANCE[channelType]?.[0]
}
