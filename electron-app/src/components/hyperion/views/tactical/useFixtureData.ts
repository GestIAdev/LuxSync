/**
 * ☀️ HYPERION — useFixtureData Hook
 * 
 * Hook que transforma datos de stores (truth + stage) en TacticalFixture[].
 * Hybrid rendering pipeline: datos de producción, NO simulación.
 * 
 * @module components/hyperion/views/tactical/useFixtureData
 * @since WAVE 2042.5 (Project Hyperion — Phase 3)
 */

import { useMemo } from 'react'
import { useTruthStore, selectHardware } from '../../../../stores/truthStore'
import { useStageStore } from '../../../../stores/stageStore'
import { useControlStore } from '../../../../stores/controlStore'
import { useOverrideStore } from '../../../../stores/overrideStore'
import { calculateFixtureRenderValues } from '../../../../hooks/useFixtureRender'
import { 
  normalizeZone, 
  ZONE_LAYOUT_2D,
  type CanonicalZone 
} from '../../shared/ZoneLayoutEngine'
import type { TacticalFixture } from './types'

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE TYPE CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Classify fixture type from zone and model hints.
 */
function classifyFixtureType(
  zone: CanonicalZone,
  model?: string
): TacticalFixture['type'] {
  // Model-based classification first
  if (model) {
    const m = model.toLowerCase()
    if (m.includes('strobe') || m.includes('atomic')) return 'strobe'
    if (m.includes('laser')) return 'laser'
    if (m.includes('par') || m.includes('led bar')) return 'par'
    if (m.includes('wash')) return 'wash'
    if (m.includes('spot') || m.includes('beam') || m.includes('profile') || m.includes('moving')) return 'moving'
  }

  // Zone-based fallback
  switch (zone) {
    case 'movers-left':
    case 'movers-right':
    case 'air':
    case 'center':
      return 'moving'
    case 'front':
    case 'back':
      return 'par'
    case 'floor':
    case 'ambient':
      return 'wash'
    default:
      return 'par'
  }
}

/**
 * Distribute fixtures horizontally within a zone's X range.
 */
function distributeInRange(
  index: number,
  total: number,
  min: number,
  max: number
): number {
  if (total <= 1) return (min + max) / 2
  return min + ((max - min) * index) / (total - 1)
}

/**
 * Distribute fixtures vertically for side-mounted zones.
 */
function distributeVertically(
  index: number,
  total: number,
  baseY: number
): number {
  if (total <= 1) return baseY
  const yStart = baseY - 0.15
  const yEnd = baseY + 0.25
  return yStart + ((yEnd - yStart) * index) / (total - 1)
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HOOK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hook that provides TacticalFixture[] for canvas rendering.
 * 
 * Data sources:
 * - stageStore: Fixture definitions (id, zone, model)
 * - truthStore: Live DMX values (intensity, color, position)
 * - controlStore: Global mode, palettes, transitions
 * - overrideStore: Per-fixture manual overrides
 */
export function useFixtureData(): TacticalFixture[] {
  // ── Store Subscriptions ─────────────────────────────────────────────────
  
  const hardware = useTruthStore(selectHardware)
  const stageFixtures = useStageStore(state => state.fixtures)
  const globalMode = useControlStore(state => state.globalMode)
  const flowParams = useControlStore(state => state.flowParams)
  const activePaletteId = useControlStore(state => state.activePalette)
  const globalIntensity = useControlStore(state => state.globalIntensity)
  const globalSaturation = useControlStore(state => state.globalSaturation)
  const targetPalette = useControlStore(state => state.targetPalette)
  const transitionProgress = useControlStore(state => state.transitionProgress)
  const overrides = useOverrideStore(state => state.overrides)

  // ── Runtime State Map ───────────────────────────────────────────────────
  
  const runtimeStateMap = useMemo(() => {
    const map = new Map<string, any>()
    const backendFixtures = hardware?.fixtures || []
    if (Array.isArray(backendFixtures)) {
      backendFixtures.forEach(f => {
        if (f?.id) map.set(f.id, f)
      })
    }
    return map
  }, [hardware?.fixtures])

  // ── Transform to TacticalFixture[] ──────────────────────────────────────
  
  return useMemo(() => {
    const fixtureArray = stageFixtures || []
    if (!Array.isArray(fixtureArray) || fixtureArray.length === 0) return []

    // First pass: classify and collect render data
    const classified: TacticalFixture[] = []

    for (let index = 0; index < fixtureArray.length; index++) {
      const fixture = fixtureArray[index]
      if (!fixture) continue

      const runtimeState = runtimeStateMap.get(fixture.id)
      const fixtureId = fixture.id || `fixture-${fixture.address}`
      const fixtureOverride = overrides.get(fixtureId)

      // Normalize zone using the canonical normalizer
      const rawZone = runtimeState?.zone || fixture.zone || ''
      const zone = normalizeZone(rawZone)
      const type = classifyFixtureType(zone, fixture.model)

      // Get render values from the render pipeline
      const renderData = calculateFixtureRenderValues(
        runtimeState || fixture,
        globalMode,
        flowParams,
        activePaletteId,
        globalIntensity,
        globalSaturation,
        index,
        fixtureOverride?.values,
        fixtureOverride?.mask,
        targetPalette,
        transitionProgress
      )

      // Normalize intensity
      const rawIntensity = renderData.intensity ?? 0
      const normalizedIntensity = !Number.isFinite(rawIntensity)
        ? 0
        : rawIntensity > 1.0
          ? rawIntensity / 255
          : rawIntensity
      const safeIntensity = Math.max(0, Math.min(1, normalizedIntensity))

      // Extract gobo/prism from runtime
      const truthSource = runtimeState || fixture
      const gobo = truthSource?.gobo ?? 0
      const prism = truthSource?.prism ?? 0

      classified.push({
        id: fixtureId,
        x: 0,  // Will be computed in layout pass
        y: 0,
        // NaN guard for color values
        r: Number.isFinite(renderData.color.r) ? renderData.color.r : 0,
        g: Number.isFinite(renderData.color.g) ? renderData.color.g : 0,
        b: Number.isFinite(renderData.color.b) ? renderData.color.b : 0,
        intensity: safeIntensity,
        type,
        zone,
        // NaN guard for physics
        physicalPan: Number.isFinite(renderData.physicalPan) ? renderData.physicalPan : 0.5,
        physicalTilt: Number.isFinite(renderData.physicalTilt) ? renderData.physicalTilt : 0.5,
        zoom: Number.isFinite(renderData.zoom) ? renderData.zoom : 127,
        focus: Number.isFinite(renderData.focus) ? renderData.focus : 127,
        gobo,
        prism,
        panVelocity: Number.isFinite(renderData.panVelocity) ? renderData.panVelocity : 0,
        tiltVelocity: Number.isFinite(renderData.tiltVelocity) ? renderData.tiltVelocity : 0,
      })
    }

    // Second pass: compute screen positions based on zone layout
    const byZone = new Map<CanonicalZone, number[]>()
    classified.forEach((f, i) => {
      const arr = byZone.get(f.zone) || []
      arr.push(i)
      byZone.set(f.zone, arr)
    })

    byZone.forEach((indices, zone) => {
      const layout = ZONE_LAYOUT_2D[zone]
      const count = indices.length
      const isVertical = layout.vertical === true

      indices.forEach((globalIdx, localIdx) => {
        const fixture = classified[globalIdx]
        
        if (isVertical && layout.fixedX !== undefined) {
          // Side-mounted: fixed X, spread Y
          fixture.x = layout.fixedX
          fixture.y = distributeVertically(localIdx, count, layout.y)
        } else {
          // Horizontal row: distribute X, fixed Y
          const [xMin, xMax] = layout.xRange
          fixture.x = distributeInRange(localIdx, count, xMin, xMax)
          fixture.y = layout.y
        }
      })
    })

    return classified
  }, [
    stageFixtures,
    runtimeStateMap,
    overrides,
    globalMode,
    flowParams,
    activePaletteId,
    globalIntensity,
    globalSaturation,
    targetPalette,
    transitionProgress,
  ])
}
