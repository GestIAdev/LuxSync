/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔣 NODE ICONS — WAVE 4548.8c
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Emojis/símbolos compactos por ForgeNodeType para las tarjetas de nodo.
 *
 * @module components/views/ForgeView/nodes/nodeIcons
 * @version WAVE 4548.8c
 */

import type { ForgeNodeType } from '../../../../core/forge/types'

export const NODE_ICONS: Record<ForgeNodeType, string> = {
  // Input
  input_dmx:         '📥',
  input_audio_band:  '🎵',
  input_beat:        '🥁',
  input_bpm:         '⏱',
  input_energy:      '⚡',
  input_constant:    '🔢',
  input_time:        '⏲',
  // Process
  proc_lfo:          '∿',
  proc_smooth:       '〜',
  proc_map_range:    '↔',
  proc_math:         '±',
  proc_clamp:        '⊡',
  proc_delay:        '⏳',
  proc_merge:        '⊕',
  proc_invert:       '⊖',
  proc_curve:        '∫',
  // Logic
  logic_threshold:   '▶',
  logic_gate:        '⊠',
  logic_switch:      '⊗',
  logic_and:         '∧',
  logic_or:          '∨',
  logic_counter:     '#',
  // Output
  output_dmx:        '📤',
  // Compound
  compound_ingenio:  '🧬',
}

export function getNodeIcon(type: ForgeNodeType): string {
  return NODE_ICONS[type] ?? '⬡'
}
