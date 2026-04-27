/**
 * WAVE 3504.4 — ORCHESTRATOR MATH EXTRACTION
 * IntentComposer — Pure effect intent assembly.
 *
 * Extracted from TitanOrchestrator.ts (WAVE 2662 block: "EL ÁRBITRO ABSOLUTO").
 * Converts a CombinedEffectOutput (zone-keyed) into a per-fixture EffectIntentMap
 * that MasterArbiter can consume via setEffectIntents() before each arbitrate().
 *
 * ─── WHAT LIVES HERE ────────────────────────────────────────────────────────
 *  • Zone → fixtureIds resolution (via ZoneMapper.fixtureMatchesZone)
 *  • HSL → RGB conversion (local, no singleton ColorSpaceUtils)
 *  • HTP dimmer merge when the same fixture appears in multiple zones
 *  • Chronos-guard: skip fixtures the timeline playback is painting
 *  • Global fallback: when zoneOverrides is absent, broadcast to all fixtures
 *
 * ─── WHAT DOES NOT LIVE HERE ────────────────────────────────────────────────
 *  • No IPC. No EventEmitter. No singletons.
 *  • No DMX. No HAL. No Arbiter state.
 *  • All external data (effects, fixtures, protected IDs) enters as parameters.
 */

import { fixtureMatchesZone } from '../../zones/ZoneMapper'
import type { EffectIntent } from '../../arbiter/types'
import type {
  EffectIntentMap,
  CombinedEffectOutput,
  FixtureSnapshot,
  ChronosProtectedIds,
  IntentCompositionResult,
} from './types'

// ─── CLASS ────────────────────────────────────────────────────────────────────

/**
 * Pure intent composer for the Orchestrator pipeline.
 *
 * Accepts a pre-allocated `EffectIntentMap` buffer to avoid per-frame heap
 * allocations (WAVE 3190 zero-GC convention). Clear it before passing it in.
 *
 * @example
 * ```ts
 * // Composition root (once)
 * const composer = new IntentComposer()
 * const intentBuf: EffectIntentMap = new Map()
 *
 * // Each frame:
 * if (effectOutput.hasActiveEffects) {
 *   intentBuf.clear()
 *   const result = composer.compose(effectOutput, fixtures, chronosIds, intentBuf)
 *   arbiter.setEffectIntents(result.intentMap)
 * }
 * ```
 */
export class IntentComposer {
  /**
   * Build the EffectIntentMap for this frame.
   *
   * @param effectOutput  Combined output from EffectManager.getCombinedOutput().
   * @param fixtures      Snapshot of all loaded fixtures (ZoneMappableFixture-compatible).
   * @param chronosIds    Fixture IDs that Chronos is currently painting (skip them).
   * @param outMap        Pre-allocated Map to write into (caller must .clear() it first).
   *                      Defaults to a fresh Map when omitted.
   * @returns             Composition result including the populated map + telemetry.
   */
  compose(
    effectOutput: CombinedEffectOutput,
    fixtures: readonly FixtureSnapshot[],
    chronosIds: ChronosProtectedIds = new Set(),
    outMap: EffectIntentMap = new Map(),
  ): IntentCompositionResult {
    const mixBus = effectOutput.mixBus ?? 'htp'
    const globalComposition = effectOutput.globalComposition ?? 0

    if (effectOutput.zoneOverrides) {
      this._composeFromZoneOverrides(effectOutput, fixtures, chronosIds, outMap, mixBus, globalComposition)
    } else {
      this._composeGlobalFallback(effectOutput, fixtures, chronosIds, outMap, mixBus, globalComposition)
    }

    return {
      intentMap: outMap,
      intentCount: outMap.size,
      mixBus,
      globalComposition,
    }
  }

  // ─── PRIVATE: ZONE OVERRIDES PATH ───────────────────────────────────────────

  /**
   * WAVE 725 + WAVE 2662: "PINCELES FINOS" — per-zone color/dimmer targeting.
   *
   * Each zone key maps to specific channels. A fixture may be hit by multiple
   * zones; in that case we apply HTP on dimmer and LTP (last zone wins) on color,
   * matching the WAVE 780 blend mode semantics.
   */
  private _composeFromZoneOverrides(
    effectOutput: CombinedEffectOutput,
    fixtures: readonly FixtureSnapshot[],
    chronosIds: ChronosProtectedIds,
    outMap: EffectIntentMap,
    mixBus: 'htp' | 'global',
    globalComposition: number,
  ): void {
    const zoneOverrides = effectOutput.zoneOverrides!

    // WAVE 3190: for...in instead of Object.keys() to avoid intermediate array
    for (const zoneId in zoneOverrides) {
      if (!Object.prototype.hasOwnProperty.call(zoneOverrides, zoneId)) continue
      const zoneData = zoneOverrides[zoneId]

      for (const fixture of fixtures) {
        if (!fixture.id) continue
        if (chronosIds.has(fixture.id)) continue

        const fixtureZone = fixture.zone || ''
        const positionX   = fixture.position?.x ?? 0

        if (!fixtureMatchesZone(fixtureZone, zoneId, positionX)) continue

        // Build raw intent for this zone
        const intent: EffectIntent = {
          mixBus,
          globalComposition,
          overrideMoverShield: effectOutput.overrideMoverShield,
        }

        if (zoneData.color) {
          intent.color = hslToRgb(zoneData.color.h, zoneData.color.s, zoneData.color.l)
        }

        if (zoneData.dimmer !== undefined) {
          intent.dimmer = Math.round(zoneData.dimmer * 255)
        }

        if (zoneData.white !== undefined) {
          intent.white = Math.round(zoneData.white * 255)
        } else if (mixBus === 'global') {
          // WAVE 993: THE IRON CURTAIN — unspecified channels die under global bus
          intent.white = 0
        }

        if (zoneData.amber !== undefined) {
          intent.amber = Math.round(zoneData.amber * 255)
        } else if (mixBus === 'global') {
          intent.amber = 0
        }

        if (zoneData.movement) {
          const m = zoneData.movement
          intent.movement = {
            pan:  m.pan  !== undefined
              ? (m.isAbsolute ? Math.round(m.pan  * 255) : Math.round((m.pan  - 0.5) * 255))
              : undefined,
            tilt: m.tilt !== undefined
              ? (m.isAbsolute ? Math.round(m.tilt * 255) : Math.round((m.tilt - 0.5) * 255))
              : undefined,
            isAbsolute: m.isAbsolute,
          }
        }

        // HTP dimmer merge if another zone already addressed this fixture
        const existing = outMap.get(fixture.id)
        if (existing?.dimmer !== undefined && intent.dimmer !== undefined) {
          intent.dimmer = Math.max(intent.dimmer, existing.dimmer)
        }

        outMap.set(fixture.id, intent)
      }
    }
  }

  // ─── PRIVATE: GLOBAL FALLBACK PATH ──────────────────────────────────────────

  /**
   * Legacy "brocha gorda" path: one color for all affected fixtures.
   * Used when effectOutput.zoneOverrides is absent.
   *
   * WAVE 635 → 993 → 2065 → 2662 lineage.
   */
  private _composeGlobalFallback(
    effectOutput: CombinedEffectOutput,
    fixtures: readonly FixtureSnapshot[],
    chronosIds: ChronosProtectedIds,
    outMap: EffectIntentMap,
    mixBus: 'htp' | 'global',
    globalComposition: number,
  ): void {
    if (effectOutput.dimmerOverride === undefined) return

    const zones = effectOutput.zones ?? []

    // Color: use colorOverride, or fall back to SolarFlare legacy gold
    let color = { r: 255, g: 200, b: 80 }
    if (effectOutput.colorOverride) {
      color = hslToRgb(
        effectOutput.colorOverride.h,
        effectOutput.colorOverride.s,
        effectOutput.colorOverride.l,
      )
    }

    for (const fixture of fixtures) {
      if (!fixture.id) continue
      if (chronosIds.has(fixture.id)) continue

      let shouldApply = false

      if (globalComposition > 0) {
        // globalComposition > 0 → affect ALL fixtures
        shouldApply = true
      } else if (zones.length > 0) {
        const fixtureZone = (fixture.zone || '').toLowerCase()
        const positionX   = fixture.position?.x ?? 0
        for (const zone of zones) {
          if (fixtureMatchesZone(fixtureZone, String(zone), positionX)) {
            shouldApply = true
            break
          }
        }
      }

      if (!shouldApply) continue

      outMap.set(fixture.id, {
        dimmer: Math.round(effectOutput.dimmerOverride * 255),
        color,
        mixBus,
        globalComposition,
        overrideMoverShield: effectOutput.overrideMoverShield,
      })
    }
  }
}

// ─── PRIVATE HELPERS ─────────────────────────────────────────────────────────

/**
 * HSL → RGB conversion (local copy — avoids singleton import).
 *
 * @param h Hue 0-360
 * @param s Saturation 0-100
 * @param l Lightness 0-100
 * @returns RGB 0-255 each channel
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hNorm = h / 360
  const sNorm = s / 100
  const lNorm = l / 100

  if (sNorm === 0) {
    const v = Math.round(lNorm * 255)
    return { r: v, g: v, b: v }
  }

  const q = lNorm < 0.5
    ? lNorm * (1 + sNorm)
    : lNorm + sNorm - lNorm * sNorm
  const p = 2 * lNorm - q

  return {
    r: Math.round(hue2rgb(p, q, hNorm + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hNorm)         * 255),
    b: Math.round(hue2rgb(p, q, hNorm - 1 / 3) * 255),
  }
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}
