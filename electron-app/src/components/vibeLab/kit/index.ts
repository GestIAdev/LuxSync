/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 index.ts — Barrel export for the Instrument Kit
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @module components/vibeLab/kit
 * @version FASE 2 — The Instrument Kit
 */

export { GeneSlider } from './GeneSlider'
export { TwinGeneSlider } from './TwinGeneSlider'
export { GeneToggle } from './GeneToggle'
export { GeneSegmented } from './GeneSegmented'
export { GeneNumberField } from './GeneNumberField'
export { MacroGeneDial } from './MacroGeneDial'
export { GenePanel } from './GenePanel'
export { SafetyInterlock } from './SafetyInterlock'
export { MutationBadge } from './MutationBadge'

export type {
  GeneVisualState,
  GeneTier,
  GenePath,
  BaseGeneProps,
  GeneSliderProps,
  TwinGeneSliderProps,
  GeneToggleProps,
  SegmentedOption,
  GeneSegmentedProps,
  GeneNumberFieldProps,
  MacroGeneDialProps,
  GenePanelProps,
  SafetyInterlockProps,
  MutationBadgeProps,
} from './types'
