/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 AETHER MATRIX — COLOR ADAPTER (Capa L1)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 4522.3: THE COLOR-AETHER BRIDGE (Fase A)
 *
 * RESPONSABILIDAD (SINGLE):
 * Consumir la paleta RGB de SeleneLuxOutput (fuente musical canónica) y
 * traducirla en NodeIntents r, g, b normalizados (0-1) para nodos COLOR
 * en la Capa L1 (priority = 10) del IIntentBus.
 *
 * CONTRATO L1:
 *   - Solo emite canales r, g, b. NUNCA dimmer, brightness, shutter ni CMY.
 *   - Fuente de color: IColorIngress.paletteRgb (RGB 0-255 de SeleneLux).
 *   - Mapeo zona → rol: selectColorRoleFromZone() (via zoneUtils).
 *   - Normalización: r255 / 255, clampeado a [0, 1].
 *
 * INVARIANTES DE DISEÑO:
 *   - Zero allocations en hot path (todas las estructuras pre-allocated).
 *   - Sin traducción a CMY, colorWheel ni hardware — eso es NodeResolver.
 *   - Sin dependencia del LiquidEngine — ese es L0 (LiquidAetherAdapter).
 *   - Sin Math.random() ni heurísticas — determinista por frame.
 *
 * INTERACCIÓN CON L0:
 *   L0 (LiquidAetherAdapter) emite 'brightness' como modulación energética.
 *   L1 (este adapter) emite r, g, b como paleta musical.
 *   NodeArbiter los combina: brightness vía LTP × nodo, r/g/b vía LTP L1.
 *
 * @module core/aether/adapters/ColorAdapter
 * @version WAVE 4522.3
 */

import { NodeFamily } from '../types'
import type { IColorNodeData } from '../capability-node'
import type { INodeView } from '../node-graph'
import type { IIntentBus, INodeIntent } from '../intent-bus'
import { BaseSystem, type IAetherSystem, type FrameContext } from '../systems'
import { selectColorRoleFromZone } from './zoneUtils'

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACE PÚBLICA — Contrato de ingesta cromática
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Componente RGB normalizado (0-255, entero o float).
 * Estructura compatible con SeleneLuxOutput.palette.*
 */
export interface RgbColor {
  readonly r: number
  readonly g: number
  readonly b: number
}

/**
 * Paleta cromática RGB indexada por rol.
 * Producida por SeleneLux y pasada al ColorAdapter en cada frame.
 *
 * La responsabilidad de computar estos colores no pertenece a este
 * adapter — solo los consume y mapea a intents.
 */
export interface IColorIngressPalette {
  readonly primary:   RgbColor
  readonly secondary: RgbColor
  readonly accent:    RgbColor
  readonly ambient:   RgbColor
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Capa L1 — tinte cromático musical. Domina sobre L0 en r/g/b. */
const INTENT_PRIORITY = 10

const COLOR_SOURCE = 'color-adapter-l1'

/**
 * Paleta de fallback (negro seguro) usada hasta que el orquestador
 * llame a setIngress() por primera vez (arranque en frío, extremadamente raro).
 */
const _FALLBACK_PALETTE: IColorIngressPalette = {
  primary:   { r: 0, g: 0, b: 0 },
  secondary: { r: 0, g: 0, b: 0 },
  accent:    { r: 0, g: 0, b: 0 },
  ambient:   { r: 0, g: 0, b: 0 },
}

// ─────────────────────────────────────────────────────────────────────────────
// COLOR ADAPTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adapter L1 para nodos COLOR (wash LED, PARs tintados).
 *
 * En cada frame recibe la paleta RGB de SeleneLux via `setIngress()` antes
 * de llamar a `process()`. Clasifica cada nodo COLOR en un rol
 * (primary/secondary/accent/ambient) según su zona espacial. El color RGB
 * del rol correspondiente se normaliza y se emite como intent al IIntentBus.
 *
 * WAVE 4522.3: Reescrito desde sistema basado en LiquidEngine + paleta HSL
 * hacia ingesta directa de SeleneLuxOutput.palette (RGB 0-255).
 *
 * PATRÓN DE INGESTA:
 *   Antes de process(), el orquestador llama:
 *     colorAdapter.setIngress(engine.getLastColorPalette())
 *   Esto mantiene el contrato IAetherSystem sin modificar la firma base.
 */
export class ColorAdapter extends BaseSystem<IColorNodeData> implements IAetherSystem<IColorNodeData> {

  readonly name   = 'ColorAdapter'
  readonly family = NodeFamily.COLOR
  readonly source: string = COLOR_SOURCE

  // Paleta activa del frame actual — actualizada via setIngress() antes de process()
  private _ingress: IColorIngressPalette = _FALLBACK_PALETTE

  constructor() {
    super()
    // Pre-allocar los canales cromáticos en el scratch — zero-alloc hot path
    this._valuesDict['r'] = 0
    this._valuesDict['g'] = 0
    this._valuesDict['b'] = 0
  }

  /**
   * Actualiza la paleta cromática para el próximo frame.
   * Llamar antes de process() en el hot path del orquestador.
   *
   * @param palette - Paleta RGB 0-255 de SeleneLuxOutput
   */
  setIngress(palette: IColorIngressPalette): void {
    this._ingress = palette
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HOT-PATH — 44Hz / 60Hz
  // ─────────────────────────────────────────────────────────────────────────

  process(
    nodes: INodeView<IColorNodeData>,
    _context: FrameContext,
    bus: IIntentBus,
  ): void {
    const ingress = this._ingress

    // ── 1. Preparar invariantes del scratch para este frame
    this._intentScratch.priority = INTENT_PRIORITY
    this._intentScratch.source   = COLOR_SOURCE

    // ── 2. Iterar nodos COLOR — determinar rol, normalizar, empujar intent
    nodes.forEach((node, _index) => {
      const role = selectColorRoleFromZone(node.zoneId ?? '')
      const rgb  = ingress[role]

      // Normalización RGB 0-255 → 0.0-1.0, clampeada
      const rNorm = rgb.r < 0 ? 0 : rgb.r > 255 ? 1 : rgb.r / 255
      const gNorm = rgb.g < 0 ? 0 : rgb.g > 255 ? 1 : rgb.g / 255
      const bNorm = rgb.b < 0 ? 0 : rgb.b > 255 ? 1 : rgb.b / 255

      // Limpiar stale values de frames anteriores antes de asignar
      // (previene ghost channels si el adaptador cambia de familia de canales)
      this._valuesDict['r'] = undefined as unknown as number
      this._valuesDict['g'] = undefined as unknown as number
      this._valuesDict['b'] = undefined as unknown as number

      this._valuesDict['r'] = rNorm
      this._valuesDict['g'] = gNorm
      this._valuesDict['b'] = bNorm

      this._intentScratch.nodeId     = node.nodeId
      this._intentScratch.confidence = 1.0
      bus.push(this._intentScratch as INodeIntent)
    })
  }
}



