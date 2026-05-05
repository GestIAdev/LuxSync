/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏛️ MOVEMENT STORE — The Kinetics Cathedral State (WAVE 4561)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Estado centralizado para el control cinemático.
 * Persiste entre cambios de vista (CONTROLS ↔ KINETICS).
 * Comparte estado entre PositionSection (sidebar) y KineticsCathedral (panel).
 *
 * ARQUITECTURA:
 *   UI (OrthoRadar, TacticalFader, PatternArsenal, ChaosOrderSlider)
 *     ↓
 *   movementStore (Zustand)
 *     ↓
 *   programmerStore.setPosition / setPositionPerFixture
 *   + window.lux.arbiter.setManualFixturePattern / applySpatialTarget
 *
 * @module stores/movementStore
 * @version WAVE 4561
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { generateSeed } from '../engine/movement/ChaosHash'
import type { Target3D, IKResult, SpatialFanMode } from '../engine/movement/InverseKinematicsEngine'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Tipos de patrones disponibles */
export type PatternType = 'none' | 'static' | 'circle' | 'eight' | 'sweep' | 'tornado' | 'bounce' | 'butterfly' | 'pulse'

/** Modo del radar: classic (grados) vs spatial (IK 3D) */
export type RadarMode = 'spatial' | 'classic'

/** Override manual del modo — null = autodetección adiabática */
export type RadarModeOverride = RadarMode | null

// ─────────────────────────────────────────────────────────────────────────────
// STATE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

interface MovementState {
  // ── Classic mode (grados) ────────────────────────────────────────────────
  pan: number      // 0-540°
  tilt: number     // 0-270°
  fanValue: number // -100..100

  // ── Spatial mode (IK 3D) ────────────────────────────────────────────────
  spatialTarget: Target3D
  spatialFanMode: SpatialFanMode
  spatialFanAmplitude: number // metros
  spatialReachability: Record<string, IKResult>
  spatialSubTargets: Record<string, Target3D>

  // ── Radar mode ──────────────────────────────────────────────────────────
  radarModeOverride: RadarModeOverride

  // ── Pattern + dynamics ──────────────────────────────────────────────────
  activePattern: PatternType
  patternSpeed: number     // 0-100
  patternAmplitude: number // 0-100

  // ── Chaos engine ────────────────────────────────────────────────────────
  chaosAmount: number // 0-1
  chaosSeed: number   // 16-bit entero (0..65535)

  // ── UI ──────────────────────────────────────────────────────────────────
  isCalibrating: boolean

  // ── Lock feedback (superior motor eviction) ─────────────────────────────
  /** Fixtures cuyo canal KINETIC está siendo controlado por un motor superior (Chronos/Selene).
   *  Rellena el KineticsBridge al detectar que la respuesta IPC indica ownership externo. */
  lockedFixtureIds: ReadonlySet<string>
}

interface MovementActions {
  // Classic
  setPanTilt: (pan: number, tilt: number) => void
  setFanValue: (v: number) => void

  // Spatial
  setSpatialTarget: (t: Target3D) => void
  setSpatialFanMode: (mode: SpatialFanMode) => void
  setSpatialFanAmplitude: (amp: number) => void
  setSpatialReachability: (r: Record<string, IKResult>) => void
  setSpatialSubTargets: (st: Record<string, Target3D>) => void

  // Radar mode
  setRadarModeOverride: (m: RadarModeOverride) => void

  // Pattern
  setActivePattern: (p: PatternType) => void
  setPatternSpeed: (v: number) => void
  setPatternAmplitude: (v: number) => void

  // Chaos
  setChaosAmount: (v: number) => void
  reseed: () => void

  // UI
  setIsCalibrating: (v: boolean) => void

  /** Marca fixtures como bloqueados por motor superior */
  setLockedFixtures: (ids: ReadonlySet<string>) => void

  /** Hidratar desde respuesta del backend (selection change) */
  hydrateFromBackend: (state: {
    pan: number | null
    tilt: number | null
    pattern: string | null
    speed: number | null
    amplitude: number | null
  }) => void

  /** Reset completo a defaults cuando no hay selección */
  resetToDefaults: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULTS: MovementState = {
  pan: 270,
  tilt: 135,
  fanValue: 0,
  spatialTarget: { x: 0, y: 2, z: 0 },
  spatialFanMode: 'converge',
  spatialFanAmplitude: 0,
  spatialReachability: {},
  spatialSubTargets: {},
  radarModeOverride: null,
  activePattern: 'none',
  patternSpeed: 50,
  patternAmplitude: 50,
  chaosAmount: 0,
  chaosSeed: generateSeed(),
  isCalibrating: false,
  lockedFixtureIds: new Set(),
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

export const useMovementStore = create<MovementState & MovementActions>()(subscribeWithSelector((set) => ({
  ...DEFAULTS,

  setPanTilt: (pan, tilt) => set({ pan, tilt }),
  setFanValue: (fanValue) => set({ fanValue }),

  setSpatialTarget: (spatialTarget) => set({ spatialTarget }),
  setSpatialFanMode: (spatialFanMode) => set({ spatialFanMode }),
  setSpatialFanAmplitude: (spatialFanAmplitude) => set({ spatialFanAmplitude }),
  setSpatialReachability: (spatialReachability) => set({ spatialReachability }),
  setSpatialSubTargets: (spatialSubTargets) => set({ spatialSubTargets }),

  setRadarModeOverride: (radarModeOverride) => set({ radarModeOverride }),

  setActivePattern: (activePattern) => set({ activePattern }),
  setPatternSpeed: (patternSpeed) => set({ patternSpeed }),
  setPatternAmplitude: (patternAmplitude) => set({ patternAmplitude }),

  setChaosAmount: (chaosAmount) => set({ chaosAmount: Math.max(0, Math.min(1, chaosAmount)) }),
  reseed: () => set({ chaosSeed: generateSeed() }),

  setIsCalibrating: (isCalibrating) => set({ isCalibrating }),

  setLockedFixtures: (lockedFixtureIds) => set({ lockedFixtureIds }),

  hydrateFromBackend: ({ pan, tilt, pattern, speed, amplitude }) => {
    const uiPattern = pattern === 'hold' ? 'static' : (pattern ?? 'none')
    set({
      pan: pan ?? 270,
      tilt: tilt ?? 135,
      activePattern: uiPattern as PatternType,
      patternSpeed: speed ?? 50,
      patternAmplitude: amplitude ?? 50,
    })
  },

  resetToDefaults: () => set({ ...DEFAULTS, chaosSeed: generateSeed() }),
})))
