/**
 * ☀️ HYPERION — useFixture3DData Hook
 * 
 * Transforma datos de los stores en Fixture3DData[] listo para renderizar.
 * Combina stageStore + truthStore + selectionStore + ZoneLayoutEngine.
 * 
 * @module components/hyperion/views/visualizer/useFixture3DData
 * @since WAVE 2042.6 (Project Hyperion — Phase 4)
 */

import { useMemo } from 'react'
import * as THREE from 'three'
import { useStageStore } from '../../../../stores/stageStore'
import { useTruthStore } from '../../../../stores/truthStore'
import { useSelectionStore } from '../../../../stores/selectionStore'
import { useOverrideStore, type Override } from '../../../../stores/overrideStore'
import { 
  normalizeZone, 
  ZONE_LAYOUT_3D, 
  type CanonicalZone 
} from '../../shared/ZoneLayoutEngine'
import type { Fixture3DData, StageConfig3D } from './types'
import type { FixtureState } from '../../../../core/protocol/SeleneProtocol'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Default stage dimensions for position calculation */
const STAGE_HALF_WIDTH = 6    // 12m / 2
const STAGE_HALF_DEPTH = 4    // 8m / 2
const TRUSS_HEIGHT = 5        // 5m

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
  
  // ── Stage Dimensions ──────────────────────────────────────────────────────
  const halfWidth = options.stageConfig?.width 
    ? options.stageConfig.width / 2 
    : STAGE_HALF_WIDTH
  const halfDepth = options.stageConfig?.depth 
    ? options.stageConfig.depth / 2 
    : STAGE_HALF_DEPTH
  const trussHeight = options.stageConfig?.trussHeight ?? TRUSS_HEIGHT

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

    for (const [zone, zoneFixtures] of fixturesByZone) {
      const layout = ZONE_LAYOUT_3D[zone]
      const total = zoneFixtures.length

      zoneFixtures.forEach((fixture, index) => {
        // ── Position calculation ────────────────────────────────────────────
        let x: number
        let y: number
        let z: number

        if (layout.vertical && layout.fixedX !== undefined) {
          // Vertical column (movers-left, movers-right)
          x = layout.fixedX * halfWidth
          y = distributeInRange(index, total, trussHeight * 0.5, trussHeight * 0.9)
          z = layout.depthFactor * halfDepth
        } else {
          // Horizontal distribution
          x = distributeInRange(
            index, 
            total, 
            layout.xRange[0] * halfWidth, 
            layout.xRange[1] * halfWidth
          )
          y = layout.heightFactor * trussHeight
          z = layout.depthFactor * halfDepth
        }

        // ── Get live DMX values from truthStore ─────────────────────────────
        // truth.hardware.fixtures contains live FixtureState[]
        const truthState = useTruthStore.getState()
        const fixtureState = truthState.truth.hardware.fixtures.find(
          (f: FixtureState) => f.id === fixture.id
        )
        
        // ── Apply overrides if present ──────────────────────────────────────
        const override = overrides.get(fixture.id)
        
        // ── Resolve final values ────────────────────────────────────────────
        // Override.values has: dimmer, r, g, b, pan, tilt
        // FixtureState has: dimmer, color.r, color.g, color.b, pan, tilt
        const intensity = (override?.values?.dimmer ?? fixtureState?.dimmer ?? 0) / 255
        const r = override?.values?.r ?? fixtureState?.color?.r ?? 255
        const g = override?.values?.g ?? fixtureState?.color?.g ?? 255
        const b = override?.values?.b ?? fixtureState?.color?.b ?? 255
        const pan = (override?.values?.pan ?? fixtureState?.pan ?? 127.5) / 255
        const tilt = (override?.values?.tilt ?? fixtureState?.tilt ?? 127.5) / 255
        const zoom = (fixtureState?.zoom ?? 127) / 255
        const focus = (fixtureState?.focus ?? 127) / 255

        // ── Create THREE.Color ──────────────────────────────────────────────
        const color = new THREE.Color(r / 255, g / 255, b / 255)

        result.push({
          id: fixture.id,
          name: fixture.name || `Fixture ${fixture.address}`,
          type: resolveFixtureType(fixture.type),
          zone,
          x,
          y,
          z,
          intensity,
          color,
          pan,
          tilt,
          zoom,
          focus,
          selected: selectedIds.has(fixture.id),
          hasOverride: override !== undefined,
        })
      })
    }

    return result
  }, [fixtures, fixturesByZone, selectedIds, overrides, halfWidth, halfDepth, trussHeight])

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
