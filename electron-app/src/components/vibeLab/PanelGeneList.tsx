/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 PanelGeneList.tsx — Renders all genes for a panel with twin grouping
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The GeneRenderer returns `null` for `control === 'twin'` because twin genes
 * need to be rendered as a pair (min/max) in a single TwinGeneSlider. This
 * component groups twin genes by their parent path prefix, renders each pair
 * via TwinGeneRenderer, and renders the remaining genes (slider, number) via
 * GeneRenderer.
 *
 * Twin grouping logic:
 *   - Genes with `control === 'twin'` are grouped by their parent path
 *     (e.g. `physics.morph.morphFloor` → parent `physics.morph`).
 *   - If a group has exactly 2 genes, they form a min/max pair → TwinGeneRenderer.
 *   - If a group has 1 gene (unpaired twin), it falls back to GeneRenderer
 *     with control overridden to 'slider' so it actually renders.
 *
 * @module components/vibeLab/PanelGeneList
 * @version FASE 3
 */

import React, { memo, useMemo } from 'react'
import type { GeneDescriptor } from './geneRegistry'
import { GeneRenderer } from './GeneRenderer'
import { TwinGeneRenderer } from './TwinGeneRenderer'

interface PanelGeneListProps {
  genes: GeneDescriptor[]
  baseDNA: string
}

/** Extract the parent path (everything except the last dot-segment). */
function parentPath(path: string): string {
  const idx = path.lastIndexOf('.')
  return idx > 0 ? path.slice(0, idx) : path
}

/** Derive a human-readable label from the parent path. */
function parentLabel(path: string): string {
  const parent = parentPath(path)
  const last = parent.split('.').pop() ?? parent
  return last
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
}

export const PanelGeneList: React.FC<PanelGeneListProps> = memo(({ genes, baseDNA }) => {
  const { twinPairs, singletons } = useMemo(() => {
    // Group twin genes by parent path
    const twinGroups = new Map<string, GeneDescriptor[]>()
    const singles: GeneDescriptor[] = []

    for (const gene of genes) {
      if (gene.control === 'twin') {
        const parent = parentPath(gene.path)
        const group = twinGroups.get(parent)
        if (group) {
          group.push(gene)
        } else {
          twinGroups.set(parent, [gene])
        }
      } else {
        singles.push(gene)
      }
    }

    // Collect pairs and unpaired twins
    const pairs: Array<{ min: GeneDescriptor; max: GeneDescriptor; label: string }> = []
    for (const [parent, group] of twinGroups) {
      if (group.length === 2) {
        // Sort by path to get deterministic min/max ordering
        const [min, max] = group[0].path < group[1].path ? [group[0], group[1]] : [group[1], group[0]]
        pairs.push({ min, max, label: parentLabel(group[0].path) })
      } else {
        // Unpaired twin → render as singleton (GeneRenderer will handle it
        // because we override control to 'slider' below)
        for (const g of group) {
          singles.push({ ...g, control: 'slider' as const })
        }
      }
    }

    return { twinPairs: pairs, singletons: singles }
  }, [genes])

  return (
    <>
      {twinPairs.map((pair) => (
        <TwinGeneRenderer
          key={`${pair.min.path}+${pair.max.path}`}
          minDescriptor={pair.min}
          maxDescriptor={pair.max}
          label={pair.label}
          baseDNA={baseDNA}
        />
      ))}
      {singletons.map((gene) => (
        <GeneRenderer
          key={gene.path}
          descriptor={gene}
          baseDNA={baseDNA}
        />
      ))}
    </>
  )
})

PanelGeneList.displayName = 'PanelGeneList'
