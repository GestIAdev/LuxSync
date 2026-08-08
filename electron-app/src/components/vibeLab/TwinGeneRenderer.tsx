/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎚️ TwinGeneRenderer.tsx — Renders a TwinGeneSlider from a pair of genes
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Some genes form natural min/max pairs (morphFloor + morphCeiling,
 * minDuration + maxDuration, floor + ceiling). The GeneRenderer returns
 * `null` for `control === 'twin'` because it needs both genes together.
 *
 * This component reads both scalar values via `useGene`, combines them into
 * a `[min, max]` tuple, and renders a single `TwinGeneSlider`. On change,
 * it writes both values back separately via `setGene`.
 *
 * @module components/vibeLab/TwinGeneRenderer
 * @version FASE 4.3 — THE GHOST IN THE MACHINE
 */

import React, { memo, useMemo, useCallback } from 'react'
import { TwinGeneSlider } from './kit'
import type { GeneDescriptor } from './geneRegistry'
import { GENE_RANGES } from '../../engine/vibe/custom/GENE_RANGES'
import { useVibeLabStore, useGene } from '../../stores/vibeLabStore'
import { resolveBaseValueNumber } from './resolveBaseValue'

interface TwinGeneRendererProps {
  /** The "min" gene of the pair (e.g. morphFloor). */
  minDescriptor: GeneDescriptor
  /** The "max" gene of the pair (e.g. morphCeiling). */
  maxDescriptor: GeneDescriptor
  /** Label for the combined slider. */
  label: string
  baseDNA: string
}

export const TwinGeneRenderer: React.FC<TwinGeneRendererProps> = memo(
  ({ minDescriptor, maxDescriptor, label, baseDNA }) => {
    const minPath = minDescriptor.path
    const maxPath = maxDescriptor.path

    const minRange = GENE_RANGES[minPath]
    const maxRange = GENE_RANGES[maxPath]
    const range = minRange ?? maxRange

    const baseMin = useMemo(() => resolveBaseValueNumber(minPath, baseDNA), [minPath, baseDNA])
    const baseMax = useMemo(() => resolveBaseValueNumber(maxPath, baseDNA), [maxPath, baseDNA])

    const { value: minVal, isMutated: minMut } = useGene<number>(minPath, baseMin)
    const { value: maxVal, isMutated: maxMut } = useGene<number>(maxPath, baseMax)

    const setGene = useVibeLabStore((s) => s.setGene)
    const revertGene = useVibeLabStore((s) => s.revertGene)

    const isMutated = minMut || maxMut

    const handleChange = useCallback(
      (v: [number, number]) => {
        setGene(minPath, v[0])
        setGene(maxPath, v[1])
      },
      [setGene, minPath, maxPath],
    )

    const handleRevert = useCallback(() => {
      revertGene(minPath)
      revertGene(maxPath)
    }, [revertGene, minPath, maxPath])

    if (!range) return null

    return (
      <TwinGeneSlider
        path={`${minPath}+${maxPath}`}
        label={label}
        baseValue={[baseMin, baseMax]}
        value={[minVal, maxVal]}
        min={range.min}
        max={range.max}
        step={range.step}
        unit={minDescriptor.unit ?? range.unit}
        isMutated={isMutated}
        tier={minDescriptor.tier}
        onChange={handleChange}
        onRevert={handleRevert}
      />
    )
  },
)

TwinGeneRenderer.displayName = 'TwinGeneRenderer'
