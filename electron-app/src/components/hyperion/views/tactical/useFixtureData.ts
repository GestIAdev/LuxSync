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
import { useStageStore } from '../../../../stores/stageStore'
import { getTransientFixture } from '../../../../stores/transientStore'
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
 * - stageStore: Fixture definitions (id, zone, model) — reactive (structural changes only)
 * - transientStore: Live DMX values (intensity, color, position) — non-reactive snapshot
 *
 * GLASS BYPASS (Fase 3): Removed truthStore/controlStore/overrideStore subscriptions.
 * Physics data is served directly by Aether Glass → packGlassFrameInto → worker RAF.
 * The snapshot here is used only for tooltip and initial scaffold values.
 */
export function useFixtureData(): TacticalFixture[] {
  // ── Store Subscriptions (structural only) ───────────────────────────────
  
  const stageFixtures = useStageStore(state => state.fixtures)
  const stageDimensions = useStageStore(state => state.stage)

  // ── Transform to TacticalFixture[] ──────────────────────────────────────
  
  return useMemo(() => {
    const fixtureArray = stageFixtures || []
    if (!Array.isArray(fixtureArray) || fixtureArray.length === 0) return []

    // First pass: classify and collect render data
    const classified: TacticalFixture[] = []

    for (let index = 0; index < fixtureArray.length; index++) {
      const fixture = fixtureArray[index]
      if (!fixture) continue

      const fixtureId = fixture.id || `fixture-${fixture.address}`

      // Normalize zone using the canonical normalizer
      const rawZone = fixture.zone || ''
      const zone = normalizeZone(rawZone)
      const type = classifyFixtureType(zone, fixture.model)

      // Non-reactive physics snapshot from transientStore.
      // Glass → packGlassFrameInto → worker RAF provides live rendering.
      // This snapshot is used only for tooltip display and scaffold init.
      const ts = getTransientFixture(fixtureId)
      const gobo  = ts?.gobo  ?? (fixture as any).gobo  ?? 0
      const prism = ts?.prism ?? (fixture as any).prism ?? 0

      classified.push({
        id: fixtureId,
        x: 0,  // Will be computed in layout pass
        y: 0,
        r: ts?.color?.r ?? 0,
        g: ts?.color?.g ?? 0,
        b: ts?.color?.b ?? 0,
        intensity: Math.min(1, (ts?.dimmer ?? 0) / 255),
        type,
        zone,
        physicalPan:  ts?.physicalPan  ?? 0.5,
        physicalTilt: ts?.physicalTilt ?? 0.5,
        zoom:  ts?.zoom  ?? 127,
        focus: ts?.focus ?? 127,
        gobo,
        prism,
        panVelocity:  ts?.panVelocity  ?? 0,
        tiltVelocity: ts?.tiltVelocity ?? 0,
      })
    }

    // Second pass: compute screen positions based on zone layout
    // 🏗️ WAVE 4573: SPATIAL TRUTH — if fixture is placed, project Position3D →2D.
    // Projection: X maps to X (canvas space), Z maps to Y inverted (front=bottom).
    // Unplaced fixtures fall back to ZONE_LAYOUT_2D as before.
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
        const stageFixture = fixtureArray[globalIdx]

        // 🎯 Spatial Truth: project 3D→2D when explicitly placed
        // 🩸 WAVE 7600: TACTICAL CANVAS FIX — bypass isPlaced for 2D-placed
        // fixtures. The isPlaced flag was designed for the 3D visualizer
        // (which needs Y/height). The tactical canvas is top-down 2D and
        // only needs X/Z — so 2D-placed fixtures (isPlaced=false but with
        // real position.x/z) should project correctly instead of falling
        // through to zone-based distribution that ignores their coordinates.
        const hasRealPosition = stageFixture?.position
          && !(stageFixture.position.x === 0
               && stageFixture.position.y === 3
               && stageFixture.position.z === 0)

        if (hasRealPosition && stageFixture.position) {
          // 🏗️ WAVE 4576 M2: Corrected projection math
          // Worker renders at fx = fixture.x * canvasWidth, so x must be in [0,1].
          // position.x ∈ [-stageW/2, +stageW/2] → normalize to [-0.5,+0.5] → shift to [0,1]
          // position.z: +Z = front/audience = bottom of canvas (y=1), -Z = back/upstage = top (y=0)
          //   → NO negation: rawY = +z/stageD maps front→high y (bottom) correctly.
          // 🩸 WAVE 7601: VIRTUAL CAMERA — clamps REMOVED. Fixtures placed
          // outside the nominal stage bounds (e.g., X=15 on a 12m stage)
          // must yield rawX > 1.0 so the virtual camera can pan/zoom to
          // reveal them. The grid layer also expands to cover the visible
          // virtual viewport, not just the stage dimensions.
          const stageW = stageDimensions?.width ?? 12
          const stageD = stageDimensions?.depth ?? 8
          const rawX = stageFixture.position.x / stageW        // [-0.5, +0.5] nominal, unbounded
          const rawY = stageFixture.position.z / stageD         // [-0.5, +0.5] nominal, unbounded
          fixture.x = rawX + 0.5
          fixture.y = rawY + 0.5
          return
        }
        
        if (isVertical && layout.fixedX !== undefined) {
          // Side-mounted: fixed X, spread Y
          fixture.x = layout.fixedX
          fixture.y = distributeVertically(localIdx, count, layout.y)
        } else if (layout.stereo) {
          // 🔥 WAVE-SPLIT-BRAIN FIX: Usar position.x si existe en lugar de paridad ciega
          const pos = stageFixture?.position
          const hasRealPosition = pos && !(pos.x === 0 && pos.y === 3 && pos.z === 0)

          const isLeft = hasRealPosition
            ? pos.x < 0
            : localIdx % 2 === 0

          const range = isLeft ? layout.stereo.leftRange : layout.stereo.rightRange
          const totalPerSide = Math.ceil(count / 2)
          const halfIndex = isLeft ? Math.floor(localIdx / 2) : Math.floor((localIdx - 1) / 2)
          fixture.x = distributeInRange(halfIndex, totalPerSide, range[0], range[1])
          fixture.y = layout.y

          // 🚦 WAVE 2042.16: TRAFFIC CONTROL - Type-based Y offset
          if (fixture.type === 'moving') {
            fixture.y -= 0.06
          } else if (fixture.type === 'par' || fixture.type === 'wash') {
            fixture.y += 0.06
          }
        } else {
          // Horizontal row: distribute X, fixed Y
          const [xMin, xMax] = layout.xRange
          fixture.x = distributeInRange(localIdx, count, xMin, xMax)
          fixture.y = layout.y

          // 🚦 WAVE 2042.16: TRAFFIC CONTROL - Type-based Y offset
          if (fixture.type === 'moving') {
            fixture.y -= 0.06
          } else if (fixture.type === 'par' || fixture.type === 'wash') {
            fixture.y += 0.06
          }
        }
      })
    })

    return classified
  }, [
    stageFixtures,
    stageDimensions,
  ])
}
