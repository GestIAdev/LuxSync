/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 GeneRenderer.tsx — Maps a GeneDescriptor to the right kit primitive
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Dado un GeneDescriptor del registry, renderiza el componente de kit
 * correspondiente (GeneSlider, TwinGeneSlider, GeneToggle, etc.) ya
 * conectado al Zustand store vía `useGene`.
 *
 * REGLA DE BINDING: cada primitiva se suscribe a SU path vía `useGene`,
 * nunca al draft entero.
 *
 * @module components/vibeLab/GeneRenderer
 * @version FASE 4.3 — THE GHOST IN THE MACHINE
 */

import React, { memo, useMemo } from 'react'
import {
  GeneSlider,
  TwinGeneSlider,
  GeneNumberField,
} from './kit'
import type { GeneDescriptor } from './geneRegistry'
import { GENE_RANGES, getGeneRange, isInDangerZone } from '../../engine/vibe/custom/GENE_RANGES'
import { useVibeLabStore, useGene } from '../../stores/vibeLabStore'
import { resolveBaseValue, resolveBaseValueNumber } from './resolveBaseValue'

// ═══════════════════════════════════════════════════════════════════════════
// BASE VALUE RESOLVER — delegates to the shared canonical resolver
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resuelve el valor base de un gen desde el ADN canónico.
 * Esto es lo que muestra el "fantasma" del slider.
 *
 * Delegates to resolveBaseValue.ts which properly maps gene path group
 * segments (envelopes., transient., hue., kinematics., etc.) to the
 * flat structure of the canonical registries.
 */
function getBaseValue(path: string, baseDNA: string): unknown {
  // Scheduler values are in PATTERN_CONFIG (not directly accessible here)
  // Return a sensible default from SCHEDULER_GENE_RANGES
  if (path.startsWith('movement.scheduler.')) {
    const range = getGeneRange(path)
    return range ? range.min : 0
  }
  const val = resolveBaseValue(path, baseDNA)
  if (val !== undefined) return val
  // Fallback to range.min — never blindly return 0
  const range = getGeneRange(path)
  return range ? range.min : 0
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface GeneRendererProps {
  descriptor: GeneDescriptor
  baseDNA: string
}

export const GeneRenderer: React.FC<GeneRendererProps> = memo(({ descriptor, baseDNA }) => {
  const { path, label, control, tier, unit } = descriptor

  const range = GENE_RANGES[path]
  const baseValue = useMemo(() => getBaseValue(path, baseDNA), [path, baseDNA])

  // Subscribe to this specific gene only
  const { value, isMutated } = useGene<unknown>(path, baseValue)

  const setGene = useVibeLabStore((s) => s.setGene)
  const revertGene = useVibeLabStore((s) => s.revertGene)

  const handleChange = useMemo(
    () => (v: unknown) => setGene(path, v),
    [setGene, path],
  )

  const handleRevert = useMemo(
    () => () => revertGene(path),
    [revertGene, path],
  )

  // ── Skip if no range (custom controls handled by panels) ────────────
  if (!range) return null

  // ── Slider ──────────────────────────────────────────────────────────
  if (control === 'slider') {
    const numValue = typeof value === 'number' ? value : (baseValue as number) ?? range.min
    const numBase = (baseValue as number) ?? range.min
    return (
      <GeneSlider
        path={path}
        label={label}
        baseValue={numBase}
        value={numValue}
        min={range.min}
        max={range.max}
        step={range.step}
        unit={unit ?? range.unit}
        danger={range.danger as [number, number] | undefined}
        isMutated={isMutated}
        isInDanger={isInDangerZone(path, numValue)}
        tier={tier}
        onChange={handleChange}
        onRevert={handleRevert}
      />
    )
  }

  // ── Number ──────────────────────────────────────────────────────────
  if (control === 'number') {
    const numValue = typeof value === 'number' ? value : (baseValue as number) ?? range.min
    const numBase = (baseValue as number) ?? range.min
    return (
      <GeneNumberField
        path={path}
        label={label}
        baseValue={numBase}
        value={numValue}
        min={range.min}
        max={range.max}
        step={range.step}
        unit={unit ?? range.unit}
        isMutated={isMutated}
        tier={tier}
        onChange={handleChange}
        onRevert={handleRevert}
      />
    )
  }

  // ── Fallback: render as slider for any unrecognized control type ─────
  // This prevents silent render failures where a gene exists in the registry
  // but its control type is not handled above (e.g. 'toggle', 'segmented',
  // 'color', 'custom'). Instead of returning null and leaving the panel
  // empty, render a basic slider so the user sees SOMETHING.
  if (range) {
    const numValue = typeof value === 'number' ? value : (baseValue as number) ?? range.min
    const numBase = (baseValue as number) ?? range.min
    return (
      <GeneSlider
        path={path}
        label={label}
        baseValue={numBase}
        value={numValue}
        min={range.min}
        max={range.max}
        step={range.step}
        unit={unit ?? range.unit}
        danger={range.danger as [number, number] | undefined}
        isMutated={isMutated}
        isInDanger={isInDangerZone(path, numValue)}
        tier={tier}
        onChange={handleChange}
        onRevert={handleRevert}
      />
    )
  }

  // No range found — this should never happen if the registry is correct
  return (
    <div style={{ padding: '8px 16px', fontSize: 10, color: 'rgba(255,100,100,0.6)' }}>
      ⚠️ No range for gene: {path}
    </div>
  )
})

GeneRenderer.displayName = 'GeneRenderer'
