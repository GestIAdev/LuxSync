/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🗂️  CONFIG PANEL REGISTRY — WAVE 4548.8c
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Mapeo de ForgeNodeType → componente de configuración del inspector.
 * Null = nodo sin configuración (usa el panel genérico vacío).
 *
 * @module components/views/ForgeView/inspector/configPanelRegistry
 * @version WAVE 4548.8c
 */

import type React from 'react'
import type { ForgeNodeType, IForgeNodeConfig } from '../../../../core/forge/types'
import { LfoConfigPanel } from './panels/LfoConfigPanel'
import { MathConfigPanel } from './panels/MathConfigPanel'
import { OutputDmxConfigPanel } from './panels/OutputDmxConfigPanel'
import { SmoothConfigPanel } from './panels/SmoothConfigPanel'
import { MapRangeConfigPanel } from './panels/MapRangeConfigPanel'

// ── Tipo del prop que todos los paneles de config aceptan ────────────────

export interface ConfigPanelProps<T extends IForgeNodeConfig> {
  config: T
  onChange: (partial: Partial<T>) => void
}

// ── Tipo genérico para el mapa ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyConfigPanel = React.FC<ConfigPanelProps<any>>

// ── Registry ────────────────────────────────────────────────────────────

export const CONFIG_PANEL_MAP: Partial<Record<ForgeNodeType, AnyConfigPanel>> = {
  proc_lfo:         LfoConfigPanel,
  proc_smooth:      SmoothConfigPanel,
  proc_math:        MathConfigPanel,
  proc_map_range:   MapRangeConfigPanel,
  output_dmx:       OutputDmxConfigPanel,
}

/**
 * Devuelve el panel de configuración para un ForgeNodeType, o null si no hay.
 */
export function getConfigPanel(type: ForgeNodeType): AnyConfigPanel | null {
  return CONFIG_PANEL_MAP[type] ?? null
}
