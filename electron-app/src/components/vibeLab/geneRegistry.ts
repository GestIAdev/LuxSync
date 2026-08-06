/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 geneRegistry.ts — THE GENOME ATLAS (Phase 3)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Maps every gene path from `GENE_RANGES` (437 entries) to a `GeneDescriptor`
 * carrying UI metadata: which tab, which panel, which control type, and a
 * human-readable label.
 *
 * The registry is built PROGRAMMATICALLY by iterating over `GENE_RANGES` and
 * deriving tab / panel / control from the dot-notation path prefix. This
 * guarantees the UI never drifts from the SSOT table — if a gene is added to
 * `GENE_RANGES`, it automatically appears in the registry (or throws at
 * module-load time if no path rule matches).
 *
 * ── PANEL STRUCTURE ─────────────────────────────────────────────────────────
 * Three tabs (physics / color / movement), each split into thematic panels.
 * Panel display names live in `PANEL_META` (the thematic names from the
 * blueprint). Helper functions `getGenesByPanel` and `getPanelsByTab` drive
 * the rendering loop of the VibeLab bench.
 *
 * @module components/vibeLab/geneRegistry
 * @version FASE 3 — The Genome Atlas
 */

import type { GenomeTab, InterlockMode } from '../../stores/vibeLabStore'
import type { GenePath } from './kit/types'
import type { GeneRange } from '../../engine/vibe/custom/GENE_RANGES'
import {
  GENE_RANGES,
  ENVELOPE_GENE_RANGES,
  SCHEDULER_GENE_RANGES,
} from '../../engine/vibe/custom/GENE_RANGES'
import { ENVELOPE_SLOTS } from '../../types/CustomVibe'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Control type rendered by the bench for a given gene. */
export type GeneControl =
  | 'slider'
  | 'twin'
  | 'toggle'
  | 'segmented'
  | 'number'
  | 'color'
  | 'custom'

/**
 * UI metadata for a single gene. One entry per path in `GENE_RANGES`.
 */
export interface GeneDescriptor {
  /** Dot-notation path, same as `GENE_RANGES` key. */
  readonly path: GenePath
  /** Human-readable label. */
  readonly label: string
  /** Tab: 'physics' | 'color' | 'movement'. */
  readonly tab: GenomeTab
  /** Panel id within the tab. */
  readonly panel: string
  /** Exposure tier — from `GENE_RANGES`, possibly overridden to 'raw'. */
  readonly tier: 'safe' | 'raw'
  /** Control type the bench renders. */
  readonly control: GeneControl
  /** Unit suffix (e.g. 'ms', 'K', '°') — from `GENE_RANGES`. */
  readonly unit?: string
  /** Options for segmented controls (currently unused — reserved). */
  readonly options?: readonly { label: string; value: string }[]
  /** Danger sub-range `[from, to]` painted red on the slider track. */
  readonly danger?: readonly [number, number]
}

// ═══════════════════════════════════════════════════════════════════════════
// LABEL GENERATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert a camelCase / PascalCase string to Title Case.
 *
 *   "percBoost"           → "Perc Boost"
 *   "ambientAttackMs"     → "Ambient Attack Ms"
 *   "sustainedSquelchStartFrames" → "Sustained Squelch Start Frames"
 *   "gateOn"              → "Gate On"
 *
 * Digit-to-letter boundaries are also split (e.g. "base64Key" → "Base 64 Key")
 * so that unit suffixes like "Ms" stay as standalone words.
 */
function camelToTitle(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
}

/**
 * Derive a human-readable label from a gene path.
 *
 * The last dot-segment is converted from camelCase to Title Case. This works
 * uniformly for:
 *   - Regular genes:  "physics.transient.percBoost" → "Perc Boost"
 *   - Envelope genes: "physics.envelopes.envelopeKick.gateOn" → "Gate On"
 *   - Scheduler genes: "movement.scheduler.drift.cycleBeats" → "Cycle Beats"
 */
function labelFromPath(path: string): string {
  const segments = path.split('.')
  const last = segments[segments.length - 1]
  return camelToTitle(last)
}

// ═══════════════════════════════════════════════════════════════════════════
// PATH → PANEL RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

/** Internal rule for mapping a path prefix to tab / panel / control. */
interface PathRule {
  readonly tab: GenomeTab
  readonly panel: string
  readonly control: GeneControl
  /** When set, forces tier to 'raw' regardless of the underlying GeneRange. */
  readonly forceRaw?: boolean
}

/**
 * Resolve a gene path to its UI rule (tab, panel, control).
 *
 * Order matters: more specific prefixes are tested before generic ones.
 * Throws if a path has no matching rule — this is intentional: it surfaces
 * unmapped genes at module-load time instead of silently dropping them.
 */
function resolvePathRule(path: string): PathRule {
  // ── PHYSICS ──────────────────────────────────────────────────────────────
  if (path.startsWith('physics.envelopes.')) {
    return { tab: 'physics', panel: 'envelopes', control: 'custom' }
  }
  if (path.startsWith('physics.overrides41.')) {
    return { tab: 'physics', panel: 'overrides41', control: 'slider', forceRaw: true }
  }
  if (path.startsWith('physics.transient.')) {
    return { tab: 'physics', panel: 'transient', control: 'slider' }
  }
  if (path.startsWith('physics.separation.')) {
    return { tab: 'physics', panel: 'separation', control: 'slider' }
  }
  if (path.startsWith('physics.sidechain.')) {
    return { tab: 'physics', panel: 'sidechain', control: 'slider' }
  }
  if (path.startsWith('physics.strobe.')) {
    return { tab: 'physics', panel: 'strobe', control: 'slider' }
  }
  if (path.startsWith('physics.modes.')) {
    return { tab: 'physics', panel: 'modes', control: 'slider' }
  }
  if (path.startsWith('physics.morph.')) {
    return { tab: 'physics', panel: 'morph', control: 'twin' }
  }
  if (path.startsWith('physics.kick.')) {
    return { tab: 'physics', panel: 'kick', control: 'slider' }
  }
  if (path.startsWith('physics.ambient.')) {
    return { tab: 'physics', panel: 'ambient', control: 'slider' }
  }

  // ── COLOR ────────────────────────────────────────────────────────────────
  if (path.startsWith('color.hue.')) {
    return { tab: 'color', panel: 'wheel', control: 'slider' }
  }
  if (path.startsWith('color.thermal.')) {
    return { tab: 'color', panel: 'thermal', control: 'slider' }
  }
  if (path.startsWith('color.luminance.')) {
    return { tab: 'color', panel: 'luminance', control: 'twin' }
  }
  if (path.startsWith('color.mudGuard.')) {
    return { tab: 'color', panel: 'sanitized', control: 'slider' }
  }
  if (path.startsWith('color.neonProtocol.')) {
    return { tab: 'color', panel: 'sanitized', control: 'slider' }
  }
  if (path.startsWith('color.harmony.')) {
    return { tab: 'color', panel: 'harmony', control: 'slider' }
  }
  if (path.startsWith('color.accent.')) {
    return { tab: 'color', panel: 'accent', control: 'slider' }
  }
  if (path.startsWith('color.transitions.')) {
    // minDuration + maxDuration form a twin pair
    return { tab: 'color', panel: 'transitions', control: 'twin' }
  }
  if (path.startsWith('color.dimming.')) {
    // floor + ceiling form a twin pair
    return { tab: 'color', panel: 'transitions', control: 'twin' }
  }
  if (path.startsWith('color.siderealClock.')) {
    return { tab: 'color', panel: 'sidereal', control: 'slider' }
  }
  if (path.startsWith('color.oceanicModulation.')) {
    return { tab: 'color', panel: 'oceanic', control: 'slider', forceRaw: true }
  }

  // ── MOVEMENT ─────────────────────────────────────────────────────────────
  if (path.startsWith('movement.scheduler.')) {
    return { tab: 'movement', panel: 'scheduler', control: 'slider' }
  }
  if (path.startsWith('movement.kinematics.')) {
    return { tab: 'movement', panel: 'reach', control: 'slider' }
  }
  if (path.startsWith('movement.stereo.')) {
    return { tab: 'movement', panel: 'ensemble', control: 'slider' }
  }
  if (path === 'movement.tiltOffset') {
    return { tab: 'movement', panel: 'reach', control: 'slider' }
  }
  if (path.startsWith('movement.physics.')) {
    return { tab: 'movement', panel: 'gearbox', control: 'slider' }
  }
  // Lens: zoomRange + focusRange are a twin pair; other optics genes are sliders
  if (path === 'movement.optics.zoomRange' || path === 'movement.optics.focusRange') {
    return { tab: 'movement', panel: 'lens', control: 'twin' }
  }
  if (path.startsWith('movement.optics.')) {
    return { tab: 'movement', panel: 'lens', control: 'slider' }
  }
  if (path.startsWith('movement.behavior.')) {
    return { tab: 'movement', panel: 'instinct', control: 'slider' }
  }
  if (path.startsWith('movement.spatial.')) {
    return { tab: 'movement', panel: 'fan', control: 'slider' }
  }
  if (path.startsWith('movement.grandMaster.')) {
    return { tab: 'movement', panel: 'grandmaster', control: 'slider' }
  }

  // If we reach here, a gene was added to GENE_RANGES without a matching rule.
  throw new Error(`[geneRegistry] Unmapped gene path — add a rule: "${path}"`)
}

// ═══════════════════════════════════════════════════════════════════════════
// REGISTRY CONSTRUCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a single `GeneDescriptor` from a GENE_RANGES entry.
 */
function buildDescriptor(path: string, range: GeneRange): GeneDescriptor {
  const rule = resolvePathRule(path)
  return {
    path,
    label: labelFromPath(path),
    tab: rule.tab,
    panel: rule.panel,
    tier: rule.forceRaw ? 'raw' : range.tier,
    control: rule.control,
    unit: range.unit,
    danger: range.danger as readonly [number, number] | undefined,
  }
}

/**
 * THE GENOME ATLAS — one `GeneDescriptor` per entry in `GENE_RANGES`.
 *
 * Built once at module load. The array is frozen (readonly) to prevent
 * accidental mutation by consumers.
 */
export const GENE_REGISTRY: readonly GeneDescriptor[] = Object.entries(GENE_RANGES).map(
  ([path, range]) => buildDescriptor(path, range),
)

// ═══════════════════════════════════════════════════════════════════════════
// PANEL METADATA
// ═══════════════════════════════════════════════════════════════════════════

/** Display metadata for each panel: thematic name + icon. */
export const PANEL_META: Readonly<Record<string, { title: string; icon: string }>> = {
  // ── PHYSICS ──
  envelopes:   { title: 'THE SIX CHAMBERS',         icon: '🏛️' },
  morph:       { title: 'MORPHOLOGY',               icon: '🌀' },
  transient:   { title: 'THE SCHWARZENEGGER',       icon: '💪' },
  separation:  { title: 'THE SEPARATION MATRIX',    icon: '🔀' },
  sidechain:   { title: 'THE GUILLOTINE',           icon: '🔪' },
  strobe:      { title: 'THE FLASH GATE',           icon: '⚡' },
  modes:       { title: 'ACID/NOISE/APOCALYPSE',    icon: '☢️' },
  kick:        { title: 'THE METRONOME',            icon: '🥁' },
  ambient:     { title: 'VISCOSITY',                icon: '🌫️' },
  routing:     { title: 'THE ROUTING BAY',          icon: '🔌' },
  overrides41: { title: 'THE COMPACT MIRROR',       icon: '🪞' },

  // ── COLOR ──
  wheel:       { title: 'THE FORBIDDEN WHEEL',      icon: '🎡' },
  thermal:     { title: 'THERMAL GRAVITY',          icon: '🌡️' },
  remapping:   { title: 'THE TRANSMUTATION TABLE',  icon: '⚗️' },
  luminance:   { title: 'THE LUMINANCE GATE',       icon: '💡' },
  sanitized:   { title: 'MUD GUARD / NEON PROTOCOL',icon: '🧼' },
  harmony:     { title: 'THE HARMONY ENGINE',       icon: '🎵' },
  accent:      { title: 'THE ACCENT REACTOR',       icon: '💥' },
  transitions: { title: 'THE GLACIER',              icon: '🧊' },
  sidereal:    { title: 'THE SIDEREAL CAROUSEL',    icon: '🎠' },
  oceanic:     { title: 'THE ABYSS',                icon: '🌊' },

  // ── MOVEMENT ──
  patterns:    { title: 'THE ORBIT VAULT',          icon: '🌍' },
  scheduler:   { title: 'THE SCHEDULER DECK',       icon: '🎛️' },
  reach:       { title: 'THE REACH',                icon: '📏' },
  ensemble:    { title: 'THE ENSEMBLE',             icon: '🎭' },
  gearbox:     { title: 'THE GEARBOX',              icon: '⚙️' },
  lens:        { title: 'THE LENS',                 icon: '🔍' },
  instinct:    { title: 'THE INSTINCT',             icon: '🧠' },
  fan:         { title: 'THE FAN ARRAY',            icon: '🌀' },
  grandmaster: { title: 'GRANDMASTER',              icon: '🎚️' },
} as const

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Return all gene descriptors for a given panel, filtered by interlock mode.
 *
 * - `shielded` → only `tier: 'safe'` genes are returned.
 * - `raw`      → all genes (safe + raw) are returned.
 *
 * @param panelId   Panel id (e.g. 'transient', 'luminance', 'gearbox').
 * @param interlock Current interlock mode of the bench.
 */
export function getGenesByPanel(
  panelId: string,
  interlock: InterlockMode,
): GeneDescriptor[] {
  return GENE_REGISTRY.filter(
    (g) =>
      g.panel === panelId &&
      (interlock === 'raw' || g.tier === 'safe'),
  )
}

/**
 * Return the unique panel ids that contain at least one gene for a given tab.
 *
 * Panels with only custom (non-numeric) controls — like `routing`, `wheel`,
 * `remapping`, `patterns` — are included here so the bench can render their
 * custom components even though they have no entries in `GENE_RANGES`.
 *
 * @param tab  One of 'physics' | 'color' | 'movement'.
 */
export function getPanelsByTab(tab: GenomeTab): string[] {
  // Collect panels that have numeric genes in the registry
  const panels = new Set<string>()
  for (const gene of GENE_REGISTRY) {
    if (gene.tab === tab) {
      panels.add(gene.panel)
    }
  }

  // Add custom-only panels (no GENE_RANGES entries but still part of the tab)
  const customPanels: Record<GenomeTab, readonly string[]> = {
    physics: ['routing'],
    color: ['wheel', 'remapping'],
    movement: ['patterns'],
  }
  for (const p of customPanels[tab]) {
    panels.add(p)
  }

  // Return in blueprint order (not insertion order) for stable UI layout
  const order: Record<GenomeTab, readonly string[]> = {
    physics: [
      'envelopes', 'morph', 'transient', 'separation', 'sidechain',
      'strobe', 'modes', 'kick', 'ambient', 'routing', 'overrides41',
    ],
    color: [
      'wheel', 'thermal', 'remapping', 'luminance', 'sanitized',
      'harmony', 'accent', 'transitions', 'sidereal', 'oceanic',
    ],
    movement: [
      'patterns', 'scheduler', 'reach', 'ensemble', 'gearbox',
      'lens', 'instinct', 'fan', 'grandmaster',
    ],
  }

  return order[tab].filter((p) => panels.has(p))
}

// ═══════════════════════════════════════════════════════════════════════════
// RE-EXPORTS (convenience for consumers)
// ═══════════════════════════════════════════════════════════════════════════

export {
  GENE_RANGES,
  ENVELOPE_GENE_RANGES,
  SCHEDULER_GENE_RANGES,
  ENVELOPE_SLOTS,
}
