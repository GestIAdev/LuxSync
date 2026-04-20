/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ TRANSIENT STORE - WAVE 348: TIERRA QUEMADA
 * "El Bypass de React para Actualizaciones de 60fps"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * PROBLEMA:
 * React/Zustand NO puede manejar 60 actualizaciones por segundo.
 * El "Reconciler" colapsa comparando DOM virtual.
 * 
 * SOLUCIÓN:
 * Store MUTABLE fuera de React. Sin setState, sin re-renders.
 * Three.js lee directamente con useFrame (bypaseando React).
 * 
 * FILOSOFÍA:
 * - React maneja LAYOUT (fixtures aparecen/desaparecen, cambio de vibe)
 * - Transient maneja PHYSICS (pan/tilt que cambian 60 veces/seg)
 * 
 * @module stores/transientStore
 * @version 348.0.0
 */

import type { SeleneTruth } from '../core/protocol/SeleneProtocol'

// ═══════════════════════════════════════════════════════════════════════════
// MUTABLE REFERENCE - "The Ghost Store"
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 👻 Store Fantasma: React no lo ve, no causa re-renders
 * 
 * Actualizado 60 veces/seg por IPC listener
 * Leído 60 veces/seg por Three.js useFrame
 * 
 * CERO overhead de React.
 */
const transientRef: {
  current: SeleneTruth | null
  frameCount: number
  lastUpdateTime: number
} = {
  current: null,
  frameCount: 0,
  lastUpdateTime: 0,
}

// 🗺️ WAVE 3250: FIXTURE INDEX — O(1) lookup en vez de Array.find() por frame.
// Con 12 fixtures y 60fps useFrame: antes = 720 .find() calls/sec → ahora = 720 Map.get()
// Se reconstruye solo cuando llega una full SeleneTruth (7Hz), no en cada hot-frame.
let fixtureIndex: Map<string, any> = new Map()

// WAVE 3403: AudioMatrix telemetry — piggybacked on hot-frame, read by RAF components
const audioMatrixTelemetry = {
  ringBufferFillLevel: 0,
  activeAudioSource: null as string | null,
}

// 🪞 WAVE 3260: VIBE GENERATION COUNTER — Monotonically incrementing.
// 3D components read this to detect vibe changes and SNAP (reset smooth refs)
// instead of slowly lerping to the new state (which creates desync).
let vibeGeneration = 0
let lastVibeId: string | null = null

// ═══════════════════════════════════════════════════════════════════════════
// API PÚBLICA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 💉 Inyectar nueva verdad (llamado por IPC listener)
 * NO causa re-render. Solo actualiza la referencia mutable.
 */
export function injectTransientTruth(truth: SeleneTruth): void {
  transientRef.current = truth
  transientRef.frameCount++
  transientRef.lastUpdateTime = Date.now()

  // 🪞 WAVE 3260: Detect vibe change → increment generation counter
  const currentVibe = truth?.consciousness?.vibe?.active ?? null
  if (currentVibe !== lastVibeId) {
    lastVibeId = currentVibe
    vibeGeneration++
  }

  // 🗺️ WAVE 3250: Rebuild fixture index on full truth injection
  const fixtures = truth?.hardware?.fixtures
  if (fixtures) {
    fixtureIndex.clear()
    for (let i = 0; i < fixtures.length; i++) {
      const f = fixtures[i]
      if (f?.id) fixtureIndex.set(f.id, f)
    }
  }
}

/**
 * ⚡ WAVE 2510 / WAVE 2520: Inyectar hot-frame (44Hz fixture data patch)
 * 
 * DEEP MERGE PARCIAL — Solo sobreescribe campos DINÁMICOS en cada fixture:
 *   dimmer, intensity, color, pan, tilt, zoom, focus, physicalPan/Tilt,
 *   panVelocity, tiltVelocity, active.
 * 
 * NUNCA toca campos ESTRUCTURALES: id, name, type, zone, dmxAddress,
 *   universe, white, amber, online, profileId.
 * 
 * Esto previene:
 *   1. Pérdida de color en 3D (fixtureState.color.r → undefined → blanco)
 *   2. UI thrashing (sidebar re-renders al perder traits/profileId)
 *   3. Modelo de datos corrupto en stores downstream
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function injectHotFrame(hotFrame: any): void {
  transientRef.frameCount++
  transientRef.lastUpdateTime = Date.now()

  if (!transientRef.current) {
    // No hay SeleneTruth base todavía — no podemos hacer patch parcial.
    return
  }

  // ── Deep-merge fixtures (in-place, field by field) ──────────────────
  const existingFixtures = transientRef.current.hardware?.fixtures
  const hotFixtures = hotFrame.fixtures
  if (hotFixtures && existingFixtures && transientRef.current.hardware) {
    let activeCount = 0

    for (let i = 0; i < hotFixtures.length; i++) {
      const hot = hotFixtures[i]
      // Match by index (fixtures arrive in same order from TitanOrchestrator)
      const existing = existingFixtures[i]

      if (existing && existing.id === hot.id) {
        // ── Patch ONLY dynamic fields onto existing fixture object ──
        // Cast to mutable: transientStore is the low-level injection point
        // where readonly physics fields ARE legitimately updated from IPC data.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mutable = existing as any
        mutable.dimmer = hot.dimmer
        mutable.intensity = hot.dimmer  // intensity mirrors dimmer
        mutable.pan = hot.pan
        mutable.tilt = hot.tilt
        mutable.zoom = hot.zoom
        mutable.focus = hot.focus
        mutable.physicalPan = hot.physicalPan
        mutable.physicalTilt = hot.physicalTilt
        mutable.panVelocity = hot.panVelocity
        mutable.tiltVelocity = hot.tiltVelocity
        mutable.active = hot.dimmer > 0

        // ── White/Amber: propagate at 22Hz (not just 7Hz from SeleneTruth) ──
        mutable.white = hot.white ?? 0
        mutable.amber = hot.amber ?? 0

        // ── Color: deep merge into existing color object ──
        if (existing.color) {
          existing.color.r = hot.r
          existing.color.g = hot.g
          existing.color.b = hot.b
        } else {
          existing.color = { r: hot.r, g: hot.g, b: hot.b }
        }

        if (hot.dimmer > 0) activeCount++
      }
      // If IDs don't match (shouldn't happen, but defensive):
      // skip — don't corrupt existing fixture with wrong data
    }

    transientRef.current.hardware.fixturesActive = activeCount
  }

  // ── Patch beat data (non-destructive) ─────────────────────────────
  if (transientRef.current.sensory?.beat) {
    transientRef.current.sensory.beat.onBeat = hotFrame.onBeat ?? false
    transientRef.current.sensory.beat.confidence = hotFrame.beatConfidence ?? 0
    transientRef.current.sensory.beat.bpm = hotFrame.bpm ?? 0
  }

  // 🎵 WAVE 3250: UNLEASH THE SPECTRUM — Patch audio bands from hot-frame (22Hz)
  // Antes: bass/mid/high/energy solo llegaban en selene:truth (~7Hz).
  // AudioSpectrumTitan leía valores idénticos 8-9 frames → escalones visibles.
  if (transientRef.current.sensory?.audio && hotFrame.bass !== undefined) {
    transientRef.current.sensory.audio.bass = hotFrame.bass
    transientRef.current.sensory.audio.mid = hotFrame.mid
    transientRef.current.sensory.audio.high = hotFrame.high
    transientRef.current.sensory.audio.energy = hotFrame.energy
  }

  // WAVE 3403: Patch AudioMatrix telemetry from hot-frame
  if (hotFrame.ringBufferFillLevel !== undefined) {
    audioMatrixTelemetry.ringBufferFillLevel = hotFrame.ringBufferFillLevel
    audioMatrixTelemetry.activeAudioSource = hotFrame.activeAudioSource ?? null
  }

  // ── Patch frame number ────────────────────────────────────────────
  if (transientRef.current.system) {
    transientRef.current.system.frameNumber = hotFrame.frameNumber ?? transientRef.current.system.frameNumber
  }
}

/**
 * 🔍 Leer verdad transiente (llamado por Three.js useFrame)
 * Acceso directo sin pasar por React.
 */
export function getTransientTruth(): SeleneTruth | null {
  return transientRef.current
}

/**
 * WAVE 3403: Read AudioMatrix telemetry imperatively (called by RAF loops).
 * Zero allocation — returns the same mutable object every time.
 */
export function getAudioMatrixTelemetry() {
  return audioMatrixTelemetry
}

/**
 * 🔍 Leer fixture específico por ID (optimización)
 * 🗺️ WAVE 3250: O(1) via Map index en vez de Array.find()
 */
export function getTransientFixture(fixtureId: string) {
  return fixtureIndex.get(fixtureId) ?? null
}

/**
 * 🪞 WAVE 3260: Vibe generation counter
 * Monotonically incrementing — 3D components compare against their local
 * copy to detect vibe changes and SNAP smooth refs.
 */
export function getVibeGeneration(): number {
  return vibeGeneration
}

/**
 * 📊 Stats para debug
 */
export function getTransientStats() {
  return {
    frameCount: transientRef.frameCount,
    lastUpdateTime: transientRef.lastUpdateTime,
    hasData: transientRef.current !== null,
    fixtureCount: transientRef.current?.hardware?.fixtures?.length || 0,
  }
}
