/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛂 WAVE 4557: AETHER SAFETY MIDDLEWARE — LA ADUANA AETHER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Capa de seguridad obligatoria entre NodeResolver y HAL.sendUniverseRaw().
 *
 *   P0: Kinetic Velocity Limiter (SAFETY_CAP + REV_LIMIT per-vibe)
 *   P0: Pan/Tilt Airbag (margen mecánico 5 DMX)
 *   P1: DarkSpin Filter (blackout durante tránsito de rueda)
 *   P2: Aduana Output Gate (outputEnabled + isVirtual)
 *   P2: Interface Throttling (refresh rate per-universe)
 *
 * ZERO-ALLOC: Float32Array per-node, pre-allocated Maps, no spreads.
 *
 * @module core/aether/egress/AetherSafetyMiddleware
 * @version WAVE 4557
 */

import type { NodeId, DeviceId } from '../types'

// ── Kinetic Safety Constants (from FixturePhysicsDriver Legacy) ──────────
const KINETIC_SAFETY_CAP_VEL = 400   // DMX units/s max absolute
const KINETIC_DEFAULT_REV_PAN  = 300
const KINETIC_DEFAULT_REV_TILT = 200
const TELEPORT_THRESHOLD_MS = 200
const PAN_AIRBAG_MARGIN  = 5
const TILT_AIRBAG_MARGIN = 5

// ── REV_LIMIT per-vibe (DMX/s, frame-rate independent) ───────────────────
const VIBE_REV_LIMITS: Record<string, { pan: number; tilt: number }> = {
  'techno-club':   { pan: 400, tilt: 400 },
  'fiesta-latina': { pan: 380, tilt: 280 },
  'pop-rock':      { pan: 300, tilt: 200 },
  'chill-lounge':  { pan:  12, tilt:   8 },
  'idle':          { pan: 120, tilt:  80 },
}

// ── Kinetic state Float32Array slots ─────────────────────────────────────
const KS_LAST_PAN = 0, KS_LAST_TILT = 1, KS_LAST_TIME = 2, KS_INIT = 3
const KS_SLOTS = 4

// ── Output gate: channels that center instead of zero ────────────────────
const SAFE_CENTER_CHANNELS = new Set<string>([
  'pan', 'tilt', 'pan_fine', 'tilt_fine', 'targetX', 'targetY', 'targetZ',
])

// ── DarkSpin state per-node ──────────────────────────────────────────────
interface DarkSpinNodeState {
  lastStableWheelDmx: number
  pendingWheelDmx: number
  inTransit: boolean
  transitStartMs: number
  transitDurationMs: number
}

// ── Throttle defaults ────────────────────────────────────────────────────
const THROTTLE_OPEN_DMX_MS = 33  // ~30Hz

// ═══════════════════════════════════════════════════════════════════════════
// CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class AetherSafetyMiddleware {

  // ── Per-node kinetic velocity state ────────────────────────────────────
  private readonly _kineticState = new Map<NodeId, Float32Array>()

  // ── Per-node DarkSpin transit state ────────────────────────────────────
  private readonly _darkSpinState = new Map<NodeId, DarkSpinNodeState>()

  // ── Output gate ────────────────────────────────────────────────────────
  private _outputEnabled = true
  private readonly _manualNodeIds = new Set<NodeId>()
  private readonly _virtualDeviceIds = new Set<DeviceId>()
  private readonly _deviceUniverseMap = new Map<DeviceId, number>()
  private readonly _universeDeviceMap = new Map<number, Set<DeviceId>>()
  private readonly _virtualOnlyUniverses = new Set<number>()

  // ── Interface throttle ─────────────────────────────────────────────────
  private readonly _lastSendTime = new Map<number, number>()
  private readonly _throttleInterval = new Map<number, number>()

  // ── Telemetry ──────────────────────────────────────────────────────────
  private _velocityClamps = 0
  private _airbagHits = 0
  private _aduanaBlocks = 0

  // ── Frame context (set each frame by Orchestrator) ─────────────────────
  private _nowMs = 0
  private _vibeId = 'idle'

  // ═════════════════════════════════════════════════════════════════════════
  // CONFIGURATION API
  // ═════════════════════════════════════════════════════════════════════════

  setFrameContext(nowMs: number, vibeId: string): void {
    this._nowMs = nowMs
    this._vibeId = vibeId
  }

  registerKineticNode(nodeId: NodeId): void {
    if (this._kineticState.has(nodeId)) return
    this._kineticState.set(nodeId, new Float32Array(KS_SLOTS))
  }

  registerDevice(deviceId: DeviceId, universe: number, isVirtual: boolean): void {
    this._deviceUniverseMap.set(deviceId, universe)
    let devs = this._universeDeviceMap.get(universe)
    if (!devs) { devs = new Set<DeviceId>(); this._universeDeviceMap.set(universe, devs) }
    devs.add(deviceId)
    if (isVirtual) this._virtualDeviceIds.add(deviceId)
    this._recalcVirtualOnlyUniverses()
  }

  setUniverseThrottle(universe: number, minIntervalMs: number): void {
    if (minIntervalMs > 0) this._throttleInterval.set(universe, minIntervalMs)
    else this._throttleInterval.delete(universe)
  }

  setDriverType(driverType: string): void {
    const interval = driverType === 'open-dmx' || driverType === 'generic' ? THROTTLE_OPEN_DMX_MS : 0
    for (const universe of this._universeDeviceMap.keys()) {
      if (interval > 0) this._throttleInterval.set(universe, interval)
      else this._throttleInterval.delete(universe)
    }
  }

  setOutputEnabled(enabled: boolean): void { this._outputEnabled = enabled }

  setManualNodeIds(nodeIds: readonly string[]): void {
    this._manualNodeIds.clear()
    for (let i = 0; i < nodeIds.length; i++) this._manualNodeIds.add(nodeIds[i])
  }

  onVibeChange(): void {
    for (const state of this._kineticState.values()) state[KS_INIT] = 0
  }

  // ═════════════════════════════════════════════════════════════════════════
  // FASE 0: PRE-RESOLVE — Aduana Output Gate
  // ═════════════════════════════════════════════════════════════════════════

  applyOutputGate(arbitrated: Map<NodeId, Record<string, number>>): void {
    if (this._outputEnabled) return
    for (const [nodeId, channels] of arbitrated) {
      if (this._manualNodeIds.has(nodeId)) continue
      this._aduanaBlocks++
      const keys = Object.keys(channels)
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i]
        if (SAFE_CENTER_CHANNELS.has(k)) {
          channels[k] = k === 'targetX' ? 0 : k === 'targetY' ? 1.5 : k === 'targetZ' ? 2.0 : 0.5
        } else {
          channels[k] = 0
        }
      }
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // FASE 1: INTRA-RESOLVE — Kinetic Velocity Clamp
  // ═════════════════════════════════════════════════════════════════════════

  clampKineticVelocity(nodeId: NodeId, panDMX: number, tiltDMX: number): { pan: number; tilt: number } {
    let state = this._kineticState.get(nodeId)
    if (!state) { state = new Float32Array(KS_SLOTS); this._kineticState.set(nodeId, state) }

    const nowMs = this._nowMs

    if (state[KS_INIT] === 0) {
      state[KS_LAST_PAN] = panDMX; state[KS_LAST_TILT] = tiltDMX
      state[KS_LAST_TIME] = nowMs; state[KS_INIT] = 1
      return { pan: panDMX, tilt: tiltDMX }
    }

    const dtMs = nowMs - state[KS_LAST_TIME]
    if (dtMs <= 0 || dtMs > TELEPORT_THRESHOLD_MS) {
      state[KS_LAST_PAN] = panDMX; state[KS_LAST_TILT] = tiltDMX; state[KS_LAST_TIME] = nowMs
      return { pan: panDMX, tilt: tiltDMX }
    }

    const dtSec = dtMs * 0.001
    const lim = VIBE_REV_LIMITS[this._vibeId]
    const maxPan  = Math.min(lim ? lim.pan  : KINETIC_DEFAULT_REV_PAN,  KINETIC_SAFETY_CAP_VEL) * dtSec
    const maxTilt = Math.min(lim ? lim.tilt : KINETIC_DEFAULT_REV_TILT, KINETIC_SAFETY_CAP_VEL) * dtSec

    let dP = panDMX - state[KS_LAST_PAN]
    let dT = tiltDMX - state[KS_LAST_TILT]

    if (dP > maxPan) { dP = maxPan; this._velocityClamps++ }
    else if (dP < -maxPan) { dP = -maxPan; this._velocityClamps++ }
    if (dT > maxTilt) { dT = maxTilt; this._velocityClamps++ }
    else if (dT < -maxTilt) { dT = -maxTilt; this._velocityClamps++ }

    const rP = state[KS_LAST_PAN] + dP
    const rT = state[KS_LAST_TILT] + dT
    state[KS_LAST_PAN] = rP; state[KS_LAST_TILT] = rT; state[KS_LAST_TIME] = nowMs

    return {
      pan:  rP < 0 ? 0 : rP > 255 ? 255 : Math.round(rP),
      tilt: rT < 0 ? 0 : rT > 255 ? 255 : Math.round(rT),
    }
  }

  clampKineticSingleAxis(nodeId: NodeId, isPan: boolean, dmxValue: number): number {
    let state = this._kineticState.get(nodeId)
    if (!state) { state = new Float32Array(KS_SLOTS); this._kineticState.set(nodeId, state) }

    const nowMs = this._nowMs
    const slot = isPan ? KS_LAST_PAN : KS_LAST_TILT

    if (state[KS_INIT] === 0) {
      state[KS_LAST_PAN] = 128; state[KS_LAST_TILT] = 128
      state[KS_LAST_TIME] = nowMs; state[KS_INIT] = 1
      state[slot] = dmxValue; return dmxValue
    }

    const dtMs = nowMs - state[KS_LAST_TIME]
    if (dtMs <= 0 || dtMs > TELEPORT_THRESHOLD_MS) {
      state[slot] = dmxValue; state[KS_LAST_TIME] = nowMs; return dmxValue
    }

    const dtSec = dtMs * 0.001
    const lim = VIBE_REV_LIMITS[this._vibeId]
    const rev = isPan
      ? Math.min(lim ? lim.pan : KINETIC_DEFAULT_REV_PAN, KINETIC_SAFETY_CAP_VEL)
      : Math.min(lim ? lim.tilt : KINETIC_DEFAULT_REV_TILT, KINETIC_SAFETY_CAP_VEL)
    const maxPerFrame = rev * dtSec
    let delta = dmxValue - state[slot]

    if (delta > maxPerFrame) { delta = maxPerFrame; this._velocityClamps++ }
    else if (delta < -maxPerFrame) { delta = -maxPerFrame; this._velocityClamps++ }

    const r = state[slot] + delta
    state[slot] = r; state[KS_LAST_TIME] = nowMs
    return r < 0 ? 0 : r > 255 ? 255 : Math.round(r)
  }

  // ═════════════════════════════════════════════════════════════════════════
  // FASE 1: Pan/Tilt Airbag
  // ═════════════════════════════════════════════════════════════════════════

  applyAirbag(dmxValue: number, isPan: boolean): number {
    const margin = isPan ? PAN_AIRBAG_MARGIN : TILT_AIRBAG_MARGIN
    if (dmxValue < margin) { this._airbagHits++; return margin }
    if (dmxValue > 255 - margin) { this._airbagHits++; return 255 - margin }
    return dmxValue
  }

  applyAirbagPair(panDMX: number, tiltDMX: number): { pan: number; tilt: number } {
    return { pan: this.applyAirbag(panDMX, true), tilt: this.applyAirbag(tiltDMX, false) }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // FASE 1b: DarkSpin — Transit Blackout
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Returns true if dimmer must be forced to 0 (transit blackout active).
   * Woodstock-compliant: uses this._nowMs (performance.now()-based).
   */
  checkDarkSpin(nodeId: NodeId, currentWheelDmx: number, minTransitMs: number, safetyMargin: number = 1.1): boolean {
    let s = this._darkSpinState.get(nodeId)
    if (!s) {
      s = { lastStableWheelDmx: currentWheelDmx, pendingWheelDmx: currentWheelDmx,
            inTransit: false, transitStartMs: 0, transitDurationMs: 0 }
      this._darkSpinState.set(nodeId, s)
      return false
    }

    const now = this._nowMs

    // CHECK 1: Active transit?
    if (s.inTransit) {
      const elapsed = now - s.transitStartMs
      const failSafe = s.transitDurationMs * 2
      if (elapsed >= failSafe) {
        // Fail-safe: stuck transit → force reset
        s.inTransit = false; s.lastStableWheelDmx = s.pendingWheelDmx
      } else if (elapsed < s.transitDurationMs) {
        return true  // Still in blackout
      } else {
        // Transit finished normally
        s.inTransit = false; s.lastStableWheelDmx = s.pendingWheelDmx
      }
    }

    // CHECK 2: New color change?
    if (currentWheelDmx !== s.lastStableWheelDmx) {
      s.inTransit = true
      s.transitStartMs = now
      s.transitDurationMs = Math.round(minTransitMs * safetyMargin)
      s.pendingWheelDmx = currentWheelDmx
      return true  // Blackout starts now
    }

    return false
  }

  // ═════════════════════════════════════════════════════════════════════════
  // FASE 2: POST-RESOLVE — Egress Gate
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Returns true if this universe should be sent to hardware this frame.
   * Checks: virtual-only skip + throttle interval.
   */
  shouldSendUniverse(universe: number): boolean {
    // Virtual-only universes never send
    if (this._virtualOnlyUniverses.has(universe)) return false

    // Throttle check
    const interval = this._throttleInterval.get(universe)
    if (interval && interval > 0) {
      const last = this._lastSendTime.get(universe) ?? 0
      if ((this._nowMs - last) < interval) return false
      this._lastSendTime.set(universe, this._nowMs)
    }

    return true
  }

  // ═════════════════════════════════════════════════════════════════════════
  // TELEMETRY
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Returns telemetry and resets counters. Call ~1Hz.
   */
  consumeTelemetry(): { velocityClamps: number; airbagHits: number; aduanaBlocks: number; darkSpinActive: number } {
    let darkSpinActive = 0
    for (const s of this._darkSpinState.values()) { if (s.inTransit) darkSpinActive++ }
    const result = {
      velocityClamps: this._velocityClamps,
      airbagHits: this._airbagHits,
      aduanaBlocks: this._aduanaBlocks,
      darkSpinActive,
    }
    this._velocityClamps = 0; this._airbagHits = 0; this._aduanaBlocks = 0
    return result
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private _recalcVirtualOnlyUniverses(): void {
    this._virtualOnlyUniverses.clear()
    for (const [universe, deviceIds] of this._universeDeviceMap) {
      let allVirtual = true
      for (const did of deviceIds) {
        if (!this._virtualDeviceIds.has(did)) { allVirtual = false; break }
      }
      if (allVirtual) this._virtualOnlyUniverses.add(universe)
    }
  }
}
