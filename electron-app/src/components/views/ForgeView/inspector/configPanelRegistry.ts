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
import { InputDmxConfigPanel } from './panels/InputDmxConfigPanel'
import { InputAudioBandConfigPanel } from './panels/InputAudioBandConfigPanel'
import { InputConstantConfigPanel } from './panels/InputConstantConfigPanel'
import { LfoConfigPanel } from './panels/LfoConfigPanel'
import { MathConfigPanel } from './panels/MathConfigPanel'
import { OutputDmxConfigPanel } from './panels/OutputDmxConfigPanel'
import { SmoothConfigPanel } from './panels/SmoothConfigPanel'
import { MapRangeConfigPanel } from './panels/MapRangeConfigPanel'
import { ProcClampConfigPanel } from './panels/ProcClampConfigPanel'
import { ProcDelayConfigPanel } from './panels/ProcDelayConfigPanel'
import { ProcMergeConfigPanel } from './panels/ProcMergeConfigPanel'
import { ProcCurveConfigPanel } from './panels/ProcCurveConfigPanel'
import { LogicGateConfigPanel } from './panels/LogicGateConfigPanel'
import { LogicThresholdConfigPanel } from './panels/LogicThresholdConfigPanel'
import { LogicCounterConfigPanel } from './panels/LogicCounterConfigPanel'
import { LogicSwitchConfigPanel } from './panels/LogicSwitchConfigPanel'

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
  // ── INPUTS ──────────────────────────────────────────────────────────────
  input_dmx:          InputDmxConfigPanel,
  input_audio_band:   InputAudioBandConfigPanel,
  input_constant:     InputConstantConfigPanel,
  // ── PROCESS ─────────────────────────────────────────────────────────────
  proc_lfo:           LfoConfigPanel,
  proc_smooth:        SmoothConfigPanel,
  proc_math:          MathConfigPanel,
  proc_map_range:     MapRangeConfigPanel,
  proc_clamp:         ProcClampConfigPanel,
  proc_delay:         ProcDelayConfigPanel,
  proc_merge:         ProcMergeConfigPanel,
  proc_curve:         ProcCurveConfigPanel,
  // ── LOGIC ───────────────────────────────────────────────────────────────  logic_gate:         LogicGateConfigPanel,  logic_threshold:    LogicThresholdConfigPanel,
  logic_counter:      LogicCounterConfigPanel,
  logic_switch:       LogicSwitchConfigPanel,
  // ── OUTPUT ──────────────────────────────────────────────────────────────
  output_dmx:         OutputDmxConfigPanel,
}

/**
 * Devuelve el panel de configuración para un ForgeNodeType, o null si no hay.
 */
export function getConfigPanel(type: ForgeNodeType): AnyConfigPanel | null {
  const panel = CONFIG_PANEL_MAP[type] ?? null
  if (!panel) {
    console.warn(`[NodeInspector] No dedicated config panel registered for node type: ${type}`)
  }
  return panel
}
