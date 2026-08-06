/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 kit types.ts — Shared TypeScript interfaces for the Instrument Kit
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Todos los componentes del kit comparten estos tipos. Los 5 estados visuales
 * están modelados como un union type para que el consumidor no pueda pasar
 * combinaciones inválidas.
 *
 * @module components/vibeLab/kit/types
 * @version FASE 2 — The Instrument Kit
 */

import type { ReactNode } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// ESTADOS VISUALES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Los 5 estados visuales de toda primitiva del kit.
 *
 * - `inherited`      — El valor es el del baseDNA. Track gris, sin glow.
 * - `mutated`        — El usuario lo modificó. Glow del accent, botón ⟲ visible.
 * - `danger`         — El valor está en zona de riesgo (banda roja visible).
 * - `sealed`         — Parámetro de seguridad bloqueado. Candado, disabled.
 * - `locked-by-basic`— Sólo visible en modo RAW. En SHIELDED se oculta.
 */
export type GeneVisualState = 'inherited' | 'mutated' | 'danger' | 'sealed' | 'locked-by-basic'

/**
 * Tier de seguridad del gen (de GENE_RANGES).
 * - `safe` — Visible en SHIELDED.
 * - `raw`  — Sólo visible en RAW.
 */
export type GeneTier = 'safe' | 'raw'

// ═══════════════════════════════════════════════════════════════════════════
// PROPS COMPARTIDOS
// ═══════════════════════════════════════════════════════════════════════════

/** Ruta dot-notation del gen dentro del documento. */
export type GenePath = string

/** Props comunes a toda primitiva de gen. */
export interface BaseGeneProps {
  /** Ruta del gen (p.ej. 'physics.transient.percBoost'). */
  readonly path: GenePath
  /** Etiqueta legible (p.ej. 'Perc Boost'). */
  readonly label: string
  /** Valor heredado del ADN base (para el fantasma). */
  readonly baseValue: unknown
  /** Tier: `safe` = visible en SHIELDED, `raw` = sólo en RAW. */
  readonly tier: GeneTier
  /** ¿Está mutado respecto al baseDNA? */
  readonly isMutated: boolean
  /** Callback al revertir al valor base. */
  readonly onRevert: () => void
}

// ═══════════════════════════════════════════════════════════════════════════
// PROPS ESPECÍFICOS
// ═══════════════════════════════════════════════════════════════════════════

/** Props del GeneSlider (slider de un valor). */
export interface GeneSliderProps extends BaseGeneProps {
  readonly value: number
  readonly min: number
  readonly max: number
  readonly step: number
  /** Unidad opcional (p.ej. 'Hz', 'ms', 'DMX/s²'). */
  readonly unit?: string
  /** Rango de peligro [start, end] dentro de [min, max]. */
  readonly danger?: readonly [number, number]
  /** ¿Está sellado (parámetro de seguridad)? */
  readonly isSealed?: boolean
  /** ¿Está en zona de peligro actualmente? */
  readonly isInDanger?: boolean
  /** Callback al cambiar el valor. */
  readonly onChange: (value: number) => void
}

/** Props del TwinGeneSlider (slider de rango min/max). */
export interface TwinGeneSliderProps extends Omit<BaseGeneProps, 'baseValue'> {
  readonly value: readonly [number, number]
  readonly baseValue: readonly [number, number]
  readonly min: number
  readonly max: number
  readonly step: number
  readonly unit?: string
  readonly isSealed?: boolean
  /** Callback al cambiar el rango. */
  readonly onChange: (value: [number, number]) => void
}

/** Props del GeneToggle (booleano). */
export interface GeneToggleProps extends BaseGeneProps {
  readonly value: boolean
  readonly baseValue: boolean
  readonly isSealed?: boolean
  /** Callback al cambiar el valor. */
  readonly onChange: (value: boolean) => void
}

/** Opción del GeneSegmented. */
export interface SegmentedOption<T extends string = string> {
  readonly label: string
  readonly value: T
  readonly icon?: string
}

/** Props del GeneSegmented (enum como botones). */
export interface GeneSegmentedProps<T extends string = string> extends Omit<BaseGeneProps, 'baseValue'> {
  readonly value: T
  readonly baseValue: T
  readonly options: readonly SegmentedOption<T>[]
  readonly isSealed?: boolean
  readonly onChange: (value: T) => void
}

/** Props del GeneNumberField (entrada numérica precisa). */
export interface GeneNumberFieldProps extends BaseGeneProps {
  readonly value: number
  readonly baseValue: number
  readonly min: number
  readonly max: number
  readonly step: number
  readonly unit?: string
  readonly precision?: number
  readonly isSealed?: boolean
  /** Callback al cambiar el valor. */
  readonly onChange: (value: number) => void
}

/** Props del MacroGeneDial (dial circular 0..1). */
export interface MacroGeneDialProps {
  readonly id: string
  readonly label: string
  readonly icon: string
  readonly accentHex: string
  readonly description: string
  readonly value: number
  readonly onChange: (value: number) => void
}

/** Props del GenePanel (acordeón colapsable). */
export interface GenePanelProps {
  readonly id: string
  readonly title: string
  readonly icon: ReactNode
  readonly accent: string
  readonly tier: GeneTier
  /** Nº de genes mutados dentro del panel. */
  readonly mutatedCount: number
  /** ¿Está expandido? */
  readonly isExpanded: boolean
  readonly onToggle: () => void
  readonly children: ReactNode
}

/** Props del SafetyInterlock (toggle SHIELDED/RAW). */
export interface SafetyInterlockProps {
  readonly mode: 'shielded' | 'raw'
  readonly onChange: (mode: 'shielded' | 'raw') => void
  /** Callback de confirmación la primera vez que se pasa a RAW. */
  readonly onConfirmRaw?: () => void
}

/** Props del MutationBadge (badge hexagonal con contador). */
export interface MutationBadgeProps {
  readonly count: number
  readonly accent?: string
}
