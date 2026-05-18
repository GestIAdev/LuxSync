/**
 * ☀️ HYPERION — useFixture3DData Hook
 * 
 * Transforma datos de los stores en Fixture3DData[] listo para renderizar.
 * Combina stageStore + truthStore + selectionStore + ZoneLayoutEngine.
 * 
 * @module components/hyperion/views/visualizer/useFixture3DData
 * @since WAVE 2042.6 (Project Hyperion — Phase 4)
 */

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useStageStore } from '../../../../stores/stageStore'
import { useSelectionStore } from '../../../../stores/selectionStore'
import { useOverrideStore, type Override } from '../../../../stores/overrideStore'
import { getTransientFixture } from '../../../../stores/transientStore'
import { 
  normalizeZone, 
  ZONE_LAYOUT_3D, 
  type CanonicalZone 
} from '../../shared/ZoneLayoutEngine'
import type { Fixture3DData, StageConfig3D } from './types'
import type { FixtureState } from '../../../../core/protocol/SeleneProtocol'
import type { InstallationOrientation, Rotation3D } from '../../../../core/stage/ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Default stage dimensions for position calculation */
const STAGE_HALF_WIDTH = 6    // 12m / 2
const STAGE_HALF_DEPTH = 4    // 8m / 2
const DEFAULT_PAN_RANGE_DEG = 540
const DEFAULT_TILT_RANGE_DEG = 270
const UNPLACED_SENTINEL_Y = 3

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Distribuye N fixtures en un rango espacial.
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
 * Determina el tipo de fixture para el renderizado 3D.
 */
function resolveFixtureType(
  fixtureType: string
): 'moving-head' | 'par' | 'wash' | 'strobe' | 'laser' | 'blinder' | 'generic' {
  const lower = fixtureType.toLowerCase()
  
  if (lower.includes('moving') || lower.includes('head') || lower.includes('spot')) {
    return 'moving-head'
  }
  if (lower.includes('par') || lower.includes('led')) {
    return 'par'
  }
  if (lower.includes('wash')) {
    return 'wash'
  }
  if (lower.includes('strobe')) {
    return 'strobe'
  }
  if (lower.includes('laser')) {
    return 'laser'
  }
  if (lower.includes('blinder')) {
    return 'blinder'
  }
  
  return 'generic'
}

function resolveMechanicalRanges(fixture: any): { panRangeDeg: number; tiltRangeDeg: number } {
  const panRangeDeg = Number(
    fixture?.panRangeDeg
    ?? fixture?.capabilities?.panRange
    ?? fixture?.physics?.panRange
    ?? DEFAULT_PAN_RANGE_DEG
  )

  const tiltRangeDeg = Number(
    fixture?.tiltRangeDeg
    ?? fixture?.capabilities?.tiltRange
    ?? fixture?.physics?.tiltRange
    ?? DEFAULT_TILT_RANGE_DEG
  )

  return {
    panRangeDeg: Number.isFinite(panRangeDeg) && panRangeDeg > 0 ? panRangeDeg : DEFAULT_PAN_RANGE_DEG,
    tiltRangeDeg: Number.isFinite(tiltRangeDeg) && tiltRangeDeg > 0 ? tiltRangeDeg : DEFAULT_TILT_RANGE_DEG,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

interface UseFixture3DDataOptions {
  /** Configuración del escenario */
  stageConfig?: StageConfig3D
}

/**
 * Hook que transforma datos de stores en Fixture3DData[] para el visualizer.
 */
export function useFixture3DData(options: UseFixture3DDataOptions = {}) {
  // ── Stores ────────────────────────────────────────────────────────────────
  const fixtures = useStageStore(state => state.fixtures)
  const selectedIds = useSelectionStore(state => state.selectedIds)
  const overrides = useOverrideStore(state => state.overrides)
  const colorPoolRef = useRef(new Map<string, THREE.Color>())
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔥 WAVE 2236: THE DECOUPLING — No reactive hardware subscription
  //
  // BEFORE: useHardware() subscribed to truthStore → useMemo recalculated
  //   Fixture3DData[] at 30fps → new array refs → all 3D children re-mounted.
  //   This was the #1 cause of GC pressure killing the renderer.
  //
  // NOW: This hook only reacts to STRUCTURAL changes (fixtures added/removed,
  //   zone changes, selection, overrides). Dynamic values (color, intensity,
  //   pan, tilt) are read by each 3D component directly from transientStore
  //   inside useFrame() at native R3F frame rate.
  //
  // For override resolution, we read getTransientFixture() at build time —
  // this is a one-time snapshot, not a subscription.
  // ═══════════════════════════════════════════════════════════════════════
  
  // 🔍 WAVE 4573 Phase 0: Expose stageStore fixture IDs for ID mismatch diagnostics
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    (window as any).__luxDebug = (window as any).__luxDebug || {}
    ;(window as any).__luxDebug.stageFixtureIds = fixtures.map(f => f.id)
  }

  // ── Stage Dimensions ──────────────────────────────────────────────────────
  const halfWidth = options.stageConfig?.width 
    ? options.stageConfig.width / 2 
    : STAGE_HALF_WIDTH
  const halfDepth = options.stageConfig?.depth 
    ? options.stageConfig.depth / 2 
    : STAGE_HALF_DEPTH

  // ── Group fixtures by zone for positioning ────────────────────────────────
  const fixturesByZone = useMemo(() => {
    const groups = new Map<CanonicalZone, typeof fixtures>()
    
    for (const fixture of fixtures) {
      const zone = normalizeZone(fixture.zone)
      if (!groups.has(zone)) {
        groups.set(zone, [])
      }
      groups.get(zone)!.push(fixture)
    }
    
    return groups
  }, [fixtures])

  // ── Transform to Fixture3DData ────────────────────────────────────────────
  const fixture3DData = useMemo<Fixture3DData[]>(() => {
    const result: Fixture3DData[] = []
    const activeIds = new Set<string>()

    for (const [zone, zoneFixtures] of fixturesByZone) {
      const layout = ZONE_LAYOUT_3D[zone]
      const total = zoneFixtures.length

      zoneFixtures.forEach((fixture, index) => {
        activeIds.add(fixture.id)
        // ── Position calculation ────────────────────────────────────────────
        let x: number
        let y: number
        let z: number

        // 🏗️ WAVE 4576 M3: Spatial Truth — use authored 3D position for placed fixtures.
        // isPlaced=true means the user explicitly positioned this fixture in StageGrid3D.
        // Fall through to zone-layout only for unplaced (algorithmically distributed) fixtures.
        if (fixture.isPlaced === true && fixture.position) {
          x = fixture.position.x
          y = fixture.position.y
          z = fixture.position.z
        } else if (layout.vertical && layout.fixedX !== undefined) {
          // Vertical column (movers-left, movers-right)
          x = layout.fixedX * halfWidth
          // WAVE 4887: fixtures no colocados deben visualizarse en el mismo sentinel que usa IK/bridge.
          y = UNPLACED_SENTINEL_Y
          z = layout.depthFactor * halfDepth
        } else {
          // Horizontal distribution
          x = distributeInRange(
            index, 
            total, 
            layout.xRange[0] * halfWidth, 
            layout.xRange[1] * halfWidth
          )
          // WAVE 4887: unificar altura de guerrilla fixtures a y=3m.
          y = UNPLACED_SENTINEL_Y
          z = layout.depthFactor * halfDepth
        }

        const { panRangeDeg, tiltRangeDeg } = resolveMechanicalRanges(fixture)

        // ═══════════════════════════════════════════════════════════════════
        // 🔥 WAVE 2236: STATIC SNAPSHOT — Dynamic values read in useFrame()
        //
        // These are "initial/default" values. The actual live data (color,
        // intensity, pan, tilt, zoom, focus) is read by HyperionMovingHead3D
        // and HyperionPar3D inside their useFrame() from transientStore.
        //
        // Overrides ARE resolved here because they're user-driven events
        // (click slider → override changes → useMemo recalculates).
        // ═══════════════════════════════════════════════════════════════════
        const override = overrides.get(fixture.id)
        
        // Snapshot from transientStore (non-reactive, zero React cost)
        const fixtureState = getTransientFixture(fixture.id)
        
        // Intensity: only override needs resolution here; live dimmer read in useFrame
        const intensity = override?.values?.dimmer !== undefined 
          ? override.values.dimmer / 255
          : (fixtureState?.dimmer ?? 0)
        
        // Colors: override resolution or snapshot
        const r = override?.values?.r ?? fixtureState?.color?.r ?? 255
        const g = override?.values?.g ?? fixtureState?.color?.g ?? 255
        const b = override?.values?.b ?? fixtureState?.color?.b ?? 255
        
        // Pan/Tilt: override resolution or snapshot
        const pan = override?.values?.pan !== undefined
          ? override.values.pan / 255
          : (fixtureState?.pan ?? 0.5)
        const tilt = override?.values?.tilt !== undefined
          ? override.values.tilt / 255
          : (fixtureState?.tilt ?? 0.5)
          
        // Physical position: override or snapshot
        const physicalPan = override?.values?.pan !== undefined
          ? override.values.pan / 255
          : (fixtureState?.physicalPan ?? fixtureState?.pan ?? 0.5)
        const physicalTilt = override?.values?.tilt !== undefined
          ? override.values.tilt / 255
          : (fixtureState?.physicalTilt ?? fixtureState?.tilt ?? 0.5)
          
        const zoom = fixtureState?.zoom ?? 0.5
        const focus = fixtureState?.focus ?? 0.5

        // Reuse THREE.Color instances per fixture to avoid GC churn on memo rebuilds.
        let color = colorPoolRef.current.get(fixture.id)
        if (!color) {
          color = new THREE.Color()
          colorPoolRef.current.set(fixture.id, color)
        }
        color.setRGB(r / 255, g / 255, b / 255)
        const resolvedType = resolveFixtureType(fixture.type)
        const orientation = (fixture.orientation ?? 'ceiling') as InstallationOrientation

        // WAVE 4643: guardia visual para shows legacy con movers ceiling
        // que quedaron con pitch base -45 por migraciones viejas.
        const authoredRotation = fixture.rotation ?? { pitch: 0, yaw: 0, roll: 0 }
        const baseRotation: Rotation3D =
          resolvedType === 'moving-head'
            && orientation === 'ceiling'
            && Math.abs((authoredRotation.pitch ?? 0) + 45) < 0.0001
            ? { ...authoredRotation, pitch: 0 }
            : authoredRotation

        result.push({
          id: fixture.id,
          name: fixture.name || `Fixture ${fixture.address}`,
          type: resolvedType,
          zone,
          x,
          y,
          z,
          intensity,
          color,
          pan,
          tilt,
          physicalPan,
          physicalTilt,
          zoom,
          focus,
          selected: selectedIds.has(fixture.id),
          hasOverride: override !== undefined,
          // 🏗️ WAVE 4573: Spatial Truth fields
          orientation,
          baseRotation,
          isPlaced: fixture.isPlaced === true,
          panRangeDeg,
          tiltRangeDeg,
        })
      })
    }

    for (const id of colorPoolRef.current.keys()) {
      if (!activeIds.has(id)) {
        colorPoolRef.current.delete(id)
      }
    }

    return result
  }, [fixtures, fixturesByZone, selectedIds, overrides, halfWidth, halfDepth])

  // ── Separate by type for instancing ───────────────────────────────────────
  const movingHeads = useMemo(
    () => fixture3DData.filter(f => f.type === 'moving-head'),
    [fixture3DData]
  )
  
  const pars = useMemo(
    () => fixture3DData.filter(f => f.type === 'par' || f.type === 'wash' || f.type === 'generic'),
    [fixture3DData]
  )
  
  const strobes = useMemo(
    () => fixture3DData.filter(f => f.type === 'strobe' || f.type === 'blinder'),
    [fixture3DData]
  )

  return {
    /** Todos los fixtures */
    all: fixture3DData,
    /** Moving heads (renderizados individualmente por complejidad) */
    movingHeads,
    /** PARs + wash (candidatos para instancing) */
    pars,
    /** Strobes + blinders (candidatos para instancing) */
    strobes,
    /** Total count */
    count: fixture3DData.length,
  }
}
