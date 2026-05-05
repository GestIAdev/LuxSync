/**
 * useAdiabaticRadarMode — WAVE 4561 / WAVE 4564
 *
 * Paradoja Adiabática: detecta automáticamente el modo del radar.
 * Si todos los fixtures seleccionados tienen posición 3D en stageStore → spatial.
 * Cualquier fixture sin posición → classic.
 * El override manual del operador siempre gana.
 *
 * Extraído de KineticsCathedral en WAVE 4564 para ser compartido con
 * KinRadarViewport (el radar gigante en el Main Viewport).
 */
import { useMemo } from 'react'
import type { RadarMode } from '../stores/movementStore'

export function useAdiabaticRadarMode(
  selectedIds: string[],
  stageFixtures: Array<{ id: string; position?: unknown }>,
  override: RadarMode | null,
): RadarMode {
  return useMemo((): RadarMode => {
    if (override !== null) return override
    if (selectedIds.length === 0) return 'classic'
    const allHavePosition = selectedIds.every(id => {
      const sf = stageFixtures.find(f => f.id === id)
      return sf?.position != null
    })
    return allHavePosition ? 'spatial' : 'classic'
  }, [selectedIds, stageFixtures, override])
}
