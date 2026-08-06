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
 * @version FASE 3
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
import { getByPath } from '../../engine/vibe/custom/pathUtils'
import { VIBE_REGISTRY } from '../../engine/vibe/profiles/index'
import { PROFILE_REGISTRY } from '../../hal/physics/profiles/index'
import { COLOR_CONSTITUTIONS } from '../../engine/color/colorConstitutions'
import { VIBE_CONFIG } from '../../engine/movement/VibeMovementManager'
import { MOVEMENT_PRESETS } from '../../engine/movement/VibeMovementPresets'

// ═══════════════════════════════════════════════════════════════════════════
// BASE VALUE RESOLVER — gets the value from the canonical registry
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resuelve el valor base de un gen desde el ADN canónico.
 * Esto es lo que muestra el "fantasma" del slider.
 */
function getBaseValue(path: string, baseDNA: string): unknown {
  // Determinar qué registry consultar según el prefijo de la ruta
  if (path.startsWith('physics.envelopes.') || path.startsWith('physics.transient.') ||
      path.startsWith('physics.separation.') || path.startsWith('physics.sidechain.') ||
      path.startsWith('physics.strobe.') || path.startsWith('physics.modes.') ||
      path.startsWith('physics.morph.') || path.startsWith('physics.kick.') ||
      path.startsWith('physics.ambient.') || path.startsWith('physics.overrides41.')) {
    const profile = PROFILE_REGISTRY[baseDNA as keyof typeof PROFILE_REGISTRY]
    if (!profile) return 0
    // Quitar el prefijo "physics." y resolver en el profile
    const subPath = path.replace(/^physics\./, '')
    return getByPath(profile as unknown as Record<string, unknown>, subPath)
  }

  if (path.startsWith('color.')) {
    const constitution = COLOR_CONSTITUTIONS[baseDNA as keyof typeof COLOR_CONSTITUTIONS]
    if (!constitution) return 0
    const subPath = path.replace(/^color\./, '')
    return getByPath(constitution as unknown as Record<string, unknown>, subPath)
  }

  if (path.startsWith('movement.kinematics.') || path.startsWith('movement.stereo.') ||
      path.startsWith('movement.tiltOffset') || path.startsWith('movement.physics.') ||
      path.startsWith('movement.optics.') || path.startsWith('movement.behavior.') ||
      path.startsWith('movement.spatial.') || path.startsWith('movement.grandMaster.')) {
    const vibeConfig = VIBE_CONFIG[baseDNA as keyof typeof VIBE_CONFIG]
    if (vibeConfig) {
      const subPath = path.replace(/^movement\./, '')
      const val = getByPath(vibeConfig as unknown as Record<string, unknown>, subPath)
      if (val !== undefined) return val
    }
    // Fallback al preset
    const preset = MOVEMENT_PRESETS[baseDNA as keyof typeof MOVEMENT_PRESETS]
    if (preset) {
      const subPath = path.replace(/^movement\./, '')
      return getByPath(preset as unknown as Record<string, unknown>, subPath)
    }
    return 0
  }

  if (path.startsWith('movement.scheduler.')) {
    // Scheduler values are in PATTERN_CONFIG (not directly accessible here)
    // Return a sensible default from SCHEDULER_GENE_RANGES
    const range = getGeneRange(path)
    return range ? range.min : 0
  }

  return 0
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

  // Twin and custom controls are handled by specialized panel components
  return null
})

GeneRenderer.displayName = 'GeneRenderer'
