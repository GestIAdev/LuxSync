/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 NODE COLORS — WAVE 4548.8c
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Paleta de colores estética "Cyberpunk Industrial" para el canvas del Forge.
 * Mapea categorías y DataTypes a colores.
 *
 * @module components/views/ForgeView/nodes/nodeColors
 * @version WAVE 4548.8c
 */

import type { ForgeDataType, ForgeNodeCategory } from '../../../../core/forge/types'

// ── Colores por categoría ────────────────────────────────────────────────

export const CATEGORY_COLORS: Record<ForgeNodeCategory, string> = {
  input:    '#00f3ff',  // Cyan eléctrico
  process:  '#39ff14',  // Verde neón
  logic:    '#ffb800',  // Amarillo ámbar
  output:   '#ff2d55',  // Rojo industrial
  compound: '#bf5af2',  // Violeta profundo
}

export const CATEGORY_GLOW: Record<ForgeNodeCategory, string> = {
  input:    'rgba(0, 243, 255, 0.18)',
  process:  'rgba(57, 255, 20, 0.18)',
  logic:    'rgba(255, 184, 0, 0.18)',
  output:   'rgba(255, 45, 85, 0.18)',
  compound: 'rgba(191, 90, 242, 0.18)',
}

// ── Colores por DataType (handles de puertos) ────────────────────────────

export const DATA_TYPE_COLORS: Record<ForgeDataType, string> = {
  normalized: '#ffffff',  // blanco
  dmx:        '#ff6b35',  // naranja
  boolean:    '#ffb800',  // ámbar
  frequency:  '#00f3ff',  // cyan
  angle:      '#bf5af2',  // violeta
  unbounded:  '#71717a',  // gris
}

export function getCategoryColor(cat: ForgeNodeCategory): string {
  return CATEGORY_COLORS[cat] ?? '#71717a'
}

export function getCategoryGlow(cat: ForgeNodeCategory): string {
  return CATEGORY_GLOW[cat] ?? 'transparent'
}

export function getDataTypeColor(dt: ForgeDataType): string {
  return DATA_TYPE_COLORS[dt] ?? '#71717a'
}
